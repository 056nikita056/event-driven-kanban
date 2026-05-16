# Kanban Hackathon — План разработки

**Дедлайн:** 17 мая, 21:00 (Екб) · **Команда:** Никита (FE/PM/Design) + Стёпа (BE/Infra) · **Сейчас:** 16 мая, начало дня

---

## 1. Конкурентный анализ — что брать, что игнорить

| Продукт | Что украсть | Что НЕ копировать |
|---|---|---|
| **Linear** | Cmd+K palette, speed, минималистичный UI, inbox с событиями, keyboard-first | Cycles, projects hierarchy |
| **Trello** | Простота drag&drop, Power-Ups как метафора правил | Слабая automation |
| **Jira** | Workflows, sprint planning терминология | Сложность настроек, тяжёлый UI |
| **Notion** | Slash-команды в описании, гибкие свойства | Универсальность (нам не нужна) |
| **ClickUp** | Views, AI-фичи, custom automation | Перегруженность |
| **Monday** | Цветные колонки, визуальный board | Хаотичность UI |
| **Asana** | Timeline вид, my tasks | Чрезмерные настройки |

**Главный инсайт:** event-driven архитектура (которая у нас и так в ТЗ) — отличный повод сделать **Visual Event Log** как в Linear inbox. Никто из конкурентов не показывает поток событий красиво — а у нас он есть by design. **Это наш главный визуальный козырь.**

---

## 2. Приоритизация фич

### MUST HAVE (без этого не сдаём)
1. Kanban доска: To Do / In Progress / Done + возможность добавить колонку
2. CRUD карточек (title, description, priority, tags, deadline)
3. Drag & drop между колонками (@dnd-kit)
4. **Event flow:** действие → BullMQ → Worker → Postgres → Socket.io → клиенты
5. Дедупликация по `eventKey`, валидация payload через zod
6. 2–3 рабочих правила автоматизации (хотя бы одно настраиваемое)
7. Real-time у двух открытых браузеров (это **главное** на демо)
8. Уведомления (in-app, всплывающие)
9. Минимальная админка: CRUD колонок + список правил
10. Деплой на Railway + README

### SHOULD HAVE (даёт wow-эффект, делаем после MUST)
11. **Visual Event Log** — sidebar со стримом событий (легко делать, выглядит мощно)
12. **Cmd+K command palette** — быстрое создание карточки, переход к карточке
13. **AI-парсер карточки** — пишешь "Срочно сделать отчёт до пятницы для Ивана" → создаётся карточка с priority=URGENT, deadline=пятница, tags=[review]
14. WIP-лимиты с цветовой подсветкой колонки
15. Optimistic UI + rollback при ошибке
16. Selector пользователя (admin/user1/user2) вместо авторизации

### NICE TO HAVE (только если идём по графику)
17. Live presence — точки других юзеров на доске
18. AI summary дня ("Что произошло за день?")
19. Slash-команды в описании (/deadline /priority)
20. Confetti при движении в Done
21. Toast-уведомления с soft-sound
22. Smart automation suggestions ("80% urgent карточек закрываются вручную — создать правило?")

### НЕ ДЕЛАЕМ (категорически)
- Auth / регистрация (селект юзера в углу)
- Mobile-вёрстка
- Файлы, комментарии, чат
- Несколько досок
- Time tracking, sprint planning
- Reports/charts
- Email/Slack интеграции
- Permissions/roles по-настоящему

---

## 3. Порядок реализации (критический путь)

Стрелка = блокирует:

```
schema.prisma → миграции → Prisma client
       ↓
   /api/cards CRUD → BullMQ enqueue
       ↓                ↓
   Worker stub      Frontend Board (моки)
       ↓                ↓
   real handler ←→ Frontend ↔ API (контракт согласован)
       ↓
   Socket.io ↔ обновления у клиентов  ← ПЕРВАЯ ДЕМОНСТРИРУЕМАЯ ВЕХА
       ↓
   Automation engine (1 hardcoded правило)
       ↓
   Уведомления в UI
       ↓
   Админка (CRUD правил)
       ↓
   Деплой Railway  ← КРИТИЧНО: первый деплой к концу дня 1
       ↓
   Polish + Wow-фичи + Демо-сценарий
```

