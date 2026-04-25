import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Camera, Edit2, Check, X, Bell,
  Shield, Trash2, Mail, Briefcase, User,
  Calendar, LogOut, Upload, FileText, Zap,
} from 'lucide-react'
import DashboardLayout  from '../layout/DashboardLayout'
import FormInput        from '../components/FormInput'
import PrimaryButton    from '../components/PrimaryButton'
import SecondaryButton  from '../components/SecondaryButton'
import { getCurrentUser, updateUserProfile, analyzeResume } from '../api/user'
import { getDashboardStats, getDashboardSummary } from '../api/dashboard'
import { logoutUser } from '../api/auth'
import { emitAuthChanged } from '../utils/authEvents'

// ── Notification toggle row ────────────────────────────────────────────────────
function ToggleRow({ label, desc, checked, onChange }) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-gray-50 last:border-0">
      <div className="flex-1 pr-6">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {desc && <p className="text-xs text-gray-400 mt-0.5">{desc}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none shrink-0 ${
          checked ? 'bg-purple-600' : 'bg-gray-200'
        }`}
        role="switch"
        aria-checked={checked}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const navigate = useNavigate()

  const [editing, setEditing] = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [stats, setStats] = useState({
    interviews: 0,
    avgScore: 0,
    streak: 0,
  })
  const [loading, setLoading] = useState(true)
  const [analyzeLoading, setAnalyzeLoading] = useState(false)
  const [analyzeError, setAnalyzeError] = useState('')
  const [resumeScore, setResumeScore] = useState(0)
  const [resumeFeedback, setResumeFeedback] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [user, statsData] = await Promise.all([
          getCurrentUser(),
          getDashboardStats(),
        ])

        setCurrentUser({
          ...user,
          joinedDate: user.joinedDate 
            ? new Date(user.joinedDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
            : 'N/A',
        })

        // Extract stats from dashboard response
        if (statsData?.stats && Array.isArray(statsData.stats)) {
          const statMap = {}
          statsData.stats.forEach(stat => {
            if (stat.key === 'interviews') statMap.interviews = stat.value || 0
            if (stat.key === 'average') statMap.avgScore = stat.value || 0
          })
          setStats(prev => ({ ...prev, ...statMap }))
        }
      } catch (err) {
        console.error('Failed to fetch data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const [form, setForm] = useState({
    name:       currentUser?.name || '',
    email:      currentUser?.email || '',
    role:       currentUser?.role || '',
    experience: currentUser?.experience || '',
  })

  useEffect(() => {
    if (currentUser) {
      setForm({
        name:       currentUser.name,
        email:      currentUser.email,
        role:       currentUser.role,
        experience: currentUser.experience,
      })
    }
  }, [currentUser])
  const [errors, setErrors] = useState({})

  const [notifications, setNotifs] = useState({
    daily:    true,
    results:  true,
    tips:     false,
    features: false,
  })

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const validate = () => {
    const errs = {}
    if (!form.name.trim())  errs.name  = 'Name is required'
    if (!form.email.trim()) errs.email = 'Email is required'
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Invalid email'
    return errs
  }

  const handleSave = async () => {
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    try {
      await updateUserProfile(form)
      setEditing(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      console.error('Failed to save profile:', err)
    }
  }

  if (loading || !currentUser) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Loading...</p>
        </div>
      </DashboardLayout>
    )
  }

  const handleCancel = () => {
    setEditing(false)
    setErrors({})
    setForm({
      name:       currentUser.name,
      email:      currentUser.email,
      role:       currentUser.role,
      experience: currentUser.experience,
    })
  }

  const toggleNotif = (key) => (val) =>
    setNotifs((n) => ({ ...n, [key]: val }))

  const handleSignOut = async () => {
    try {
      await logoutUser()
    } catch (err) {
      console.error('Failed to logout:', err)
    } finally {
      emitAuthChanged(null)
      navigate('/login')
    }
  }

  const handleAnalyzeResume = async () => {
    setAnalyzeLoading(true)
    setAnalyzeError('')
    try {
      const result = await analyzeResume()
      setResumeScore(result?.score || 0)
      setResumeFeedback(result?.feedback || '')
      
      // Update current user with new resume analysis data
      setCurrentUser(prev => ({
        ...prev,
        resume: {
          ...prev?.resume,
          analyzed: true,
          score: result?.score || 0,
          feedback: result?.feedback || '',
          canAnalyze: false,
          buttonLabel: 'Verified ✓'
        }
      }))

      // Show success toast
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setAnalyzeError(err.message || 'Failed to analyze resume. Try again.')
      console.error('Failed to analyze resume:', err)
    } finally {
      setAnalyzeLoading(false)
    }
  }

  const initials = form.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const resumeInfo = currentUser?.resume || currentUser?.resumeMeta || null
  const resumeFileName = resumeInfo?.fileName || currentUser?.resumeFile || 'No resume uploaded yet'
  const resumeUploadedAt = resumeInfo?.uploadedAt
    ? new Date(resumeInfo.uploadedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : 'Not uploaded'
  const hasResume = Boolean(resumeInfo?.url || currentUser?.resumeUrl)

  return (
    <DashboardLayout>

      {/* ── Page header ── */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
        <p className="text-gray-500 text-sm mt-0.5">Manage your account information and preferences.</p>
      </div>

      {/* ── Saved toast ── */}
      {saved && (
        <div className="mb-5 flex items-center gap-2.5 bg-green-50 border border-green-200 text-green-800 text-sm font-medium px-5 py-3.5 rounded-xl">
          <Check size={16} className="text-green-600" />
          Profile updated successfully.
        </div>
      )}

      <div className="max-w-2xl space-y-6">

        {/* ── Avatar card ──────────────────────────────────── */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">

            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-20 h-20 rounded-full bg-purple-100 flex items-center justify-center text-purple-700 font-black text-2xl select-none">
                {initials}
              </div>
              <button
                className="absolute -bottom-1.5 -right-1.5 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center shadow-lg hover:bg-purple-700 transition-colors border-2 border-white"
                aria-label="Change avatar"
              >
                <Camera size={13} className="text-white" />
              </button>
            </div>

            {/* Name + role */}
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-gray-900 truncate">{form.name}</h2>
              <p className="text-sm text-gray-500 truncate">{form.role}</p>
              <div className="flex flex-wrap gap-2 mt-2.5">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-100 px-2.5 py-0.5 rounded-full">
                  <span className="w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse" />
                  Active Member
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold bg-green-50 text-green-700 border border-green-100 px-2.5 py-0.5 rounded-full">
                  <Shield size={11} />
                  Verified
                </span>
              </div>
            </div>

            {/* Edit / Save / Cancel */}
            <div className="flex gap-2 shrink-0">
              {editing ? (
                <>
                  <PrimaryButton size="sm" onClick={handleSave}>
                    <Check size={14} />
                    Save
                  </PrimaryButton>
                  <SecondaryButton variant="ghost" size="sm" onClick={handleCancel}>
                    <X size={14} />
                    Cancel
                  </SecondaryButton>
                </>
              ) : (
                <SecondaryButton variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Edit2 size={13} />
                  Edit Profile
                </SecondaryButton>
              )}
            </div>
          </div>
        </div>

        {/* ── Personal details ──────────────────────────────── */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-5 flex items-center gap-2 text-base">
            <User size={16} className="text-purple-600" />
            Personal Details
          </h3>
          <div className="space-y-4">
            <FormInput
              label="Full Name"
              type="text"
              id="profile-name"
              value={form.name}
              onChange={set('name')}
              disabled={!editing}
              error={errors.name}
              icon={User}
            />
            <FormInput
              label="Email Address"
              type="email"
              id="profile-email"
              value={form.email}
              onChange={set('email')}
              disabled={!editing}
              error={errors.email}
              icon={Mail}
            />
            <FormInput
              label="Target Role"
              type="text"
              id="profile-role"
              value={form.role}
              onChange={set('role')}
              disabled={!editing}
              icon={Briefcase}
            />
            <FormInput
              label="Experience Level"
              type="select"
              id="profile-exp"
              value={form.experience}
              onChange={set('experience')}
              disabled={!editing}
            >
              <option>Intern / Fresher (0–1 years)</option>
              <option>Junior (1–3 years)</option>
              <option>Mid-Level (3–6 years)</option>
              <option>Senior (6+ years)</option>
            </FormInput>

            {/* Read-only: joined date */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-gray-700">Member Since</label>
              <div className="flex items-center gap-2.5 border border-gray-200 rounded-xl px-4 py-3 bg-gray-50">
                <Calendar size={15} className="text-gray-400 shrink-0" />
                <span className="text-sm text-gray-500">{currentUser.joinedDate}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Stats ──────────────────────────────────────────── */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-5 text-base">Your Stats</h3>
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Interviews',   value: stats.interviews,     color: 'text-purple-700', bg: 'bg-purple-50' },
              { label: 'Avg Score',    value: `${stats.avgScore}%`, color: 'text-blue-700',   bg: 'bg-blue-50'   },
              { label: 'Day Streak',   value: `${stats.streak} 🔥`, color: 'text-orange-600', bg: 'bg-orange-50' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className={`${bg} rounded-xl p-4 text-center`}>
                <p className={`text-2xl font-black ${color}`}>{value}</p>
                <p className="text-xs text-gray-500 mt-1 font-medium">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Resume ───────────────────────────────────────────── */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
            <div>
              <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                <FileText size={16} className="text-purple-600" />
                Resume
              </h3>
              <p className="text-xs text-gray-400 mt-1">Keep the latest resume here so interview questions stay up to date.</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <SecondaryButton variant="outline" size="sm" onClick={() => navigate('/setup')}>
                <Upload size={14} />
                {hasResume ? 'Update Resume' : 'Upload Resume'}
              </SecondaryButton>
              {currentUser?.resume?.uploaded && (
                <PrimaryButton 
                  size="sm" 
                  onClick={handleAnalyzeResume}
                  disabled={analyzeLoading || !currentUser?.resume?.canAnalyze}
                  loading={analyzeLoading}
                >
                  {!analyzeLoading && currentUser?.resume?.analyzed && <Check size={14} />}
                  {!analyzeLoading && !currentUser?.resume?.analyzed && <Zap size={14} />}
                  {currentUser?.resume?.buttonLabel || 'Verify Resume'}
                </PrimaryButton>
              )}
            </div>
          </div>

          {analyzeError && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {analyzeError}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 mb-4">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Current File</p>
              <p className="mt-1 text-sm font-semibold text-gray-800 truncate">{resumeFileName}</p>
              <p className="mt-1 text-xs text-gray-500">{hasResume ? 'Resume is available for interview personalization.' : 'Upload a resume to unlock personalized interview questions.'}</p>
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">Last Updated</p>
              <p className="mt-1 text-sm font-semibold text-gray-800">{resumeUploadedAt}</p>
              <p className="mt-1 text-xs text-gray-500">The dashboard and interview flow use this latest version.</p>
            </div>
          </div>

          {currentUser?.resume?.analyzed && (
            <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Check size={16} className="text-green-600" />
                  <p className="text-sm font-semibold text-gray-900">Resume Analysis Complete</p>
                </div>
                <div className="text-2xl font-black text-purple-700">{currentUser?.resume?.score || resumeScore}%</div>
              </div>
              {(currentUser?.resume?.feedback || resumeFeedback) && (
                <p className="text-xs text-gray-600 leading-relaxed">{currentUser?.resume?.feedback || resumeFeedback}</p>
              )}
            </div>
          )}
        </div>

        {/* ── Notifications ───────────────────────────────────── */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-1 flex items-center gap-2 text-base">
            <Bell size={16} className="text-purple-600" />
            Notifications
          </h3>
          <p className="text-xs text-gray-400 mb-5">Choose what PrepAI sends you reminders about.</p>
          <div>
            <ToggleRow
              label="Daily practice reminders"
              desc="Get reminded to practice every day at 7 PM"
              checked={notifications.daily}
              onChange={toggleNotif('daily')}
            />
            <ToggleRow
              label="Interview result summaries"
              desc="Receive a full breakdown email after each session"
              checked={notifications.results}
              onChange={toggleNotif('results')}
            />
            <ToggleRow
              label="Preparation tips & insights"
              desc="Weekly curated tips from top interviewers"
              checked={notifications.tips}
              onChange={toggleNotif('tips')}
            />
            <ToggleRow
              label="New feature announcements"
              desc="Be the first to know about PrepAI updates"
              checked={notifications.features}
              onChange={toggleNotif('features')}
            />
          </div>
        </div>

        {/* ── Danger zone ─────────────────────────────────────── */}
        <div className="bg-white border border-red-100 rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-red-700 mb-1 flex items-center gap-2 text-base">
            <Trash2 size={16} />
            Danger Zone
          </h3>
          <p className="text-xs text-gray-400 mb-5">
            These actions are permanent and cannot be undone.
          </p>
          <div className="flex flex-wrap gap-3">
            <SecondaryButton
              variant="outline"
              size="sm"
              className="border-red-200 text-red-500 hover:bg-red-50"
              onClick={handleSignOut}
            >
              <LogOut size={13} />
              Sign Out
            </SecondaryButton>
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-500 border border-red-200 rounded-xl hover:bg-red-50 transition-colors">
              <Trash2 size={13} />
              Delete Account
            </button>
          </div>
        </div>

      </div>
    </DashboardLayout>
  )
}
