# Code Review — Kanban Task Manager (Хакатон MVP)
> Staff/Principal Engineer review · 17 мая 2026

---

## Общее впечатление

Проект крепкий. Архитектура не просто задекларирована — она реально реализована: BullMQ worker как отдельный процесс, Socket.io на custom server, Zod-валидация на входе, оптимистичное блокирование, WIP-лимиты, automation engine. Это не болванка с туториала.

Главная проблема — несколько специфических следов AI-генерации, которые опытный жюри заметит. Устранив их + пару конкретных багов, проект будет выглядеть как сильная работа реальной команды.

---

## 1. Архитектура

**Что хорошо:**
- Разделение ответственности логичное: API route → DB write → enqueue → worker → socket emit. Правильный event-driven flow.
- Custom server (`server.ts`) для Socket.io — единственное верное решение для Next.js App Router. Команда это понимает, что видно из комментария.
- Worker как отдельный процесс — не заглушка, реально запускается через `npm run worker`.
- Singleton-паттерн для Prisma/Redis/Queue через `globalThis` — правильно для Next.js hot reload.
- Automation engine отделён от worker'а — хорошая граница ответственности.

**Проблемы:**

**P1 — Переусложнённый `KanbanEventSchema` (мёртвый код):**
В `events/types.ts` определён огромный discriminated union с Zod-схемами для каждого типа события (`CardCreatedPayloadSchema`, `CardMovedPayloadSchema` и т.д.), но он **нигде не вызывается с `.parse()` или `.safeParse()`**. Payload в worker'е принимается как `unknown`, в API routes — валидируются только входящие HTTP-параметры (другими, более простыми схемами). Сам `KanbanEventSchema` — это 40 строк нерабочего кода, который выглядит как архитектурный задел, но не приносит пользы. Для жюри это либо непонятно, либо выглядит как незаконченность.

Решение: либо удалить `KanbanEventSchema` и payload-схемы, оставив только `KanbanJobData` + event type string union, либо реально использовать их в worker'е для валидации payload'а перед обработкой.

**P2 — `getBoardId` в worker'е:**
```typescript
function getBoardId(type: EventType, payload: Record<string, unknown>): string {
  const boardId = payload.boardId as string | undefined
  if (boardId) return boardId
  return process.env.DEFAULT_BOARD_ID || 'board-1'
}
```
Параметр `type` принимается, но не используется. Это либо dead arg, либо задел, который не был дописан. Убрать его.

**P3 — `board.upsert` на каждый GET:**
В `/api/board/route.ts` и `/api/columns/route.ts` — `prisma.board.upsert(...)` при каждом запросе. Это 2 лишних query в горячем пути. Для хакатона — терпимо, но если жюри смотрит в код — видят.

---

## 2. Чистота кода

**`Board.tsx` — 769 строк, это много:**
Компонент делает слишком много: header, drag-and-drop логика, column dialog (7 state-переменных), socket subscription, card/column CRUD handlers. Самый простой рефакторинг — вынести column dialog в отдельный компонент `ColumnDialog.tsx`. Это займёт 15 минут и сразу уберёт ~100 строк.

**Дублирование `ApiResponse<T>`:**
Тип определён в трёх местах:
- `events/types.ts` — `ApiSuccess<T>` / `ApiError` / `ApiResponse<T>`
- `Board.tsx` — локальный `interface ApiResponse<T>`
- `AdminRulesDialog.tsx` — ещё один локальный `interface ApiResponse<T>`

При этом версия из `events/types.ts` нигде не импортируется компонентами — они определяют свою. Убрать локальные, импортировать из types.

**Dead code в `utils.ts`:**
```typescript
export const PRIORITY_COLORS = { ... }  // нигде не используется
export const PRIORITY_BORDER = { ... }  // нигде не используется
```
`PRIORITY_LABELS` используется везде, а эти два объекта — нет. Убрать.