**Правило:** деплой делаем **в первый же день**, пусть хоть hello-world. Никогда не оставляем деплой на последний час.

---

## 4. Timeline по часам (2 дня)

### День 1 — 16 мая (суббота)

| Время | Никита (FE/Design/PM) | Стёпа (BE/Infra) |
|---|---|---|
| 10:00–11:00 | Setup Next.js + Tailwind + shadcn, базовый layout | Railway проект, Postgres + Redis services, docker-compose локально |
| 11:00–13:00 | Дизайн-набросок board (Figma/в коде), компоненты Board/Column/Card (моки) | `schema.prisma`, миграции, seed (2 доски, 3 колонки, ~10 карточек, 3 юзера) |
| 13:00–14:00 | **Обед / синк по API-контракту** (5 минут на zod-схемы событий — фиксируем types.ts) |
| 14:00–17:00 | `@dnd-kit` интеграция, CardModal с формой | `/api/cards`, `/api/columns` (CRUD), BullMQ setup, `worker.ts` skeleton |
| 17:00–19:00 | Подключить FE к API, optimistic updates | Event handlers: `card.created`, `card.moved`. Дедупликация |
| 19:00–21:00 | Visual Event Log компонент + Cmd+K palette | Socket.io: server + client emit/listen, первый real-time event |
| 21:00–22:00 | **СИНК. Merge на main. Деплой на Railway. Проверка что работает в проде.** |

**Цель дня 1:** видеть, как карточка, созданная в одном браузере, появляется в другом — на проде.

### День 2 — 17 мая (воскресенье)

| Время | Никита | Стёпа |
|---|---|---|
| 09:00–11:00 | Уведомления (Toast), Activity sidebar, доработка дизайна | Automation engine, 2 правила: "card → Done = notify", "tag:urgent → move to In Progress" |
| 11:00–13:00 | Админка UI: колонки, правила (формы) | API для админки, поддержка кастомных правил из БД |
| 13:00–14:00 | **Обед / тест real-time с двух браузеров** |
| 14:00–16:00 | **AI-парсер карточек** (OpenAI/Claude API, простой prompt) + Confetti | Polish: error handling, retry в BullMQ, метрики событий |
| 16:00–18:00 | WIP limits UI, smart-look polish, иконки, скриншоты | Финальные баги, проверка durability (рестарт worker — события не потеряны) |
| 18:00–19:00 | **README + архитектурная диаграмма + демо-сценарий** | Финальный деплой, проверка прод |
| 19:00–20:00 | **Репетиция демо** (минимум 3 прогона) |
| 20:00–21:00 | **Буфер на пожары** — не планировать ничего нового |

---

## 5. Разделение задач

### Никита — Frontend / Design / Project / Demo

- Setup проекта (вместе со Стёпой)
- Все компоненты: `Board`, `Column`, `Card`, `CardModal`, `Toast`, `EventLog`, `CommandPalette`
- Drag & drop через @dnd-kit (одна из самых частых ошибок — пихнуть в Card, а не Column DroppableContainer)
- Дизайн-система (Tailwind токены, shadcn-палитра)
- Админка UI
- Интеграция с Socket.io клиентом
- AI-парсер UI (input + вызов API)
- README, скриншоты, демо-сценарий, репетиция

### Стёпа — Backend / Worker / Infra

- Prisma schema + миграции + seed
- API routes (`/api/cards`, `/api/columns`, `/api/rules`)
- `lib/queue.ts` (BullMQ), `lib/redis.ts`, `lib/socket.ts`
- `worker.ts` (отдельный процесс)
- `events/handlers/*` — по handler-у на каждый тип
- `events/automation.ts` — движок правил
- Socket.io сервер (custom server.ts или адаптер)
- Дедупликация (`eventKey unique`), optimistic locking (`version`)
- Endpoint для AI-парсера (proxy к Claude/OpenAI API)
- Railway деплой (web + worker — два сервиса)

