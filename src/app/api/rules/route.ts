import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'

const DEFAULT_BOARD_ID = process.env.DEFAULT_BOARD_ID || 'board-1'
export const dynamic = 'force-dynamic'

// GET /api/rules?boardId=...
export async function GET(req: NextRequest) {
  const boardId = req.nextUrl.searchParams.get('boardId') || DEFAULT_BOARD_ID

  const rules = await prisma.automationRule.findMany({
    where: { boardId },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({ data: rules, ok: true })
}

// POST /api/rules
const CreateRuleSchema = z.object({
  boardId: z.string().default(DEFAULT_BOARD_ID),
  name: z.string().min(1).max(200),
  triggerType: z.enum(['card.created', 'card.moved', 'tag.added']),
  triggerConfig: z.record(z.unknown()),
  actionType: z.enum(['move_to_column', 'add_tag', 'notify']),
  actionConfig: z.record(z.unknown()),
  enabled: z.boolean().default(true),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = CreateRuleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message, ok: false }, { status: 400 })
    }

    await prisma.board.upsert({
      where: { id: parsed.data.boardId },
      update: {},
      create: { id: parsed.data.boardId, name: 'Main Board' },
    })

    const rule = await prisma.automationRule.create({
      data: {
        id: uuidv4(),
        ...parsed.data,
        triggerConfig: parsed.data.triggerConfig as Prisma.InputJsonValue,
        actionConfig: parsed.data.actionConfig as Prisma.InputJsonValue,
      },
    })

    return NextResponse.json({ data: rule, ok: true }, { status: 201 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message, ok: false }, { status: 500 })
  }
}
