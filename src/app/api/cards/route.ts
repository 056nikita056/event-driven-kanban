import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enqueueEvent } from '@/lib/queue'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'

const DEFAULT_BOARD_ID = process.env.DEFAULT_BOARD_ID || 'board-1'
export const dynamic = 'force-dynamic'

// GET /api/cards?columnId=...
export async function GET(req: NextRequest) {
  const columnId = req.nextUrl.searchParams.get('columnId')
  const boardId = req.nextUrl.searchParams.get('boardId') || DEFAULT_BOARD_ID

  const cards = await prisma.card.findMany({
    where: columnId ? { columnId } : { column: { boardId } },
    orderBy: { order: 'asc' },
  })

  return NextResponse.json({ data: cards, ok: true })
}

// POST /api/cards
const CreateCardSchema = z.object({
  columnId: z.string(),
  boardId: z.string().default(DEFAULT_BOARD_ID),
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  tags: z.array(z.string()).default([]),
  deadline: z.string().datetime().optional(),
  userId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = CreateCardSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message, ok: false }, { status: 400 })
  }

  const { userId, boardId, ...cardData } = parsed.data

  const maxOrder = await prisma.card.aggregate({
    where: { columnId: cardData.columnId },
    _max: { order: true },
  })
  const order = (maxOrder._max.order ?? -1) + 1
  const cardId = uuidv4()

  const card = await prisma.card.create({
    data: {
      id: cardId,
      ...cardData,
      order,
      deadline: cardData.deadline ? new Date(cardData.deadline) : undefined,
    },
  })

  await enqueueEvent(
    'card.created',
    { cardId, columnId: cardData.columnId, boardId, title: cardData.title, priority: cardData.priority, tags: cardData.tags, order },
    { userId }
  )

  return NextResponse.json({ data: card, ok: true }, { status: 201 })
}
