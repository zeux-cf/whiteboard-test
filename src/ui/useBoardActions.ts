import { useRef, useState } from 'react'
import { api, boardUrl, errorMessage } from './api'

export function useBoardActions() {
  const active = useRef(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  async function createBoard() {
    if (active.current) return
    active.current = true
    setCreating(true)
    setError('')
    try {
      const { board } = await api.create()
      window.location.assign(boardUrl(board.id) + '?rename=1')
    } catch (reason) {
      setError(errorMessage(reason))
      setCreating(false)
      active.current = false
    }
  }

  return { creating, createBoard, createError: error }
}