**Дублирование labels для событий:**
`EventLogPanel.tsx` определяет свой `eventLabels: Record<string, string>`, а в `utils.ts` уже есть `EVENT_TYPE_LABELS` с теми же данными (и с emoji). Это один и тот же словарь, разбросанный по двум местам. Объединить.

**Бесполезный useCallback:**
```typescript
const handleBoardUpdate = useCallback(() => {
  void refreshBoard()
}, [refreshBoard])
```
Это просто обёртка вокруг одной функции. `handleBoardUpdate` везде мог бы быть просто `refreshBoard`. Аналогично:
```typescript
// useSocket вызывается с:
onBoardUpdate: handleBoardUpdate
// При том что handleBoardUpdate === () => void refreshBoard()
```

**`columnColors` в `Column.tsx` — ненадёжный подход:**
```typescript
const columnColors: Record<string, string> = {
  '#007aff': 'border-t-blue-500',
  ...
}
```
Этот lookup используется так: `columnColors[column.color || ''] || 'border-t-slate-200'`. Но при этом ниже тот же `accentColor` применяется через inline style: `borderTopColor: accentColor`. То есть цвет top border устанавливается **дважды** — через inline style (всегда) и через Tailwind class (иногда). Inline style перебивает Tailwind class в любом случае, так что весь `columnColors` lookup — мёртвый код. Можно убрать.

**Неиспользуемые зависимости в `package.json`:**
- `date-fns` — установлена, нигде не импортируется
- `canvas-confetti` — установлена, нигде не используется
- `@radix-ui/react-switch`, `@radix-ui/react-tabs`, `@radix-ui/react-tooltip`, `@radix-ui/react-separator`, `@radix-ui/react-label` — ни одна из этих не используется в коде

Это 6 лишних зависимостей. При взгляде на `package.json` жюри может заметить, что зависимостей больше, чем кода.

---

## 3. Следы AI-generated кода

Вот конкретные места, которые палятся:

**3.1 — Файлы планирования в корне проекта**
В корне лежат: `design-brief.md`, `implementation-guide.md`, `project-notes.md`, `roadmap.md`. Это AI-артефакты планирования, которые не должны быть в репозитории перед сдачей. Жюри, открыв репо, увидит папку с файлами "implementation-guide.md" и сразу поймёт, что это был AI-workflow. Удалить или переложить в `/docs`.

**3.2 — Структура `events/types.ts` — "слишком идеальная"**
77 строк строго типизированных Zod-схем, полный discriminated union, `ServerToClientEvents`/`ClientToServerEvents` интерфейсы. Это выглядит как enterprise TypeScript SDK. Для хакатона — избыточно. Жюри видит: "это сгенерировано, потому что человек бы не стал это писать за хакатон-ночь". 

Конкретная проблема: `ApiSuccess<T>` / `ApiError` / `ApiResponse<T>` в этом файле — классический AI-шаблон generic error/success wrapper, который в реальном коде никто не использует (что и случилось — компоненты определили свои локальные версии).

**3.3 — JSDoc комментарии везде**
```typescript
/**
 * BullMQ Event Worker — отдельный процесс.
 * Запуск: npm run worker (tsx watch src/worker.ts)
 * Прод: node dist/worker.js
 */
```
```typescript
/**
 * Custom Next.js server with Socket.io attached.
 * Run: tsx server.ts (dev) or node dist/server.js (prod)
 *
 * This is needed because Socket.io requires access to the raw http.Server,
 * which App Router API routes don't expose.
 */
```
```typescript
/**
 * Automation engine: evaluates rules against events.
 * Called by the worker after each event is processed.
 */
```

Каждый файл начинается с идеального JSDoc блока. Реальная команда так не пишет — они добавляют комментарии к сложным местам, а не к каждому файлу. Оставить 1-2 важных (например, объяснение кастомного сервера — это реально полезно), остальные убрать или переформатировать в `//`.

