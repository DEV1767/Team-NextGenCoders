import { useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  Zap, LayoutDashboard, Mic, BookOpen,
  BarChart2, User, LogOut, ChevronRight, Upload,
  Award,
} from 'lucide-react'
import { getCurrentUser } from '../api/user'
import { logoutUser } from '../api/auth'
import { emitAuthChanged } from '../utils/authEvents'

const ICON_MAP = {
  LayoutDashboard,
  Mic,
  BookOpen,
  BarChart2,
  User,
  Upload,
  Award,
}

const NAV = [
  { label: 'Dashboard',    path: '/dashboard', icon: 'LayoutDashboard' },
  { label: 'Resume Upload', path: '/setup', icon: 'Upload'               },
  { label: 'Interview',    path: '/interview',  icon: 'Mic'             },
  { label: 'Daily Challenge', path: '/challenge', icon: 'Zap'           },
  { label: 'Flashcards',    path: '/flashcards', icon: 'BookOpen'        },
  { label: 'Leaderboard',   path: '/leaderboard', icon: 'Award'          },
  { label: 'MCQ Practice', path: '/objective',  icon: 'BookOpen'        },
  { label: 'Aptitude Practice', path: '/aptitude',  icon: 'BookOpen'    },
  { label: 'Results',      path: '/result',     icon: 'BarChart2'       },
  { label: 'Profile',      path: '/profile',    icon: 'User'            },
]

export default function Sidebar({ onClose }) {
  const navigate      = useNavigate()
  const { pathname }  = useLocation()
  const [currentUser, setCurrentUser] = useState(null)

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const user = await getCurrentUser()
        setCurrentUser(user)
      } catch (err) {
        console.error('Failed to fetch user:', err)
      }
    }
    fetchUser()
  }, [])

  const user = currentUser || {
    avatarInitials: 'U',
    name: 'User',
    email: 'user@example.com',
  }

  const go = (path) => {
    navigate(path)
    onClose?.()
  }

  const handleSignOut = async () => {
    try {
      await logoutUser()
    } catch (err) {
      console.error('Failed to logout:', err)
    } finally {
      emitAuthChanged(null)
      go('/login')
    }
  }

  return (
    <aside className="w-64 h-full bg-white border-r border-gray-100 flex flex-col">

      {/* ── Logo ── */}
      <div className="px-5 py-5 border-b border-gray-100 shrink-0">
        <button
          onClick={() => go('/')}
          className="flex items-center gap-2 focus:outline-none focus:ring-2 focus:ring-purple-400 rounded-lg"
        >
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center shadow-sm">
            <Zap size={15} className="text-white fill-white" />
          </div>
          <span className="font-bold text-xl text-gray-900">
            Prep<span className="text-purple-600">AI</span>
          </span>
        </button>
      </div>

      {/* ── Nav items ── */}
      <nav className="flex-1 px-3 py-5 overflow-y-auto flex flex-col gap-1">

        {/* Section label */}
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest px-3 mb-2">
          Main Menu
        </p>

        {NAV.map(({ label, path, icon }) => {
          const Icon   = ICON_MAP[icon] ?? LayoutDashboard
          const active = pathname === path

          return (
            <button
              key={path}
              onClick={() => go(path)}
              className={[
                'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium',
                'transition-all duration-150 text-left',
                'focus:outline-none focus:ring-2 focus:ring-purple-300',
                active
                  ? 'bg-purple-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
              ].join(' ')}
            >
              <Icon
                size={17}
                strokeWidth={active ? 2.5 : 1.8}
                className={active ? 'text-white' : 'text-gray-400'}
              />
              <span className="flex-1">{label}</span>
              {active && <ChevronRight size={14} className="text-white/70" />}
            </button>
          )
        })}

        {/* Divider */}
        <div className="my-3 border-t border-gray-100" />

        {/* Quick start interview */}
        <button
          onClick={() => go('/interview')}
          className={[
            'w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold',
            'bg-purple-50 border border-purple-200 text-purple-700',
            'hover:bg-purple-100 hover:border-purple-300',
            'transition-all duration-150',
          ].join(' ')}
        >
          <Mic size={16} className="text-purple-600" />
          Start New Interview
        </button>
      </nav>

      {/* ── User card + logout ── */}
      <div className="px-3 py-4 border-t border-gray-100 space-y-1 shrink-0">
        {/* User info */}
        <button
          onClick={() => go('/profile')}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-left"
        >
          <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-700 shrink-0">
            {user.avatarInitials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-800 truncate">{user.name}</p>
            <p className="text-[11px] text-gray-400 truncate">{user.email}</p>
          </div>
        </button>

        {/* Logout */}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-500 transition-all duration-150"
        >
          <LogOut size={15} className="shrink-0" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
