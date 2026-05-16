/**
 * Custom Next.js server with Socket.io attached.
 * Run: tsx server.ts (dev) or node dist/server.js (prod)
 *
 * This is needed because Socket.io requires access to the raw http.Server,
 * which App Router API routes don't expose.
 */

import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { Server as SocketIOServer } from 'socket.io'
import { setSocketServer } from './src/lib/socket'
import type { ServerToClientEvents, ClientToServerEvents } from './src/events/types'

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOST || 'localhost'
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

  // Attach Socket.io
  const io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  })

  setSocketServer(io)

  io.on('connection', (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`)

    socket.on('board:join', (boardId: string) => {
      socket.join(`board:${boardId}`)
      console.log(`[Socket.io] ${socket.id} joined board:${boardId}`)
    })

    socket.on('board:leave', (boardId: string) => {
      socket.leave(`board:${boardId}`)
    })

    socket.on('disconnect', () => {
      console.log(`[Socket.io] Client disconnected: ${socket.id}`)
    })
  })

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
    console.log(`> Socket.io listening on same port`)
  })
})
