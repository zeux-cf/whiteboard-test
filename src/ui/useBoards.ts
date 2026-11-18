import { useEffect, useState } from 'react'
import { api, errorMessage, type BoardSummary } from './api'

export function useBoards(enabled: boolean) {
  const [boards, setBoards] = useState<BoardSummary[] | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!enabled) return
    let current = true
    void api.list().then(
      result => { if (current) setBoards(result.boards) },
      reason => { if (current) setError(errorMessage(reason)) },
    )
    return () => { current = false }
  }, [enabled])
  return { boards, setBoards, error }
}
