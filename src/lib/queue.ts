import { Queue } from 'bullmq'
import { createRedisConnection } from './redis'
import type { KanbanJobData, EventType } from '@/events/types'
import { makeEventKey } from '@/events/types'
import { v4 as uuidv4 } from 'uuid'

export const QUEUE_NAME = 'kanban-events'

const globalForQueue = globalThis as unknown as {
  kanbanQueue: Queue<KanbanJobData> | undefined
}

export const kanbanQueue: Queue<KanbanJobData> =
  globalForQueue.kanbanQueue ??
  new Queue<KanbanJobData>(QUEUE_NAME, {
    connection: createRedisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: { count: 100 },
      removeOnFail: { count: 50 },
    },
  })

if (process.env.NODE_ENV !== 'production') globalForQueue.kanbanQueue = kanbanQueue

export async function enqueueEvent(
  type: EventType,
  payload: unknown,
  options?: {
    userId?: string
    eventKey?: string
    deduplicationId?: string
  }
): Promise<string> {
  const id = uuidv4()
  const eventKey = options?.eventKey ?? makeEventKey(type, id)

  const jobData: KanbanJobData = {
    eventKey,
    type,
    payload,
    userId: options?.userId,
  }

  await kanbanQueue.add(type, jobData, {
    jobId: eventKey,
  })

  console.log(`[Queue] Enqueued ${type} | key: ${eventKey}`)
  return eventKey
}
