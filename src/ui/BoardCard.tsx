import { DotsThree, PencilSimple, Trash } from '@phosphor-icons/react'
import { DropdownMenu } from 'radix-ui'
import { useState } from 'react'
import { BoardPreview } from '../canvas/BoardPreview'
import { boardUrl, type BoardSummary } from './api'
import { DeleteBoardDialog } from './DeleteBoardDialog'

export function BoardCard({ board, onDelete, dark }: {
  board: BoardSummary
  onDelete: () => void
  dark: boolean
}) {
  const [deleting, setDeleting] = useState(false)
  const url = boardUrl(board.id)

  return (
    <article className="wb-board-card">
      <a href={url} className="wb-board-card-link">
        <div className="wb-card-preview" aria-hidden="true">
          <BoardPreview elements={board.preview ?? []} dark={dark} />
        </div>
        <div className="wb-board-caption">
          <h3>{board.title}</h3>
          {board.role !== 'owner' && <span className="wb-role">{board.role === 'editor' ? 'Can edit' : 'Can view'}</span>}
        </div>
      </a>
      {board.role === 'owner' && (
        <>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger className="wb-board-options" aria-label={`Manage ${board.title}`}>
              <DotsThree size={20} weight="bold" />
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content className="wb-menu" align="end" sideOffset={5}>
                <DropdownMenu.Item className="wb-menu-item" asChild>
                  <a href={url + '?rename=1'}><PencilSimple size={16} /> Rename</a>
                </DropdownMenu.Item>
                <DropdownMenu.Item className="wb-menu-item wb-menu-danger" onSelect={() => setDeleting(true)}>
                  <Trash size={16} /> Delete board
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          <DeleteBoardDialog board={board} open={deleting} onOpenChange={setDeleting} onDelete={onDelete} />
        </>
      )}
    </article>
  )
}
