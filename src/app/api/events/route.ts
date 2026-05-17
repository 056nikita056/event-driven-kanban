import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'

// GET /api/events?boardId=board-1&limit=50
export async function GET(req: NextRequest) {
  const boardId = req.nextUrl.searchParams.get('boardId') || 'board-1'
  const limit = Math.min(Number(req.nextUrl.searchParams.get('limit') || '50'), 100)

  const events = await prisma.event.findMany({
    where: {
      payload: {
        path: ['boardId'],
        equals: boardId,
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return NextResponse.json({ data: events, ok: true })
}
