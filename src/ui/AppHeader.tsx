import type { ReactNode } from 'react'
import { AccountMenu } from './AccountMenu'
import { Brand } from './Brand'

export function AppHeader({ title, user, collaborators, actions }: {
  title?: ReactNode
  user?: string
  collaborators?: ReactNode
  actions?: ReactNode
}) {
  return (
    <header className="wb-header">
      <Brand />
      {title && <><span className="wb-breadcrumb" aria-hidden="true">/</span>{title}</>}
      <div className="wb-header-actions">
        {user && <AccountMenu name={user} />}
        {collaborators}
        {actions}
      </div>
    </header>
  )
}
