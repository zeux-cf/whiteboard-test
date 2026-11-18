import { CaretDown } from '@phosphor-icons/react'
import type { ShareAccess } from './api'
import { Button } from './Button'

const roleName = { owner: 'Owner', editor: 'Can edit', viewer: 'Can view' } as const

export function AccessManagement({ access, busy, onRevokeInvite, onRevokeMember }: {
  access: ShareAccess | null
  busy: boolean
  onRevokeInvite: (id: string) => void
  onRevokeMember: (id: string) => void
}) {
  return (
    <details className="wb-access">
      <summary>Manage access <CaretDown size={14} /></summary>
      {!access && <p role="status">Loading access…</p>}
      {access && <>
        <h3>Members</h3>
        <ul>
          {access.members.map(member => (
            <li key={member.id}>
              <span>{member.name} <small>{roleName[member.role]}</small></span>
              {member.role !== 'owner' && <Button variant="outline" disabled={busy}
                aria-label={`Remove access for ${member.name}`} onClick={() => onRevokeMember(member.id)}>Remove</Button>}
            </li>
          ))}
        </ul>
        <h3>Active invite links</h3>
        {access.invites.length === 0 && <p>No active invite links.</p>}
        <ul>
          {access.invites.map(invite => (
            <li key={invite.id}>
              <span>{roleName[invite.role]} <small>{new Date(invite.createdAt).toLocaleString()}</small></span>
              <Button variant="outline" disabled={busy}
                aria-label={`Revoke ${roleName[invite.role].toLowerCase()} invite from ${new Date(invite.createdAt).toLocaleString()}`}
                onClick={() => onRevokeInvite(invite.id)}>Revoke</Button>
            </li>
          ))}
        </ul>
      </>}
    </details>
  )
}
