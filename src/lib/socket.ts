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

  // emit to all clients in board room
  io.to(`board:${boardId}`).emit('board:update', {
    type: type as any,
    payload,
    boardId,
    timestamp: new Date().toISOString(),
  })
}

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
