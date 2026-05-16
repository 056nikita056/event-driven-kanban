/**
 * BullMQ Event Worker — отдельный процесс.
 * Запуск: npm run worker (tsx watch src/worker.ts)
 * Прод: node dist/worker.js
 */

import 'dotenv/config'
import { Worker, Job } from 'bullmq'
import { prisma } from './lib/prisma'
import { createRedisConnection } from './lib/redis'
import { runAutomation } from './events/automation'
import { emitBoardUpdate, emitEventLog } from './lib/socket'
import type { KanbanJobData, EventType } from './events/types'

const QUEUE_NAME = 'kanban-events'

console.log('[Worker] Starting Kanban event worker...')

const worker = new Worker<KanbanJobData>(
  QUEUE_NAME,
  async (job: Job<KanbanJobData>) => {
    const { eventKey, type, payload, userId } = job.data
    console.log(`[Worker] Processing ${type} | key: ${eventKey}`)

    // 1. Save event to DB (deduplicated by eventKey unique constraint)
    let eventRecord
    try {
      eventRecord = await prisma.event.create({
        data: {
          eventKey,
          type,
          payload: payload as any,
          userId: userId || null,
          status: 'PROCESSING',
        },
      })
    } catch (err: any) {
      if (err.code === 'P2002') {
        // Unique constraint violation = duplicate event, skip
        console.log(`[Worker] Duplicate event skipped: ${eventKey}`)
        return
      }
      throw err
    }

    try {
      // 2. Determine boardId from payload
      const boardId = getBoardId(type as EventType, payload as Record<string, unknown>)

      // 3. Emit real-time update to all board clients
      emitBoardUpdate(boardId, type, payload)

      // 4. Run automation rules
      await runAutomation({
        eventType: type as EventType,
        payload: payload as Record<string, unknown>,
        boardId,
        userId,
      })

      // 5. Mark event as completed
      await prisma.event.update({
        where: { id: eventRecord.id },
        data: { status: 'COMPLETED', processedAt: new Date() },
      })

      // 6. Emit event log for visual event stream
      emitEventLog(boardId, {
        id: eventRecord.id,
        type,
        payload,
        status: 'COMPLETED',
        createdAt: eventRecord.createdAt.toISOString(),
        processedAt: new Date().toISOString(),
      })

      console.log(`[Worker] ✓ ${type} completed`)
    } catch (err: any) {
      // Mark event as failed
      await prisma.event.update({
        where: { id: eventRecord.id },
        data: { status: 'FAILED', error: err?.message || 'Unknown error' },
      })
      console.error(`[Worker] ✗ ${type} failed:`, err)
      throw err
    }
  },
  {
    connection: createRedisConnection(),
    concurrency: 5,
  }
)

worker.on('failed', (job, err) => {
  console.error(`[Worker] Job ${job?.id} failed after all retries:`, err.message)
})

worker.on('error', (err) => {
  console.error('[Worker] Worker error:', err)
})

process.on('SIGTERM', async () => {
  console.log('[Worker] SIGTERM received, shutting down gracefully...')
  await worker.close()
  await prisma.$disconnect()
  process.exit(0)
})

process.on('SIGINT', async () => {
  await worker.close()
  await prisma.$disconnect()
  process.exit(0)
})

// ─── Helper ────────────────────────────────────────────────────────────────────
function getBoardId(type: EventType, payload: Record<string, unknown>): string {
  const boardId = payload.boardId as string | undefined
  if (boardId) return boardId
  return process.env.DEFAULT_BOARD_ID || 'board-1'
}
