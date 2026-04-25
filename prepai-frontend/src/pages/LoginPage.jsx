import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Zap, Eye, EyeOff, Mail, Lock, ArrowLeft, CheckCircle } from 'lucide-react'
import FormInput     from '../components/FormInput'
import PrimaryButton from '../components/PrimaryButton'
import { loginUser } from '../api/auth'
import { getCurrentUser } from '../api/user'
import { emitAuthChanged } from '../utils/authEvents'
import { getPostLoginPath } from '../utils/userState'

const PERKS = [
  'Personalized AI interview sessions',
  'Resume-based question generation',
  'Real-time scoring & feedback',
  'Progress tracking dashboard',
]

export default function LoginPage() {
  const navigate = useNavigate()

  const [form, setForm]         = useState({ email: '', password: '' })
  const [showPwd, setShowPwd]   = useState(false)
  const [errors, setErrors]     = useState({})
  const [loading, setLoading]   = useState(false)
  const [apiError, setApiError] = useState('')

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const validate = () => {
    const errs = {}
    if (!form.email)                        errs.email    = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email'
    if (!form.password)                     errs.password = 'Password is required'
    else if (form.password.length < 6)      errs.password = 'Minimum 6 characters'
    return errs
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    setApiError('')
    setLoading(true)
    try {
      await loginUser({
        email: form.email,
        password: form.password,
      })
      const currentUser = await getCurrentUser()
      emitAuthChanged(currentUser)
      setLoading(false)
      navigate(getPostLoginPath(currentUser), { replace: true })
    } catch (err) {
      setLoading(false)
      setApiError(err.message || 'Unable to login. Please try again.')
    }
  }

  return (
    <div className="min-h-screen flex">

      {/* ── LEFT — Brand panel ───────────────────────────────── */}
      <div className="hidden lg:flex lg:w-5/12 xl:w-1/2 bg-gray-900 flex-col justify-between p-12 relative overflow-hidden">

        {/* Decorative rings */}
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full border-[48px] border-purple-600/10 pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full border-[36px] border-purple-600/10 pointer-events-none" />
        <div className="absolute bottom-32 right-10 w-32 h-32 rounded-full border-[20px] border-purple-600/20 pointer-events-none" />

        {/* Logo */}
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2.5 z-10 relative focus:outline-none"
        >
          <div className="w-9 h-9 bg-purple-600 rounded-xl flex items-center justify-center shadow-lg">
            <Zap size={17} className="text-white fill-white" />
          </div>
          <span className="font-bold text-2xl text-white">
            Prep<span className="text-purple-400">AI</span>
          </span>
        </button>

        {/* Main copy */}
        <div className="z-10 relative">
          <h2 className="font-bold text-4xl xl:text-5xl text-white leading-tight mb-5">
            Welcome back.
            <br />
            <span className="text-purple-400">Keep building</span>
            <br />
            your confidence.
          </h2>
          <p className="text-gray-400 text-base leading-relaxed max-w-sm mb-10">
            Log back in and continue your preparation journey.
            Thousands of candidates have landed their dream roles — you're next.
          </p>
          <ul className="space-y-3">
            {PERKS.map((p) => (
              <li key={p} className="flex items-center gap-3 text-sm text-gray-300">
                <CheckCircle size={15} className="text-purple-400 shrink-0" />
                {p}
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <p className="text-gray-600 text-xs z-10 relative">© 2026 PrepAI · AI Interview Coach</p>
      </div>

      {/* ── RIGHT — Form panel ───────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12 overflow-y-auto">

        {/* Back link */}
        <div className="w-full max-w-sm mb-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors"
          >
            <ArrowLeft size={15} />
            Back to home
          </button>
        </div>

        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
              <Zap size={15} className="text-white fill-white" />
            </div>
            <span className="font-bold text-xl text-gray-900">
              Prep<span className="text-purple-600">AI</span>
            </span>
          </div>

          {/* Heading */}
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Log in to your account</h1>
          <p className="text-sm text-gray-500 mb-8">
            Don't have an account?{' '}
            <Link to="/signup" className="text-purple-600 font-semibold hover:underline">
              Sign up free
            </Link>
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>

            {apiError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {apiError}
              </div>
            )}

            <FormInput
              label="Email address"
              type="email"
              id="email"
              name="email"
              value={form.email}
              onChange={set('email')}
              placeholder="you@example.com"
              required
              error={errors.email}
              icon={Mail}
            />

            <div>
              <FormInput
                label="Password"
                type={showPwd ? 'text' : 'password'}
                id="password"
                name="password"
                value={form.password}
                onChange={set('password')}
                placeholder="Enter your password"
                required
                error={errors.password}
                icon={Lock}
                rightSlot={
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                    aria-label="Toggle password visibility"
                  >
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                }
              />
              <div className="flex justify-end mt-1.5">
                <button type="button" className="text-xs text-purple-600 hover:underline font-medium">
                  Forgot password?
                </button>
              </div>
            </div>

            {/* Remember me */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none group">
              <input
                type="checkbox"
                className="w-4 h-4 accent-purple-600 rounded"
              />
              <span className="text-sm text-gray-600 group-hover:text-gray-900 transition-colors">
                Remember me for 30 days
              </span>
            </label>

            <PrimaryButton
              type="submit"
              size="lg"
              fullWidth
              loading={loading}
            >
              {loading ? 'Logging in…' : 'Log In'}
            </PrimaryButton>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-xs text-gray-400 font-medium">or continue with</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>

          {/* OAuth placeholder buttons */}
          <div className="grid grid-cols-2 gap-3">
            {['Google', 'GitHub'].map((provider) => (
              <button
                key={provider}
                type="button"
                className="flex items-center justify-center gap-2 border border-gray-200 rounded-xl py-2.5 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all"
              >
                <span>{provider === 'Google' ? '🇬' : '🐙'}</span>
                {provider}
              </button>
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}
