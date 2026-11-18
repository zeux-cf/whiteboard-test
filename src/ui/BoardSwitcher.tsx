import { CaretDown, Check, FolderSimple, PencilSimple, Plus, Trash } from '@phosphor-icons/react'
import { DropdownMenu } from 'radix-ui'
import { boardUrl, type BoardSummary } from './api'

export function BoardSwitcher({ board, boards, creating, onCreate, onRename, onDelete }: {
  board: BoardSummary
  boards: BoardSummary[]
  creating: boolean
  onCreate: () => void
  onRename: () => void
  onDelete: () => void
}) {
  const orderedBoards = [board, ...boards.filter(item => item.id !== board.id)]
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="wb-board-title" aria-label={`Switch board, current board ${board.title}`}>
        <span>{board.title}</span> <CaretDown size={14} />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="wb-menu wb-switcher" align="start" alignOffset={-174} sideOffset={7} collisionPadding={12}>
          {orderedBoards.map(item => (
            <DropdownMenu.Item key={item.id} className="wb-menu-item wb-switcher-board" asChild>
              <a href={boardUrl(item.id)} aria-current={item.id === board.id ? 'page' : undefined}>
                {item.id === board.id && <Check size={16} />}
                <span>{item.title}</span>
              </a>
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className="wb-menu-separator" />
          <DropdownMenu.Item className="wb-menu-item" onSelect={onCreate} disabled={creating}>
            <Plus size={17} /> New board
          </DropdownMenu.Item>
          <DropdownMenu.Item className="wb-menu-item" asChild>
            <a href="/boards"><FolderSimple size={17} /> All boards</a>
          </DropdownMenu.Item>
          {board.role === 'owner' && <>
            <DropdownMenu.Separator className="wb-menu-separator" />
            <DropdownMenu.Item className="wb-menu-item" onSelect={onRename}>
              <PencilSimple size={17} /> Rename board
            </DropdownMenu.Item>
            <DropdownMenu.Item className="wb-menu-item wb-menu-danger" onSelect={onDelete}>
              <Trash size={17} /> Delete board
            </DropdownMenu.Item>
          </>}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
