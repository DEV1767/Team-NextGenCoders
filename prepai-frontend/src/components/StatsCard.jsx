/**
 * StatsCard
 * Used on the Dashboard page to display key metrics.
 *
 * Props:
 *  stat – { id, label, value, sub, icon (string), accent }
 */
import {
  Mic, TrendingUp, Zap, CheckSquare,
  BarChart2, Target, BookOpen, Award,
} from 'lucide-react'

const ICON_MAP = {
  Mic, TrendingUp, Zap, CheckSquare,
  BarChart2, Target, BookOpen, Award,
}

const ACCENT_STYLES = {
  purple: {
    wrapper: 'bg-purple-50 border-purple-100',
    icon:    'bg-purple-100 text-purple-700',
    value:   'text-purple-700',
    dot:     'bg-purple-400',
  },
  blue: {
    wrapper: 'bg-blue-50 border-blue-100',
    icon:    'bg-blue-100 text-blue-700',
    value:   'text-blue-700',
    dot:     'bg-blue-400',
  },
  orange: {
    wrapper: 'bg-orange-50 border-orange-100',
    icon:    'bg-orange-100 text-orange-700',
    value:   'text-orange-700',
    dot:     'bg-orange-400',
  },
  green: {
    wrapper: 'bg-green-50 border-green-100',
    icon:    'bg-green-100 text-green-700',
    value:   'text-green-700',
    dot:     'bg-green-400',
  },
}

export default function StatsCard({ stat }) {
  const Icon   = ICON_MAP[stat.icon] ?? BarChart2
  const accent = ACCENT_STYLES[stat.accent] ?? ACCENT_STYLES.purple

  const normalizeText = (value, fallback = '-') => {
    if (value === null || value === undefined) return fallback
    if (typeof value === 'string' || typeof value === 'number') return String(value)
    if (typeof value === 'object') {
      const candidate = value.value || value.label || value.title || value.text || value.score || fallback
      return typeof candidate === 'string' || typeof candidate === 'number'
        ? String(candidate)
        : fallback
    }
    return fallback
  }

  return (
    <div
      className={`rounded-2xl border p-5 flex flex-col gap-4 transition-shadow hover:shadow-md ${accent.wrapper}`}
    >
      {/* Icon + label row */}
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accent.icon}`}>
          <Icon size={18} strokeWidth={1.8} />
        </div>
        <span className="text-xs text-gray-400 font-medium text-right leading-tight max-w-[80px]">
          {normalizeText(stat.label, 'Metric')}
        </span>
      </div>

      {/* Value */}
      <div>
        <p className={`text-3xl font-bold leading-none ${accent.value}`}>
          {normalizeText(stat.value, '0')}
        </p>
        <p className="text-xs text-gray-500 mt-1.5 flex items-center gap-1">
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${accent.dot}`} />
          {normalizeText(stat.sub, 'No change')}
        </p>
      </div>
    </div>
  )
}
