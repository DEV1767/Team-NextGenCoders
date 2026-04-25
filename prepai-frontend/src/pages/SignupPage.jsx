import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Zap, Eye, EyeOff, Mail, Lock, User, ArrowLeft, ArrowRight, GraduationCap, School } from 'lucide-react'
import FormInput     from '../components/FormInput'
import PrimaryButton from '../components/PrimaryButton'
import { registerUser } from '../api/auth'

const BULLETS = [
  'Completely free to get started',
  'Resume-based personalized questions',
  'Instant AI scoring after every answer',
  'Full progress dashboard included',
]

export default function SignupPage() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    username: '', email: '', password: '', batchYear: '', collegeName: '',
  })
  const [showPwd, setShowPwd]       = useState(false)
  const [errors, setErrors]         = useState({})
  const [loading, setLoading]       = useState(false)
  const [apiError, setApiError]     = useState('')

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const validate = () => {
    const errs = {}
    if (!form.username.trim())                       errs.username = 'Username is required'
    if (!form.email)                                 errs.email   = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(form.email))      errs.email   = 'Enter a valid email address'
    if (!form.password)                              errs.password = 'Password is required'
    else if (form.password.length < 8)               errs.password = 'Minimum 8 characters required'
    if (!form.batchYear)                             errs.batchYear = 'Batch year is required'
    else if (!/^\d{4}$/.test(form.batchYear))        errs.batchYear = 'Enter a valid year like 2026'
    if (!form.collegeName.trim())                    errs.collegeName = 'College name is required'
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
      const year = Number(form.batchYear)
      await registerUser({
        username: form.username,
        email: form.email,
        password: form.password,
        graduationYear: year,
        batchYear: year,
        collegeName: form.collegeName,
        course: 'General',
      })
      setLoading(false)
      navigate('/login')
    } catch (err) {
      setLoading(false)
      setApiError(err.message || 'Unable to create account. Please try again.')
    }
  }

  // Password strength
  const strength = (() => {
    if (!form.password) return 0
    let s = 0
    if (form.password.length >= 8)           s++
    if (/[A-Z]/.test(form.password))         s++
    if (/[0-9]/.test(form.password))         s++
    if (/[^A-Za-z0-9]/.test(form.password)) s++
    return s
  })()

  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength]
  const strengthColor = ['', 'bg-red-400', 'bg-yellow-400', 'bg-blue-400', 'bg-green-500'][strength]

  return (
    <div className="min-h-screen flex">

      {/* ── LEFT — Brand panel ───────────────────────────── */}
      <div className="hidden lg:flex lg:w-5/12 xl:w-1/2 bg-gray-900 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full border-[48px] border-purple-600/10 pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full border-[36px] border-purple-600/10 pointer-events-none" />

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

        {/* Copy */}
        <div className="z-10 relative">
          <h2 className="font-bold text-4xl xl:text-5xl text-white leading-tight mb-5">
            Start your journey
            <br />
            to your{' '}
            <span className="text-purple-400">dream role.</span>
          </h2>
          <p className="text-gray-400 text-base leading-relaxed max-w-sm mb-10">
            Create your free account in under 60 seconds and start practising
            with AI-powered mock interviews personalised specifically for you.
          </p>
          <ul className="space-y-3">
            {BULLETS.map((b) => (
              <li key={b} className="flex items-center gap-3 text-sm text-gray-300">
                <span className="w-5 h-5 rounded-full bg-purple-600 flex items-center justify-center shrink-0">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </span>
                {b}
              </li>
            ))}
          </ul>
        </div>

        <p className="text-gray-600 text-xs z-10 relative">© 2026 PrepAI · AI Interview Coach</p>
      </div>

      {/* ── RIGHT — Form panel ───────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10 overflow-y-auto">

        {/* Back */}
        <div className="w-full max-w-sm mb-7">
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
          <div className="lg:hidden flex items-center gap-2 mb-7">
            <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
              <Zap size={15} className="text-white fill-white" />
            </div>
            <span className="font-bold text-xl text-gray-900">
              Prep<span className="text-purple-600">AI</span>
            </span>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-1">Create your account</h1>
          <p className="text-sm text-gray-500 mb-8">
            Already have one?{' '}
            <Link to="/login" className="text-purple-600 font-semibold hover:underline">
              Log in
            </Link>
          </p>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>

            {apiError && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {apiError}
              </div>
            )}

            {/* Username */}
            <FormInput
              label="Username"
              type="text"
              id="username"
              name="username"
              value={form.username}
              onChange={set('username')}
              placeholder="alexjohnson"
              required
              error={errors.username}
              icon={User}
            />

            {/* Email */}
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

            {/* Password */}
            <div>
              <FormInput
                label="Password"
                type={showPwd ? 'text' : 'password'}
                id="password"
                name="password"
                value={form.password}
                onChange={set('password')}
                placeholder="Min. 8 characters"
                required
                error={errors.password}
                icon={Lock}
                rightSlot={
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="text-gray-400 hover:text-gray-600 p-1"
                    aria-label="Toggle password"
                  >
                    {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                }
              />

              {/* Strength bar */}
              {form.password && (
                <div className="mt-2 flex gap-1 items-center">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${
                        i <= strength ? strengthColor : 'bg-gray-100'
                      }`}
                    />
                  ))}
                  <span className={`text-[10px] font-semibold ml-1 ${
                    strength <= 1 ? 'text-red-500'
                    : strength === 2 ? 'text-yellow-600'
                    : strength === 3 ? 'text-blue-600'
                    : 'text-green-600'
                  }`}>
                    {strengthLabel}
                  </span>
                </div>
              )}
            </div>

            <FormInput
              label="Batch Year"
              type="text"
              id="batchYear"
              name="batchYear"
              value={form.batchYear}
              onChange={set('batchYear')}
              placeholder="2026"
              required
              error={errors.batchYear}
              icon={GraduationCap}
            />

            <FormInput
              label="College Name"
              type="text"
              id="collegeName"
              name="collegeName"
              value={form.collegeName}
              onChange={set('collegeName')}
              placeholder="ABC Institute of Technology"
              required
              error={errors.collegeName}
              icon={School}
            />

            {/* Terms */}
            <label className="flex items-start gap-2.5 cursor-pointer select-none">
              <input type="checkbox" required className="w-4 h-4 mt-0.5 accent-purple-600" />
              <span className="text-xs text-gray-500 leading-relaxed">
                I agree to the{' '}
                <button type="button" className="text-purple-600 font-medium hover:underline">Terms of Service</button>
                {' '}and{' '}
                <button type="button" className="text-purple-600 font-medium hover:underline">Privacy Policy</button>.
              </span>
            </label>

            <PrimaryButton type="submit" size="lg" fullWidth loading={loading}>
              {loading ? 'Creating account…' : 'Create Account'}
              {!loading && <ArrowRight size={17} />}
            </PrimaryButton>
          </form>

        </div>
      </div>
    </div>
  )
}
