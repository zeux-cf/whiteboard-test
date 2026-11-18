import { useEffect, useState } from 'react'
import { api, errorMessage, type BoardSummary } from './api'
import { AppHeader } from './AppHeader'
import { EditorWorkspace } from './EditorWorkspace'
import { ScreenStatus } from './ScreenStatus'
import { useRequiredSession } from './useRequiredSession'

export function EditorScreen({ boardId }: { boardId: string }) {
  const { data, error: sessionError } = useRequiredSession()
  const [board, setBoard] = useState<BoardSummary | null>(null)
  const [error, setError] = useState('')
  const user = data?.user

  useEffect(() => {
    if (!user) return
    let current = true
    void api.board(boardId).then(
      result => { if (current) setBoard(result.board) },
      reason => { if (current) setError(errorMessage(reason)) },
    )
    return () => { current = false }
  }, [boardId, user])

  if (board && user) return <EditorWorkspace key={board.id} initialBoard={board} user={user} />

  const message = sessionError?.message ?? error
  return (
    <>
      <AppHeader user={user?.name} />
      <main className="wb-boards">
        <ScreenStatus error={!!message}>{message || 'Opening board…'}</ScreenStatus>
        {message && <a className="wb-text-link" href="/boards">Go to Boards</a>}
      </main>
    </>
  )
}
