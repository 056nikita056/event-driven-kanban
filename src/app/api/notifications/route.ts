import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
export const dynamic = 'force-dynamic'

// GET /api/notifications?userId=...
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId')
  if (!userId) {
    return NextResponse.json({ error: 'userId required', ok: false }, { status: 400 })
  }

  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })

  return NextResponse.json({ data: notifications, ok: true })
}

// PATCH /api/notifications — mark as read
const MarkReadSchema = z.object({
  ids: z.array(z.string()).optional(),
  userId: z.string(),
  all: z.boolean().default(false),
})

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const parsed = MarkReadSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message, ok: false }, { status: 400 })
  }

  const { ids, userId, all } = parsed.data

  if (all) {
    await prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    })
  } else if (ids && ids.length > 0) {
    await prisma.notification.updateMany({
      where: { id: { in: ids }, userId },
      data: { read: true },
    })
  }

  return NextResponse.json({ data: { ok: true }, ok: true })
}
