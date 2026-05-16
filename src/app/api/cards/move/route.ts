import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enqueueEvent } from '@/lib/queue'
import { z } from 'zod'
export const dynamic = 'force-dynamic'

// POST /api/cards/move — drag & drop reorder
const MoveCardSchema = z.object({
  cardId: z.string(),
  fromColumnId: z.string(),
  toColumnId: z.string(),
  order: z.number().int(),
  boardId: z.string().default('board-1'),
  userId: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const body = await req.json()
  const parsed = MoveCardSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message, ok: false }, { status: 400 })
  }

  const { cardId, fromColumnId, toColumnId, order, boardId, userId } = parsed.data

  // Update card position + increment version
  const card = await prisma.card.update({
    where: { id: cardId },
    data: {
      columnId: toColumnId,
      order,
      version: { increment: 1 },
    },
  })

  // Reorder other cards in target column
  await prisma.card.updateMany({
    where: {
      columnId: toColumnId,
      id: { not: cardId },
      order: { gte: order },
    },
    data: { order: { increment: 1 } },
  })

  await enqueueEvent(
    'card.moved',
    { cardId, boardId, fromColumnId, toColumnId, order, version: card.version },
    { userId }
  )

  return NextResponse.json({ data: card, ok: true })
}
