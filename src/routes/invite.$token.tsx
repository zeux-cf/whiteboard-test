import { createFileRoute } from '@tanstack/react-router'
import { InviteScreen } from '../ui/InviteScreen'

export const Route = createFileRoute('/invite/$token')({ component: InviteRoute })

function InviteRoute() {
  const { token } = Route.useParams()
  return <InviteScreen token={token} />
}
