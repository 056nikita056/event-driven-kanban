'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Settings2, Trash2 } from 'lucide-react'

import type { AutomationRule, Column, RuleActionType, RuleTriggerType, User } from '@/types/kanban'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

interface AdminRulesDialogProps {
  isOpen: boolean
  onClose: () => void
  boardId: string
  users: User[]
  columns: Column[]
}

interface RuleFormState {
  id?: string
  name: string
  enabled: boolean
  triggerType: RuleTriggerType
  triggerUserId: string
  triggerPriority: string
  triggerTag: string
  triggerFromColumnId: string
  triggerToColumnId: string
  actionType: RuleActionType
  actionColumnId: string
  actionTag: string
  actionMessage: string
  actionTargetUserId: string
}

interface ApiResponse<T> {
  ok: boolean
  data?: T
  error?: string
}

const EMPTY_VALUE = '__empty__'

const DEFAULT_FORM: RuleFormState = {
  name: '',
  enabled: true,
  triggerType: 'card.created',
  triggerUserId: '',
  triggerPriority: '',
  triggerTag: '',
  triggerFromColumnId: '',
  triggerToColumnId: '',
  actionType: 'notify',
  actionColumnId: '',
  actionTag: '',
  actionMessage: '⚡ Автоматизация сработала',
  actionTargetUserId: '',
}

function emptyToSentinel(value: string | undefined | null) {
  return value && value.length > 0 ? value : EMPTY_VALUE
}

function sentinelToEmpty(value: string) {
  return value === EMPTY_VALUE ? '' : value
}

function makeFormFromRule(rule: AutomationRule): RuleFormState {
  const trigger = rule.triggerConfig || {}
  const action = rule.actionConfig || {}

  return {
    id: rule.id,
    name: rule.name,
    enabled: rule.enabled,
    triggerType: rule.triggerType,
    triggerUserId: String(trigger.userId || ''),
    triggerPriority: String(trigger.priority || ''),
    triggerTag: String(trigger.tag || ''),
    triggerFromColumnId: String(trigger.fromColumnId || ''),
    triggerToColumnId: String(trigger.toColumnId || ''),
    actionType: rule.actionType,
    actionColumnId: String(action.columnId || ''),
    actionTag: String(action.tag || ''),
    actionMessage: String(action.message || '⚡ Автоматизация сработала'),
    actionTargetUserId: String(action.targetUserId || ''),
  }
}

