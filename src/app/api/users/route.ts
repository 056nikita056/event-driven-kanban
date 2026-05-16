import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
export const dynamic = 'force-dynamic'

// GET /api/users — list all users (for the user selector)
export async function GET() {
  const users = await prisma.user.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, role: true },
  })

  return NextResponse.json({ data: users, ok: true })
}
