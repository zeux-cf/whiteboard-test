import { Moon, SignOut, Sun } from '@phosphor-icons/react'
import { DropdownMenu } from 'radix-ui'
import { useState } from 'react'
import { authClient } from './auth-client'
import { useTheme } from './useTheme'

export function AccountMenu({ name }: { name: string }) {
  const { theme, toggleTheme } = useTheme()
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function signOut() {
    setPending(true)
    try {
      const result = await authClient.signOut()
      if (result.error) throw new Error(result.error.message ?? 'Sign out failed.')
      window.location.assign('/sign-in')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Sign out failed.')
    } finally {
      setPending(false)
    }
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="wb-avatar" aria-label={`Account menu for ${name}`} title={name}>
          {name.trim().slice(0, 1).toUpperCase()}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content className="wb-menu" align="end" sideOffset={8}>
          <DropdownMenu.Label className="wb-menu-label">{name}</DropdownMenu.Label>
          <DropdownMenu.Item className="wb-menu-item" onSelect={toggleTheme}>
            {theme === 'light' ? <Moon size={17} /> : <Sun size={17} />}
            {theme === 'light' ? 'Dark theme' : 'Light theme'}
          </DropdownMenu.Item>
          <DropdownMenu.Item className="wb-menu-item" disabled={pending} onSelect={event => {
            event.preventDefault()
            void signOut()
          }}>
            <SignOut size={17} /> Sign out
          </DropdownMenu.Item>
          {error && <p role="alert" className="wb-error">{error}</p>}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
