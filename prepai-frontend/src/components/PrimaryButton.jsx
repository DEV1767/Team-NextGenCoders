/**
 * PrimaryButton
 * Main solid purple CTA button. Supports different sizes and a loading state.
 *
 * Props:
 *  children   – button label / content
 *  onClick    – click handler
 *  type       – button type ('button' | 'submit')
 *  size       – 'sm' | 'md' | 'lg' | 'xl'
 *  disabled   – boolean
 *  loading    – boolean, shows a spinner
 *  fullWidth  – boolean
 *  className  – extra Tailwind classes
 */
export default function PrimaryButton({
  children,
  onClick,
  type      = 'button',
  size      = 'md',
  disabled  = false,
  loading   = false,
  fullWidth = false,
  className = '',
}) {
  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-7 py-3 text-base',
    xl: 'px-9 py-3.5 text-base font-semibold',
  }

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={[
        'inline-flex items-center justify-center gap-2',
        'bg-purple-600 text-white font-medium rounded-xl',
        'hover:bg-purple-700 active:bg-purple-800',
        'transition-all duration-150',
        'focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        'select-none',
        sizes[size] ?? sizes.md,
        fullWidth ? 'w-full' : '',
        className,
      ].join(' ')}
    >
      {loading && (
        <svg
          className="animate-spin -ml-1 h-4 w-4 text-white"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v8z"
          />
        </svg>
      )}
      {children}
    </button>
  )
}
