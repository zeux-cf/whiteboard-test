import { ArrowRight, GoogleLogo, Moon, Sun } from '@phosphor-icons/react'
import { useEffect, useState, type FormEvent } from 'react'
import { api, errorMessage } from './api'
import { authClient, localDestination } from './auth-client'
import { Brand } from './Brand'
import { Button } from './Button'
import { useTheme } from './useTheme'

export function AuthScreen({ returnTo }: { returnTo?: string }) {
  const { theme, toggleTheme } = useTheme()
  const [creating, setCreating] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [googleEnabled, setGoogleEnabled] = useState(false)
  const { data: session } = authClient.useSession()
  const destination = localDestination(returnTo)

  useEffect(() => {
    void api.config().then(config => setGoogleEnabled(config.googleEnabled), () => undefined)
  }, [])

  useEffect(() => {
    if (session) window.location.replace(destination)
  }, [destination, session])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const username = String(form.get('username') ?? '').trim()
    const password = String(form.get('password') ?? '')
    const name = String(form.get('name') ?? '').trim()
    const email = String(form.get('email') ?? '').trim()
    setPending(true)
    setError('')
    try {
      const result = creating
        ? await authClient.signUp.email({ email, name, username, password })
        : await authClient.signIn.username({ username, password })
      if (result.error) throw new Error(result.error.message ?? 'Check your details and try again.')
      window.location.replace(destination)
    } catch (reason) {
      setError(errorMessage(reason))
    } finally {
      setPending(false)
    }
  }

  async function google() {
    setPending(true)
    setError('')
    try {
      const { error: result } = await authClient.signIn.social({
        provider: 'google',
        callbackURL: new URL(destination, window.location.origin).href,
      })
      if (result) throw new Error(result.message ?? 'Google sign in failed.')
    } catch (reason) {
      setError(errorMessage(reason))
      setPending(false)
    }
  }

  return (
    <main className="wb-auth">
      <header className="wb-header">
        <Brand />
        <div className="wb-header-actions">
          <Button variant="ghost" className="wb-header-icon-button" onClick={toggleTheme} aria-label={theme === 'light' ? 'Dark theme' : 'Light theme'}>
            {theme === 'light' ? <Moon size={19} /> : <Sun size={19} />}
          </Button>
        </div>
      </header>
      <div className="wb-auth-card">
        <h1>{creating ? 'Create your account' : 'Sign in to Whiteboard'}</h1>
        <form className="wb-auth-form" onSubmit={submit}>
          {creating && <label>Name<input required name="name" autoComplete="name" maxLength={100} /></label>}
          {creating && <label>Email<input required name="email" type="email" autoComplete="email" /></label>}
          <label>Username<input required name="username" autoComplete="username" minLength={creating ? 3 : undefined} maxLength={30} /></label>
          <label>Password<input required name="password" type="password" autoComplete={creating ? 'new-password' : 'current-password'} minLength={creating ? 8 : undefined} maxLength={128} /></label>
          {error && <p className="wb-error" role="alert">{error}</p>}
          <Button variant="primary" type="submit" disabled={pending}>
            {creating ? 'Create account' : 'Sign in'} <ArrowRight size={18} />
          </Button>
        </form>
        {googleEnabled && <Button variant="outline" className="wb-auth-google" onClick={google} disabled={pending}>
          <GoogleLogo size={18} /> Continue with Google
        </Button>}
        <p className="wb-auth-switch">
          {creating ? 'Already have an account?' : 'New to Whiteboard?'}{' '}
          <button className="wb-link-button" onClick={() => { setCreating(!creating); setError('') }} disabled={pending}>
            {creating ? 'Sign in' : 'Create an account'}
          </button>
        </p>
      </div>
    </main>
  )
}
