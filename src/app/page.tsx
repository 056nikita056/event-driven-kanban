import { Board } from '@/components/Board'

const BOARD_ID = process.env.DEFAULT_BOARD_ID || 'board-1'
const DEFAULT_USER_ID = 'user1'
export const dynamic = 'force-dynamic'

export default function HomePage() {
  return (
    <Board
      initialColumns={[]}
      boardId={BOARD_ID}
      boardName="Kanban Board"
      userId={DEFAULT_USER_ID}
    />
  )
}
