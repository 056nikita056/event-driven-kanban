/**
 * Seed script — создаёт demo-данные для доски.
 * Запуск: npm run db:seed
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BOARD_ID = process.env.DEFAULT_BOARD_ID || 'board-1'

async function main() {
  console.log('🌱 Seeding database...')

  // Users
  const users = await Promise.all([
    prisma.user.upsert({
      where: { id: 'admin' },
      update: {},
      create: { id: 'admin', name: 'Admin', role: 'ADMIN' },
    }),
    prisma.user.upsert({
      where: { id: 'user1' },
      update: {},
      create: { id: 'user1', name: 'Никита', role: 'USER' },
    }),
    prisma.user.upsert({
      where: { id: 'user2' },
      update: {},
      create: { id: 'user2', name: 'Стёпа', role: 'USER' },
    }),
  ])
  console.log(`✓ Users: ${users.map((u) => u.name).join(', ')}`)

  // Board
  const board = await prisma.board.upsert({
    where: { id: BOARD_ID },
    update: { name: 'Kanban Board' },
    create: { id: BOARD_ID, name: 'Kanban Board' },
  })
  console.log(`✓ Board: ${board.name}`)

  // Columns
  const columnDefs = [
    { id: 'col-todo', name: 'To Do', order: 0, color: '#6366f1' },
    { id: 'col-inprogress', name: 'In Progress', order: 1, color: '#f59e0b', wipLimit: 3 },
    { id: 'col-review', name: 'Review', order: 2, color: '#8b5cf6' },
    { id: 'col-done', name: 'Done', order: 3, color: '#10b981' },
  ]

  for (const col of columnDefs) {
    await prisma.column.upsert({
      where: { id: col.id },
      update: { name: col.name, order: col.order, color: col.color },
      create: { ...col, boardId: BOARD_ID },
    })
  }
  console.log(`✓ Columns: ${columnDefs.map((c) => c.name).join(', ')}`)

  // Cards
  const cardDefs = [
    {
      id: 'card-1',
      columnId: 'col-todo',
      title: 'Настроить деплой на Railway',
      description: 'Создать проект, подключить Postgres и Redis, настроить env vars',
      priority: 'URGENT' as const,
      tags: ['backend', 'infra'],
      order: 0,
      deadline: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), // завтра
    },
    {
      id: 'card-2',
      columnId: 'col-todo',
      title: 'Реализовать Cmd+K командную палитру',
      description: 'Использовать библиотеку cmdk для быстрого создания карточек',
      priority: 'HIGH' as const,
      tags: ['frontend', 'feature'],
      order: 1,
    },
    {
      id: 'card-3',
      columnId: 'col-todo',
      title: 'Написать README с архитектурной схемой',
      description: 'Описать event-driven flow, стек, инструкции по запуску',
      priority: 'MEDIUM' as const,
      tags: ['docs'],
      order: 2,
    },
    {
      id: 'card-4',
      columnId: 'col-inprogress',
      title: 'Event Worker — обработчики событий',
      description: 'BullMQ worker обрабатывает card.created, card.moved, rule.triggered',
      priority: 'URGENT' as const,
      tags: ['backend', 'feature'],
      order: 0,
    },
    {
      id: 'card-5',
      columnId: 'col-inprogress',
      title: 'Drag & Drop между колонками',
      description: '@dnd-kit, оптимистичный UI, синхронизация через Socket.io',
      priority: 'HIGH' as const,
      tags: ['frontend'],
      order: 1,
    },
    {
      id: 'card-6',
      columnId: 'col-inprogress',
      title: 'Visual Event Log sidebar',
      description: 'Стрим событий в реальном времени — главный wow-фактор демо',
      priority: 'HIGH' as const,
      tags: ['frontend', 'feature'],
      order: 2,
    },
    {
      id: 'card-7',
      columnId: 'col-review',
      title: 'Prisma schema + миграции',
      description: 'User, Board, Column, Card, AutomationRule, Event, Notification',
      priority: 'MEDIUM' as const,
      tags: ['backend'],
      order: 0,
    },
    {
      id: 'card-8',
      columnId: 'col-review',
      title: 'AI-парсер карточек',
      description: '"Срочно сделать отчёт до пятницы" → priority=URGENT, deadline=friday',
      priority: 'HIGH' as const,
      tags: ['ai', 'feature'],
      order: 1,
    },
    {
      id: 'card-9',
      columnId: 'col-done',
      title: 'Определить технический стек',
      description: 'Next.js 14, Prisma, BullMQ, Socket.io, Railway',
      priority: 'MEDIUM' as const,
      tags: ['planning'],
      order: 0,
    },
    {
      id: 'card-10',
      columnId: 'col-done',
      title: 'Написать план разработки',
      description: 'PLAN.md с приоритизацией, timeline по часам, demo-сценарий',
      priority: 'MEDIUM' as const,
      tags: ['planning', 'docs'],
      order: 1,
    },
  ]

  for (const card of cardDefs) {
    await prisma.card.upsert({
      where: { id: card.id },
      update: {},
      create: {
        ...card,
        version: 1,
        deadline: card.deadline ? new Date(card.deadline) : undefined,
      },
    })
  }
  console.log(`✓ Cards: ${cardDefs.length} created`)

  // Automation Rules
  const rules = [
    {
      id: 'rule-1',
      boardId: BOARD_ID,
      name: 'Уведомить при завершении задачи',
      triggerType: 'card.moved',
      triggerConfig: { toColumnId: 'col-done' },
      actionType: 'notify',
      actionConfig: { message: '🎉 Задача выполнена! Молодец!' },
      enabled: true,
    },
    {
      id: 'rule-2',
      boardId: BOARD_ID,
      name: 'Пометить срочные как urgent',
      triggerType: 'card.created',
      triggerConfig: { priority: 'URGENT' },
      actionType: 'add_tag',
      actionConfig: { tag: 'urgent' },
      enabled: true,
    },
    {
      id: 'rule-3',
      boardId: BOARD_ID,
      name: 'Переместить баги в In Progress',
      triggerType: 'card.created',
      triggerConfig: { tag: 'bug' },
      actionType: 'move_to_column',
      actionConfig: { columnId: 'col-inprogress' },
      enabled: false, // выключено по умолчанию — включить в админке на демо
    },
  ]

  for (const rule of rules) {
    await prisma.automationRule.upsert({
      where: { id: rule.id },
      update: {},
      create: rule,
    })
  }
  console.log(`✓ Automation rules: ${rules.length} created`)

  console.log('\n✅ Seed complete! Board is ready for demo.')
  console.log(`   Board ID: ${BOARD_ID}`)
  console.log(`   Columns: ${columnDefs.length} | Cards: ${cardDefs.length} | Rules: ${rules.length}`)
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
