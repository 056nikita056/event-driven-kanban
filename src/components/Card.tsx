'use client'

import { CSS } from '@dnd-kit/utilities'
import { useSortable } from '@dnd-kit/sortable'
import { Calendar, GripVertical, Tag } from 'lucide-react'

import type { Card as CardData, Priority } from '@/types/kanban'
import { PRIORITY_LABELS, cn, formatDeadline, isOverdue } from '@/lib/utils'

interface CardProps {
  card: CardData
  onClick?: (card: CardData) => void
  isDragOverlay?: boolean
}

const priorityColors: Record<Priority, string> = {
  LOW: 'border-green-200 bg-green-50 text-green-700',
  MEDIUM: 'border-amber-200 bg-amber-50 text-amber-700',
  HIGH: 'border-red-200 bg-red-50 text-red-700',
  URGENT: 'border-violet-200 bg-violet-50 text-violet-700',
}

export function KanbanCard({ card, onClick, isDragOverlay = false }: CardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: card.id, data: { type: 'card', card } })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const overdue = isOverdue(card.deadline)

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative cursor-pointer rounded-2xl border border-slate-200 bg-white p-3 pl-11 shadow-sm transition-all duration-200',
        'hover:-translate-y-0.5 hover:shadow-lg',
        isDragging && 'rotate-2 scale-[1.02] opacity-60 shadow-2xl',
        isDragOverlay && 'rotate-2 scale-105 shadow-2xl'
      )}
      onClick={() => onClick?.(card)}
    >
      <div
        {...attributes}
        {...listeners}
        className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-4 w-4" />
      </div>

      <div className="space-y-2.5">
        <h4 className="line-clamp-2 text-sm font-medium leading-snug text-slate-900">{card.title}</h4>

        {card.description && (
          <p className="line-clamp-1 text-xs text-muted-foreground">{card.description}</p>
        )}

        {card.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {card.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700"
              >
                <Tag className="h-3 w-3" />
                {tag}
              </span>
            ))}
            {card.tags.length > 3 && (
              <span className="text-xs text-slate-400">+{card.tags.length - 3}</span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          <span
            className={cn(
              'inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium',
              priorityColors[card.priority]
            )}
          >
            {PRIORITY_LABELS[card.priority]}
          </span>

          {card.deadline && (
            <div
              className={cn(
                'inline-flex items-center gap-1.5 text-xs',
                overdue ? 'font-medium text-red-600' : 'text-muted-foreground'
              )}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>{formatDeadline(card.deadline)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
