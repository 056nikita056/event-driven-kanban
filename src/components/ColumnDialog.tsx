'use client'

import { forwardRef, useImperativeHandle, useState } from 'react'

import type { Column } from '@/types/kanban'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'

interface ColumnDialogProps {
  boardId: string
  columns: Column[]
  userId: string
  onSuccess: () => void
}

type ColumnDialogMode = 'create' | 'edit' | 'delete'

export interface ColumnDialogHandle {
  open: (mode: ColumnDialogMode, column?: Column) => void
}

const COLUMN_COLORS = ['#007aff', '#5e5ce6', '#ff9500', '#34c759', '#ff2d55', '#5ac8fa']

export const ColumnDialog = forwardRef<ColumnDialogHandle, ColumnDialogProps>(
  function ColumnDialog({ boardId, columns, userId, onSuccess }, ref) {
    const [columnDialogOpen, setColumnDialogOpen] = useState(false)
    const [columnDialogMode, setColumnDialogMode] = useState<ColumnDialogMode>('create')
    const [columnDraftName, setColumnDraftName] = useState('')
    const [columnDraftColor, setColumnDraftColor] = useState(COLUMN_COLORS[0])
    const [columnDraftWipLimit, setColumnDraftWipLimit] = useState('')
    const [columnTarget, setColumnTarget] = useState<Column | null>(null)
    const [columnSubmitting, setColumnSubmitting] = useState(false)
    const { toast } = useToast()

    useImperativeHandle(
      ref,
      () => ({
        open: (mode, column) => {
          setColumnDialogMode(mode)
          setColumnDraftName(column?.name || '')
          setColumnDraftColor(column?.color || COLUMN_COLORS[columns.length % COLUMN_COLORS.length] || COLUMN_COLORS[0])
          setColumnDraftWipLimit(column?.wipLimit ? String(column.wipLimit) : '')
          setColumnTarget(column || null)
          setColumnDialogOpen(true)
        },
      }),
      [columns.length]
    )

    async function handleSubmitColumnDialog() {
      setColumnSubmitting(true)
      try {
        if (columnDialogMode === 'create') {
          if (!columnDraftName.trim()) return

          const response = await fetch('/api/columns', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              boardId,
              name: columnDraftName.trim(),
              color: columnDraftColor,
              wipLimit: columnDraftWipLimit.trim() ? Number(columnDraftWipLimit) : null,
              userId,
            }),
          })

          if (!response.ok) {
            toast({ title: 'Не удалось создать колонку', variant: 'destructive' })
            return
          }

          await Promise.resolve(onSuccess())
          setColumnDialogOpen(false)
          return
        }

        if (!columnTarget) return

        if (columnDialogMode === 'edit') {
          if (!columnDraftName.trim() || columnDraftName.trim() === columnTarget.name) {
            setColumnDialogOpen(false)
            return
          }

          const response = await fetch(`/api/columns/${columnTarget.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: columnDraftName.trim(),
              color: columnDraftColor,
              wipLimit: columnDraftWipLimit.trim() ? Number(columnDraftWipLimit) : null,
              userId,
            }),
          })

          if (!response.ok) {
            toast({ title: 'Не удалось обновить колонку', variant: 'destructive' })
            return
          }

          await Promise.resolve(onSuccess())
          setColumnDialogOpen(false)
          return
        }

        const response = await fetch(`/api/columns/${columnTarget.id}?userId=${userId}`, {
          method: 'DELETE',
        })

        if (!response.ok) {
          toast({ title: 'Не удалось удалить колонку', variant: 'destructive' })
          return
        }

        await Promise.resolve(onSuccess())
        setColumnDialogOpen(false)
      } finally {
        setColumnSubmitting(false)
      }
    }

    return (
      <Dialog open={columnDialogOpen} onOpenChange={setColumnDialogOpen}>
        <DialogContent className="max-w-md rounded-[28px] border-white/60 bg-white/95">
          <DialogHeader>
            <DialogTitle>
              {columnDialogMode === 'create' && 'Новая колонка'}
              {columnDialogMode === 'edit' && 'Переименовать колонку'}
              {columnDialogMode === 'delete' && 'Удалить колонку'}
            </DialogTitle>
          </DialogHeader>

          {columnDialogMode === 'delete' ? (
            <p className="text-sm text-muted-foreground">
              Удалить колонку "{columnTarget?.name}"? Это действие нельзя отменить.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Название</label>
                <Input
                  value={columnDraftName}
                  onChange={(e) => setColumnDraftName(e.target.value)}
                  placeholder="Например: На проверке"
                  className="h-11 rounded-xl bg-slate-50"
                  autoFocus
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Цвет</label>
                  <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2">
                    <input
                      type="color"
                      value={columnDraftColor}
                      onChange={(e) => setColumnDraftColor(e.target.value)}
                      className="h-8 w-10 cursor-pointer rounded border-0 bg-transparent p-0"
                    />
                    <span className="text-sm text-slate-600">{columnDraftColor}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">WIP limit</label>
                  <Input
                    type="number"
                    min="0"
                    value={columnDraftWipLimit}
                    onChange={(e) => setColumnDraftWipLimit(e.target.value)}
                    placeholder="Например: 3"
                    className="h-11 rounded-xl bg-slate-50"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setColumnDialogOpen(false)}
              disabled={columnSubmitting}
            >
              Отмена
            </Button>
            <Button
              variant={columnDialogMode === 'delete' ? 'destructive' : 'default'}
              onClick={() => void handleSubmitColumnDialog()}
              disabled={columnSubmitting || (columnDialogMode !== 'delete' && !columnDraftName.trim())}
            >
              {columnDialogMode === 'delete' ? 'Удалить' : 'Сохранить'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }
)
