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
        // дедупликация: duplicate event — skip
        console.log(`[Worker] Duplicate event skipped: ${eventKey}`)
        return
      }
      throw err
    }

    try {
      const boardId = getBoardId(payload as Record<string, unknown>)

      emitBoardUpdate(boardId, type, payload)

      // запускаем правила автоматизации
      await runAutomation({
        eventType: type as EventType,
        payload: payload as Record<string, unknown>,
        boardId,
        userId,
      })

      await prisma.event.update({
        where: { id: eventRecord.id },
        data: { status: 'COMPLETED', processedAt: new Date() },
      })

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

function getBoardId(payload: Record<string, unknown>): string {
  const boardId = payload.boardId as string | undefined
  if (boardId) return boardId
  return process.env.DEFAULT_BOARD_ID || 'board-1'
}
