import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enqueueEvent } from '@/lib/queue'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'

const DEFAULT_BOARD_ID = process.env.DEFAULT_BOARD_ID || 'board-1'
export const dynamic = 'force-dynamic'

// GET /api/columns?boardId=...
export async function GET(req: NextRequest) {
  const boardId = req.nextUrl.searchParams.get('boardId') || DEFAULT_BOARD_ID

  const columns = await prisma.column.findMany({
    where: { boardId },
    include: {
      cards: {
        orderBy: { order: 'asc' },
      },
    },
    orderBy: { order: 'asc' },
  })

  return NextResponse.json({ data: columns, ok: true })
}

// POST /api/columns
const CreateColumnSchema = z.object({
  boardId: z.string().default(DEFAULT_BOARD_ID),
  name: z.string().min(1).max(100),
  color: z.string().optional(),
  wipLimit: z.number().int().nullable().optional(),
  userId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = CreateColumnSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message, ok: false }, { status: 400 })
  }

  const { boardId, name, color, wipLimit, userId } = parsed.data

  await prisma.board.upsert({
    where: { id: boardId },
    update: {},
    create: { id: boardId, name: 'Main Board' },
  })

  const maxOrder = await prisma.column.aggregate({
    where: { boardId },
    _max: { order: true },
  })
  const order = (maxOrder._max.order ?? -1) + 1
  const columnId = uuidv4()

  const column = await prisma.column.create({
    data: { id: columnId, boardId, name, color, wipLimit, order },
  })

  await enqueueEvent('column.created', { columnId, boardId, name, order, color }, { userId })

  return NextResponse.json({ data: column, ok: true }, { status: 201 })
}