**3.4 — `emptyToSentinel` / `sentinelToEmpty` в `AdminRulesDialog.tsx`**
```typescript
const EMPTY_VALUE = '__empty__'

function emptyToSentinel(value: string | undefined | null) {
  return value && value.length > 0 ? value : EMPTY_VALUE
}
function sentinelToEmpty(value: string) {
  return value === EMPTY_VALUE ? '' : value
}
```
Это решение правильное по сути (Select требует non-empty string value), но функции с названиями `emptyToSentinel`/`sentinelToEmpty` — очень AI-стиль. Реальный разработчик написал бы `toSelectValue`/`fromSelectValue` или просто инлайн без выноса в функцию. Переименовать.

**3.5 — Unnaturally uniform error handling**
Каждый API route возвращает `{ error: ..., ok: false }` — идеально консистентно. Реальная команда за хакатон обычно делает несколько по-разному. Это не проблема для кода, но создаёт впечатление шаблонности.

**3.6 — `RegexParse` в `ai-parse/route.ts` — `datePatterns` с нерабочим кодом**
```typescript
{ regex: /до\s+(понедельника|вторника|среды|четверга|пятницы|субботы|воскресенья)/i, 
  offset: { пятницы: 4, четверга: 3, среды: 2, вторника: 1, понедельника: 0, субботы: 5, воскресенья: 6 } },
```
Объект `offset` определён, но в логике обработки не используется — код только проверяет `'days' in p`, а у этого элемента нет `days`. То есть паттерн "до пятницы" никогда не будет обработан. Это классический AI-incomplete implementation — структура выглядит продуманно, но не работает до конца.

---

## 4. Code Style

**Хорошо:**
- Именование переменных и функций консистентное
- Imports организованы логично (third-party → internal)
- JSX читаемый, Tailwind-классы не превращаются в месиво

**Проблемы:**
- В `Board.tsx` функции смешивают стили объявления: `function handleDragStart()`, `async function handleDragEnd()`, `async function handleSaveCard()` — все через `function`, но `handleBoardUpdate` и другие — через `const` с useCallback. Лучше выбрать одно.
- `EventLogPanel.tsx` показывает `payload.fromColumnId` и `payload.toColumnId` как raw ID строки. Жюри на демо увидит `"col-todo" → "col-inprogress"` вместо `"To Do → In Progress"`. Это конкретный баг визуала.
- В `Board.tsx` строка `const sourceColumn = columns.find((column) => column.id === dragCard.columnId) || findColumn(active.id as string)` — двойной поиск источника колонки при drag end, первый из которых может дать устаревший `columnId` после оптимистичного обновления state. Работает, но логика запутана.

---

## 5. Frontend

**Сильные стороны:**
- UI выглядит целостно. Glassmorphism (`bg-white/70 backdrop-blur-sm`), скруглённые углы (`rounded-[24px]`), цветные акценты колонок — это смотрится профессионально.
- CommandPalette с `Cmd+K` — настоящий wow-эффект. Работает, красиво открывается, есть "AI распознал".
- EventLogPanel — живая лента событий с анимирующимся LIVE-индикатором. Это главный demo-killer feature.
- WIP limit с индикатором предупреждения — жюри такое замечает и ценит.
- Drag overlay с `rotate-2 scale-105 shadow-2xl` — приятная деталь.

**Проблемы:**

**F1 — Hardcoded `userId="user1"` в `page.tsx`:**
```typescript
<Board initialColumns={...} boardId={BOARD_ID} boardName={board.name} userId="user1" />
```
При первом открытии страницы всегда будет user1, пока не загрузится localStorage. Если localStorage пустой (первый визит), пользователь всегда будет user1. Это нормально по условию задания, но это hardcoded string в JSX — выглядит как недоделка.

Простое решение: сделать `DEFAULT_USER_ID = 'user1'` константой и передавать её.

