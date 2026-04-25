import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  Mic, ArrowRight, Clock, TrendingUp,
  BookOpen, ChevronRight, Calendar, Zap, Upload,
} from 'lucide-react'
import DashboardLayout from '../layout/DashboardLayout'
import StatsCard       from '../components/StatsCard'
import PrimaryButton   from '../components/PrimaryButton'
import SecondaryButton from '../components/SecondaryButton'
import { getCurrentUser } from '../api/user'
import { getDashboardSummary, getDashboardStats, getRecentSessions, getWeeklyActivity, getScoreTrend } from '../api/dashboard'

// Score colour helper
const scoreColor = (s) =>
  s >= 85 ? 'text-green-600'
  : s >= 70 ? 'text-blue-600'
  : s >= 55 ? 'text-yellow-600'
  : 'text-red-500'

const scoreBg = (s) =>
  s >= 85 ? 'bg-green-50 text-green-700 border-green-200'
  : s >= 70 ? 'bg-blue-50 text-blue-700 border-blue-200'
  : s >= 55 ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
  : 'bg-red-50 text-red-700 border-red-200'

// Mini weekly progress bar
function WeekBar({ days = [] }) {
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
  const values = days.length === 7 ? days : [1, 1, 1, 0, 1, 1, 0]
  return (
    <div className="flex gap-2 items-end">
      {labels.map((l, i) => (
        <div key={i} className="flex flex-col items-center gap-1.5">
          <div
            className={`w-6 rounded-md transition-colors ${
              values[i] ? 'bg-purple-600' : 'bg-gray-100'
            }`}
            style={{ height: values[i] ? '28px' : '12px' }}
          />
          <span className="text-[9px] text-gray-400 font-medium">{l}</span>
        </div>
      ))}
    </div>
  )
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [currentUser, setCurrentUser] = useState(null)
  const [dashStats, setDashStats] = useState([])
  const [recentSessions, setRecentSessions] = useState([])
  const [weeklyActivity, setWeeklyActivity] = useState([1, 1, 1, 0, 1, 1, 0])
  const [scoreTrend, setScoreTrend] = useState([
    { label: 'S1', score: 62 },
    { label: 'S2', score: 68 },
    { label: 'S3', score: 71 },
    { label: 'S4', score: 74 },
    { label: 'S5', score: 79 },
    { label: 'S6', score: 82 },
  ])
  const [loading, setLoading] = useState(true)

  const safeText = (value, fallback = '-') => {
    if (value === null || value === undefined) return fallback
    if (typeof value === 'string' || typeof value === 'number') return String(value)
    if (typeof value === 'object') {
      const candidate =
        value.label ||
        value.name ||
        value.title ||
        value.value ||
        value.text ||
        value.date ||
        value.type ||
        fallback

      return typeof candidate === 'string' || typeof candidate === 'number'
        ? String(candidate)
        : fallback
    }
    return fallback
  }

  const normalizeNumeric = (value, fallback = 0) => {
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
      const parsed = Number(value)
      return Number.isFinite(parsed) ? parsed : fallback
    }
    if (value && typeof value === 'object') {
      const candidate = value.score ?? value.value ?? value.y
      const parsed = Number(candidate)
      return Number.isFinite(parsed) ? parsed : fallback
    }
    return fallback
  }

  const normalizeSessions = (items) => {
    const list = Array.isArray(items) ? items : []
    return list.map((session) => {
      const completedDate = session.completedAt || session.createdAt
      const dateObj = completedDate ? new Date(completedDate) : new Date()
      const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      
      const modeLabel = session.mode === 'live_interview' 
        ? 'AI Interview' 
        : session.mode === 'interview_mock'
        ? 'AI Interview'
        : session.mode === 'mcq_practice'
        ? (session.topic && session.topic.toLowerCase().includes('aptitude') ? 'Aptitude Practice' : 'MCQ Practice')
        : session.mode || 'Session'

      return {
        id: session._id || session.id,
        role: session.targetRole || session.role || 'Unknown Role',
        date: formattedDate,
        duration: session.durationMinutes ? `${Math.round(session.durationMinutes)} min` : 'N/A',
        type: modeLabel,
        score: normalizeNumeric(session.overallScore || session.score, 0),
      }
    })
  }

  const normalizeDashStats = (items) => {
    const list = Array.isArray(items) ? items : []
    return list.length ? list : []
  }

  const normalizeTrend = (items) => {
    const list = Array.isArray(items) ? items : []
    const normalized = list.map((item, index) => {
      if (typeof item === 'number' || typeof item === 'string') {
        return {
          label: `S${index + 1}`,
          score: normalizeNumeric(item, 0),
        }
      }

      return {
        label: safeText(item?.label || `S${item?.index || index + 1}`, `S${index + 1}`),
        score: normalizeNumeric(item?.score || item?.overallScore, 0),
      }
    })

    return normalized.length
      ? normalized
      : [
          { label: 'S1', score: 62 },
          { label: 'S2', score: 68 },
          { label: 'S3', score: 71 },
          { label: 'S4', score: 74 },
          { label: 'S5', score: 79 },
          { label: 'S6', score: 82 },
        ]
  }

  const toList = (value, preferredKey) => {
    if (Array.isArray(value)) return value
    if (!value || typeof value !== 'object') return []
    if (Array.isArray(value[preferredKey])) return value[preferredKey]

    const firstArray = Object.values(value).find(Array.isArray)
    return firstArray || []
  }

  const openResult = (resultId) => {
    if (!resultId) {
      navigate('/result')
      return
    }

    navigate(`/result?resultId=${encodeURIComponent(resultId)}`)
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [user, summary, stats, sessions, activity, trend] = await Promise.all([
          getCurrentUser(),
          getDashboardSummary(),
          getDashboardStats(),
          getRecentSessions(5),
          getWeeklyActivity(),
          getScoreTrend(),
        ])
        setCurrentUser(user)
        const statsList = toList(stats, 'stats')
        const summaryList = toList(summary, 'stats')
        setDashStats(statsList.length ? statsList : summaryList)
        
        const sessionsData = toList(sessions, 'sessions')
        setRecentSessions(normalizeSessions(sessionsData))

        // Extract weekly activity from response
        const weekData = activity?.weeklyActivity || activity?.data || toList(activity, 'weeklyActivity')
        const normalizedWeek = weekData.map((entry) => {
          if (typeof entry === 'number') return entry
          if (typeof entry === 'boolean') return entry ? 1 : 0
          if (entry && typeof entry === 'object') {
            if (typeof entry.active === 'boolean') return entry.active ? 1 : 0
            return normalizeNumeric(entry.sessions ?? entry.count ?? entry.value, 0) > 0 ? 1 : 0
          }
          return 0
        })
        setWeeklyActivity(normalizedWeek.length ? normalizedWeek : [1, 1, 1, 0, 1, 1, 0])

        // Extract score trend from response
        const trendData = trend?.scoreTrend || trend?.data || toList(trend, 'scoreTrend')
        setScoreTrend(normalizeTrend(trendData.length ? trendData : []))
      } catch (err) {
        console.error('Failed to fetch dashboard data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading || !currentUser) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Loading...</p>
        </div>
      </DashboardLayout>
    )
  }

  const displayName = currentUser?.name || currentUser?.username || 'User'
  const firstName = displayName.split(' ')[0]
  const streak = Number(currentUser?.streak || 0)
  const latestResultId = recentSessions[0]?.id

  return (
    <DashboardLayout>

      {/* ── Welcome header ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <p className="text-sm text-gray-400 font-medium mb-0.5">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
            Welcome back, {firstName} 👋
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            You're on a{' '}
            <span className="text-purple-700 font-semibold">{streak}-day streak</span>
            {' '}— keep it going!
          </p>
        </div>

        <PrimaryButton size="md" onClick={() => navigate('/interview')}>
          <Mic size={15} />
          Start Interview
        </PrimaryButton>
      </div>

      {/* ── Stat cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {dashStats.map((stat, i) => (
          <StatsCard key={stat.id || stat.label || i} stat={stat} />
        ))}
      </div>

      {/* ── Main grid: Quick Actions + Recent Sessions ─────────── */}
      <div className="grid lg:grid-cols-3 gap-6 mb-6">

        {/* Quick Actions — spans 1 col */}
        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wider">
            Quick Actions
          </h2>

          {/* AI Interview CTA */}
          <div className="bg-gray-900 rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full border-[20px] border-purple-600/20 pointer-events-none" />
            <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center mb-4">
              <Mic size={19} className="text-white" />
            </div>
            <h3 className="font-bold text-white text-base mb-1">AI Interview</h3>
            <p className="text-gray-400 text-xs leading-relaxed mb-4">
              Start a new mock interview session personalised to your profile.
            </p>
            <PrimaryButton size="sm" onClick={() => navigate('/interview')}>
              Start Now <ArrowRight size={14} />
            </PrimaryButton>
          </div>

          {/* MCQ Practice CTA */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-purple-200 hover:shadow-sm transition-all cursor-pointer" onClick={() => navigate('/objective')}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 bg-purple-50 rounded-xl flex items-center justify-center">
                <BookOpen size={17} className="text-purple-600" />
              </div>
              <ChevronRight size={16} className="text-gray-300" />
            </div>
            <p className="font-semibold text-gray-800 text-sm">MCQ Practice</p>
            <p className="text-xs text-gray-400 mt-0.5">Sharpen technical concepts</p>
          </div>

          {/* Resume Upload CTA */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-purple-200 hover:shadow-sm transition-all cursor-pointer" onClick={() => navigate('/setup')}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center">
                <Upload size={17} className="text-indigo-600" />
              </div>
              <ChevronRight size={16} className="text-gray-300" />
            </div>
            <p className="font-semibold text-gray-800 text-sm">Upload / Update Resume</p>
            <p className="text-xs text-gray-400 mt-0.5">Manage resume used for interview personalization</p>
          </div>

          {/* View Results */}
          <div className="bg-white border border-gray-100 rounded-2xl p-5 hover:border-purple-200 hover:shadow-sm transition-all cursor-pointer" onClick={() => openResult(latestResultId)}>
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center">
                <TrendingUp size={17} className="text-blue-600" />
              </div>
              <ChevronRight size={16} className="text-gray-300" />
            </div>
            <p className="font-semibold text-gray-800 text-sm">View Latest Result</p>
            <p className="text-xs text-gray-400 mt-0.5">Score: 82 · Apr 17</p>
          </div>
        </div>

        {/* Recent Sessions — spans 2 cols */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-800">Recent Sessions</h2>
              <button
                onClick={() => openResult(latestResultId)}
                className="text-xs text-purple-600 font-semibold hover:underline flex items-center gap-0.5"
              >
                View all <ChevronRight size={13} />
              </button>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {['Role', 'Date', 'Duration', 'Type', 'Score'].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentSessions.map((s, i) => (
                    <tr
                      key={s.id || `${s.role || 'session'}-${s.date || 'date'}-${i}`}
                      onClick={() => openResult(s.id)}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 bg-purple-50 rounded-lg flex items-center justify-center shrink-0">
                            <Mic size={13} className="text-purple-600" />
                          </div>
                          <span className="font-medium text-gray-800 text-xs">{s.role}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Calendar size={11} className="text-gray-300" />
                          {safeText(s.date, 'N/A')}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock size={11} className="text-gray-300" />
                          {safeText(s.duration, 'N/A')}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full border ${
                          s.type === 'AI Interview'
                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                            : 'bg-gray-100 text-gray-600 border-gray-200'
                        }`}>
                          {safeText(s.type, 'Session')}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`text-xs font-bold ${scoreColor(s.score)}`}>
                          {normalizeNumeric(s.score, 0)}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* ── Progress + Insights row ───────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-6">

        {/* Weekly activity */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-gray-800">Weekly Activity</h3>
            <span className="text-xs text-gray-400">This week</span>
          </div>
          <WeekBar days={weeklyActivity} />
          <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-purple-600 inline-block" />
              Practiced
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-gray-100 border border-gray-200 inline-block" />
              Skipped
            </span>
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              <span className="font-semibold text-gray-800">5 of 7 days</span> practiced this week.
              Great discipline! Aim for all 7 next week.
            </p>
          </div>
        </div>

        {/* Score trend */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-gray-800">Score Trend</h3>
            <span className="text-xs text-purple-600 font-semibold flex items-center gap-0.5">
              <TrendingUp size={12} /> +20% this month
            </span>
          </div>
          {/* Mini bar chart */}
          <div className="flex items-end gap-2 h-24">
            {scoreTrend.map((point, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[9px] text-gray-400">{point.score}</span>
                <div
                  className="w-full bg-purple-600 rounded-t-md transition-all duration-500 hover:bg-purple-700"
                  style={{ height: `${(point.score / 100) * 70}px` }}
                  title={`${point.label}: ${point.score}%`}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2">
            {scoreTrend.map((point, i) => (
              <span key={i} className="text-[9px] text-gray-400 flex-1 text-center">{point.label}</span>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              Your average improved from{' '}
              <span className="font-semibold text-gray-800">62 → 82</span>{' '}
              over your last 6 sessions.
            </p>
          </div>
        </div>

      </div>

      {/* ── Upgrade / tip banner ─────────────────────────────── */}
      <div className="mt-6 bg-purple-50 border border-purple-100 rounded-2xl px-6 py-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center shrink-0">
            <Zap size={19} className="text-purple-700 fill-purple-300" />
          </div>
          <div>
            <p className="font-semibold text-purple-900 text-sm">Ready for your next interview?</p>
            <p className="text-purple-700 text-xs mt-0.5">
              Your last session scored 82%. Push it to 90+ with one more practice today.
            </p>
          </div>
        </div>
        <PrimaryButton size="sm" onClick={() => navigate('/interview')}>
          Practice Now <ArrowRight size={14} />
        </PrimaryButton>
      </div>

    </DashboardLayout>
  )
}
