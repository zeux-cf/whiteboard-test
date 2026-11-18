import { createAuthClient } from 'better-auth/react'
import { usernameClient } from 'better-auth/client/plugins'

export const authClient = createAuthClient({ plugins: [usernameClient()] })

export function signInUrl(returnTo: string) {
  return `/sign-in?returnTo=${encodeURIComponent(returnTo)}`
}

export function localDestination(value?: string) {
  if (value?.startsWith('/') && !value.startsWith('//') && !value.includes('\\')) return value
  return '/boards'
}
