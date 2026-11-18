import { SquaresFour } from '@phosphor-icons/react'

export function Brand() {
  return (
    <a className="wb-brand" href="/boards" aria-label="Whiteboard home">
      <SquaresFour size={26} weight="fill" aria-hidden="true" />
      <span>Whiteboard</span>
    </a>
  )
}
