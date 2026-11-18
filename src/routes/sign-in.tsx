import { createFileRoute } from '@tanstack/react-router'
import { AuthScreen } from '../ui/AuthScreen'

export const Route = createFileRoute('/sign-in')({
  validateSearch: (search: Record<string, unknown>) => ({
    returnTo: typeof search.returnTo === 'string' && /^\/(boards|invite)(\/|$)/.test(search.returnTo)
      ? search.returnTo
      : undefined,
  }),
  component: SignInRoute,
})

function SignInRoute() {
  const { returnTo } = Route.useSearch()
  return <AuthScreen returnTo={returnTo} />
}
