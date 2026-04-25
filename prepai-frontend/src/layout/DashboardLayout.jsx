import { useState } from 'react'
import { Menu, X } from 'lucide-react'
import Sidebar from '../components/Sidebar'

/**
 * DashboardLayout
 * App shell for all authenticated / dashboard pages.
 * - Desktop: persistent left sidebar + scrollable main content
 * - Mobile: hidden sidebar that slides in as a drawer overlay
 *
 * Props:
 *  children – page content rendered in the main area
 */
export default function DashboardLayout({ children }) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <div className="min-h-screen flex bg-white font-poppins">

      {/* ── Desktop sidebar (always visible ≥ md) ── */}
      <div className="hidden md:flex md:shrink-0 sticky top-0 h-screen shadow-sm">
        <Sidebar />
      </div>

      {/* ── Mobile sidebar drawer ── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Panel */}
          <div className="w-64 h-full shadow-2xl animate-slide-up">
            <Sidebar onClose={() => setDrawerOpen(false)} />
          </div>
          {/* Backdrop */}
          <div
            className="flex-1 bg-black/40 backdrop-blur-[2px]"
            onClick={() => setDrawerOpen(false)}
            aria-label="Close sidebar"
          />
        </div>
      )}

      {/* ── Main content column ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Mobile top bar */}
        <div className="md:hidden sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3.5 flex items-center gap-3">
          <button
            onClick={() => setDrawerOpen(true)}
            className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors focus:outline-none"
            aria-label="Open navigation"
          >
            <Menu size={20} />
          </button>
          <span className="font-bold text-lg text-gray-900">
            Prep<span className="text-purple-600">AI</span>
          </span>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto page-enter">
          <div className="w-full p-5 md:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
