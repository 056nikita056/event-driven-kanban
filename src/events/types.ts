import { z } from 'zod'

// ─── Priority & Status enums ──────────────────────────────────────────────────
export const PrioritySchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT'])
export type Priority = z.infer<typeof PrioritySchema>

export const EventStatusSchema = z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'])
export type EventStatus = z.infer<typeof EventStatusSchema>

// ─── Base event envelope ──────────────────────────────────────────────────────
export const BaseEventSchema = z.object({
  eventKey: z.string().min(1),  // unique key for dedup — e.g. `card.created:${cardId}:${Date.now()}`
  type: z.string(),
  userId: z.string().optional(),
  createdAt: z.string().datetime().optional(),
})

// ─── Event payloads ───────────────────────────────────────────────────────────

export const CardCreatedPayloadSchema = z.object({
  cardId: z.string(),
  columnId: z.string(),
  boardId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  priority: PrioritySchema.default('MEDIUM'),
  tags: z.array(z.string()).default([]),
  deadline: z.string().datetime().optional(),
  order: z.number().int(),
})
export type CardCreatedPayload = z.infer<typeof CardCreatedPayloadSchema>

export const CardUpdatedPayloadSchema = z.object({
  cardId: z.string(),
  boardId: z.string(),
  version: z.number().int(),
  changes: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    priority: PrioritySchema.optional(),
    tags: z.array(z.string()).optional(),
    deadline: z.string().datetime().nullable().optional(),
    columnId: z.string().optional(),
  }),
})
export type CardUpdatedPayload = z.infer<typeof CardUpdatedPayloadSchema>

export const CardMovedPayloadSchema = z.object({
  cardId: z.string(),
  boardId: z.string(),
  fromColumnId: z.string(),
  toColumnId: z.string(),
  order: z.number().int(),
  version: z.number().int(),
})
export type CardMovedPayload = z.infer<typeof CardMovedPayloadSchema>

export const CardDeletedPayloadSchema = z.object({
  cardId: z.string(),
  boardId: z.string(),
  columnId: z.string(),
})
export type CardDeletedPayload = z.infer<typeof CardDeletedPayloadSchema>

export const ColumnCreatedPayloadSchema = z.object({
  columnId: z.string(),
  boardId: z.string(),
  name: z.string(),
  order: z.number().int(),
  color: z.string().optional(),
})
export type ColumnCreatedPayload = z.infer<typeof ColumnCreatedPayloadSchema>

export const ColumnUpdatedPayloadSchema = z.object({
  columnId: z.string(),
  boardId: z.string(),
  changes: z.object({
    name: z.string().optional(),
    color: z.string().optional(),
    wipLimit: z.number().int().nullable().optional(),
    order: z.number().int().optional(),
  }),
})
export type ColumnUpdatedPayload = z.infer<typeof ColumnUpdatedPayloadSchema>

export const ColumnDeletedPayloadSchema = z.object({
  columnId: z.string(),
  boardId: z.string(),
})
export type ColumnDeletedPayload = z.infer<typeof ColumnDeletedPayloadSchema>

export const RuleTriggeredPayloadSchema = z.object({
  ruleId: z.string(),
  ruleName: z.string(),
  boardId: z.string(),
  sourceEventType: z.string(),
  action: z.object({
    type: z.string(),
    config: z.record(z.unknown()),
  }),
  affectedCardId: z.string().optional(),
})
export type RuleTriggeredPayload = z.infer<typeof RuleTriggeredPayloadSchema>

// ─── Typed event union ────────────────────────────────────────────────────────
export const KanbanEventSchema = z.discriminatedUnion('type', [
  BaseEventSchema.extend({ type: z.literal('card.created'), payload: CardCreatedPayloadSchema }),
  BaseEventSchema.extend({ type: z.literal('card.updated'), payload: CardUpdatedPayloadSchema }),
  BaseEventSchema.extend({ type: z.literal('card.moved'), payload: CardMovedPayloadSchema }),
  BaseEventSchema.extend({ type: z.literal('card.deleted'), payload: CardDeletedPayloadSchema }),
  BaseEventSchema.extend({ type: z.literal('column.created'), payload: ColumnCreatedPayloadSchema }),
  BaseEventSchema.extend({ type: z.literal('column.updated'), payload: ColumnUpdatedPayloadSchema }),
  BaseEventSchema.extend({ type: z.literal('column.deleted'), payload: ColumnDeletedPayloadSchema }),
  BaseEventSchema.extend({ type: z.literal('rule.triggered'), payload: RuleTriggeredPayloadSchema }),
])
export type KanbanEvent = z.infer<typeof KanbanEventSchema>

export type EventType = KanbanEvent['type']

// ─── BullMQ job data ──────────────────────────────────────────────────────────
export interface KanbanJobData {
  eventKey: string
  type: EventType
  payload: unknown
  userId?: string
}

// ─── Socket.io events (client ↔ server) ──────────────────────────────────────
// Server → Client
export interface ServerToClientEvents {
  'board:update': (event: {
    type: EventType
    payload: unknown
    boardId: string
    timestamp: string
  }) => void
  'notification:new': (notification: {
    id: string
    type: string
    message: string
    payload?: unknown
    createdAt: string
  }) => void
  'event:log': (entry: {
    id: string
    type: EventType
    payload: unknown
    status: EventStatus
    createdAt: string
    processedAt?: string
  }) => void
}

// Client → Server
export interface ClientToServerEvents {
  'board:join': (boardId: string) => void
  'board:leave': (boardId: string) => void
}

// ─── API response types ───────────────────────────────────────────────────────
export interface ApiSuccess<T> {
  data: T
  ok: true
}

export interface ApiError {
  error: string
  ok: false
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError

// ─── Helper to create eventKey ────────────────────────────────────────────────
export function makeEventKey(type: EventType, id: string): string {
  return `${type}:${id}:${Date.now()}`
}
