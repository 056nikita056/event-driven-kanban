import { prisma } from '@/lib/prisma'
import { Board } from '@/components/Board'
import type { Column } from '@/types/kanban'

const BOARD_ID = process.env.DEFAULT_BOARD_ID || 'board-1'
export const dynamic = 'force-dynamic'

// Ensure board exists
async function getBoard() {
  return prisma.board.upsert({
    where: { id: BOARD_ID },
    update: {},
    create: { id: BOARD_ID, name: 'Main Board' },
    include: {
      columns: {
        orderBy: { order: 'asc' },
        include: {
          cards: { orderBy: { order: 'asc' } },
        },
      },
    },
  })
}

export default async function HomePage() {
  const board = await getBoard()

  return (
    <Board
      initialColumns={board.columns as unknown as Column[]}
      boardId={BOARD_ID}
      boardName={board.name}
      userId="user1"
    />
  )
}
