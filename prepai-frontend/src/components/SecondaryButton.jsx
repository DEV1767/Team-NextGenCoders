/**
 * SecondaryButton
 * Outlined purple button — used for secondary actions.
 *
 * Props:
 *  children   – button label / content
 *  onClick    – click handler
 *  type       – button type ('button' | 'submit')
 *  size       – 'sm' | 'md' | 'lg' | 'xl'
 *  disabled   – boolean
 *  fullWidth  – boolean
 *  variant    – 'outline' | 'ghost' — outline has border, ghost is borderless
 *  className  – extra Tailwind classes
 */
export default function SecondaryButton({
  children,
  onClick,
  type      = 'button',
  size      = 'md',
  disabled  = false,
  fullWidth = false,
  variant   = 'outline',
  className = '',
}) {
  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-7 py-3 text-base',
    xl: 'px-9 py-3.5 text-base font-semibold',
  }

  const variants = {
    outline:
      'border-2 border-purple-600 text-purple-600 bg-white hover:bg-purple-50 active:bg-purple-100',
    ghost:
      'border-2 border-transparent text-gray-600 bg-transparent hover:bg-gray-100 active:bg-gray-200',
    dark:
      'border-2 border-gray-900 text-gray-900 bg-white hover:bg-gray-50',
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={[
        'inline-flex items-center justify-center gap-2',
        'font-medium rounded-xl',
        'transition-all duration-150',
        'focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'select-none',
        variants[variant] ?? variants.outline,
        sizes[size] ?? sizes.md,
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
    >
      {children}
    </button>
  )
}
