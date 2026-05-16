'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, arrayMove, horizontalListSortingStrategy } from '@dnd-kit/sortable'
import { Command as CommandIcon, Layers, Plus, Zap } from 'lucide-react'

import { CardModal } from '@/components/CardModal'
import { CommandPalette } from '@/components/CommandPalette'
import { EventLogPanel } from '@/components/EventLogPanel'
import { NotificationsPopover } from '@/components/NotificationsPopover'
import { KanbanCard } from '@/components/Card'
import { KanbanColumn } from '@/components/Column'
import { AdminRulesDialog } from '@/components/AdminRulesDialog'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useSocket } from '@/hooks/useSocket'
import { useToast } from '@/hooks/use-toast'
import type { Card, Column, EventLogEntry, Notification, User } from '@/types/kanban'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface BoardProps {
  initialColumns: Column[]
  boardId: string
  boardName: string
  userId: string
}

interface ApiResponse<T> {
  ok: boolean
  data?: T
  error?: string
}

const COLUMN_COLORS = ['#007aff', '#5e5ce6', '#ff9500', '#34c759', '#ff2d55', '#5ac8fa']

export function Board({ initialColumns, boardId, boardName, userId }: BoardProps) {
  const [columns, setColumns] = useState<Column[]>(initialColumns)
  const [activeCard, setActiveCard] = useState<Card | null>(null)
  const [activeColumn, setActiveColumn] = useState<Column | null>(null)
  const [selectedCard, setSelectedCard] = useState<Card | null>(null)
  const [newCardColumnId, setNewCardColumnId] = useState<string | null>(null)
  const [isEventLogOpen, setIsEventLogOpen] = useState(false)
  const [isCommandOpen, setIsCommandOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [eventLog, setEventLog] = useState<EventLogEntry[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [currentUserId, setCurrentUserId] = useState(userId)
  const [isAdminDialogOpen, setIsAdminDialogOpen] = useState(false)
  const [columnDialogOpen, setColumnDialogOpen] = useState(false)
  const [columnDialogMode, setColumnDialogMode] = useState<'create' | 'edit' | 'delete'>('create')
  const [columnDraftName, setColumnDraftName] = useState('')
  const [columnDraftColor, setColumnDraftColor] = useState(COLUMN_COLORS[0])
  const [columnDraftWipLimit, setColumnDraftWipLimit] = useState('')
  const [columnTarget, setColumnTarget] = useState<Column | null>(null)
  const [columnSubmitting, setColumnSubmitting] = useState(false)
  const { toast } = useToast()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  const currentUserName = useMemo(
    () => users.find((item) => item.id === currentUserId)?.name || 'Demo user',
    [currentUserId, users]
  )
  const isAdmin = useMemo(
    () => users.find((item) => item.id === currentUserId)?.role === 'ADMIN',
    [currentUserId, users]
  )

  const refreshBoard = useCallback(async () => {
    const response = await fetch(`/api/board?boardId=${boardId}`)
    const result: ApiResponse<{ columns: Column[] }> = await response.json()
    if (result.ok && result.data) {
      setColumns(result.data.columns || [])
    }
  }, [boardId])

  const fetchNotifications = useCallback(async (targetUserId: string) => {
    const response = await fetch(`/api/notifications?userId=${targetUserId}`)
    const result: ApiResponse<Notification[]> = await response.json()
    if (result.ok && result.data) {
      setNotifications(result.data)
    }
  }, [])

  useEffect(() => {
    const savedUserId = window.localStorage.getItem('kanban_userId')
    if (savedUserId) setCurrentUserId(savedUserId)
  }, [])

  useEffect(() => {
    window.localStorage.setItem('kanban_userId', currentUserId)
    void fetchNotifications(currentUserId)
  }, [currentUserId, fetchNotifications])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsCommandOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadUsers() {
      const response = await fetch('/api/users')
      const result: ApiResponse<User[]> = await response.json()
      if (!cancelled && result.ok && result.data) setUsers(result.data)
    }

    void loadUsers()

    return () => {
      cancelled = true
    }
  }, [])

  const handleBoardUpdate = useCallback(() => {
    void refreshBoard()
  }, [refreshBoard])

  const handleNotification = useCallback(
    (notification: { id: string; type: string; message: string; payload?: unknown; createdAt: string }) => {
      setNotifications((prev) => [{ ...notification, read: false }, ...prev].slice(0, 50))
      toast({ title: 'Автоматизация', description: notification.message })
    },
    [toast]
  )

  const handleEventLog = useCallback((entry: EventLogEntry) => {
    setEventLog((prev) => [entry, ...prev].slice(0, 50))
  }, [])

  useSocket({
    boardId,
    onBoardUpdate: handleBoardUpdate,
    onNotification: handleNotification,
    onEventLog: handleEventLog,
  })

  function findColumn(cardId: string) {
    return columns.find((column) => column.cards.some((card) => card.id === cardId))
  }

  function handleDragStart(event: DragStartEvent) {
    const card = event.active.data.current?.card as Card | undefined
    const column = event.active.data.current?.column as Column | undefined
    if (card) {
      setActiveCard(card)
      return
    }
    if (column) setActiveColumn(column)
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    if (active.data.current?.type === 'column') return

    const sourceColumn = findColumn(active.id as string)
    const targetColumn =
      over.data.current?.type === 'column'
        ? columns.find((column) => column.id === over.id)
        : findColumn(over.id as string)

    if (!sourceColumn || !targetColumn || sourceColumn.id === targetColumn.id) return

    setColumns((prev) => {
      const movingCard = sourceColumn.cards.find((card) => card.id === active.id)
      if (!movingCard) return prev

      return prev.map((column) => {
        if (column.id === sourceColumn.id) {
          return { ...column, cards: column.cards.filter((card) => card.id !== active.id) }
        }

        if (column.id === targetColumn.id) {
          const overIndex = column.cards.findIndex((card) => card.id === over.id)
          const nextCards = [...column.cards]
          nextCards.splice(overIndex >= 0 ? overIndex : nextCards.length, 0, {
            ...movingCard,
            columnId: targetColumn.id,
          })
          return { ...column, cards: nextCards }
        }

        return column
      })
    })
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    const dragCard = activeCard
    setActiveCard(null)
    const dragColumn = activeColumn
    setActiveColumn(null)
    if (!over) return

    if (active.data.current?.type === 'column' && dragColumn) {
      const oldIndex = columns.findIndex((column) => column.id === active.id)
      const newIndex = columns.findIndex((column) => column.id === over.id)

      if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return

      const reordered = arrayMove(columns, oldIndex, newIndex).map((column, index) => ({
        ...column,
        order: index,
      }))

      setColumns(reordered)

      const changedColumns = reordered.filter((column, index) => column.order !== columns[index]?.order)

      try {
        await Promise.all(
          changedColumns.map((column) =>
            fetch(`/api/columns/${column.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ order: column.order, userId: currentUserId }),
            })
          )
        )
      } catch {
        toast({
          title: 'Не удалось переставить колонки',
          description: 'Порядок будет обновлён после перезагрузки.',
          variant: 'destructive',
        })
        await refreshBoard()
      }
      return
    }

    if (!dragCard) return

    const sourceColumn = columns.find((column) => column.id === dragCard.columnId) || findColumn(active.id as string)
    const targetColumn =
      over.data.current?.type === 'column'
        ? columns.find((column) => column.id === over.id)
        : findColumn(over.id as string)

    if (!sourceColumn || !targetColumn) {
      await refreshBoard()
      return
    }

    if (sourceColumn.id === targetColumn.id) {
      const oldIndex = sourceColumn.cards.findIndex((card) => card.id === active.id)
      const newIndex =
        over.data.current?.type === 'column'
          ? sourceColumn.cards.length - 1
          : sourceColumn.cards.findIndex((card) => card.id === over.id)

      if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
        setColumns((prev) =>
          prev.map((column) =>
            column.id === sourceColumn.id
              ? { ...column, cards: arrayMove(column.cards, oldIndex, newIndex) }
              : column
          )
        )
      }
    }

    const order =
      over.data.current?.type === 'column'
        ? targetColumn.cards.length
        : Math.max(targetColumn.cards.findIndex((card) => card.id === over.id), 0)

    try {
      const response = await fetch('/api/cards/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardId: active.id,
          fromColumnId: dragCard.columnId,
          toColumnId: targetColumn.id,
          order,
          boardId,
          userId: currentUserId,
        }),
      })

      if (!response.ok) throw new Error('Move failed')
      if (targetColumn.id !== dragCard.columnId && /done|готово/i.test(targetColumn.name)) {
        toast({ title: 'Карточка завершена', description: `"${dragCard.title}" перемещена в "${targetColumn.name}"` })
      }
    } catch {
      toast({
        title: 'Ошибка',
        description: 'Не удалось переместить карточку',
        variant: 'destructive',
      })
      await refreshBoard()
    }
  }

  async function handleSaveCard(cardData: Partial<Card>) {
    if (cardData.id) {
      const response = await fetch(`/api/cards/${cardData.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: cardData.title,
          description: cardData.description,
          priority: cardData.priority,
          tags: cardData.tags,
          deadline: cardData.deadline,
          version: cardData.version,
          boardId,
          userId: currentUserId,
        }),
      })

      if (!response.ok) {
        toast({
          title: 'Не удалось обновить карточку',
          description: response.status === 409 ? 'Карточка была изменена в другом окне' : 'Попробуйте ещё раз',
          variant: 'destructive',
        })
        throw new Error('Update failed')
      }

      await refreshBoard()
      return
    }

    const targetColumnId = newCardColumnId || columns[0]?.id
    if (!targetColumnId) return

    const response = await fetch('/api/cards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        columnId: targetColumnId,
        boardId,
        title: cardData.title,
        description: cardData.description || undefined,
        priority: cardData.priority || 'MEDIUM',
        tags: cardData.tags || [],
        deadline: cardData.deadline || undefined,
        userId: currentUserId,
      }),
    })

    if (!response.ok) {
      toast({ title: 'Не удалось создать карточку', variant: 'destructive' })
      throw new Error('Create failed')
    }

    await refreshBoard()
  }

  async function handleDeleteCard(cardId: string) {
    const response = await fetch(`/api/cards/${cardId}?boardId=${boardId}&userId=${currentUserId}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      toast({ title: 'Не удалось удалить карточку', variant: 'destructive' })
      throw new Error('Delete failed')
    }

    await refreshBoard()
  }

  async function handleCreateCardFromCommand(data: {
    title: string
    priority?: Card['priority']
    tags?: string[]
    deadline?: string
  }) {
    const response = await fetch('/api/ai-parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: data.title }),
    })

    let parsed = data
    if (response.ok) {
      const result: ApiResponse<{
        title: string
        priority: Card['priority']
        tags: string[]
        deadline?: string
      }> = await response.json()
      if (result.ok && result.data) parsed = { ...data, ...result.data }
    }

    setNewCardColumnId(columns[0]?.id || null)
    await handleSaveCard({
      title: parsed.title,
      priority: parsed.priority,
      tags: parsed.tags,
      deadline: parsed.deadline || null,
      description: null,
    })
    setNewCardColumnId(null)
  }

  async function handleMarkAllNotificationsRead() {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: currentUserId, all: true }),
    })
    setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })))
  }

  function openCreateColumnDialog() {
    setColumnDialogMode('create')
    setColumnDraftName('')
    setColumnDraftColor(COLUMN_COLORS[columns.length % COLUMN_COLORS.length] || COLUMN_COLORS[0])
    setColumnDraftWipLimit('')
    setColumnTarget(null)
    setColumnDialogOpen(true)
  }

  function handleColumnAction(column: Column, action: 'edit' | 'delete') {
    if (action === 'edit') {
      setColumnDialogMode('edit')
      setColumnDraftName(column.name)
      setColumnDraftColor(column.color || COLUMN_COLORS[0])
      setColumnDraftWipLimit(column.wipLimit ? String(column.wipLimit) : '')
      setColumnTarget(column)
      setColumnDialogOpen(true)
      return
    }

    setColumnDialogMode('delete')
    setColumnDraftName(column.name)
    setColumnDraftColor(column.color || COLUMN_COLORS[0])
    setColumnDraftWipLimit(column.wipLimit ? String(column.wipLimit) : '')
    setColumnTarget(column)
    setColumnDialogOpen(true)
  }

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
            userId: currentUserId,
          }),
        })

        if (!response.ok) {
          toast({ title: 'Не удалось создать колонку', variant: 'destructive' })
          return
        }

        await refreshBoard()
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
            userId: currentUserId,
          }),
        })

        if (!response.ok) {
          toast({ title: 'Не удалось обновить колонку', variant: 'destructive' })
          return
        }

        await refreshBoard()
        setColumnDialogOpen(false)
        return
      }

      const response = await fetch(`/api/columns/${columnTarget.id}?userId=${currentUserId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        toast({ title: 'Не удалось удалить колонку', variant: 'destructive' })
        return
      }

      await refreshBoard()
      setColumnDialogOpen(false)
    } finally {
      setColumnSubmitting(false)
    }
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[radial-gradient(circle_at_top,#eef2ff,transparent_38%),linear-gradient(180deg,#f8fafc_0%,#f3f4f6_100%)]">
      <header className="border-b border-white/60 bg-white/70 px-6 py-4 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">{boardName}</h1>
              <p className="text-sm text-muted-foreground">Пользователь: {currentUserName}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NotificationsPopover
              notifications={notifications}
              onMarkAllRead={handleMarkAllNotificationsRead}
            />

            <Button
              variant={isEventLogOpen ? 'default' : 'outline'}
              size="sm"
              className="rounded-xl"
              onClick={() => setIsEventLogOpen((prev) => !prev)}
            >
              <Zap className="mr-2 h-4 w-4" />
              Лента событий
            </Button>

            <Select value={currentUserId} onValueChange={setCurrentUserId}>
              <SelectTrigger className="w-[150px] rounded-xl bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {users.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => setIsAdminDialogOpen(true)}
              >
                Админка
              </Button>
            )}

            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setIsCommandOpen(true)}>
              <CommandIcon className="h-4 w-4" />
              <span className="ml-2 hidden sm:inline">Cmd+K</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="relative flex-1 overflow-hidden">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="h-full overflow-x-auto px-6 py-6">
            <SortableContext
              items={columns.map((column) => column.id)}
              strategy={horizontalListSortingStrategy}
            >
              <div className="flex h-full gap-4">
                {columns.map((column) => (
                  <KanbanColumn
                    key={column.id}
                    column={column}
                    onCardClick={setSelectedCard}
                    onAddCard={setNewCardColumnId}
                    onColumnMenu={handleColumnAction}
                  />
                ))}

                <div className="flex h-full w-80 flex-shrink-0 items-stretch">
                  <Button
                    variant="outline"
                    className="h-full min-h-[220px] w-full rounded-[24px] border-dashed bg-white/50 text-slate-500 hover:bg-white"
                    onClick={openCreateColumnDialog}
                  >
                    <Plus className="mr-2 h-5 w-5" />
                    Добавить колонку
                  </Button>
                </div>
              </div>
            </SortableContext>
          </div>

          <DragOverlay>
            {activeCard ? <KanbanCard card={activeCard} isDragOverlay /> : null}
            {!activeCard && activeColumn ? (
              <KanbanColumn
                column={activeColumn}
                onCardClick={setSelectedCard}
                onAddCard={setNewCardColumnId}
                onColumnMenu={handleColumnAction}
                isDragOverlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>

        <EventLogPanel
          events={eventLog}
          isOpen={isEventLogOpen}
          onClose={() => setIsEventLogOpen(false)}
        />
      </main>

      <CardModal
        card={selectedCard}
        isOpen={selectedCard !== null || newCardColumnId !== null}
        onClose={() => {
          setSelectedCard(null)
          setNewCardColumnId(null)
        }}
        onSave={handleSaveCard}
        onDelete={handleDeleteCard}
      />

      <CommandPalette
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        onCreateCard={handleCreateCardFromCommand}
        onNavigateToAdmin={() => {
          if (!isAdmin) {
            toast({ title: 'Недостаточно прав', description: 'Админка доступна только пользователю admin.' })
            return
          }
          setIsAdminDialogOpen(true)
        }}
        columns={columns.map((column) => ({ id: column.id, name: column.name }))}
      />

      <AdminRulesDialog
        isOpen={isAdminDialogOpen}
        onClose={() => setIsAdminDialogOpen(false)}
        boardId={boardId}
        users={users}
        columns={columns}
      />

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
    </div>
  )
}