**F2 — "AI распознал" при regex:**
CommandPalette показывает "AI распознал" и иконку `Zap`, когда распознаёт паттерны — но это просто regex в компоненте, без вызова API. Если на демо жюри спросят "а это настоящий AI?", ответить будет неловко. Либо переименовать в "Умный ввод" / "Автораспознавание", либо подключить реальный `ai-parse` API к CommandPalette (тем более он уже реализован в `handleCreateCardFromCommand`).

**F3 — Column dialog в Board.tsx:**
7 state-переменных для одного диалога (`columnDialogOpen`, `columnDialogMode`, `columnDraftName`, `columnDraftColor`, `columnDraftWipLimit`, `columnTarget`, `columnSubmitting`) и ~130 строк логики. Это должен быть `ColumnDialog.tsx`. Такой рефакторинг сделает Board.tsx ~630 строк вместо 769 и сделает компонент понятнее.

**F4 — `NotificationsPopover` использует Radix Popover напрямую:**
```typescript
import * as Popover from '@radix-ui/react-popover'
```
Все остальные компоненты используют shadcn/ui обёртки. Это несогласованность — либо использовать shadcn Popover, либо везде Radix напрямую.

---

## 6. Backend

**Что хорошо:**
- Zod-валидация на входе всех POST/PATCH endpoint'ов
- Optimistic locking через `version` поле реализован
- Дедупликация через `eventKey` на уровне DB constraint + BullMQ `jobId` — двойная защита
- try/catch в worker'е с обновлением статуса события на FAILED
- Graceful shutdown через SIGTERM/SIGINT в worker'е

**Проблемы:**

**B1 — Optimistic locking — race condition (TOCTOU):**
```typescript
// api/cards/[id]/route.ts
const current = await prisma.card.findUnique({ where: { id: params.id }, select: { version: true } })
if (current.version !== clientVersion) return 409
const card = await prisma.card.update({ where: { id: params.id }, data: { version: { increment: 1 } } })
```
Между `findUnique` и `update` другой запрос может успеть обновить карточку. True optimistic lock — это `UPDATE cards WHERE id=? AND version=? RETURNING *` с проверкой affected rows. Через Prisma это сделать сложнее, но можно через `$executeRaw` или добавив version в where:
```typescript
const card = await prisma.card.updateMany({
  where: { id: params.id, version: clientVersion },
  data: { ...changes, version: { increment: 1 } },
})
if (card.count === 0) return 409
```
Для хакатона текущая версия работает в 99% случаев, но стоит упомянуть это ограничение, если жюри спросит.

**B2 — Нет try/catch в большинстве API routes:**
Если Prisma бросит исключение (потеря соединения, timeout), Next.js вернёт 500 с HTML-страницей ошибки, а не JSON. Для хакатона — не критично, но на демо если что-то упадёт, клиент получит непарсящийся ответ. Добавить общий try/catch в каждый route занимает 3 минуты.

**B3 — `card.move` API не атомарна:**
```typescript
await prisma.card.update({ where: { id: cardId }, data: { columnId: toColumnId, order, version: { increment: 1 } } })
await prisma.card.updateMany({ where: { columnId: toColumnId, id: { not: cardId }, order: { gte: order } }, data: { order: { increment: 1 } } })
```
Две отдельные операции без транзакции. Если вторая упадёт, карточка переместится, но порядок в колонке будет нарушен. Завернуть в `prisma.$transaction([...])`.

**B4 — `runAutomation` может зациклиться:**
Если правило типа `card.moved → move_to_column`, то перемещение карточки внутри `executeAction` снова вызовет `enqueueEvent('card.moved', ...)`, что снова запустит worker, который снова вызовет automation... Нет защиты от цикличных правил. Для хакатона — просто документировать в README.

**B5 — Нет обработки `tag.added` событий:**
В `types.ts` и `automation.ts` есть поддержка `tag.added` как trigger type. В UI AdminRulesDialog позволяет создать правило с `triggerType: 'tag.added'`. Но в коде никогда не вызывается `enqueueEvent('tag.added', ...)`. Этот триггер никогда не сработает. Либо реализовать, либо убрать из UI.

