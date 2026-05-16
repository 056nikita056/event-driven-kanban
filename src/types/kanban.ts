export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export interface Card {
  id: string
  columnId: string
  title: string
  description?: string | null
  priority: Priority
  tags: string[]
  order: number
  deadline?: string | null
  version: number
  createdAt: string
}

export interface Column {
  id: string
  boardId: string
  name: string
  order: number
  color?: string | null
  wipLimit?: number | null
  cards: Card[]
}

export interface EventLogEntry {
  id: string
  type: string
  payload: unknown
  status: string
  createdAt: string
  processedAt?: string
}

export interface Notification {
  id: string
  type: string
  message: string
  read: boolean
  payload?: unknown
  createdAt: string
}

export interface User {
  id: string
  name: string
  role?: string
}

export type RuleTriggerType = 'card.created' | 'card.moved' | 'tag.added'
export type RuleActionType = 'move_to_column' | 'add_tag' | 'notify'

export interface AutomationRule {
  id: string
  boardId: string
  name: string
  enabled: boolean
  triggerType: RuleTriggerType
  triggerConfig: Record<string, unknown>
  actionType: RuleActionType
  actionConfig: Record<string, unknown>
}
