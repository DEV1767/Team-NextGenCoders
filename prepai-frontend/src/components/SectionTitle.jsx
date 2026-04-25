/**
 * SectionTitle
 * Reusable section heading used across the landing page.
 *
 * Props:
 *  eyebrow   – small uppercase label above the heading
 *  heading   – main heading text (can include <br /> or JSX via children instead)
 *  subtext   – paragraph below the heading
 *  align     – 'left' | 'center' | 'right'  (default 'center')
 *  className – extra wrapper classes
 */
export default function SectionTitle({
  eyebrow   = '',
  heading   = '',
  subtext   = '',
  align     = 'center',
  className = '',
}) {
  const alignment = {
    left:   'text-left  items-start',
    center: 'text-center items-center',
    right:  'text-right items-end',
  }

  return (
    <div className={`flex flex-col gap-3 ${alignment[align]} ${className}`}>
      {/* Eyebrow pill */}
      {eyebrow && (
        <span className="inline-flex items-center gap-2 px-3.5 py-1 bg-purple-50 border border-purple-200 text-purple-700 text-xs font-semibold uppercase tracking-widest rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
          {eyebrow}
        </span>
      )}

      {/* Main heading */}
      {heading && (
        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 leading-tight">
          {heading}
        </h2>
      )}

      {/* Supporting text */}
      {subtext && (
        <p className="text-base md:text-lg text-gray-500 max-w-2xl leading-relaxed">
          {subtext}
        </p>
      )}
    </div>
  )
}