### Точки синхронизации
- **13:00 день 1:** API-контракт зафиксирован в `events/types.ts` (zod-схемы) — это единственный источник правды для FE и BE.
- **21:00 день 1:** мердж в main + деплой.
- **13:00 день 2:** real-time проверка с двух устройств.
- **18:00 день 2:** feature freeze. Только баг-фиксы.

---

## 6. Что зафейкать для демо

| Часть | Фейк |
|---|---|
| Авторизация | Селектор юзера (admin/user1/user2) в углу. Все могут всё. |
| Email/Slack notify | Только in-app toast, других каналов нет. |
| Если AI-парсер не успели | Hardcoded "smart parser": regex на ключевые слова "срочно", "до", даты. Выглядит как AI. |
| Если Smart Suggestions не успели | На демо вручную кликнуть "Suggest rule" → показать заранее заготовленный текст. |
| Permissions | Все админы. Кнопка "admin" просто меняет URL. |
| Несколько досок | Одна board, hardcoded boardId в seed. |
| Bulk actions | Нет — у нас drag&drop. |

---

## 7. План деплоя

1. **Railway проект** на день 1, 10:00. Подключить Postgres + Redis из marketplace.
2. **Два сервиса из одного репо:**
   - `web` — Next.js (`npm run start`)
   - `worker` — `node dist/worker.js` (build через `tsx` или скомпилировать)
3. **ENV vars** в Railway: `DATABASE_URL`, `REDIS_URL`, `NEXT_PUBLIC_SOCKET_URL`, `ANTHROPIC_API_KEY`.
4. **Healthcheck endpoint** — `/api/health` (проверяет Postgres + Redis).
5. **Auto-deploy on push to main.** Каждый коммит = деплой.
6. **Custom server** для Socket.io: либо `server.ts` рядом с Next.js, либо отдельный socket service. На Railway это нюанс — лучше встроить в Next.js через App Router и кастомный server.
7. **Прогрев перед демо:** seed-запуск на проде (10 карточек, 2 правила), чтобы доска не была пустой.

---

## 8. Что обязательно показать на демо (сценарий 4–5 минут)

**Откройте 2 браузера рядом — это ключевой визуальный wow.**

1. **(30 сек)** Показ доски с уже заполненной seed-data — выглядит как готовый продукт.
2. **(45 сек)** Создаю карточку обычным способом → она мгновенно появляется во втором браузере. Перетаскиваю — то же самое.
3. **(45 сек)** Открываю **Cmd+K** → создаю карточку через AI-парсер: "Срочно подготовить отчёт до пятницы". Показываю, что AI правильно распарсил priority/deadline.
4. **(45 сек)** Перетаскиваю карточку в Done → срабатывает правило → у всех всплывает уведомление "Карточка завершена". В Visual Event Log видно поток `card.moved → rule.triggered → notification.sent`.
5. **(45 сек)** Захожу в админку → создаю новое правило ("если tag = bug → перемещать в In Progress") → проверяю, что работает.
6. **(30 сек)** Архитектура слайдом: "Любое действие → BullMQ → Worker → Postgres + Socket.io. Дедупликация по eventKey, optimistic locking через version, ретраи в очереди." Покажи Visual Event Log — это и есть доказательство что архитектура работает.
7. **(15 сек)** Итог: чем мы лучше конкурентов (AI parser + visual event stream + real-time).

**Демо-трюк:** на main display — клиент 1, на втором экране проектора — клиент 2. Аудитория видит синхронизацию сразу.

---

## 9. Типичные ошибки, убивающие такие проекты

