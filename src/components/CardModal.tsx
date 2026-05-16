'use client'

import { useEffect, useState } from 'react'
import { Calendar as CalendarIcon, X } from 'lucide-react'

import type { Card, Priority } from '@/types/kanban'
import { PRIORITY_LABELS, cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'

interface CardModalProps {
  card: Card | null
  isOpen: boolean
  onClose: () => void
  onSave: (card: Partial<Card>) => void | Promise<void>
  onDelete?: (cardId: string) => void | Promise<void>
}

export function CardModal({ card, isOpen, onClose, onSave, onDelete }: CardModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<Priority>('MEDIUM')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [deadline, setDeadline] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (card) {
      setTitle(card.title)
      setDescription(card.description || '')
      setPriority(card.priority)
      setTags(card.tags)
      setDeadline(card.deadline ? new Date(card.deadline).toISOString().split('T')[0] || '' : '')
      return
    }

    setTitle('')
    setDescription('')
    setPriority('MEDIUM')
    setTags([])
    setTagInput('')
    setDeadline('')
  }, [card, isOpen])

  async function handleSave() {
    if (!title.trim()) return

    setIsSubmitting(true)
    try {
      await onSave({
        id: card?.id,
        title: title.trim(),
        description: description.trim() || null,
        priority,
        tags,
        deadline: deadline ? new Date(`${deadline}T23:59:00`).toISOString() : null,
        version: card?.version || 0,
      })
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleAddTag(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== 'Enter' || !tagInput.trim()) return
    e.preventDefault()
    const nextTag = tagInput.trim()
    if (!tags.includes(nextTag)) setTags((prev) => [...prev, nextTag])
    setTagInput('')
  }

  async function handleDelete() {
    if (!card || !onDelete) return
    setIsSubmitting(true)
    try {
      await onDelete(card.id)
      onClose()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl rounded-[28px] border-white/60 bg-white/95 p-6 shadow-2xl backdrop-blur">
        <DialogHeader>
          <DialogTitle>{card ? 'Редактировать карточку' : 'Новая карточка'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <label className="text-sm font-medium">Название</label>
            <Input
              placeholder="Введите название задачи..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              className="h-11 rounded-xl bg-slate-50"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Описание</label>
            <Textarea
              placeholder="Добавьте описание..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="rounded-xl bg-slate-50"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Приоритет</label>
              <Select value={priority} onValueChange={(value) => setPriority(value as Priority)}>
                <SelectTrigger className="h-11 rounded-xl bg-slate-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Дедлайн</label>
              <div className="relative">
                <Input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="h-11 rounded-xl bg-slate-50 pl-10"
                />
                <CalendarIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Теги</label>
            <Input
              placeholder="Введите тег и нажмите Enter..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleAddTag}
              className="h-11 rounded-xl bg-slate-50"
            />
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-sm text-slate-700"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => setTags((prev) => prev.filter((item) => item !== tag))}
                      className={cn('transition-colors hover:text-red-600')}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="items-center justify-between gap-3 sm:justify-between">
          <div>
            {card && onDelete && (
              <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
                Удалить
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={!title.trim() || isSubmitting}>
              Сохранить
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
