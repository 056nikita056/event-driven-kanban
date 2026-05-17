# Kanban Hackathon

Event-driven MVP канбан-доски для хакатона. Это не попытка за 48 часов повторить Jira или Trello целиком. Проект показывает главное из ТЗ: доску задач, real-time обновления, очередь событий, worker, автоматизации и уведомления.

## Что умеет

- Канбан-доска с колонками `To Do`, `In Progress`, `Review`, `Done` и кастомными колонками.
- Карточки задач: название, описание, приоритет, теги, дедлайн, порядок, версия.
- Создание, редактирование, удаление и drag-and-drop карточек.
- Real-time синхронизация между открытыми окнами через Socket.IO.
- Очередь событий на BullMQ + Redis.
- Worker, который обрабатывает события и запускает правила автоматизации.
- Админка правил: уведомить, добавить тег, переместить карточку.
- Уведомления и лента событий в интерфейсе.
- AI/regex-парсер быстрой задачи через Cmd+K. API-ключ Claude необязателен, без него работает простой regex-парсер.

## Стек

- Next.js 14 + React
- Socket.IO
- Prisma + PostgreSQL
- Redis
- BullMQ
- Tailwind CSS
- Docker / Railway config

## Как это работает

Обычный путь такой:

1. Пользователь создает, редактирует или двигает карточку.
2. API сохраняет изменение в Postgres.
3. API кладет событие в очередь BullMQ.
4. Worker забирает событие, пишет его в таблицу `Event`, запускает правила автоматизации.
5. Worker публикует обновления в Redis pub/sub.
6. Web-сервер получает pub/sub сообщение и отправляет его клиентам через Socket.IO.
7. Открытые доски обновляются без перезагрузки страницы.

Важно: real-time работает через кастомный сервер [server.ts](server.ts). Поэтому в проде нужно запускать `npm run start`, а не обычный `next start`.

## Локальный запуск

Нужны Node.js 20+, Docker и npm.

1. Установить зависимости:

```bash
npm install
```

2. Создать `.env`:

```bash
cp .env.example .env
```

3. Поднять Postgres и Redis:

```bash
docker compose up -d
```

4. Подготовить базу:

```bash
npm run db:push
npm run db:seed
```

5. Запустить web-сервер:

```bash
npm run dev
```

6. В другом терминале запустить worker:

```bash
npm run worker
```

После этого приложение будет доступно на:

```text
http://localhost:3000
```

Чтобы проверить real-time, откройте приложение в двух вкладках и переместите карточку. Вторая вкладка должна обновиться сама.

## Переменные окружения

Минимальный набор:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/kanban?schema=public"
REDIS_URL="redis://localhost:6379"
NEXT_PUBLIC_SOCKET_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Опционально:

```env
ANTHROPIC_API_KEY=""
DEFAULT_BOARD_ID="board-1"
```

Для Railway или другого сервера в `NEXT_PUBLIC_SOCKET_URL` и `NEXT_PUBLIC_APP_URL` нужно указать публичный URL web-сервиса, например:

```env
NEXT_PUBLIC_SOCKET_URL="https://your-app.up.railway.app"
NEXT_PUBLIC_APP_URL="https://your-app.up.railway.app"
```

## Запуск в production

Сборка:

```bash
npm run build
```

Web-процесс:

```bash
npm run start
```

Worker-процесс:

```bash
npm run worker:prod
```

Для real-time нужны оба процесса. Если запустить только web, интерфейс откроется, но события из очереди и автоматизации не будут нормально обрабатываться.

## Docker

Dockerfile собирает web-приложение и запускает кастомный `server.ts`, к которому подключен Socket.IO.

Сборка образа:

```bash
docker build -t kanban-hackathon .
```

Запуск web-контейнера:

```bash
docker run --rm -p 3000:3000 \
  -e DATABASE_URL="postgresql://postgres:password@host.docker.internal:5432/kanban?schema=public" \
  -e REDIS_URL="redis://host.docker.internal:6379" \
  -e NEXT_PUBLIC_SOCKET_URL="http://localhost:3000" \
  -e NEXT_PUBLIC_APP_URL="http://localhost:3000" \
  kanban-hackathon
```

Worker можно запустить из того же образа отдельным контейнером:

```bash
docker run --rm \
  -e DATABASE_URL="postgresql://postgres:password@host.docker.internal:5432/kanban?schema=public" \
  -e REDIS_URL="redis://host.docker.internal:6379" \
  kanban-hackathon npm run worker:prod
```

## Railway

Удобная схема для Railway: два сервиса из одного репозитория.

### 1. Web service

Использует [railway.toml](railway.toml).

Команды уже прописаны:

```text
build: npm ci && npx prisma generate && npx prisma db push && npm run build
start: npm run start
```

Этот сервис должен иметь переменные:

```env
DATABASE_URL=...
REDIS_URL=...
NEXT_PUBLIC_SOCKET_URL=https://your-web-service.up.railway.app
NEXT_PUBLIC_APP_URL=https://your-web-service.up.railway.app
NODE_ENV=production
SERVICE_TYPE=web
```

### 2. Worker service

Создайте второй Railway service из того же репозитория и укажите ему [railway.worker.toml](railway.worker.toml) или вручную задайте start command:

```bash
npm run worker:prod
```

Для worker нужны:

```env
DATABASE_URL=...
REDIS_URL=...
NODE_ENV=production
SERVICE_TYPE=worker
```

Worker не принимает HTTP-запросы. Его задача — слушать очередь `kanban-events`.

## Проверка после деплоя

1. Открыть `/api/health`.
2. Должно быть:

```json
{
  "status": "ok",
  "checks": {
    "postgres": "ok",
    "redis": "ok"
  }
}
```

3. Открыть доску в двух вкладках.
4. Передвинуть карточку.
5. Убедиться, что вторая вкладка обновилась.
6. Включить или создать правило автоматизации и проверить, что уведомления/перемещения приходят без ручной перезагрузки.

## Полезные команды

```bash
npm run dev              # web с Socket.IO для разработки
npm run worker           # worker в watch-режиме
npm run build            # production build
npm run start            # production web с Socket.IO
npm run worker:prod      # production worker
npm run db:push          # применить Prisma schema к базе
npm run db:seed          # демо-данные
npm run db:studio        # Prisma Studio
```

## Что осталось за рамками MVP

- полноценная авторизация и права на сервере;
- сложная обработка конфликтов при одновременном drag-and-drop;
- интеграции с внешними таск-трекерами;
- покрытие тестами всех сценариев;
- продвинутая аналитика и аудит действий.

Для хакатона это сознательно оставлено за рамками: основной фокус здесь на рабочем event-driven flow, real-time доске и автоматизациях.
