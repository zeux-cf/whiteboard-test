import { cva, type VariantProps } from 'class-variance-authority'
import { clsx } from 'clsx'
import type { ComponentProps } from 'react'

const variants = cva('wb-button inline-flex items-center justify-center', {
  variants: {
    variant: {
      primary: 'wb-button--primary',
      neutral: 'wb-button--neutral',
      outline: 'wb-button--outline',
      ghost: 'wb-button--ghost',
      danger: 'wb-button--danger',
    },
  },
  defaultVariants: { variant: 'neutral' },
})

export function Button({
  variant,
  className,
  type = 'button',
  ...props
}: ComponentProps<'button'> & VariantProps<typeof variants>) {
  return <button type={type} className={clsx(variants({ variant }), className)} {...props} />
}
