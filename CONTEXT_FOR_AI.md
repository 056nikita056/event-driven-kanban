# Kanban Hackathon — Полный контекст для AI-ассистента

> Дедлайн: **17 мая 2025, 21:00 (Екб)**. Сейчас: утро 16 мая.
> Команда: Никита (FE/Design) + Стёпа (BE/Infra). AI-assisted разработка.

---

## 1. ЧТО УЖЕ СДЕЛАНО

Весь бэкенд-скаффолдинг готов. Структура файлов:

```
kanban-hackathon/
├── package.json              ✅ все зависимости
├── tsconfig.json             ✅
├── tailwind.config.ts        ✅
├── next.config.js            ✅
├── docker-compose.yml        ✅ postgres + redis локально
├── server.ts                 ✅ custom Next.js server с Socket.io
├── Dockerfile                ✅
├── railway.toml              ✅ web сервис
├── railway.worker.toml       ✅ worker сервис
├── .env.example              ✅
├── prisma/
│   ├── schema.prisma         ✅ полная схема
│   └── seed.ts               ✅ 10 карточек, 4 колонки, 3 правила
└── src/
    ├── app/
    │   ├── layout.tsx        ✅
    │   ├── page.tsx          ✅ SSR главная страница
    │   ├── globals.css       ✅
    │   └── api/
    │       ├── board/route.ts        ✅ GET полное состояние доски
    │       ├── cards/route.ts        ✅ GET + POST
    │       ├── cards/[id]/route.ts   ✅ GET + PATCH + DELETE
    │       ├── cards/move/route.ts   ✅ POST drag&drop
    │       ├── columns/route.ts      ✅ GET + POST
    │       ├── columns/[id]/route.ts ✅ PATCH + DELETE
    │       ├── rules/route.ts        ✅ GET + POST
    │       ├── rules/[id]/route.ts   ✅ PATCH + DELETE
    │       ├── notifications/route.ts ✅ GET + PATCH (mark read)
    │       ├── users/route.ts        ✅ GET
    │       ├── ai-parse/route.ts     ✅ POST (Claude API + regex fallback)
    │       └── health/route.ts       ✅ GET (postgres + redis check)
    ├── events/
    │   ├── types.ts          ✅ zod схемы всех событий, Socket.io типы
    │   └── automation.ts     ✅ движок правил (move_to_column, add_tag, notify)
    ├── lib/
    │   ├── prisma.ts         ✅ singleton
    │   ├── redis.ts          ✅ ioredis singleton
    │   ├── queue.ts          ✅ BullMQ queue + enqueueEvent()
    │   ├── socket.ts         ✅ Socket.io singleton + emit helpers
    │   └── utils.ts          ✅ cn(), PRIORITY_COLORS, formatDeadline, etc.
    ├── worker.ts             ✅ BullMQ worker (отдельный процесс)
    ├── hooks/
    │   ├── useSocket.ts      ✅ React hook для Socket.io клиента
    │   └── use-toast.ts      ✅
    └── components/
        ├── Board.tsx         ✅ dnd-kit оркестратор + socket updates
        ├── Column.tsx        ✅ базовый (дизайн переделывается в Figma Make)
        ├── Card.tsx          ✅ базовый (дизайн переделывается в Figma Make)
        └── ui/               ✅ button, badge, input, textarea, toast
```

---

## 2. ТЕХНИЧЕСКИЙ СТЕК

- **Frontend + Backend:** Next.js 14 (App Router, TypeScript)
- **UI:** Tailwind CSS + shadcn/ui + @dnd-kit (drag & drop)
- **БД:** PostgreSQL + Prisma ORM
- **Очередь:** Redis + BullMQ
- **Real-time:** Socket.io (на custom server `server.ts`, не встроен в Next.js)
- **Деплой:** Railway (два сервиса: `web` + `worker`)

---

## 3. АРХИТЕКТУРА (event-driven)

```
Пользователь → API Route → enqueueEvent() → BullMQ Queue (Redis)
                                                    ↓
                                             Worker (worker.ts)
                                                    ↓
                                        prisma.event.create()  ← дедупликация по eventKey
                                                    ↓
                                         runAutomation()       ← правила автоматизации
                                                    ↓
                                    emitBoardUpdate() via Socket.io → все клиенты
```

