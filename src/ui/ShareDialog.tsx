import { Export, LinkSimple, LockSimple, X } from '@phosphor-icons/react'
import { Dialog } from 'radix-ui'
import { useState } from 'react'
import { AccessManagement } from './AccessManagement'
import type { BoardSummary, InviteRole } from './api'
import { Button } from './Button'
import { useShareAccess } from './useShareAccess'

export function ShareDialog({ board }: { board: BoardSummary }) {
  const owner = board.role === 'owner'
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState<InviteRole>('editor')
  const share = useShareAccess(board.id, open && owner)

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button className="wb-share"><Export size={18} /> Share</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="wb-backdrop" />
        <Dialog.Content className="wb-dialog wb-share-dialog">
          <div className="wb-dialog-heading">
            <Dialog.Title>Share {board.title}</Dialog.Title>
            <Dialog.Close asChild>
              <Button variant="ghost" className="wb-header-icon-button" aria-label="Close"><X size={19} /></Button>
            </Dialog.Close>
          </div>
          <div className="wb-current-access">
            <LockSimple size={21} />
            <div>
              <strong>Current access</strong>
              <Dialog.Description>Private · Only members can open the board URL</Dialog.Description>
            </div>
          </div>
          {owner && <>
            <fieldset className="wb-invite-fieldset">
              <legend>Invite link</legend>
              <div className="wb-invite-options">
                <label><input type="radio" name="invite-role" checked={role === 'editor'} onChange={() => setRole('editor')} /> Can edit</label>
                <label><input type="radio" name="invite-role" checked={role === 'viewer'} onChange={() => setRole('viewer')} /> Can view</label>
              </div>
              <p>Sign-in required</p>
            </fieldset>
            <Button variant="primary" className="wb-copy-invite" disabled={share.busy} onClick={() => void share.generate(role)}>
              <LinkSimple size={19} /> Copy invite link
            </Button>
            {share.notice && <p className="wb-share-notice" role="status">{share.notice}</p>}
            {share.link && <input className="wb-manual-link" aria-label="Generated invite link" value={share.link}
              readOnly onFocus={event => event.currentTarget.select()} />}
            {share.error && <p className="wb-error" role="alert">{share.error}</p>}
            <AccessManagement access={share.access} busy={share.busy}
              onRevokeInvite={share.revokeInvite} onRevokeMember={share.revokeMember} />
          </>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