---

## 7. Real-time

**Что хорошо:**
- Правильная архитектура: room per board (`board:${boardId}`), user room для notifications (`user:${userId}`)
- Ref-based callbacks в `useSocket` — правильное решение для предотвращения stale closures
- Module-level socket singleton (`let socket: TypedSocket | null = null`) — работает корректно с `'use client'`

**Проблемы:**

**RT1 — Полный refetch на каждое событие:**
```typescript
const handleBoardUpdate = useCallback(() => {
  void refreshBoard()  // GET /api/board — полный fetch колонок + всех карточек
}, [refreshBoard])
```
Любое событие (переименование колонки, добавление тега) вызывает полный перезагрузку доски. При 5 одновременных пользователях это 5× запросов. Для хакатона — нормально, но это видно на демо как небольшой "моргание" при обновлении. Лучше: parse payload в `handleBoardUpdate` и делать targeted state update.

**RT2 — Двойной update при drag:**
Пользователь перетаскивает карточку → frontend optimistically обновляет columns state → API вызывается → worker эмитит `board:update` → клиент снова вызывает `refreshBoard()` и перезаписывает state. Это вызывает лёгкое мерцание после drag-end. Решение: в `handleBoardUpdate` проверять, не является ли событие нашим собственным (по userId), и не делать refetch в этом случае.

**RT3 — EventLog показывает сырые IDs:**
```typescript
{'fromColumnId' in payload && 'toColumnId' in payload && (
  <p className="text-xs text-muted-foreground">
    {String(payload.fromColumnId)} → {String(payload.toColumnId)}  // "col-todo" → "col-inprogress"
  </p>
)}
```
На демо это будет выглядеть некрасиво. Нужно резолвить IDs в имена колонок. Board уже хранит columns в state — передать их в EventLogPanel и делать lookup.

---

## 8. Database

**Что хорошо:**
- Правильные cascade deletes (`onDelete: Cascade`)
- `version` на Card для optimistic locking
- `eventKey @unique` — дедупликация на уровне DB

**Проблемы:**

**DB1 — `assigneeId` на Card — мёртвое поле:**
```prisma
model Card {
  assigneeId  String?   // это поле есть в схеме...
```
Но оно нигде не используется — ни в API routes, ни в компонентах, ни в seed. Это либо задел, либо забытая фича. Убрать или реализовать.

**DB2 — Нет индексов на часто-запрашиваемые поля:**
```prisma
model Card {
  columnId    String   // нет @@index
  order       Int      // нет @@index
}
model Column {
  boardId     String   // нет @@index
}
model Notification {
  userId      String   // нет @@index
}
```
Для хакатона с малым объёмом данных не критично. Но если добавить несколько строчек — это плюс к впечатлению:
```prisma
@@index([columnId, order])
```

**DB3 — `Notification.id` создаётся через `uuidv4()` в коде:**
```typescript
const notif = await prisma.notification.create({
  data: { id: uuidv4(), ... }
})
```
Все остальные модели используют `@id @default(cuid())` в схеме. Это непоследовательность. Убрать явный `id: uuidv4()` из кода и добавить `@default(cuid())` в схему.

**DB4 — Event таблица растёт бесконечно:**
Нет ни TTL, ни cleanup job. BullMQ queue чистится (`removeOnComplete: { count: 100 }`), а вот PostgreSQL `Event` таблица — нет. Для хакатона — не проблема, но стоит упомянуть в README.

---

## 9. DX

**`npm run dev` работает** — это самое важное. `docker-compose up` поднимает Postgres + Redis, `npm run db:seed` заполняет данными.

**Seed файл хорош** — реальные карточки с описаниями, настроенные правила автоматизации, один rule намеренно выключен ("включить на демо"). Это видно как продуманная подготовка к demo.

