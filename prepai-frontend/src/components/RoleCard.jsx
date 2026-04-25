/**
 * RoleCard
 * Selectable card used on the Resume Upload / Setup page for role selection.
 *
 * Props:
 *  role      – role object { id, title, icon, description, popular, tags }
 *  selected  – boolean, whether this card is currently selected
 *  onSelect  – callback(roleId)
 */
import {
  Code2, Monitor, Server, Layers, BarChart2,
  Briefcase, GitBranch, Palette,
} from 'lucide-react'

const ICON_MAP = {
  Code2,
  Monitor,
  Server,
  Layers,
  BarChart2,
  Briefcase,
  GitBranch,
  Palette,
}

export default function RoleCard({ role, selected = false, onSelect }) {
  const Icon = ICON_MAP[role.icon] ?? Code2

  return (
    <button
      type="button"
      onClick={() => onSelect(role.id)}
      className={[
        'relative w-full text-left p-5 rounded-2xl border-2 transition-all duration-150',
        'hover:border-purple-400 hover:bg-purple-50',
        'focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-1',
        selected
          ? 'border-purple-600 bg-purple-50 shadow-sm'
          : 'border-gray-200 bg-white',
      ].join(' ')}
    >
      {/* Popular badge */}
      {role.popular && (
        <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wider bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
          Popular
        </span>
      )}

      {/* Selected check */}
      {selected && (
        <div className="absolute top-3 right-3 w-5 h-5 bg-purple-600 rounded-full flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      {/* Icon */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${selected ? 'bg-purple-100' : 'bg-gray-100'}`}>
        <Icon size={20} className={selected ? 'text-purple-700' : 'text-gray-500'} strokeWidth={1.8} />
      </div>

      {/* Title */}
      <p className={`text-sm font-semibold mb-1 ${selected ? 'text-purple-800' : 'text-gray-800'}`}>
        {role.title}
      </p>

      {/* Description */}
      <p className="text-xs text-gray-400 leading-relaxed mb-3">
        {role.description}
      </p>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5">
        {role.tags.map((tag) => (
          <span
            key={tag}
            className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
              selected
                ? 'bg-purple-200 text-purple-800'
                : 'bg-gray-100 text-gray-500'
            }`}
          >
            {tag}
          </span>
        ))}
      </div>
    </button>
  )
}