**Ключевые детали:**
- `eventKey` — уникальный ключ события (`card.created:${cardId}:${timestamp}`), дедупликация на уровне БД (unique constraint)
- `version` в Card — optimistic locking при конкурентных изменениях
- Worker — **отдельный процесс** (`npm run worker`), не часть Next.js
- Socket.io работает на том же порту что и Next.js через `server.ts`

---

## 4. PRISMA SCHEMA (полная)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id            String         @id @default(cuid())
  name          String
  role          Role           @default(USER)
  createdAt     DateTime       @default(now())
  events        Event[]
  notifications Notification[]
}

enum Role { USER ADMIN }

model Board {
  id      String          @id @default(cuid())
  name    String
  columns Column[]
  rules   AutomationRule[]
}

model Column {
  id       String  @id @default(cuid())
  boardId  String
  name     String
  order    Int
  color    String?
  wipLimit Int?
  board    Board   @relation(fields: [boardId], references: [id], onDelete: Cascade)
  cards    Card[]
}

model Card {
  id          String    @id @default(cuid())
  columnId    String
  title       String
  description String?
  priority    Priority  @default(MEDIUM)
  tags        String[]
  order       Int
  deadline    DateTime?
  assigneeId  String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  version     Int       @default(1)
  column      Column    @relation(fields: [columnId], references: [id], onDelete: Cascade)
}

enum Priority { LOW MEDIUM HIGH URGENT }

model AutomationRule {
  id            String  @id @default(cuid())
  boardId       String
  name          String
  enabled       Boolean @default(true)
  triggerType   String  // 'card.created' | 'card.moved' | 'tag.added'
  triggerConfig Json
  actionType    String  // 'move_to_column' | 'add_tag' | 'notify'
  actionConfig  Json
  board         Board   @relation(fields: [boardId], references: [id], onDelete: Cascade)
}

model Event {
  id          String      @id @default(cuid())
  eventKey    String      @unique
  type        String
  payload     Json
  userId      String?
  status      EventStatus @default(PENDING)
  error       String?
  createdAt   DateTime    @default(now())
  processedAt DateTime?
  user        User?       @relation(fields: [userId], references: [id])
}

enum EventStatus { PENDING PROCESSING COMPLETED FAILED }

