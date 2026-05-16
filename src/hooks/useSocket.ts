/**
 * Socket.io client hook — подключается к серверу и слушает события доски.
 */

'use client'

import { useEffect, useRef, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'
import type { ServerToClientEvents, ClientToServerEvents } from '@/events/types'

type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>

let socket: TypedSocket | null = null

function getSocket(): TypedSocket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || '', {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
    })
  }
  return socket
}

interface UseSocketOptions {
  boardId: string
  onBoardUpdate?: (event: { type: string; payload: unknown; boardId: string; timestamp: string }) => void
  onNotification?: (notification: { id: string; type: string; message: string; payload?: unknown; createdAt: string }) => void
  onEventLog?: (entry: { id: string; type: string; payload: unknown; status: string; createdAt: string; processedAt?: string }) => void
}

export function useSocket({ boardId, onBoardUpdate, onNotification, onEventLog }: UseSocketOptions) {
  const onBoardUpdateRef = useRef(onBoardUpdate)
  const onNotificationRef = useRef(onNotification)
  const onEventLogRef = useRef(onEventLog)

  useEffect(() => { onBoardUpdateRef.current = onBoardUpdate }, [onBoardUpdate])
  useEffect(() => { onNotificationRef.current = onNotification }, [onNotification])
  useEffect(() => { onEventLogRef.current = onEventLog }, [onEventLog])

  useEffect(() => {
    const s = getSocket()

    s.emit('board:join', boardId)

    const handleBoardUpdate: ServerToClientEvents['board:update'] = (event) => {
      onBoardUpdateRef.current?.(event)
    }

    const handleNotification: ServerToClientEvents['notification:new'] = (notification) => {
      onNotificationRef.current?.(notification)
    }

    const handleEventLog: ServerToClientEvents['event:log'] = (entry) => {
      onEventLogRef.current?.(entry as any)
    }

    s.on('board:update', handleBoardUpdate)
    s.on('notification:new', handleNotification)
    s.on('event:log', handleEventLog)

    return () => {
      s.off('board:update', handleBoardUpdate)
      s.off('notification:new', handleNotification)
      s.off('event:log', handleEventLog)
      s.emit('board:leave', boardId)
    }
  }, [boardId])

  return { socket: getSocket() }
}
