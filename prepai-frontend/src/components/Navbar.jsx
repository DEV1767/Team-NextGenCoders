import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Zap, Menu, X } from 'lucide-react'
import PrimaryButton   from './PrimaryButton'
import SecondaryButton from './SecondaryButton'

const NAV_LINKS = [
  { label: 'Home',      to: '/'         },
  { label: 'Features',  to: '/#features' },
  { label: 'How It Works', to: '/#how-it-works' },
  { label: 'Dashboard', to: '/dashboard' },
]

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const navigate  = useNavigate()
  const { pathname } = useLocation()

  const isActive = (to) => pathname === to

  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-gray-100 shadow-sm">
      <nav className="max-w-6xl mx-auto px-5 lg:px-8 h-16 flex items-center justify-between">

        {/* ── Logo ── */}
        <Link
          to="/"
          className="flex items-center gap-2 shrink-0 focus:outline-none focus:ring-2 focus:ring-purple-400 rounded-lg"
          onClick={() => setMobileOpen(false)}
        >
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center shadow-sm">
            <Zap size={15} className="text-white fill-white" />
          </div>
          <span className="font-bold text-xl text-gray-900">
            Prep<span className="text-purple-600">AI</span>
          </span>
        </Link>

        {/* ── Desktop links ── */}
        <div className="hidden md:flex items-center gap-7">
          {NAV_LINKS.map(({ label, to }) => (
            <Link
              key={to}
              to={to}
              className={`text-sm font-medium transition-colors duration-150 ${
                isActive(to)
                  ? 'text-purple-600'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* ── Desktop CTA ── */}
        <div className="hidden md:flex items-center gap-2.5">
          <SecondaryButton
            variant="ghost"
            size="sm"
            onClick={() => navigate('/login')}
          >
            Log In
          </SecondaryButton>
          <PrimaryButton
            size="sm"
            onClick={() => navigate('/signup')}
          >
            Get Started
          </PrimaryButton>
        </div>

        {/* ── Mobile menu toggle ── */}
        <button
          className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none"
          onClick={() => setMobileOpen((o) => !o)}
          aria-label="Toggle navigation menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <div className="md:hidden absolute inset-x-0 top-16 bg-white border-b border-gray-100 shadow-lg z-50 px-5 py-5 flex flex-col gap-4 animate-slide-up">
          {NAV_LINKS.map(({ label, to }) => (
            <Link
              key={to}
              to={to}
              className="text-sm font-medium text-gray-700 py-1.5 hover:text-purple-600 transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              {label}
            </Link>
          ))}
          <div className="pt-3 border-t border-gray-100 flex flex-col gap-2.5">
            <SecondaryButton
              size="md"
              fullWidth
              onClick={() => { navigate('/login'); setMobileOpen(false) }}
            >
              Log In
            </SecondaryButton>
            <PrimaryButton
              size="md"
              fullWidth
              onClick={() => { navigate('/signup'); setMobileOpen(false) }}
            >
              Get Started — Free
            </PrimaryButton>
          </div>
        </div>
      )}
    </header>
  )
}