1. **Деплой в последний час.** → Деплоим в день 1, вечером.
2. **Слишком много фич, ничего не доделано.** → Жесткий MUST/SHOULD/NICE, NICE трогаем только если MUST зелёный.
3. **Несогласованный API-контракт.** → `events/types.ts` фиксируется к обеду дня 1.
4. **Пустая доска на демо.** → Seed-скрипт обязателен.
5. **Не репетировали демо.** → 3 прогона минимум, последний с таймером.
6. **Socket.io не работает на проде** (классика, особенно на Railway/Vercel). → Тестируем на проде в день 1.
7. **БД мигрирована локально, забыли на проде.** → `prisma migrate deploy` в Railway build command.
8. **Worker не запущен в проде.** → На Railway это **отдельный сервис**, нужно проверить логи.
9. **Не используют AI на полную.** Вайбкодинг — это значит давать Claude/Cursor задачу целиком, а не построчно.
10. **Conflict-resolution в drag&drop** — два юзера двигают одну карточку. → Optimistic locking через `version`. Если конфликт — последний выигрывает, в UI всплывает warning.

---

## 10. Уникальные фичи поверх ТЗ (топ-10, реалистичных)

1. **AI Quick Card Parser** — естественный язык → структурированная карточка. *Сложность: 2-3 часа. Demo value: 10/10.*
2. **Visual Event Log** — sidebar со стримом событий в реальном времени, как Linear inbox. У нас уже есть события — просто их показать. *Сложность: 1-2 часа. Demo value: 9/10. Доказывает event-driven архитектуру визуально.*
3. **Cmd+K Command Palette** — Linear-style быстрые действия. *Сложность: 2 часа (cmdk библиотека). Demo value: 8/10.*
4. **Smart Automation Suggestions** — система замечает паттерн ("80% urgent → Done вручную") и предлагает создать правило. На демо можно зафейкать. *Сложность: 1 час фейк, 4 часа реально. Demo value: 9/10.*
5. **WIP Limits с цветовой подсветкой** — колонка краснеет при превышении. *Сложность: 30 мин. Demo value: 6/10.*
6. **Live Presence** — точки/аватарки других юзеров на доске. *Сложность: 2-3 часа. Demo value: 8/10.*
7. **AI Daily Summary** — кнопка "Что произошло сегодня?" → AI генерит сводку из event log. *Сложность: 1 час. Demo value: 7/10.*
8. **Slash-commands в описании** — `/deadline tomorrow`, `/priority high`. *Сложность: 2 часа. Demo value: 6/10.*
9. **Confetti + sound at Done** — мелочь, но эмоция. *Сложность: 15 мин (canvas-confetti). Demo value: 5/10.*
10. **Activity rewind** — кнопка "перемотать события за день" — анимация прогоняет события на доске. *Сложность: 3-4 часа. Demo value: 10/10. Уникально, никто такое не показывает.*

**Рекомендация:** делать #1, #2, #3 в SHOULD HAVE. #4, #6, #7, #9 — в NICE HAVE. #10 — если внезапно осталось 3 часа в день 2.

---

## 11. UX-решения от конкурентов — что брать

- **Linear:** Cmd+K (обязательно), скорость, минимализм, inbox-стиль уведомлений.
- **Trello:** простой drag&drop без 100 настроек, цвет колонки.
- **Notion:** slash-commands, плавная анимация при добавлении блока.
- **Linear:** keyboard shortcuts (J/K между карточками, X закрыть, E редактировать).
- **Jira:** terminology (To Do / In Progress / Done) — пользователи знают.
- **ClickUp:** AI-кнопки прямо в UI, не в отдельном модальном окне.

---

## 12. Если всё горит — что вырезаем (в порядке отказа)

1. Activity rewind / AI summary
2. Smart automation suggestions
3. Live presence
4. AI-парсер (заменить на простой regex)
5. Кастомные правила в админке (захардкодить 2 правила в коде)
6. Visual Event Log (показать в виде простого списка в углу)
7. Confetti / анимации
8. WIP limits

**Не вырезаем никогда:** drag&drop, real-time через socket, event-driven flow, деплой. Это ядро ТЗ.

---

## 13. Git workflow

