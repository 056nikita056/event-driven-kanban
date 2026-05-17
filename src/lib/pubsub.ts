import { createRedisConnection } from './redis'
import type Redis from 'ioredis'

export const PUBSUB_CHANNELS = {
  BOARD_UPDATE: 'kanban:board-update',
  EVENT_LOG:    'kanban:event-log',
  NOTIFICATION: 'kanban:notification',
} as const

const globalForPubSub = globalThis as unknown as {
  pubsubPublisher: Redis | undefined
}

function getPublisher(): Redis {
  if (!globalForPubSub.pubsubPublisher) {
    globalForPubSub.pubsubPublisher = createRedisConnection()
    globalForPubSub.pubsubPublisher.on('error', (err) => {
      console.error('[PubSub] Publisher error:', err.message)
    })
  }

  return globalForPubSub.pubsubPublisher
}

export function publishBoardUpdate(boardId: string, type: string, payload: unknown): void {
  const message = JSON.stringify({ boardId, type, payload, timestamp: new Date().toISOString() })
  getPublisher().publish(PUBSUB_CHANNELS.BOARD_UPDATE, message).then((receivers) => {
    console.log(`[PubSub] Published ${type} → ${receivers} receiver(s)`)
  }).catch((err) => {
    console.error('[PubSub] Publish error:', err.message)
  })
}

export function publishEventLog(boardId: string, entry: unknown): void {
  void getPublisher().publish(
    PUBSUB_CHANNELS.EVENT_LOG,
    JSON.stringify({ boardId, entry })
  )
}

export function publishNotification(userId: string, notification: unknown): void {
  void getPublisher().publish(
    PUBSUB_CHANNELS.NOTIFICATION,
    JSON.stringify({ userId, notification })
  )
}
