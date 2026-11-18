import { Plus } from '@phosphor-icons/react'
import { AppHeader } from './AppHeader'
import { BoardCard } from './BoardCard'
import { Button } from './Button'
import { ScreenStatus } from './ScreenStatus'
import { useBoardActions } from './useBoardActions'
import { useBoards } from './useBoards'
import { useRequiredSession } from './useRequiredSession'
import { useTheme } from './useTheme'

export function BoardsScreen() {
  const { data, error: sessionError } = useRequiredSession()
  const { boards, setBoards, error: listError } = useBoards(!!data)
  const { createBoard, creating, createError } = useBoardActions()
  const { theme } = useTheme()
  const error = sessionError?.message ?? (listError || createError)
  const sections = boards && [
    { title: 'Your boards', items: boards.filter(board => board.role === 'owner'), empty: 'You haven’t created a board yet.' },
    { title: 'Shared with you', items: boards.filter(board => board.role !== 'owner'), empty: 'Boards you join will appear here.' },
  ]

  return (
    <>
      <AppHeader user={data?.user.name} />
      <main className="wb-boards">
        <div className="wb-page-heading">
          <h1>Boards</h1>
          <Button variant="primary" className="wb-new-board" onClick={createBoard} disabled={creating || !data}>
            <Plus size={22} weight="regular" /> New board
          </Button>
        </div>
        {error && <ScreenStatus error>{error}</ScreenStatus>}
        {!sections && !error && <ScreenStatus>Loading boards…</ScreenStatus>}
        {sections?.map(section => (
          <section key={section.title} className="wb-board-section">
            <h2>{section.title}</h2>
            {section.items.length === 0 && <p className="wb-empty">{section.empty}</p>}
            <div className="wb-board-grid">
              {section.items.map(board => (
                <BoardCard key={board.id} board={board} dark={theme === 'dark'}
                  onDelete={() => setBoards(current => current?.filter(item => item.id !== board.id) ?? null)} />
              ))}
            </div>
          </section>
        ))}
      </main>
    </>
  )
}
