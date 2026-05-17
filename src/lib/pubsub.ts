import { createRedisConnection } from './redis'

export const PUBSUB_CHANNELS = {
  BOARD_UPDATE: 'kanban:board-update',
  EVENT_LOG:    'kanban:event-log',
  NOTIFICATION: 'kanban:notification',
} as const

const pub = createRedisConnection()

pub.on('error', (err) => console.error('[PubSub] Publisher error:', err.message))

export function publishBoardUpdate(boardId: string, type: string, payload: unknown): void {
  const message = JSON.stringify({ boardId, type, payload, timestamp: new Date().toISOString() })
  pub.publish(PUBSUB_CHANNELS.BOARD_UPDATE, message).then((receivers) => {
    console.log(`[PubSub] Published ${type} → ${receivers} receiver(s)`)
  }).catch((err) => {
    console.error('[PubSub] Publish error:', err.message)
  })
}

export function publishEventLog(boardId: string, entry: unknown): void {
  void pub.publish(
    PUBSUB_CHANNELS.EVENT_LOG,
    JSON.stringify({ boardId, entry })
  )
}

export function publishNotification(userId: string, notification: unknown): void {
  void pub.publish(
    PUBSUB_CHANNELS.NOTIFICATION,
    JSON.stringify({ userId, notification })
  )
}
