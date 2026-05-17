export type EventType =
  | 'card.created'
  | 'card.updated'
  | 'card.moved'
  | 'card.deleted'
  | 'column.created'
  | 'column.updated'
  | 'column.deleted'
  | 'rule.triggered'

export interface KanbanJobData {
  eventKey: string
  type: EventType
  payload: unknown
  userId?: string
}

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
    status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
    createdAt: string
    processedAt?: string
  }) => void
}

export interface ClientToServerEvents {
  'board:join': (boardId: string) => void
  'board:leave': (boardId: string) => void
  'user:join': (userId: string) => void
  'user:leave': (userId: string) => void
}

export function makeEventKey(type: EventType, id: string): string {
  return `${type}:${id}:${Date.now()}`
}
