# Промпт для Figma Make

---

Создай современный Kanban-менеджер задач с реал-тайм обновлениями — уровня Linear или Notion. Придумай дизайн сам: выбери цветовую схему, типографику, стиль карточек. Главное — он должен выглядеть как профессиональный SaaS-продукт, а не учебный проект. Весь текст в интерфейсе — на русском языке.

---

## Что это за приложение

Event-driven Kanban-доска. Любое действие пользователя (создание карточки, перетаскивание, смена приоритета) превращается в событие, которое обрабатывается асинхронно и мгновенно синхронизируется у всех открытых браузеров через WebSocket. Главная фишка на демо — открыть два браузера рядом и показать, что изменения появляются везде одновременно.

---

## Структура приложения

### Главная страница — Доска

Хедер (фиксированный сверху):
- Слева: логотип + название доски
- Справа: иконка колокольчика с бейджем непрочитанных уведомлений, кнопка «⚡ Лента событий» (показывает/скрывает правую панель), селектор пользователя (admin / Никита / Стёпа — без авторизации, просто выбор из списка), подсказка Cmd+K

Доска — горизонтальный скролл колонок. В конце — кнопка «+ Добавить колонку».

Правая панель «Лента событий» — выезжает сбоку, показывает поток всех событий в реальном времени.

### Колонка

Каждая колонка содержит:
- Заголовок с названием и счётчиком карточек
- Цветной акцент (у каждой колонки свой цвет)
- Если задан WIP-лимит и он превышен — визуальное предупреждение
- Область карточек с вертикальным скроллом
- Кнопка «+ Добавить карточку» снизу
- Меню «···» с опциями: переименовать, задать WIP-лимит, изменить цвет, удалить

Стартовые колонки: «К выполнению», «В работе» (WIP лимит 3), «На проверке», «Готово».

### Карточка

