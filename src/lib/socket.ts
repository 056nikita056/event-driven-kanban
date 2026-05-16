/**
 * Socket.io singleton for Next.js API route.
 *
 * Usage in API route:
 *   import { getIO } from '@/lib/socket'
 *   const io = await getIO(res)  // only works with custom server
 *
 * Since Next.js App Router doesn't expose raw http.Server,
 * we run Socket.io on a separate port via the custom server (server.ts).
 * The io instance is shared via globalThis.
 */

import { Server as SocketIOServer } from 'socket.io'
import type { ServerToClientEvents, ClientToServerEvents } from '@/events/types'

export type TypedServer = SocketIOServer<ClientToServerEvents, ServerToClientEvents>

const globalForSocket = globalThis as unknown as {
  io: TypedServer | undefined
}

export function getSocketServer(): TypedServer | undefined {
  return globalForSocket.io
}

export function setSocketServer(io: TypedServer): void {
  globalForSocket.io = io
  console.log('[Socket.io] Server registered globally')
}

/**
 * Emit a board update to all clients watching that board.
 */
export function emitBoardUpdate(
  boardId: string,
  type: string,
  payload: unknown
): void {
  const io = getSocketServer()
  if (!io) {
    console.warn('[Socket.io] No server — skipping emit')
    return
  }

  io.to(`board:${boardId}`).emit('board:update', {
    type: type as any,
    payload,
    boardId,
    timestamp: new Date().toISOString(),
  })
}

/**
 * Emit a notification to a specific user's room.
 */
export function emitNotification(
  userId: string,
  notification: {
    id: string
    type: string
    message: string
    payload?: unknown
    createdAt: string
  }
): void {
  const io = getSocketServer()
  if (!io) return

  io.to(`user:${userId}`).emit('notification:new', notification)
}

/**
 * Emit an event log entry to all clients on a board.
 */
export function emitEventLog(
  boardId: string,
  entry: {
    id: string
    type: string
    payload: unknown
    status: string
    createdAt: string
    processedAt?: string
  }
): void {
  const io = getSocketServer()
  if (!io) return

  io.to(`board:${boardId}`).emit('event:log', entry as any)
}