- `main` — всегда деплоится, всегда работает.
- Крупные фичи (event log, AI parser) — feature branch на пару часов, потом merge.
- Мелкие правки (стили, копирайт) — push прямо в main, не теряем время на PR.
- **Договорённость:** Никита трогает `src/components/*`, `src/app/*`. Стёпа — `prisma/*`, `src/lib/*`, `src/events/*`, `src/worker.ts`, `src/app/api/*`. Контактные точки: `src/events/types.ts` (zod) и socket events — обсуждаем вместе.
- Pull/push каждый час. Если конфликт — синк голосом, не через мерж-инструменты.
- **Commit messages** короткие, в свободной форме. Не тратим время на conventional commits.

---

## 14. README структура (минимум)

```
# Kanban Task Manager

[GIF демо 5 секунд] [Деплой ссылка]

Event-driven канбан-система с real-time синхронизацией.

## Что внутри
- Real-time доска (Socket.io) — изменения у всех мгновенно
- Event-driven архитектура (BullMQ) — каждое действие = событие
- Движок автоматизации — правила "триггер → действие"
- AI-парсер карточек — естественный язык в структуру
- Visual event log — поток событий в реальном времени

## Архитектура
[Диаграмма: Client → Next.js API → BullMQ → Worker → Postgres + Socket.io → Clients]

Любое действие пользователя становится событием в BullMQ.
Воркер обрабатывает асинхронно, обновляет Postgres, прогоняет правила автоматизации,
рассылает обновление через Socket.io.

Дедупликация: eventKey unique в БД.
Конфликты: optimistic locking через version.

## Стек
Next.js 14, TypeScript, Prisma, PostgreSQL, Redis, BullMQ, Socket.io, Tailwind, shadcn/ui, @dnd-kit.

## Запуск локально
1. `docker-compose up -d` (postgres + redis)
2. `npm install`
3. `cp .env.example .env`
4. `npx prisma migrate dev && npx prisma db seed`
5. `npm run dev` (Next.js)
6. `npm run worker` (в отдельном терминале)

## Деплой
[Ссылка на Railway]

## Авторы
Никита (frontend, design), Стёпа (backend, infra)
```

---

## 15. AI-assisted подходы для ускорения

1. **Дай Claude/Cursor весь schema.prisma + types.ts → попроси сгенерить CRUD API целиком.** Не построчно — целым файлом.
2. **shadcn/ui CLI** — `npx shadcn add button card dialog input` — экономит часы.
3. **v0.dev** для генерации сложных UI секций (например, админка) — копипастишь готовый JSX.
4. **Один человек = один AI-чат.** Не оба в одном Cursor, конфликты.
5. **README пусть пишет AI** — дай ему `package.json`, `schema.prisma`, и пару скриншотов.
6. **Тесты не пишем.** Если очень хочется — попроси AI написать `playwright` сценарий на демо-флоу и пусть прогоняет.
7. **Парсер событий** — отличная задача для AI: дай ему zod-схему и список handlerов, попроси скелет.
8. **Для AI-парсера карточек:** Claude API c простым промптом. Не делай fine-tuning, не делай structured output через долгие схемы — обычный JSON-mode prompt.
9. **Drag&drop с @dnd-kit** — у Claude есть готовые шаблоны, не пиши с нуля.
10. **Не давай AI весь проект в контекст** — давай по слою. Так быстрее и меньше галлюцинаций.

---

## 16. Финальный чек-лист перед демо (17 мая, 18:00)

- [ ] Прод доступен по ссылке, не падает
- [ ] Real-time работает на проде с двух браузеров
- [ ] Seed-данные на проде (10+ карточек, 2 правила)
- [ ] Все 8 типов событий хотя бы один раз отработали в проде
- [ ] Worker запущен на Railway (проверить логи)
- [ ] README залит, ссылка на деплой работает
- [ ] Демо-сценарий записан на 1 листке, отрепетирован 3 раза
- [ ] Заготовлена 1 слайдовая архитектурная диаграмма
- [ ] Backup на случай падения интернета: видео-запись демо
- [ ] Cmd+K не сломан, AI-парсер не сломан
- [ ] Drag&drop плавный (если не успели — отключить анимации)
- [ ] Никаких console.error в продовом браузере
