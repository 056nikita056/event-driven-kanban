import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enqueueEvent } from '@/lib/queue'
import { z } from 'zod'
export const dynamic = 'force-dynamic'

// GET /api/cards/:id
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const card = await prisma.card.findUnique({ where: { id: params.id } })
  if (!card) {
    return NextResponse.json({ error: 'Card not found', ok: false }, { status: 404 })
  }
  return NextResponse.json({ data: card, ok: true })
}

// PATCH /api/cards/:id
const UpdateCardSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().nullable().optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  tags: z.array(z.string()).optional(),
  deadline: z.string().datetime().nullable().optional(),
  version: z.number().int().optional(), // for optimistic locking check
  boardId: z.string().optional(),
  userId: z.string().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json()
  const parsed = UpdateCardSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message, ok: false }, { status: 400 })
  }

  const { userId, boardId, version: clientVersion, ...changes } = parsed.data

  // Optimistic locking check
  if (clientVersion !== undefined) {
    const current = await prisma.card.findUnique({
      where: { id: params.id },
      select: { version: true },
    })
    if (!current) {
      return NextResponse.json({ error: 'Card not found', ok: false }, { status: 404 })
    }
    if (current.version !== clientVersion) {
      return NextResponse.json(
        { error: 'Conflict: card was modified by someone else', ok: false },
        { status: 409 }
      )
    }
  }

  const card = await prisma.card.update({
    where: { id: params.id },
    data: {
      ...changes,
      deadline: changes.deadline === null ? null : changes.deadline ? new Date(changes.deadline) : undefined,
      version: { increment: 1 },
    },
  })

  const resolvedBoardId = boardId || (await prisma.column.findUnique({
    where: { id: card.columnId },
    select: { boardId: true },
  }))?.boardId || 'board-1'

  await enqueueEvent(
    'card.updated',
    { cardId: params.id, boardId: resolvedBoardId, version: card.version, changes },
    { userId }
  )

  return NextResponse.json({ data: card, ok: true })
}

// DELETE /api/cards/:id
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = req.nextUrl.searchParams.get('userId') || undefined
  const boardId = req.nextUrl.searchParams.get('boardId') || 'board-1'

  const card = await prisma.card.findUnique({ where: { id: params.id } })
  if (!card) {
    return NextResponse.json({ error: 'Card not found', ok: false }, { status: 404 })
  }

  await prisma.card.delete({ where: { id: params.id } })

  await enqueueEvent(
    'card.deleted',
    { cardId: params.id, boardId, columnId: card.columnId },
    { userId }
  )

  return NextResponse.json({ data: { id: params.id }, ok: true })
}
