import type { CSSProperties } from 'react'
import type { Presence } from '../shared/protocol'

export function PresenceAvatars({ presence, userId }: { presence: Presence[]; userId: string }) {
  const peers = [...new Map(presence.filter(peer => peer.userId !== userId).map(peer => [peer.userId, peer])).values()]
  return (
    <div className="wb-peers" aria-label="Collaborators online">
      {peers.slice(0, 4).map(peer => (
        <span className="wb-avatar wb-peer" title={peer.name} aria-label={peer.name} key={peer.userId} style={{ '--peer-color': peer.color } as CSSProperties}>
          {peer.name.trim().slice(0, 1).toUpperCase()}
        </span>
      ))}
      {peers.length > 4 && <span className="wb-avatar wb-peer-extra" aria-label={`${peers.length - 4} more collaborators`}>+{peers.length - 4}</span>}
    </div>
  )
}