**Проблема: README.md не существует** (или не в workspace). Это критично для хакатона — README с архитектурной схемой и инструкцией по запуску обязателен. Без него жюри не поймёт, как запустить проект.

**`.env.example` есть** — хорошо.

**Проблема: planning docs в корне.** `design-brief.md`, `implementation-guide.md`, `project-notes.md`, `roadmap.md` — их нужно убрать из корня или поместить в `.ai-planning/` (gitignored).

---

## 10. Hackathon-fit

**Сильные стороны (wow-факторы для демо):**
1. **EventLog панель** — живой поток событий с LIVE-индикатором. Это главный визуальный аргумент для "event-driven архитектуры". Открыть, подвигать карточку — жюри видит событие в реальном времени.
2. **Automation rules UI** — полноценный редактор "триггер → действие". Это сложнее, чем большинство хакатон-проектов делают за ночь.
3. **Cmd+K CommandPalette** — неожиданная деталь, которую жюри запомнит.
4. **WIP limits** — показывает понимание Kanban-методологии, а не просто "колонки с карточками".
5. **Drag & drop колонок** — не только карточек, но и самих колонок.

**Слабые стороны (вредят впечатлению):**
1. EventLog показывает сырые ID (`"col-todo" → "col-inprogress"`). Это заметит каждый.
2. "AI распознал" в CommandPalette — это просто regex, без реального AI-парсера. Если демо показывается оффлайн без `ANTHROPIC_API_KEY` — фича выглядит обманчиво.
3. `canvas-confetti` в зависимостях, но не реализован. Было бы мощно: карточка улетает в "Done" — конфетти. Займёт 10 минут.
4. Planning-файлы в корне репозитория.

---

## 11. Performance

**Нет критических проблем** для хакатонного масштаба.

Лишний ререндер на каждом событии (полный refetch доски) — единственное заметное место. При 3-4 пользователях одновременно это создаёт небольшое мерцание при быстром перетаскивании. Не критично для демо.

`useMemo` для `currentUserName` и `isAdmin` — правильно применено.

`Board.tsx` не мемоизирует children (Column, Card) — каждое изменение columns state ре-рендерит все колонки. Добавление `React.memo` на `KanbanColumn` и `KanbanCard` убрало бы ненужные ре-рендеры, но для хакатона — не критично.

---

## 12. Security / Basic Safety

**Можно игнорировать для хакатона:**
- Нет аутентификации — это условие задания
- `userId` в query params (DELETE) выглядит плохо, но для хакатона без auth — нормально
- Нет rate limiting
- CORS настроен через env var — хорошо

**Стоит исправить:**
- `ai-parse` route делает fetch к Anthropic API без timeout. Если Anthropic висит, запрос будет ждать бесконечно. Добавить `AbortSignal.timeout(5000)`.
- `JSON.parse(content)` в `claudeParse` без проверки структуры — если Claude вернёт не JSON, упадёт в catch и вернёт regex результат. Это нормальный fallback, но стоит добавить `if (!parsed.title)` проверку.

---

## 13. Что нужно срочно исправить

### Критично (до сдачи, влияет на демо):

1. **EventLog: показывать названия колонок, а не ID.**
   Передать `columns` в `EventLogPanel`, добавить helper `getColumnName(id: string)`.

2. **Удалить planning docs из корня** (`design-brief.md`, `implementation-guide.md`, `project-notes.md`, `roadmap.md`) или gitignore их.

3. **Написать README.md** с: стек, архитектурная схема (текстом), как запустить локально (3 команды), как задеплоить на Railway.

4. **Убрать мёртвый `KanbanEventSchema`** из `events/types.ts` — либо использовать для валидации в worker'е, либо удалить. Оставлять нерабочий impressive-looking код хуже, чем не иметь его.

### Желательно (улучшат восприятие):

