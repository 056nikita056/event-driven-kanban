import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { Server as SocketIOServer } from 'socket.io'
import { setSocketServer } from './src/lib/socket'
import { createRedisConnection } from './src/lib/redis'
import { PUBSUB_CHANNELS } from './src/lib/pubsub'
import type { ServerToClientEvents, ClientToServerEvents } from './src/events/types'

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOST || process.env.HOSTNAME || '0.0.0.0'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling request', req.url, err)
      res.statusCode = 500
      res.end('Internal Server Error')
    }
  })

  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: [
        process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
      ],
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  })

  setSocketServer(io)

  // Subscribe to Redis pub/sub — bridge between worker process and Socket.io
  const sub = createRedisConnection()
  sub.subscribe(
    PUBSUB_CHANNELS.BOARD_UPDATE,
    PUBSUB_CHANNELS.EVENT_LOG,
    PUBSUB_CHANNELS.NOTIFICATION
  ).then(() => {
    console.log('[PubSub] Server subscribed to Redis channels')
  }).catch((err) => {
    console.error('[PubSub] Subscribe error:', err.message)
  })

  sub.on('message', (channel, message) => {
    console.log(`[PubSub] Received on ${channel}`)
    try {
      const data = JSON.parse(message)
      if (channel === PUBSUB_CHANNELS.BOARD_UPDATE) {
        io.to(`board:${data.boardId}`).emit('board:update', {
          type: data.type,
          payload: data.payload,
          boardId: data.boardId,
          timestamp: data.timestamp,
        })
      } else if (channel === PUBSUB_CHANNELS.EVENT_LOG) {
        io.to(`board:${data.boardId}`).emit('event:log', data.entry)
      } else if (channel === PUBSUB_CHANNELS.NOTIFICATION) {
        io.to(`user:${data.userId}`).emit('notification:new', data.notification)
      }
    } catch (err) {
      console.error('[PubSub] Failed to handle message:', err)
    }
  })

  io.on('connection', (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`)

    socket.on('board:join', (boardId: string) => {
      socket.join(`board:${boardId}`)
      console.log(`[Socket.io] ${socket.id} joined board:${boardId}`)
    })

    socket.on('board:leave', (boardId: string) => {
      socket.leave(`board:${boardId}`)
    })

    socket.on('user:join', (userId: string) => {
      socket.join(`user:${userId}`)
      console.log(`[Socket.io] ${socket.id} joined user:${userId}`)
    })

    socket.on('user:leave', (userId: string) => {
      socket.leave(`user:${userId}`)
      console.log(`[Socket.io] ${socket.id} left user:${userId}`)
    })

    socket.on('disconnect', () => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}`)
    })
  })

  httpServer.listen(port, () => {
    // Socket.io attached to same port as Next.js
    console.log(`> Ready on http://${hostname}:${port}`)
    console.log(`> Socket.io listening on same port`)
  })
})