export function AdminRulesDialog({
  isOpen,
  onClose,
  boardId,
  users,
  columns,
}: AdminRulesDialogProps) {
  const [rules, setRules] = useState<AutomationRule[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState<RuleFormState>(DEFAULT_FORM)
  const { toast } = useToast()
  const editorRef = useRef<HTMLDivElement | null>(null)
  const nameInputRef = useRef<HTMLInputElement | null>(null)

  const canSubmit = useMemo(() => {
    if (!form.name.trim()) return false
    if (form.actionType === 'move_to_column' && !form.actionColumnId) return false
    if (form.actionType === 'add_tag' && !form.actionTag.trim()) return false
    if (form.actionType === 'notify' && !form.actionMessage.trim()) return false
    return true
  }, [form])

  const submitHint = useMemo(() => {
    if (!form.name.trim()) return 'Добавь название правила.'
    if (form.actionType === 'move_to_column' && !form.actionColumnId) {
      return 'Выбери колонку, в которую нужно переместить карточку.'
    }
    if (form.actionType === 'add_tag' && !form.actionTag.trim()) {
      return 'Укажи тег, который нужно автоматически добавить.'
    }
    if (form.actionType === 'notify' && !form.actionMessage.trim()) {
      return 'Добавь текст уведомления.'
    }
    return null
  }, [form])

  async function loadRules() {
    setLoading(true)
    try {
      const response = await fetch(`/api/rules?boardId=${boardId}`)
      const result: ApiResponse<AutomationRule[]> = await response.json()
      if (!response.ok || !result.ok) {
        toast({
          title: 'Не удалось загрузить правила',
          description: result.error || 'Попробуйте обновить окно админки.',
          variant: 'destructive',
        })
        return
      }
      if (result.data) setRules(result.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isOpen) return
    void loadRules()
  }, [isOpen, boardId])

  function resetForm() {
    setForm(DEFAULT_FORM)
  }

  function startCreateRule() {
    resetForm()
    requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      nameInputRef.current?.focus()
    })
    toast({
      title: 'Новое правило',
      description: 'Заполни название, триггер и действие.',
    })
  }

  function buildPayload() {
    const triggerConfig: Record<string, unknown> = {}
    const actionConfig: Record<string, unknown> = {}

    if (form.triggerUserId) triggerConfig.userId = form.triggerUserId

    if (form.triggerType === 'card.created') {
      if (form.triggerPriority) triggerConfig.priority = form.triggerPriority
      if (form.triggerTag.trim()) triggerConfig.tag = form.triggerTag.trim()
    }

    if (form.triggerType === 'card.moved') {
      if (form.triggerFromColumnId) triggerConfig.fromColumnId = form.triggerFromColumnId
      if (form.triggerToColumnId) triggerConfig.toColumnId = form.triggerToColumnId
    }

    if (form.triggerType === 'tag.added' && form.triggerTag.trim()) {
      triggerConfig.tag = form.triggerTag.trim()
    }

    if (form.actionType === 'move_to_column') {
      actionConfig.columnId = form.actionColumnId
    }

    if (form.actionType === 'add_tag') {
      actionConfig.tag = form.actionTag.trim()
    }

    if (form.actionType === 'notify') {
      actionConfig.message = form.actionMessage.trim()
      if (form.actionTargetUserId) actionConfig.targetUserId = form.actionTargetUserId
    }

    return {
      boardId,
      name: form.name.trim(),
      enabled: form.enabled,
      triggerType: form.triggerType,
      triggerConfig,
      actionType: form.actionType,
      actionConfig,
    }
  }

  async function handleSubmit() {
    if (!canSubmit) return

    setSubmitting(true)
    try {
      const payload = buildPayload()
      const response = await fetch(form.id ? `/api/rules/${form.id}` : '/api/rules', {
        method: form.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result: ApiResponse<AutomationRule> = await response.json()
      if (!response.ok || !result.ok) {
        toast({
          title: form.id ? 'Не удалось сохранить правило' : 'Не удалось создать правило',
          description: result.error || 'Проверь настройки триггера и действия.',
          variant: 'destructive',
        })
        return
      }

      await loadRules()
      resetForm()
      toast({
        title: form.id ? 'Правило обновлено' : 'Правило создано',
        description: result.data?.name || 'Изменения сохранены.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(ruleId: string) {
    setSubmitting(true)
    try {
      const response = await fetch(`/api/rules/${ruleId}`, { method: 'DELETE' })
      const result: ApiResponse<{ id: string }> = await response.json()
      if (!response.ok || !result.ok) {
        toast({
          title: 'Не удалось удалить правило',
          description: result.error || 'Попробуйте ещё раз.',
          variant: 'destructive',
        })
        return
      }
      await loadRules()
      if (form.id === ruleId) resetForm()
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggle(rule: AutomationRule) {
    const response = await fetch(`/api/rules/${rule.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !rule.enabled }),
    })
    const result: ApiResponse<AutomationRule> = await response.json()
    if (!response.ok || !result.ok) {
      toast({
        title: 'Не удалось изменить статус правила',
        description: result.error || 'Попробуйте ещё раз.',
        variant: 'destructive',
      })
      return
    }
    await loadRules()
    if (form.id === rule.id) {
      setForm((prev) => ({ ...prev, enabled: !rule.enabled }))
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="h-[90vh] w-[min(96vw,1200px)] max-w-6xl overflow-hidden rounded-[28px] border-white/60 bg-white/95 p-0">
        <DialogHeader className="border-b border-slate-200 px-6 py-4">
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-indigo-600" />
            Админка правил
          </DialogTitle>
        </DialogHeader>

        <div className="grid h-[calc(90vh-88px)] min-h-0 grid-cols-1 overflow-hidden md:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="min-h-0 border-b border-slate-200 p-4 md:border-b-0 md:border-r">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">Список правил</h3>
              <Button size="sm" className="rounded-xl" onClick={startCreateRule}>
                <Plus className="mr-1 h-4 w-4" />
                Новое
              </Button>
            </div>

            <div className="space-y-2 overflow-y-auto pr-1 md:h-[calc(90vh-170px)]">
              {loading && <p className="text-sm text-muted-foreground">Загружаю правила...</p>}
              {!loading && rules.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-200 p-4 text-sm text-muted-foreground">
                  Пока нет правил. Создай первое автоматическое действие.
                </div>
              )}
              {rules.map((rule) => (
                <div
                  key={rule.id}
                  className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setForm(makeFormFromRule(rule))}
                      className="min-w-0 text-left"
                    >
                      <p className="truncate text-sm font-semibold text-slate-900">{rule.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {rule.triggerType} → {rule.actionType}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(rule.id)}
                      className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      aria-label={`Удалить правило ${rule.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        rule.enabled
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {rule.enabled ? 'Включено' : 'Выключено'}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="rounded-xl"
                      onClick={() => void handleToggle(rule)}
                    >
                      {rule.enabled ? 'Отключить' : 'Включить'}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div ref={editorRef} className="min-h-0 overflow-y-auto p-6">
            <div className="mb-5">
              <h3 className="text-lg font-semibold text-slate-900">
                {form.id ? 'Редактирование правила' : 'Новое правило'}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Настраивай триггеры по типу события и выбранному пользователю.
              </p>
            </div>

            <div className="grid gap-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Название</label>
                  <Input
                    ref={nameInputRef}
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    className="h-11 rounded-xl bg-slate-50"
                    placeholder="Например: Завершение задачи для Никиты"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Статус</label>
                  <Select
                    value={form.enabled ? 'enabled' : 'disabled'}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, enabled: value === 'enabled' }))}
                  >
                    <SelectTrigger className="h-11 rounded-xl bg-slate-50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="enabled">Включено</SelectItem>
                      <SelectItem value="disabled">Выключено</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50/60 p-4">
                <h4 className="mb-4 text-sm font-semibold text-slate-900">Триггер</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Тип события</label>
                    <Select
                      value={form.triggerType}
                      onValueChange={(value) =>
                        setForm((prev) => ({ ...prev, triggerType: value as RuleTriggerType }))
                      }
                    >
                      <SelectTrigger className="h-11 rounded-xl bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="card.created">card.created</SelectItem>
                        <SelectItem value="card.moved">card.moved</SelectItem>
                        <SelectItem value="tag.added">tag.added</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Пользователь</label>
                    <Select
                      value={emptyToSentinel(form.triggerUserId)}
                      onValueChange={(value) =>
                        setForm((prev) => ({ ...prev, triggerUserId: sentinelToEmpty(value) }))
                      }
                    >
                      <SelectTrigger className="h-11 rounded-xl bg-white">
                        <SelectValue placeholder="Любой пользователь" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={EMPTY_VALUE}>Любой пользователь</SelectItem>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {form.triggerType === 'card.created' && (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Приоритет</label>
                        <Select
                          value={emptyToSentinel(form.triggerPriority)}
                          onValueChange={(value) =>
                            setForm((prev) => ({ ...prev, triggerPriority: sentinelToEmpty(value) }))
                          }
                        >
                          <SelectTrigger className="h-11 rounded-xl bg-white">
                            <SelectValue placeholder="Любой приоритет" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={EMPTY_VALUE}>Любой приоритет</SelectItem>
                            <SelectItem value="LOW">LOW</SelectItem>
                            <SelectItem value="MEDIUM">MEDIUM</SelectItem>
                            <SelectItem value="HIGH">HIGH</SelectItem>
                            <SelectItem value="URGENT">URGENT</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Тег</label>
                        <Input
                          value={form.triggerTag}
                          onChange={(e) => setForm((prev) => ({ ...prev, triggerTag: e.target.value }))}
                          className="h-11 rounded-xl bg-white"
                          placeholder="Например: bug"
                        />
                      </div>
                    </>
                  )}

                  {form.triggerType === 'card.moved' && (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Из колонки</label>
                        <Select
                          value={emptyToSentinel(form.triggerFromColumnId)}
                          onValueChange={(value) =>
                            setForm((prev) => ({ ...prev, triggerFromColumnId: sentinelToEmpty(value) }))
                          }
                        >
                          <SelectTrigger className="h-11 rounded-xl bg-white">
                            <SelectValue placeholder="Любая колонка" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={EMPTY_VALUE}>Любая колонка</SelectItem>
                            {columns.map((column) => (
                              <SelectItem key={column.id} value={column.id}>
                                {column.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">В колонку</label>
                        <Select
                          value={emptyToSentinel(form.triggerToColumnId)}
                          onValueChange={(value) =>
                            setForm((prev) => ({ ...prev, triggerToColumnId: sentinelToEmpty(value) }))
                          }
                        >
                          <SelectTrigger className="h-11 rounded-xl bg-white">
                            <SelectValue placeholder="Любая колонка" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={EMPTY_VALUE}>Любая колонка</SelectItem>
                            {columns.map((column) => (
                              <SelectItem key={column.id} value={column.id}>
                                {column.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  {form.triggerType === 'tag.added' && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Тег</label>
                      <Input
                        value={form.triggerTag}
                        onChange={(e) => setForm((prev) => ({ ...prev, triggerTag: e.target.value }))}
                        className="h-11 rounded-xl bg-white"
                        placeholder="Например: urgent"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-slate-50/60 p-4">
                <h4 className="mb-4 text-sm font-semibold text-slate-900">Действие</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Тип действия</label>
                    <Select
                      value={form.actionType}
                      onValueChange={(value) =>
                        setForm((prev) => ({ ...prev, actionType: value as RuleActionType }))
                      }
                    >
                      <SelectTrigger className="h-11 rounded-xl bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="notify">notify</SelectItem>
                        <SelectItem value="move_to_column">move_to_column</SelectItem>
                        <SelectItem value="add_tag">add_tag</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {form.actionType === 'move_to_column' && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Целевая колонка</label>
                      <Select
                        value={emptyToSentinel(form.actionColumnId)}
                        onValueChange={(value) =>
                          setForm((prev) => ({ ...prev, actionColumnId: sentinelToEmpty(value) }))
                        }
                      >
                        <SelectTrigger className="h-11 rounded-xl bg-white">
                          <SelectValue placeholder="Выбери колонку" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={EMPTY_VALUE}>Выбери колонку</SelectItem>
                          {columns.map((column) => (
                            <SelectItem key={column.id} value={column.id}>
                              {column.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {form.actionType === 'add_tag' && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Добавляемый тег</label>
                      <Input
                        value={form.actionTag}
                        onChange={(e) => setForm((prev) => ({ ...prev, actionTag: e.target.value }))}
                        className="h-11 rounded-xl bg-white"
                        placeholder="Например: urgent"
                      />
                    </div>
                  )}

                  {form.actionType === 'notify' && (
                    <>
                      <div className="space-y-2 md:col-span-2">
                        <label className="text-sm font-medium">Сообщение</label>
                        <Input
                          value={form.actionMessage}
                          onChange={(e) => setForm((prev) => ({ ...prev, actionMessage: e.target.value }))}
                          className="h-11 rounded-xl bg-white"
                          placeholder="Что показывать в уведомлении"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Кому отправить</label>
                        <Select
                          value={emptyToSentinel(form.actionTargetUserId)}
                          onValueChange={(value) =>
                            setForm((prev) => ({ ...prev, actionTargetUserId: sentinelToEmpty(value) }))
                          }
                        >
                          <SelectTrigger className="h-11 rounded-xl bg-white">
                            <SelectValue placeholder="Всем пользователям" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={EMPTY_VALUE}>Всем пользователям</SelectItem>
                            {users.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="mt-6">
              <div className="mr-auto text-sm text-slate-500">
                {submitHint || 'Можно сохранять правило.'}
              </div>
              <Button variant="outline" onClick={startCreateRule} disabled={submitting}>
                Сбросить
              </Button>
              <Button onClick={() => void handleSubmit()} disabled={!canSubmit || submitting}>
                {form.id ? 'Сохранить правило' : 'Создать правило'}
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