5. **Убрать dead dependencies**: `date-fns`, `canvas-confetti` (или реализовать confetti при перемещении в Done), неиспользуемые Radix пакеты.

6. **Убрать dead code**: `PRIORITY_COLORS`, `PRIORITY_BORDER` из utils.ts, `columnColors` из Column.tsx.

7. **Убрать `assigneeId`** из Prisma schema (или добавить в UI).

8. **Переименовать** `emptyToSentinel`/`sentinelToEmpty` → `toSelectValue`/`fromSelectValue`.

9. **Объединить дублирующиеся `eventLabels`** в EventLogPanel и `EVENT_TYPE_LABELS` в utils.

10. **Добавить confetti** при drag карточки в колонку с именем "Done/Готово" — `canvas-confetti` уже установлен, добавить 5 строк в `handleDragEnd`.

### Можно не трогать:

- Optimistic locking race condition (теоретическая проблема)
- Отсутствие индексов в Prisma
- Polling fallback для Socket.io
- Отсутствие транзакции в card.move (реально ломается только при одновременных moves)
- Automation loop (просто задокументировать)

---

## 14. Что стоит упростить

**14.1 — Board.tsx column dialog:**

Сейчас: 7 state-переменных в Board.tsx + ~130 строк логики.

Лучше: один объект состояния в отдельном компоненте:
```typescript
// ColumnDialog.tsx — 80 строк, изолированная логика
interface ColumnDialogProps {
  mode: 'create' | 'edit' | 'delete' | null
  column?: Column
  boardId: string
  onSuccess: () => void
  onClose: () => void
}
```
Почему лучше: Board.tsx становится читаемым (600 строк вместо 769), логика колонок изолирована, нет 7 лишних state в родителе.

**14.2 — `KanbanEventSchema` — упростить или использовать:**

Если оставить — добавить валидацию в worker:
```typescript
// worker.ts, внутри обработчика
const parsed = KanbanEventSchema.safeParse({ type, payload, eventKey })
if (!parsed.success) {
  console.error('[Worker] Invalid event payload:', parsed.error)
  throw new Error('Invalid payload')
}
```
Если убрать — удалить 40+ строк из types.ts, оставить только `EventType` string union и `KanbanJobData`.

**14.3 — Дублирование API response типа:**

Вместо трёх определений — один в общем месте:
```typescript
// types/kanban.ts — уже существует, добавить туда:
export interface ApiResponse<T> {
  ok: boolean
  data?: T
  error?: string
}
```
И убрать из `Board.tsx` и `AdminRulesDialog.tsx`.

---

## 15. Финальная оценка

| Критерий | Оценка | Комментарий |
|----------|--------|-------------|
| **Архитектура** | 8/10 | Event-driven реально работает, разделение процессов правильное. Минус за нерабочий KanbanEventSchema. |
| **Code Quality** | 6.5/10 | Board.tsx великоват, dead code, дублирование types. Но логика в целом чистая. |
| **UX** | 8.5/10 | Визуально сильно. Glassmorphism, CommandPalette, EventLog — запоминается. |
| **Стабильность** | 7/10 | Нет try/catch в routes, TOCTOU в optimistic lock, нерабочий tag.added trigger. |
| **Впечатление для жюри** | 7.5/10 | Сейчас: сырые IDs в EventLog и planning-файлы в репо снижают. После фиксов: 8.5/10. |
| **"Работа сильной команды"** | 7/10 | Сейчас видны следы AI-генерации. После чистки — 8.5/10. |

**Главный совет:** Потратьте 1.5-2 часа на:
1. README.md (30 мин)
2. Удаление planning-файлов и dead code (20 мин)
3. Исправление EventLog с column names вместо IDs (20 мин)
4. Confetti при перемещении в Done (10 мин)
5. Вынос column dialog в отдельный компонент (30 мин)

После этого проект будет выглядеть как качественная, продуманная инженерная работа, а не как AI-generated MVP.
