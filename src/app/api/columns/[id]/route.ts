import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enqueueEvent } from '@/lib/queue'
import { z } from 'zod'
export const dynamic = 'force-dynamic'

// PATCH /api/columns/:id
const UpdateColumnSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  color: z.string().optional(),
  wipLimit: z.number().int().nullable().optional(),
  order: z.number().int().optional(),
  userId: z.string().optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json()
  const parsed = UpdateColumnSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message, ok: false }, { status: 400 })
  }

  const { userId, ...changes } = parsed.data

  const column = await prisma.column.update({
    where: { id: params.id },
    data: changes,
  })

  await enqueueEvent(
    'column.updated',
    { columnId: params.id, boardId: column.boardId, changes },
    { userId }
  )

  return NextResponse.json({ data: column, ok: true })
}

// DELETE /api/columns/:id
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = req.nextUrl.searchParams.get('userId') || undefined

  const column = await prisma.column.findUnique({ where: { id: params.id } })
  if (!column) {
    return NextResponse.json({ error: 'Column not found', ok: false }, { status: 404 })
  }

  await prisma.column.delete({ where: { id: params.id } })

  await enqueueEvent(
    'column.deleted',
    { columnId: params.id, boardId: column.boardId },
    { userId }
  )

  return NextResponse.json({ data: { id: params.id }, ok: true })
}
