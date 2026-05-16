import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
export const dynamic = 'force-dynamic'

// PATCH /api/rules/:id
const UpdateRuleSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  enabled: z.boolean().optional(),
  triggerType: z.enum(['card.created', 'card.moved', 'tag.added']).optional(),
  triggerConfig: z.record(z.unknown()).optional(),
  actionType: z.enum(['move_to_column', 'add_tag', 'notify']).optional(),
  actionConfig: z.record(z.unknown()).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json()
  const parsed = UpdateRuleSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message, ok: false }, { status: 400 })
  }

  const rule = await prisma.automationRule.update({
    where: { id: params.id },
    data: {
      ...parsed.data,
      triggerConfig: parsed.data.triggerConfig as Prisma.InputJsonValue | undefined,
      actionConfig: parsed.data.actionConfig as Prisma.InputJsonValue | undefined,
    },
  })

  return NextResponse.json({ data: rule, ok: true })
}

// DELETE /api/rules/:id
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await prisma.automationRule.delete({ where: { id: params.id } })
  return NextResponse.json({ data: { id: params.id }, ok: true })
}