Каждая карточка показывает:
- Заголовок (до 2 строк)
- Превью описания (1 строка, если есть)
- Теги в виде пилюль (#backend, #urgent и т.д.)
- Приоритет: Низкий / Средний / Высокий / Срочно — цветной бейдж
- Дедлайн с иконкой календаря; если просрочен — красного цвета

При наведении карточка приподнимается. При перетаскивании — полупрозрачная с лёгким поворотом. Карточка, которая летит за курсором — чуть больше и с тенью.

Клик на карточку открывает модальное окно редактирования.

### Модальное окно карточки

Поля:
- Заголовок (автофокус, крупный шрифт)
- Описание (многострочный текст)
- Приоритет (выпадающий список: Низкий / Средний / Высокий / Срочно)
- Теги (добавить/удалить)
- Дедлайн (выбор даты)

Кнопки: «Удалить» (слева, красный), «Отмена», «Сохранить».

### Cmd+K — командная палитра

Открывается по Cmd+K. Плавающее окно по центру экрана сверху.

Пользователь вводит текст — автоматически запрашивается AI-парсер (`POST /api/ai-parse`). Под полем ввода показывается превью того, что AI распознал: приоритет, дедлайн, теги. Enter — создаёт карточку. Escape — закрывает.

Пример: пользователь вводит «Срочно подготовить отчёт до пятницы» → AI определяет: приоритет Срочно, дедлайн пятница, тег #срочно.

Также в палитре: быстрый переход в «Добавить карточку в [название колонки]» и «Открыть админку».

### Лента событий (правая панель)

Тёмная панель 300px. Заголовок «⚡ Лента событий» + мигающая зелёная точка LIVE.

Каждое событие — отдельная строка, новые появляются сверху с анимацией:
- ✨ Карточка создана
- → Карточка перемещена  
- ✏️ Карточка обновлена
- 🗑 Карточка удалена
- ⚡ Правило сработало

Показывает название карточки и время. Максимум 50 записей.

### Уведомления

Клик на колокольчик — выпадающий список уведомлений. Каждое: иконка, текст, время. Кнопка «Отметить все прочитанными».

### Страница /admin — Админка

Две колонки:

Левая — управление колонками:
- Список существующих колонок (название, цвет, WIP-лимит, кнопка удалить)
- Форма добавления: название + выбор цвета + WIP-лимит

Правая — правила автоматизации:
- Список правил с тумблером вкл/выкл
- Каждое правило: название + «Когда [триггер] → [действие]»
- Форма создания правила:
  - Название
  - Триггер: «Карточка создана» / «Карточка перемещена в колонку» / «Добавлен тег»
  - Условие триггера (выбор колонки или ввод тега)
  - Действие: «Переместить в колонку» / «Добавить тег» / «Уведомить всех»
  - Параметр действия

---

## Технические типы данных

```typescript
type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

const PRIORITY_LABELS = {
  LOW: 'Низкий',
  MEDIUM: 'Средний', 
  HIGH: 'Высокий',
  URGENT: 'Срочно',
}

interface Card {
  id: string
  columnId: string
  title: string
  description?: string | null
  priority: Priority
  tags: string[]
  order: number
  deadline?: string | null  // ISO datetime
  version: number
  createdAt: string
}

interface Column {
  id: string
  boardId: string
  name: string
  order: number
  color?: string | null
  wipLimit?: number | null
  cards: Card[]
}

interface EventLogEntry {
  id: string
  type: 'card.created' | 'card.moved' | 'card.updated' | 'card.deleted' | 'column.created' | 'column.deleted' | 'rule.triggered'
  payload: unknown
  status: string
  createdAt: string
}

interface Notification {
  id: string
  type: string
  message: string
  read: boolean
  createdAt: string
}

interface AutomationRule {
  id: string
  name: string
  enabled: boolean
  triggerType: 'card.created' | 'card.moved' | 'tag.added'
  triggerConfig: Record<string, unknown>
  actionType: 'move_to_column' | 'add_tag' | 'notify'
  actionConfig: Record<string, unknown>
}
```

---

## API-вызовы

```typescript
// Загрузка доски (SSR или useEffect)
GET /api/board?boardId=board-1
// → { data: { id, name, columns: Column[] } }

// Создать карточку
POST /api/cards
body: { columnId, boardId: 'board-1', title, description?, priority, tags, deadline?, userId }

// Обновить карточку
PATCH /api/cards/:id
body: { title?, description?, priority?, tags?, deadline?, version, userId }

// Переместить карточку (drag & drop)
POST /api/cards/move
body: { cardId, fromColumnId, toColumnId, order, boardId: 'board-1', userId }

// Удалить карточку
DELETE /api/cards/:id?userId=...

// Создать колонку
POST /api/columns
body: { boardId: 'board-1', name, color?, userId }

// Обновить колонку
PATCH /api/columns/:id
body: { name?, color?, wipLimit? }

// Удалить колонку
DELETE /api/columns/:id

// AI-парсер карточки из текста
POST /api/ai-parse
body: { text: 'Срочно подготовить отчёт до пятницы' }
// → { data: { title, priority, tags, deadline?, description? } }

// Уведомления
GET /api/notifications?userId=...
PATCH /api/notifications
body: { userId, all: true }  // отметить все прочитанными

// Правила автоматизации
GET /api/rules?boardId=board-1
POST /api/rules
body: { boardId, name, triggerType, triggerConfig, actionType, actionConfig }
PATCH /api/rules/:id
body: { enabled?, name?, triggerType?, triggerConfig?, actionType?, actionConfig? }
DELETE /api/rules/:id

// Список пользователей
GET /api/users
// → { data: [{ id: 'admin', name: 'Admin', role: 'ADMIN' }, ...] }
```

---

## Реалтайм через Socket.io

Уже реализован хук `src/hooks/useSocket.ts`. Используй так:

```typescript
import { useSocket } from '@/hooks/useSocket'

useSocket({
  boardId: 'board-1',
  onBoardUpdate: (event) => {
    // event.type: 'card.created' | 'card.moved' | 'card.updated' | 
    //             'card.deleted' | 'column.created' | 'column.deleted' | 'rule.triggered'
    // event.payload: данные события
    // Обновить локальный state колонок
  },
  onNotification: (notif) => {
    // notif.message, notif.type
    // Показать тост + добавить в список уведомлений
  },
  onEventLog: (entry) => {
    // Добавить в начало ленты событий
  },
})
```

---

## Спецэффекты

```typescript
// Конфетти когда карточка попадает в колонку "Готово"
import confetti from 'canvas-confetti'
// Вызвать внутри onBoardUpdate когда type === 'card.moved' && toColumnId === 'col-done'
confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })

// Тост уведомления (хук уже есть)
import { toast } from '@/hooks/use-toast'
toast({ title: '⚡ Автоматизация', description: notif.message })
```

---

## Пользователь

Нет авторизации. Текущий пользователь хранится в localStorage:

```typescript
const userId = localStorage.getItem('kanban_userId') || 'user1'
// Сохранить при выборе:
localStorage.setItem('kanban_userId', selectedUserId)
```

---

## Стейт-менеджмент

Весь стейт — в одном компоненте Board:

```typescript
const [columns, setColumns] = useState<Column[]>(initialColumns)
const [activeCard, setActiveCard] = useState<Card | null>(null)       // drag
const [selectedCard, setSelectedCard] = useState<Card | null>(null)   // в модалке
const [newCardColumnId, setNewCardColumnId] = useState<string | null>(null)
const [isEventLogOpen, setIsEventLogOpen] = useState(false)
const [notifications, setNotifications] = useState<Notification[]>([])
const [eventLog, setEventLog] = useState<EventLogEntry[]>([])
const [currentUserId, setCurrentUserId] = useState('user1')
```

---

## Drag & drop

Используй `@dnd-kit/core` и `@dnd-kit/sortable` (уже в package.json).

Базовая реализация уже есть в `src/components/Board.tsx` — можешь взять её за основу и переделать визуал.

```typescript
import { DndContext, DragOverlay, closestCorners, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
```

Сенсор: `PointerSensor` с `activationConstraint: { distance: 5 }` (чтобы клик не активировал drag).

---

## Что уже реализовано на бэкенде — не трогай

- `src/lib/prisma.ts` — Prisma клиент
- `src/lib/redis.ts` — Redis
- `src/lib/queue.ts` — BullMQ очередь
- `src/lib/socket.ts` — Socket.io сервер
- `src/hooks/useSocket.ts` — Socket.io клиент-хук
- `src/hooks/use-toast.ts` — тосты
- `src/events/types.ts` — все типы событий
- `src/events/automation.ts` — движок правил
- `src/worker.ts` — воркер событий
- Все API-роуты в `src/app/api/`

Твоя задача — создать только компоненты в `src/components/` и страницы `src/app/page.tsx`, `src/app/admin/page.tsx`.