model Notification {
  id        String   @id @default(cuid())
  userId    String
  type      String
  message   String
  read      Boolean  @default(false)
  payload   Json?
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

---

## 5. API КОНТРАКТ

### Типы событий (src/events/types.ts)

| Тип | Payload |
|-----|---------|
| `card.created` | `{cardId, columnId, boardId, title, priority, tags, order}` |
| `card.updated` | `{cardId, boardId, version, changes: {...}}` |
| `card.moved` | `{cardId, boardId, fromColumnId, toColumnId, order, version}` |
| `card.deleted` | `{cardId, boardId, columnId}` |
| `column.created` | `{columnId, boardId, name, order, color?}` |
| `column.updated` | `{columnId, boardId, changes: {...}}` |
| `column.deleted` | `{columnId, boardId}` |
| `rule.triggered` | `{ruleId, ruleName, boardId, sourceEventType, action, affectedCardId?}` |

### REST API

```
GET  /api/board?boardId=board-1          — полное состояние доски
GET  /api/columns?boardId=board-1
POST /api/columns                        — {boardId, name, color?, userId?}
PATCH /api/columns/:id                   — {name?, color?, wipLimit?, userId?}
DELETE /api/columns/:id

GET  /api/cards?boardId=board-1
POST /api/cards                          — {columnId, boardId, title, priority, tags, deadline?, userId?}
PATCH /api/cards/:id                     — {title?, description?, priority?, tags?, deadline?, version?, userId?}
DELETE /api/cards/:id
POST /api/cards/move                     — {cardId, fromColumnId, toColumnId, order, boardId, userId?}

GET  /api/rules?boardId=board-1
POST /api/rules                          — {name, triggerType, triggerConfig, actionType, actionConfig}
PATCH /api/rules/:id
DELETE /api/rules/:id

GET  /api/notifications?userId=user1
PATCH /api/notifications                 — {userId, ids?, all?}

GET  /api/users
POST /api/ai-parse                       — {text: "Срочно сделать отчёт до пятницы"}
GET  /api/health
```

### Socket.io Events

```typescript
// Server → Client
'board:update'    — {type, payload, boardId, timestamp}
'notification:new' — {id, type, message, payload?, createdAt}
'event:log'       — {id, type, payload, status, createdAt, processedAt?}

// Client → Server
'board:join'  — (boardId: string)
'board:leave' — (boardId: string)
```

---

## 6. КАК ПОДКЛЮЧИТЬСЯ К SOCKET.IO (клиент)

```typescript
// src/hooks/useSocket.ts — уже готов
import { useSocket } from '@/hooks/useSocket'

useSocket({
  boardId: 'board-1',
  onBoardUpdate: (event) => {
    // event.type: 'card.created' | 'card.moved' | ...
    // event.payload: данные события
    // Обновить локальный state
  },
  onNotification: (notif) => {
    // Показать toast
  },
  onEventLog: (entry) => {
    // Добавить в Visual Event Log sidebar
  },
})
```

---

## 7. ЧТО НУЖНО ДОДЕЛАТЬ (приоритеты)

### 🔴 MUST — без этого не сдаём

1. **CardModal** (`src/components/CardModal.tsx`) — модалка создания/редактирования карточки
   - Поля: title, description, priority (select), tags (input), deadline (date)
   - Кнопки: Save, Delete
   - Вызывается по клику на карточку или "Добавить карточку"
   - API: `POST /api/cards` или `PATCH /api/cards/:id`

2. **Страница `/admin`** (`src/app/admin/page.tsx`) — управление
   - Список колонок (CRUD)
   - Список правил автоматизации (CRUD + toggle enabled)
   - Форма создания правила: name, triggerType, triggerConfig, actionType, actionConfig

3. **User Selector** — выпадающий список в хедере (admin/user1/user2)
   - Нет авторизации, просто localStorage + GET /api/users
   - userId передаётся во все запросы

4. **Git init + первый деплой на Railway** — сделать сегодня до 21:00!

### 🟡 SHOULD — wow-эффект на демо

5. **Visual Event Log sidebar** — стрим событий в реальном времени
   - Слушает Socket.io `event:log`
   - Список с анимацией появления новых событий
   - Иконка/цвет по типу события

6. **Cmd+K Command Palette** — быстрое создание карточки
   - Используй библиотеку `cmdk` (уже в package.json)
   - Открывается по Cmd+K
   - Интегрировать с AI-парсером: вводишь текст → `POST /api/ai-parse` → автозаполнение полей

7. **Confetti при Done** — `canvas-confetti` уже в зависимостях
   - Слушать socket `board:update` где `type === 'card.moved'` и `toColumnId === 'col-done'`

### 🟢 NICE — если будет время

8. **WIP limits** — колонка краснеет при превышении (wipLimit уже в схеме)
9. **Live Presence** — аватарки других пользователей на доске

---

## 8. SEED-ДАННЫЕ (для демо)

```
Колонки: To Do (indigo) | In Progress (amber, wipLimit=3) | Review (violet) | Done (emerald)

Карточки:
- col-todo: "Настроить деплой на Railway" [URGENT, backend, infra, deadline=завтра]
- col-todo: "Реализовать Cmd+K командную палитру" [HIGH, frontend]
- col-todo: "Написать README" [MEDIUM, docs]
- col-inprogress: "Event Worker — обработчики событий" [URGENT, backend]
- col-inprogress: "Drag & Drop между колонками" [HIGH, frontend]
- col-inprogress: "Visual Event Log sidebar" [HIGH, frontend, feature]
- col-review: "Prisma schema + миграции" [MEDIUM, backend]
- col-review: "AI-парсер карточек" [HIGH, ai, feature]
- col-done: "Определить технический стек" [MEDIUM, planning]
- col-done: "Написать план разработки" [MEDIUM, planning, docs]

Правила:
- card.moved → toColumnId=col-done → notify "🎉 Задача выполнена!"
- card.created с priority=URGENT → add_tag "urgent"
- card.created с tag=bug → move_to_column col-inprogress (выключено)
```

---

## 9. ENV ПЕРЕМЕННЫЕ

```bash
DATABASE_URL="postgresql://postgres:password@localhost:5432/kanban"
REDIS_URL="redis://localhost:6379"
NEXT_PUBLIC_SOCKET_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
ANTHROPIC_API_KEY=""          # опционально для AI-парсера
DEFAULT_BOARD_ID="board-1"    # hardcoded одна доска
NODE_ENV="development"
```

---

## 10. ЗАПУСК ЛОКАЛЬНО

```bash
# 1. Зависимости
npm install

# 2. БД + Redis
docker-compose up -d

# 3. Env
cp .env.example .env

# 4. Миграция + seed
npm run db:migrate
npm run db:seed

# 5. Запуск (два терминала)
npm run dev       # Next.js + Socket.io сервер (server.ts)
npm run worker    # BullMQ event worker
```

---

## 11. ДЕПЛОЙ НА RAILWAY

1. Создать Railway проект → Add PostgreSQL + Redis из marketplace
2. Добавить сервис из репо → Railway прочтёт `railway.toml`
3. ENV vars: `DATABASE_URL`, `REDIS_URL`, `NEXT_PUBLIC_SOCKET_URL`, `ANTHROPIC_API_KEY`
4. Создать **второй сервис** из того же репо → указать `railway.worker.toml` как конфиг, start command: `npx tsx src/worker.ts`
5. Проверить `/api/health` — должно быть `{"status":"ok","checks":{"postgres":"ok","redis":"ok"}}`
6. Запустить seed на проде: подключиться через Railway CLI → `npm run db:seed`

---

## 12. ПРАВИЛА АВТОМАТИЗАЦИИ — формат JSON

```json
// Триггер card.moved в колонку Done:
triggerType: "card.moved"
triggerConfig: {"toColumnId": "col-done"}
actionType: "notify"
actionConfig: {"message": "🎉 Задача выполнена!"}

// Триггер card.created с priority URGENT:
triggerType: "card.created"
triggerConfig: {"priority": "URGENT"}
actionType: "add_tag"
actionConfig: {"tag": "urgent"}

// Триггер card.created с тегом bug:
triggerType: "card.created"
triggerConfig: {"tag": "bug"}
actionType: "move_to_column"
actionConfig: {"columnId": "col-inprogress"}
```

---

## 13. AI-ПАРСЕР КАРТОЧЕК

```bash
POST /api/ai-parse
Body: {"text": "Срочно подготовить отчёт до пятницы для Ивана"}

Response:
{
  "data": {
    "title": "Подготовить отчёт для Ивана",
    "priority": "URGENT",
    "tags": ["urgent"],
    "deadline": "2025-05-16T23:59:00.000Z",
    "description": null
  },
  "ok": true
}
```

Работает с Claude API (если есть `ANTHROPIC_API_KEY`) или через regex-fallback автоматически.

---

## 14. DEMO СЦЕНАРИЙ (4-5 минут)

1. **Открыть 2 браузера рядом** — это главный визуальный wow
2. Создать карточку → она мгновенно появляется во втором браузере
3. Перетащить карточку → то же самое
4. Открыть Cmd+K → ввести "Срочно сделать баг-фикс до завтра" → AI распарсил priority/deadline
5. Перетащить карточку в Done → правило срабатывает → у всех всплывает уведомление → в Event Log видно поток
6. Зайти в админку → создать новое правило → проверить что работает
7. Слайд с архитектурой: "Любое действие → BullMQ → Worker → Postgres + Socket.io"

---

## 15. ВАЖНЫЕ ТЕХНИЧЕСКИЕ ДЕТАЛИ

- **Board ID:** hardcoded `board-1` (одна доска, нет multiple boards)
- **Auth:** нет — просто `userId` из localStorage/select
- **Socket.io rooms:** `board:${boardId}` для обновлений доски, `user:${userId}` для уведомлений
- **Worker:** должен быть запущен отдельно — без него события не обрабатываются
- **Optimistic UI:** Board.tsx делает мгновенное обновление при drag, откатывает при ошибке API
- **Dedup:** если два одинаковых события придут в BullMQ, second job проигнорируется (jobId = eventKey)
- **Версионирование:** при конфликте (409) — показать пользователю предупреждение
