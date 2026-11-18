export function ScreenStatus({ children, error }: { children: string; error?: boolean }) {
  return <p className={`wb-status${error ? ' wb-error' : ''}`} role={error ? 'alert' : 'status'}>{children}</p>
}
