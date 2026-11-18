import { AlertDialog } from 'radix-ui'
import { useState } from 'react'
import { api, errorMessage, type BoardSummary } from './api'
import { Button } from './Button'

export function DeleteBoardDialog({ board, open, onOpenChange, onDelete }: {
  board: BoardSummary
  open: boolean
  onOpenChange: (open: boolean) => void
  onDelete: () => void
}) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  async function remove() {
    setError('')
    setPending(true)
    try {
      await api.remove(board.id)
      onOpenChange(false)
      onDelete()
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={next => { if (!pending) onOpenChange(next) }}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="wb-backdrop" />
        <AlertDialog.Content className="wb-dialog wb-delete-dialog">
          <AlertDialog.Title>Delete {board.title}?</AlertDialog.Title>
          <AlertDialog.Description>This permanently removes the board and its contents for everyone with access.</AlertDialog.Description>
          {error && <p className="wb-error" role="alert">{error}</p>}
          <div className="wb-dialog-actions">
            <AlertDialog.Cancel asChild><Button variant="outline" disabled={pending}>Cancel</Button></AlertDialog.Cancel>
            <Button variant="danger" disabled={pending} onClick={remove}>{pending ? 'Deleting…' : 'Delete board'}</Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
