import Navbar from '../components/Navbar'

/**
 * MainLayout
 * Wraps all public-facing pages (Landing, Login, Signup, etc.)
 * with the top Navbar.
 *
 * Props:
 *  children    – page content
 *  hideNavbar  – boolean — set true on pages that have their own header
 */
export default function MainLayout({ children, hideNavbar = false }) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      {!hideNavbar && <Navbar />}
      <main className="flex-1 page-enter">
        {children}
      </main>
    </div>
  )
}
