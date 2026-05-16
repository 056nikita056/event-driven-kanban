'use client'

import { Edit3, MoveRight, Sparkles, Trash2, X, Zap } from 'lucide-react'

import type { EventLogEntry } from '@/types/kanban'
import { formatTime, cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface EventLogPanelProps {
  events: EventLogEntry[]
  isOpen: boolean
  onClose: () => void
}

const eventIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  'card.created': Sparkles,
  'card.moved': MoveRight,
  'card.updated': Edit3,
  'card.deleted': Trash2,
  'column.created': Sparkles,
  'column.deleted': Trash2,
  'rule.triggered': Zap,
}

const eventLabels: Record<string, string> = {
  'card.created': 'Карточка создана',
  'card.moved': 'Карточка перемещена',
  'card.updated': 'Карточка обновлена',
  'card.deleted': 'Карточка удалена',
  'column.created': 'Колонка создана',
  'column.deleted': 'Колонка удалена',
  'rule.triggered': 'Правило сработало',
}

export function EventLogPanel({ events, isOpen, onClose }: EventLogPanelProps) {
  return (
    <div
      className={cn(
        'fixed right-0 top-0 z-40 h-full w-[350px] border-l border-slate-200 bg-white/95 shadow-2xl backdrop-blur-xl transition-transform duration-300',
        isOpen ? 'translate-x-0' : 'translate-x-full'
      )}
    >
      <div className="flex items-center justify-between border-b border-slate-200 p-4">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-indigo-600" />
          <h3 className="text-base font-semibold">Лента событий</h3>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="text-xs font-medium text-emerald-600">LIVE</span>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="h-[calc(100vh-73px)] space-y-2 overflow-y-auto p-4">
        {events.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
            <Zap className="mb-3 h-12 w-12 opacity-20" />
            <p className="text-sm">Пока нет событий</p>
          </div>
        ) : (
          events.slice(0, 50).map((event, index) => {
            const Icon = eventIcons[event.type] || Sparkles
            const label = eventLabels[event.type] || event.type
            const payload = event.payload as Record<string, unknown>

            return (
              <div
                key={event.id}
                className={cn(
                  'rounded-2xl border border-slate-200 bg-white/70 p-3 shadow-sm transition-all',
                  index === 0 && 'event-entry'
                )}
              >
                <div className="flex items-start gap-3">
                  <Icon className="mt-0.5 h-4 w-4 text-slate-500" />
                  <div className="min-w-0 flex-1">
                    <p className="mb-1 text-sm font-medium">{label}</p>
                    {'title' in payload && typeof payload.title === 'string' && (
                      <p className="truncate text-xs text-muted-foreground">{payload.title}</p>
                    )}
                    {'ruleName' in payload && typeof payload.ruleName === 'string' && (
                      <p className="truncate text-xs text-muted-foreground">{payload.ruleName}</p>
                    )}
                    {'fromColumnId' in payload && 'toColumnId' in payload && (
                      <p className="text-xs text-muted-foreground">
                        {String(payload.fromColumnId)} → {String(payload.toColumnId)}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">{formatTime(event.createdAt)}</p>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
