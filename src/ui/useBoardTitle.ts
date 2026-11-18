import { useEffect, useRef, useState } from 'react'
import { api, errorMessage, type BoardSummary } from './api'

export function useBoardTitle(board: BoardSummary, onRename: (board: BoardSummary) => void) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(board.title)
  const [error, setError] = useState('')
  const stopped = useRef(false)
  const committing = useRef(false)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const url = new URL(window.location.href)
    if (board.role === 'owner' && url.searchParams.has('rename')) {
      url.searchParams.delete('rename')
      window.history.replaceState(window.history.state, '', url)
      setEditing(true)
    }
  }, [board.role])

  useEffect(() => {
    if (editing) {
      input.current?.focus()
      input.current?.select()
    }
  }, [editing])

  function start() {
    stopped.current = false
    setError('')
    setDraft(board.title)
    setEditing(true)
  }

  function cancel() {
    stopped.current = true
    setEditing(false)
  }

  async function save() {
    if (stopped.current || committing.current) return
    const title = draft.trim()
    if (!title || title === board.title) {
      cancel()
      return
    }
    committing.current = true
    setError('')
    try {
      const result = await api.rename(board.id, title)
      onRename(result.board)
      setEditing(false)
    } catch (reason) {
      setError(errorMessage(reason))
      input.current?.focus()
    } finally {
      committing.current = false
    }
  }

  return { editing, draft, setDraft, error, input, start, cancel, save }
}
