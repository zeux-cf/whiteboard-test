import { useRef, useState } from 'react'
import { api, boardUrl, errorMessage } from './api'
import { AppHeader } from './AppHeader'
import { Button } from './Button'
import { ScreenStatus } from './ScreenStatus'
import { useRequiredSession } from './useRequiredSession'

export function InviteScreen({ token }: { token: string }) {
  const { data, error: sessionError } = useRequiredSession()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const redeeming = useRef(false)

  async function join() {
    if (redeeming.current) return
    redeeming.current = true
    setPending(true)
    setError('')
    try {
      const { board } = await api.redeem(token)
      window.location.replace(boardUrl(board.id))
    } catch (reason) {
      setError(errorMessage(reason))
      setPending(false)
      redeeming.current = false
    }
  }

  return (
    <>
      <AppHeader user={data?.user.name} />
      <main className="wb-auth-card">
        <h1>Board invitation</h1>
        {data && <Button variant="primary" disabled={pending} onClick={join}>Join board</Button>}
        {!data && !sessionError && <ScreenStatus>Checking sign-in…</ScreenStatus>}
        {sessionError && <ScreenStatus error>{sessionError.message ?? 'Could not check your session.'}</ScreenStatus>}
        {error && <ScreenStatus error>{error}</ScreenStatus>}
        <a className="wb-text-link" href="/boards">Go to Boards</a>
      </main>
    </>
  )
}
