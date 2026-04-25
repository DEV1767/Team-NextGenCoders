/**
 * FormInput
 * Reusable form field — handles text/email/password inputs, textareas, and selects.
 *
 * Props:
 *  label       – field label text
 *  type        – 'text' | 'email' | 'password' | 'textarea' | 'select'
 *  id          – HTML id (also used for label htmlFor)
 *  name        – field name
 *  value       – controlled value
 *  onChange    – change handler
 *  placeholder – placeholder text
 *  required    – boolean
 *  disabled    – boolean
 *  error       – error message string
 *  hint        – helper text below field
 *  rows        – textarea row count (default 4)
 *  children    – used for <select> options
 *  icon        – Lucide icon component to render on the left
 *  rightSlot   – JSX rendered on the right side (e.g. show/hide password)
 *  className   – extra classes on the wrapper
 */
export default function FormInput({
  label,
  type        = 'text',
  id,
  name,
  value,
  onChange,
  placeholder = '',
  required    = false,
  disabled    = false,
  error       = '',
  hint        = '',
  rows        = 4,
  children,
  icon: Icon,
  rightSlot,
  className   = '',
}) {
  const baseInput = [
    'w-full rounded-xl border bg-white text-gray-900 text-sm',
    'placeholder-gray-400 font-poppins',
    'transition-all duration-150',
    'focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-500',
    'disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed',
    error
      ? 'border-red-400 focus:ring-red-300 focus:border-red-400'
      : 'border-gray-200 hover:border-gray-300',
    Icon ? 'pl-10 pr-4 py-3' : rightSlot ? 'pl-4 pr-10 py-3' : 'px-4 py-3',
  ].join(' ')

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {/* Label */}
      {label && (
        <label
          htmlFor={id}
          className="text-sm font-medium text-gray-700 select-none"
        >
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      {/* Input wrapper */}
      <div className="relative">
        {/* Left icon */}
        {Icon && (
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <Icon size={16} className={error ? 'text-red-400' : 'text-gray-400'} />
          </div>
        )}

        {/* Actual input element */}
        {type === 'textarea' ? (
          <textarea
            id={id}
            name={name}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            rows={rows}
            className={`${baseInput} resize-none leading-relaxed`}
          />
        ) : type === 'select' ? (
          <select
            id={id}
            name={name}
            value={value}
            onChange={onChange}
            required={required}
            disabled={disabled}
            className={`${baseInput} appearance-none cursor-pointer`}
          >
            {children}
          </select>
        ) : (
          <input
            id={id}
            name={name}
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            className={baseInput}
          />
        )}

        {/* Right slot (e.g. password eye toggle) */}
        {rightSlot && !Icon && (
          <div className="absolute inset-y-0 right-3 flex items-center">
            {rightSlot}
          </div>
        )}

        {/* Dropdown arrow for select */}
        {type === 'select' && (
          <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
            <svg
              className="w-4 h-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          {error}
        </p>
      )}

      {/* Hint text */}
      {hint && !error && (
        <p className="text-xs text-gray-400">{hint}</p>
      )}
    </div>
  )
}
