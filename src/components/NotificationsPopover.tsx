'use client'

import { Bell, Check, Edit3, MoveRight, Sparkles, Trash2, Zap } from 'lucide-react'
import * as Popover from '@radix-ui/react-popover'

import type { Notification } from '@/types/kanban'
import { formatTime, cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

interface NotificationsPopoverProps {
  notifications: Notification[]
  onMarkAllRead: () => void | Promise<void>
}

const notificationIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  'card.created': Sparkles,
  'card.moved': MoveRight,
  'card.updated': Edit3,
  'card.deleted': Trash2,
  'rule.triggered': Zap,
  automation: Zap,
}

export function NotificationsPopover({ notifications, onMarkAllRead }: NotificationsPopoverProps) {
  const unreadCount = notifications.filter((item) => !item.read).length

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-xl">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          className="z-50 w-80 rounded-2xl border border-slate-200 bg-white p-0 shadow-xl outline-none"
          align="end"
          sideOffset={8}
        >
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-semibold">Уведомления</h3>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={() => void onMarkAllRead()} className="h-auto px-2 py-1 text-xs">
                <Check className="mr-1 h-3 w-3" />
                Отметить прочитанными
              </Button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                <Bell className="mb-3 h-12 w-12 opacity-20" />
                <p className="text-sm">Нет уведомлений</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {notifications.slice(0, 10).map((notification) => {
                  const Icon = notificationIcons[notification.type] || Bell
                  return (
                    <div
                      key={notification.id}
                      className={cn(
                        'flex items-start gap-3 px-4 py-3 transition-colors hover:bg-slate-50',
                        !notification.read && 'bg-indigo-50/50'
                      )}
                    >
                      <Icon className="mt-0.5 h-4 w-4 text-slate-500" />
                      <div className="min-w-0 flex-1">
                        <p className={cn('text-sm', !notification.read && 'font-medium')}>
                          {notification.message}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">{formatTime(notification.createdAt)}</p>
                      </div>
                      {!notification.read && <span className="mt-1.5 h-2 w-2 rounded-full bg-indigo-600" />}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
