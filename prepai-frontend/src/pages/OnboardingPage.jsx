import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, Zap } from 'lucide-react'
import PrimaryButton from '../components/PrimaryButton'
import SecondaryButton from '../components/SecondaryButton'
import { completeOnboarding, getExperienceLevels, getRoles } from '../api/onboarding'
import { getCurrentUser } from '../api/user'
import { logoutUser } from '../api/auth'
import { emitAuthChanged } from '../utils/authEvents'

const FALLBACK_EXPERIENCE_LEVELS = [
  { id: 'intern', label: 'Intern / Fresher', description: '0-1 years' },
  { id: 'junior', label: 'Junior', description: '1-3 years' },
  { id: 'mid', label: 'Mid-Level', description: '3-6 years' },
  { id: 'senior', label: 'Senior', description: '6+ years' },
]

function pickList(raw) {
  if (Array.isArray(raw)) return raw
  if (!raw || typeof raw !== 'object') return []

  if (Array.isArray(raw.roles)) return raw.roles
  if (Array.isArray(raw.levels)) return raw.levels
  if (Array.isArray(raw.experienceLevels)) return raw.experienceLevels
  if (Array.isArray(raw.items)) return raw.items

  const firstArray = Object.values(raw).find(Array.isArray)
  return firstArray || []
}

function normalizeRoles(raw) {
  return pickList(raw)
    .map((item, index) => {
      if (typeof item === 'string') {
        return { id: item, title: item, description: '' }
      }

      return {
        id: item.id || item.value || item.name || String(index),
        title: item.title || item.name || item.label || item.value || `Role ${index + 1}`,
        description: item.description || item.desc || '',
      }
    })
    .filter((item) => item.id && item.title)
}

function normalizeLevels(raw) {
  return pickList(raw)
    .map((item, index) => {
      if (typeof item === 'string') {
        return { id: item, label: item, description: '' }
      }

      return {
        id: item.id || item.value || item.name || String(index),
        label: item.label || item.name || item.title || item.value || `Level ${index + 1}`,
        description: item.description || item.desc || '',
      }
    })
    .filter((item) => item.id && item.label)
}

export default function OnboardingPage() {
  const navigate = useNavigate()
  const [roles, setRoles] = useState([])
  const [levels, setLevels] = useState([])
  const [selectedRole, setSelectedRole] = useState('')
  const [selectedExperience, setSelectedExperience] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleUseDifferentAccount = async () => {
    try {
      await logoutUser()
    } catch {
      // Ignore logout failure and still clear local auth state.
    } finally {
      emitAuthChanged(null)
      navigate('/login', { replace: true })
    }
  }

  useEffect(() => {
    let active = true

    const fetchOptions = async () => {
      try {
        const [rolesResponse, levelsResponse] = await Promise.all([
          getRoles(),
          getExperienceLevels(),
        ])

        if (!active) return

        const normalizedRoles = normalizeRoles(rolesResponse)
        const normalizedLevels = normalizeLevels(levelsResponse)

        setRoles(normalizedRoles)
        setLevels(normalizedLevels.length ? normalizedLevels : FALLBACK_EXPERIENCE_LEVELS)
      } catch (err) {
        if (!active) return
        setError(err.message || 'Failed to load onboarding options. Showing fallback experience levels.')
        setLevels(FALLBACK_EXPERIENCE_LEVELS)
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchOptions()

    return () => {
      active = false
    }
  }, [])

  const canSubmit = useMemo(() => selectedRole && selectedExperience, [selectedRole, selectedExperience])

  const handleSubmit = async () => {
    if (!canSubmit) return

    setSaving(true)
    setError('')

    try {
      await completeOnboarding({
        role: selectedRole,
        experience: selectedExperience,
      })

      const updatedUser = await getCurrentUser()
      emitAuthChanged(updatedUser)

      navigate('/setup')
    } catch (err) {
      setError(err.message || 'Failed to save onboarding data.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="border-b border-gray-100 bg-white">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2">
            <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
              <Zap size={15} className="text-white fill-white" />
            </div>
            <span className="font-bold text-lg text-gray-900">
              Prep<span className="text-purple-600">AI</span>
            </span>
          </button>

          <button
            type="button"
            onClick={handleUseDifferentAccount}
            className="text-xs text-gray-500 hover:text-gray-800 font-medium"
          >
            Use different account
          </button>
        </div>
      </header>

      <div className="flex-1 px-5 py-10">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-semibold uppercase tracking-wider text-purple-600">Onboarding</p>
            <h1 className="text-3xl font-bold text-gray-900 mt-2">Set your role and experience</h1>
            <p className="text-sm text-gray-500 mt-2">
              We use this to personalize interviews, MCQ difficulty, and scoring criteria.
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading ? (
            <div className="h-48 flex items-center justify-center">
              <p className="text-sm text-gray-500">Loading onboarding options...</p>
            </div>
          ) : (
            <div className="grid lg:grid-cols-2 gap-6">
              <section className="bg-white border border-gray-100 rounded-2xl p-6">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Target Role</h2>
                <div className="space-y-3">
                  {roles.map((role) => (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => setSelectedRole(role.title)}
                      className={[
                        'w-full text-left p-4 rounded-xl border transition-colors',
                        selectedRole === role.title
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-purple-300',
                      ].join(' ')}
                    >
                      <p className="text-sm font-semibold text-gray-900">{role.title}</p>
                      {role.description && <p className="text-xs text-gray-500 mt-1">{role.description}</p>}
                    </button>
                  ))}
                </div>
              </section>

              <section className="bg-white border border-gray-100 rounded-2xl p-6">
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-4">Experience</h2>
                <div className="space-y-3">
                  {levels.map((level) => (
                    <button
                      key={level.id}
                      type="button"
                      onClick={() => setSelectedExperience(level.id)}
                      className={[
                        'w-full text-left p-4 rounded-xl border transition-colors',
                        selectedExperience === level.id
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-purple-300',
                      ].join(' ')}
                    >
                      <p className="text-sm font-semibold text-gray-900">{level.label}</p>
                      {level.description && <p className="text-xs text-gray-500 mt-1">{level.description}</p>}
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}

          <div className="mt-8 flex items-center justify-between">
            <SecondaryButton variant="ghost" size="md" onClick={() => navigate('/login')}>
              Back
            </SecondaryButton>
            <PrimaryButton size="lg" onClick={handleSubmit} disabled={!canSubmit || saving || loading} loading={saving}>
              Continue to Resume Upload
              {!saving && <ArrowRight size={16} />}
            </PrimaryButton>
          </div>

          {!canSubmit && !loading && (
            <p className="text-xs text-gray-500 mt-3 text-right">
              Select both role and experience to continue.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
