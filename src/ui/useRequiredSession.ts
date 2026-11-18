import { useEffect } from 'react'
import { authClient, signInUrl } from './auth-client'

export function useRequiredSession() {
  const session = authClient.useSession()
  const { data, error, isPending } = session
  useEffect(() => {
    if (!isPending && !data && !error) {
      window.location.replace(signInUrl(window.location.pathname + window.location.search))
    }
  }, [data, error, isPending])
  return session
}
