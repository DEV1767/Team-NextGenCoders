/**
 * FeatureCard
 * Used on the Landing Page features section.
 *
 * Props:
 *  icon      – Lucide icon component
 *  title     – card title
 *  description – text body
 *  index     – card index for staggered animation delay
 *  className – extra classes
 */
export default function FeatureCard({
  icon: Icon,
  title,
  description,
  index     = 0,
  className = '',
}) {
  return (
    <div
      className={[
        'bg-white border border-gray-100 rounded-2xl p-7',
        'hover:border-purple-200 hover:shadow-lg hover:-translate-y-1',
        'transition-all duration-200 cursor-default',
        'animate-fade-in',
        className,
      ].join(' ')}
      style={{ animationDelay: `${index * 80}ms`, animationFillMode: 'both' }}
    >
      {/* Icon container */}
      <div className="w-12 h-12 bg-purple-50 border border-purple-100 rounded-xl flex items-center justify-center mb-5">
        {Icon && <Icon size={22} className="text-purple-600" strokeWidth={1.8} />}
      </div>

      {/* Title */}
      <h3 className="text-base font-semibold text-gray-900 mb-2 leading-snug">
        {title}
      </h3>

      {/* Description */}
      <p className="text-sm text-gray-500 leading-relaxed">
        {description}
      </p>
    </div>
  )
}
