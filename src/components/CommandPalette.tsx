'use client'

import { useEffect, useMemo, useState } from 'react'
import { Command } from 'cmdk'
import { Calendar, Plus, Search, Settings, Tag, Zap } from 'lucide-react'

import type { Priority } from '@/types/kanban'
import { PRIORITY_LABELS } from '@/lib/utils'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onCreateCard: (data: {
    title: string
    priority?: Priority
    tags?: string[]
    deadline?: string
  }) => void | Promise<void>
  onNavigateToAdmin: () => void
  columns: Array<{ id: string; name: string }>
}

export function CommandPalette({
  isOpen,
  onClose,
  onCreateCard,
  onNavigateToAdmin,
  columns,
}: CommandPaletteProps) {
  const [search, setSearch] = useState('')
  const [aiSuggestion, setAiSuggestion] = useState<{
    priority?: Priority
    tags?: string[]
    deadline?: string
  } | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setSearch('')
      setAiSuggestion(null)
    }
  }, [isOpen])

  useEffect(() => {
    if (search.trim().length <= 3) {
      setAiSuggestion(null)
      return
    }

    const timeout = setTimeout(() => {
      const lower = search.toLowerCase()
      const suggestion: { priority?: Priority; tags?: string[]; deadline?: string } = {}

      if (/(срочно|urgent|asap|горит)/i.test(lower)) suggestion.priority = 'URGENT'
      else if (/(важно|high|высок)/i.test(lower)) suggestion.priority = 'HIGH'

      if (/(завтра|tomorrow)/i.test(lower)) {
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        suggestion.deadline = tomorrow.toISOString()
      }

      if (/(пятниц|friday)/i.test(lower)) {
        const friday = new Date()
        const daysUntilFriday = (5 - friday.getDay() + 7) % 7 || 7
        friday.setDate(friday.getDate() + daysUntilFriday)
        suggestion.deadline = friday.toISOString()
      }

      const tags: string[] = []
      if (/(backend|бэкенд|api|сервер)/i.test(lower)) tags.push('backend')
      if (/(frontend|фронтенд|ui|интерфейс)/i.test(lower)) tags.push('frontend')
      if (/(design|дизайн|ux)/i.test(lower)) tags.push('design')
      if (suggestion.priority === 'URGENT') tags.push('urgent')
      if (tags.length) suggestion.tags = tags

      setAiSuggestion(Object.keys(suggestion).length ? suggestion : null)
    }, 250)

    return () => clearTimeout(timeout)
  }, [search])

  const deadlineLabel = useMemo(() => {
    if (!aiSuggestion?.deadline) return null
    return new Date(aiSuggestion.deadline).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
    })
  }, [aiSuggestion?.deadline])

  async function handleCreateCard() {
    if (!search.trim()) return
    await onCreateCard({
      title: search.trim(),
      ...aiSuggestion,
    })
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden rounded-[28px] border-white/60 bg-white/95 p-0 shadow-2xl backdrop-blur">
        <DialogTitle className="sr-only">Командная палитра</DialogTitle>
        <Command className="rounded-[28px]">
          <div className="flex items-center border-b border-slate-200 px-4">
            <Search className="h-5 w-5 shrink-0 text-muted-foreground" />
            <Input
              placeholder="Введите команду или создайте карточку..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && search.trim()) void handleCreateCard()
                if (e.key === 'Escape') onClose()
              }}
              className="h-14 border-0 bg-transparent text-base focus-visible:ring-0"
              autoFocus
            />
          </div>

          {aiSuggestion && (
            <div className="border-b border-slate-200 bg-indigo-50/80 px-4 py-3">
              <div className="mb-2 flex items-center gap-2 text-xs font-medium text-indigo-700">
                <Zap className="h-4 w-4" />
                AI распознал
              </div>
              <div className="flex flex-wrap gap-2">
                {aiSuggestion.priority && (
                  <span className="rounded-md bg-violet-100 px-2.5 py-1 text-xs font-medium text-violet-700">
                    {PRIORITY_LABELS[aiSuggestion.priority]}
                  </span>
                )}
                {deadlineLabel && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                    <Calendar className="h-3 w-3" />
                    {deadlineLabel}
                  </span>
                )}
                {aiSuggestion.tags?.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    <Tag className="h-3 w-3" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          <Command.List className="max-h-[400px] overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-muted-foreground">
              Ничего не найдено
            </Command.Empty>

            {search.trim() && (
              <Command.Group heading="Создать">
                <Command.Item
                  onSelect={() => void handleCreateCard()}
                  className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm aria-selected:bg-slate-100"
                >
                  <Plus className="h-4 w-4" />
                  <span>Создать карточку: &quot;{search}&quot;</span>
                </Command.Item>
              </Command.Group>
            )}

            {!search && (
              <>
                <Command.Group heading="Быстрые действия">
                  {columns.map((column) => (
                    <Command.Item
                      key={column.id}
                      onSelect={() => setSearch(`Срочно сделать задачу для ${column.name}`)}
                      className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm aria-selected:bg-slate-100"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Добавить карточку в {column.name}</span>
                    </Command.Item>
                  ))}
                </Command.Group>

                <Command.Group heading="Навигация">
                  <Command.Item
                    onSelect={() => {
                      onNavigateToAdmin()
                      onClose()
                    }}
                    className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm aria-selected:bg-slate-100"
                  >
                    <Settings className="h-4 w-4" />
                    <span>Открыть админку</span>
                  </Command.Item>
                </Command.Group>
              </>
            )}
          </Command.List>
        </Command>
      </DialogContent>
    </Dialog>
  )
}
