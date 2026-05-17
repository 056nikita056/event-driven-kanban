import { prisma } from '@/lib/prisma'
import { enqueueEvent } from '@/lib/queue'
import { publishBoardUpdate, publishNotification } from '@/lib/pubsub'
import type { EventType } from './types'

interface AutomationContext {
  eventType: EventType | 'tag.added'
  payload: Record<string, unknown>
  boardId: string
  userId?: string
}

export async function runAutomation(ctx: AutomationContext): Promise<void> {
  const { eventType, payload, boardId, userId } = ctx

  const rules = await prisma.automationRule.findMany({
    where: { boardId, enabled: true, triggerType: eventType },
  })

  for (const rule of rules) {
    const triggerConfig = rule.triggerConfig as Record<string, unknown>
    const actionConfig = rule.actionConfig as Record<string, unknown>

    const matches = checkTrigger(eventType, payload, triggerConfig, userId)
    if (!matches) continue

    console.log(`[Automation] Rule "${rule.name}" triggered`)

    try {
      await executeAction(rule.actionType, actionConfig, payload, boardId, userId)

      await enqueueEvent('rule.triggered', {
        ruleId: rule.id,
        ruleName: rule.name,
        boardId,
        sourceEventType: eventType,
        action: { type: rule.actionType, config: actionConfig },
        affectedCardId: payload.cardId as string | undefined,
      })
    } catch (err) {
      console.error(`[Automation] Rule "${rule.name}" action failed:`, err)
    }
  }
}

function checkTrigger(
  eventType: EventType | 'tag.added',
  payload: Record<string, unknown>,
  config: Record<string, unknown>,
  userId?: string
): boolean {
  if (config.userId && config.userId !== userId) return false

  switch (eventType) {
    case 'card.moved': {
      if (config.toColumnId && payload.toColumnId !== config.toColumnId) return false
      if (config.fromColumnId && payload.fromColumnId !== config.fromColumnId) return false
      return true
    }
    case 'card.created': {
      if (config.priority && payload.priority !== config.priority) return false
      if (config.tag) {
        const tags = payload.tags as string[] || []
        if (!tags.includes(config.tag as string)) return false
      }
      return true
    }
    case 'tag.added': {
      if (config.tag && payload.tag !== config.tag) return false
      return true
    }
    default:
      return true
  }
}

async function executeAction(
  actionType: string,
  config: Record<string, unknown>,
  payload: Record<string, unknown>,
  boardId: string,
  actorUserId?: string
): Promise<void> {
  switch (actionType) {
    case 'move_to_column': {
      const cardId = payload.cardId as string
      const targetColumnId = config.columnId as string
      if (!cardId || !targetColumnId) return

      const card = await prisma.card.findUnique({ where: { id: cardId } })
      if (!card) return
      // loop protection: не двигаем если карточка уже в нужной колонке
      if (card.columnId === targetColumnId) return

      const maxOrder = await prisma.card.aggregate({
        where: { columnId: targetColumnId },
        _max: { order: true },
      })

      const updatedCard = await prisma.card.update({
        where: { id: cardId },
        data: {
          columnId: targetColumnId,
          order: (maxOrder._max.order ?? -1) + 1,
          version: { increment: 1 },
        },
      })

      publishBoardUpdate(boardId, 'card.moved', {
        cardId,
        boardId,
        fromColumnId: card.columnId,
        toColumnId: targetColumnId,
        order: updatedCard.order,
        version: updatedCard.version,
        automated: true,
      })
      break
    }

    case 'add_tag': {
      const cardId = payload.cardId as string
      const tag = config.tag as string
      if (!cardId || !tag) return

      const card = await prisma.card.findUnique({ where: { id: cardId } })
      if (!card) return
      if (card.tags.includes(tag)) return

      const updatedCard = await prisma.card.update({
        where: { id: cardId },
        data: { tags: [...card.tags, tag], version: { increment: 1 } },
      })

      publishBoardUpdate(boardId, 'card.updated', {
        cardId,
        boardId,
        version: updatedCard.version,
        changes: { tags: updatedCard.tags },
        automated: true,
      })
      break
    }

    case 'notify': {
      const cardId = payload.cardId as string
      const targetUserId = config.targetUserId as string | undefined

      const [card, actor, allUsers] = await Promise.all([
        cardId ? prisma.card.findUnique({ where: { id: cardId }, select: { title: true } }) : null,
        actorUserId ? prisma.user.findUnique({ where: { id: actorUserId }, select: { name: true } }) : null,
        prisma.user.findMany({ select: { id: true } }),
      ])

      const actorName = actor?.name || 'Кто-то'
      const cardTitle = card?.title || 'задачу'
      const templateMessage = config.message as string | undefined
      const message = templateMessage
        ? `${actorName}: ${templateMessage}`
        : `${actorName} завершил «${cardTitle}»`

      console.log(`[Automation] notify — actor: ${actorUserId}, allUsers: ${allUsers.map(u => u.id).join(', ')}`)

      const recipients = targetUserId
        ? allUsers.filter((u) => u.id === targetUserId)
        : allUsers.filter((u) => u.id !== actorUserId)

      console.log(`[Automation] recipients: ${recipients.map(u => u.id).join(', ')}`)

      for (const user of recipients) {
        const notif = await prisma.notification.create({
          data: {
            userId: user.id,
            type: 'automation',
            message,
            payload: { boardId, cardId },
          },
        })

        publishNotification(user.id, {
          id: notif.id,
          type: notif.type,
          message: notif.message,
          payload: notif.payload,
          createdAt: notif.createdAt.toISOString(),
        })
      }
      break
    }

    default:
      console.warn(`[Automation] Unknown action type: ${actionType}`)
  }
}
