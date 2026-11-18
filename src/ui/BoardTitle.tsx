import { LockSimple } from '@phosphor-icons/react'
import { BoardSwitcher } from './BoardSwitcher'
import { useBoardTitle } from './useBoardTitle'
import type { BoardSummary } from './api'

export function BoardTitle({ board, boards, creating, onCreate, onRename, onDelete }: {
  board: BoardSummary
  boards: BoardSummary[]
  creating: boolean
  onCreate: () => void
  onRename: (board: BoardSummary) => void
  onDelete: () => void
}) {
  const title = useBoardTitle(board, onRename)
  return (
    <div className="wb-board-heading">
      {title.editing
        ? <form className="wb-rename" onSubmit={event => { event.preventDefault(); void title.save() }}>
          <input aria-label="Board name" ref={title.input} value={title.draft} maxLength={120}
            onChange={event => title.setDraft(event.target.value)} onBlur={() => void title.save()}
            onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); title.cancel() } }} />
        </form>
        : <BoardSwitcher board={board} boards={boards} creating={creating} onCreate={onCreate}
            onRename={title.start} onDelete={onDelete} />}
      {title.editing && <span className="wb-private-label"><LockSimple size={17} /> Private</span>}
      {board.role === 'viewer' && <span className="wb-role">Can view</span>}
      {title.error && <p className="wb-title-error wb-error" role="alert">{title.error}</p>}
    </div>
  )
}
