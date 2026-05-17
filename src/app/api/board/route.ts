import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

const DEFAULT_BOARD_ID = process.env.DEFAULT_BOARD_ID || 'board-1'
export const dynamic = 'force-dynamic'

// GET /api/board — full board state (columns + cards)
export async function GET(req: NextRequest) {
  const boardId = req.nextUrl.searchParams.get('boardId') || DEFAULT_BOARD_ID

  const board = await prisma.board.upsert({
    where: { id: boardId },
    update: {},
    create: { id: boardId, name: 'Main Board' },
    include: {
      columns: {
        orderBy: { order: 'asc' },
        include: {
          cards: {
            orderBy: { order: 'asc' },
          },
        },
      },
    },
  })

  return NextResponse.json({ data: board, ok: true })
}
