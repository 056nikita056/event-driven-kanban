'use client'

import { CSS } from '@dnd-kit/utilities'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { AlertTriangle, GripVertical, MoreVertical, Plus } from 'lucide-react'

import type { Card, Column } from '@/types/kanban'
import { cn } from '@/lib/utils'
import { KanbanCard } from '@/components/Card'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface ColumnProps {
  column: Column
  onAddCard?: (columnId: string) => void
  onCardClick?: (card: Card) => void
  onColumnMenu?: (column: Column, action: 'edit' | 'delete') => void
  isDragOverlay?: boolean
}

export function KanbanColumn({
  column,
  onAddCard,
  onCardClick,
  onColumnMenu,
  isDragOverlay = false,
}: ColumnProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: column.id,
    data: { type: 'column', column },
    disabled: isDragOverlay,
  })

  const cardIds = column.cards.map((card) => card.id)
  const isOverLimit = Boolean(column.wipLimit && column.cards.length > column.wipLimit)
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }
  const accentColor = column.color || '#cbd5e1'

  if (isDragging && !isDragOverlay) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="flex h-full w-80 flex-shrink-0 items-center justify-center rounded-[24px] border-2 border-dashed border-slate-200 bg-slate-100/70"
      >
        <span className="text-sm font-medium text-slate-400">Переместите колонку</span>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        borderTopColor: accentColor,
        boxShadow: `0 18px 40px -28px ${accentColor}`,
      }}
      className={cn(
        'flex h-full w-80 flex-shrink-0 flex-col rounded-[24px] border border-slate-200 border-t-4 bg-white/70 shadow-sm backdrop-blur-sm transition-all duration-200',
        isOver && 'ring-2 ring-indigo-400 ring-offset-2',
        isDragging && 'z-20 rotate-1 shadow-2xl'
      )}
    >
      <div className="flex items-center justify-between border-b border-slate-200 p-4">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-slate-100 hover:text-slate-500"
            aria-label={`Переместить колонку ${column.name}`}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <h3 className="truncate text-base font-semibold text-slate-900">{column.name}</h3>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-medium text-slate-600">
            {column.cards.length}
          </span>
          {isOverLimit && (
            <div className="flex items-center gap-1 text-xs text-amber-600">
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>WIP {column.wipLimit}</span>
            </div>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-xl">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onColumnMenu?.(column, 'edit')}>
              Редактировать
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => onColumnMenu?.(column, 'delete')}
              className="text-destructive focus:text-destructive"
            >
              Удалить
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div
        className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-3"
      >
        <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
          {column.cards.map((card) => (
            <KanbanCard key={card.id} card={card} onClick={onCardClick} />
          ))}
        </SortableContext>

        {column.cards.length === 0 && !isOver && (
          <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/60">
            <p className="text-xs text-slate-400">Перетащите карточку сюда</p>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 p-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start rounded-xl"
          onClick={() => onAddCard?.(column.id)}
          disabled={isDragOverlay}
        >
          <Plus className="mr-1 h-4 w-4" />
          Добавить карточку
        </Button>
      </div>
    </div>
  )
}
