import { useState } from 'react'
import { BoardCanvas } from '../canvas/BoardCanvas'
import { useBoardCollaboration } from '../collaboration/use-board-collaboration'
import { AppHeader } from './AppHeader'
import { BoardTitle } from './BoardTitle'
import { DeleteBoardDialog } from './DeleteBoardDialog'
import { PresenceAvatars } from './PresenceAvatars'
import { ScreenStatus } from './ScreenStatus'
import { ShareDialog } from './ShareDialog'
import type { BoardSummary } from './api'
import { useBoardActions } from './useBoardActions'
import { useBoards } from './useBoards'
import { useTheme } from './useTheme'

export function EditorWorkspace({ initialBoard, user }: {
  initialBoard: BoardSummary
  user: { id: string; name: string }
}) {
  const [board, setBoard] = useState(initialBoard)
  const [deleting, setDeleting] = useState(false)
  const { boards } = useBoards(true)
  const { createBoard, creating, createError } = useBoardActions()
  const { theme } = useTheme()
  const room = useBoardCollaboration(board.id, board.role)
  const switcherBoards = boards?.map(item => item.id === board.id ? board : item) ?? [board]
  const hasAccess = room.status !== 'forbidden'
  const connecting = room.status === 'connecting' && !room.elements.length
  const status = room.status === 'disconnected'
    ? 'Connection lost. Reconnecting…'
    : connecting ? 'Connecting…' : ''

  if (!hasAccess) return (
    <>
      <AppHeader user={user.name} />
      <main className="wb-boards">
        <ScreenStatus error>You no longer have access to this board.</ScreenStatus>
        <a className="wb-text-link" href="/boards">Go to Boards</a>
      </main>
    </>
  )

  return (
    <div className="wb-editor">
      <AppHeader
        title={<BoardTitle board={board} boards={switcherBoards} creating={creating}
          onCreate={createBoard} onRename={setBoard} onDelete={() => setDeleting(true)} />}
        user={user.name}
        collaborators={<PresenceAvatars presence={room.presence} userId={user.id} />}
        actions={<ShareDialog board={board} />}
      />
      <main className="wb-editor-content" aria-label={board.title}>
        <BoardCanvas title={board.title} elements={room.elements} presence={room.presence}
          dark={theme === 'dark'} readOnly={board.role === 'viewer' || connecting}
          onCommit={room.commit} onCursor={room.setCursor} onUndo={room.undo} onRedo={room.redo}
          canUndo={room.canUndo} canRedo={room.canRedo} />
        {(createError || room.error || status) && (
          <div className="wb-connection-status">
            <ScreenStatus error={!!(createError || room.error)}>{createError || room.error || status}</ScreenStatus>
          </div>
        )}
      </main>
      <DeleteBoardDialog board={board} open={deleting} onOpenChange={setDeleting}
        onDelete={() => window.location.assign('/boards')} />
    </div>
  )
}
