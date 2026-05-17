import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const PRIORITY_LABELS = {
  LOW: 'Низкий',
  MEDIUM: 'Средний',
  HIGH: 'Высокий',
  URGENT: 'Срочно',
} as const

export const EVENT_TYPE_LABELS: Record<string, string> = {
  'card.created': '✨ Карточка создана',
  'card.updated': '✏️ Карточка обновлена',
  'card.moved': '→ Карточка перемещена',
  'card.deleted': '🗑️ Карточка удалена',
  'column.created': '📋 Колонка создана',
  'column.updated': '✏️ Колонка обновлена',
  'column.deleted': '🗑️ Колонка удалена',
  'rule.triggered': '⚡ Правило сработало',
}

export function formatDeadline(deadline: string | null | undefined): string {
  if (!deadline) return ''
  const d = new Date(deadline)
  const now = new Date()
  const diff = d.getTime() - now.getTime()
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24))

  if (days < 0) return `Просрочено (${Math.abs(days)} дн)`
  if (days === 0) return 'Сегодня'
  if (days === 1) return 'Завтра'
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}

export function isOverdue(deadline: string | null | undefined): boolean {
  if (!deadline) return false
  return new Date(deadline) < new Date()
}

export function formatTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'только что'
  if (minutes < 60) return `${minutes} мин. назад`
  if (hours < 24) return `${hours} ч. назад`
  if (days < 7) return `${days} дн. назад`

  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
}
