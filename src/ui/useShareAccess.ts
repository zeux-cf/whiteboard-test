import { useEffect, useState } from 'react'
import { api, errorMessage, type InviteRole, type ShareAccess } from './api'

export function useShareAccess(boardId: string, open: boolean) {
  const [access, setAccess] = useState<ShareAccess | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [link, setLink] = useState('')

  useEffect(() => {
    if (!open) return
    let current = true
    void api.access(boardId).then(
      result => { if (current) setAccess(result) },
      reason => { if (current) setError(errorMessage(reason)) },
    )
    return () => { current = false }
  }, [boardId, open])

  async function mutate(action: () => Promise<void>) {
    setBusy(true)
    setError('')
    setNotice('')
    setLink('')
    try {
      await action()
      setAccess(await api.access(boardId))
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setBusy(false)
    }
  }

  function generate(role: InviteRole) {
    return mutate(async () => {
      const { url } = await api.invite(boardId, role)
      const absolute = new URL(url, window.location.origin).href
      try {
        await navigator.clipboard.writeText(absolute)
        setNotice('Invite link copied.')
      } catch {
        setLink(absolute)
        setNotice('Invite link created. Copy it below.')
      }
    })
  }

  function revokeInvite(id: string) {
    return mutate(async () => {
      await api.revokeInvite(boardId, id)
      setNotice('Invite link revoked.')
    })
  }

  function revokeMember(id: string) {
    return mutate(async () => {
      await api.revokeMember(boardId, id)
      setNotice('Member access removed.')
    })
  }

  return { access, busy, error, notice, link, generate, revokeInvite, revokeMember }
}
