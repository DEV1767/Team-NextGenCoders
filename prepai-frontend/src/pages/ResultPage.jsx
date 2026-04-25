import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CheckCircle, AlertTriangle,
  XCircle, RotateCcw, ArrowRight,
  Download, BookOpen, Lightbulb, Briefcase,
} from 'lucide-react'
import DashboardLayout from '../layout/DashboardLayout'
import PrimaryButton from '../components/PrimaryButton'
import SecondaryButton from '../components/SecondaryButton'
import { exportResultPDF, getLatestResult, getRecommendations, getResultById, getRoadmapStatus, generateRoadmap } from '../api/results'

function ScoreGauge({ score, grade, verdict }) {
  const value = Number(score || 0)
  const r = 52
  const circ = 2 * Math.PI * r
  const dash = circ - (value / 100) * circ

  const color =
    value >= 85 ? '#16a34a'
    : value >= 70 ? '#9333ea'
    : value >= 55 ? '#ca8a04'
    : '#dc2626'

  const label =
    value >= 85 ? 'Excellent'
    : value >= 70 ? 'Good'
    : value >= 55 ? 'Average'
    : 'Needs Work'

  return (
    <div className="flex flex-col items-center select-none">
      <div className="relative">
        <svg width="140" height="140" className="-rotate-90">
          <circle cx="70" cy="70" r={r} strokeWidth="12" stroke="#f3f4f6" fill="none" />
          <circle
            cx="70"
            cy="70"
            r={r}
            strokeWidth="12"
            stroke={color}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={dash}
            style={{ transition: 'stroke-dashoffset 1.2s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-black" style={{ color }}>{value}</span>
          <span className="text-xs text-gray-400 font-medium mt-0.5">/ 100</span>
        </div>
      </div>
      <p className="font-bold text-lg text-gray-900 mt-2">{label}</p>
      <p className="text-xs text-gray-400">{grade || '-'} | {verdict || '-'}</p>
    </div>
  )
}

function FeedbackItem({ type, text }) {
  const config = {
    positive: {
      icon: CheckCircle,
      bg: 'bg-green-50 border-green-100',
      iconCl: 'text-green-500',
      textCl: 'text-green-900',
    },
    warning: {
      icon: AlertTriangle,
      bg: 'bg-yellow-50 border-yellow-100',
      iconCl: 'text-yellow-500',
      textCl: 'text-yellow-900',
    },
    negative: {
      icon: XCircle,
      bg: 'bg-red-50 border-red-100',
      iconCl: 'text-red-500',
      textCl: 'text-red-900',
    },
  }

  const { icon: Icon, bg, iconCl, textCl } = config[type] ?? config.warning

  return (
    <div className={`flex items-start gap-3.5 p-4 rounded-xl border ${bg}`}>
      <Icon size={16} className={`${iconCl} mt-0.5 shrink-0`} />
      <p className={`text-sm leading-relaxed ${textCl}`}>{text}</p>
    </div>
  )
}

function ScoreBar({ label, score }) {
  const value = Math.max(0, Math.min(100, Number(score) || 0))
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm font-medium text-gray-700">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
        <div className="h-full rounded-full bg-gradient-to-r from-purple-600 to-indigo-500 transition-all" style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

export default function ResultPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [result, setResult] = useState(null)
  const [roadmapDetails, setRoadmapDetails] = useState(null);
  const [roadmapStatus, setRoadmapStatus] = useState({ generated: false })
  const [roadmapGenerating, setRoadmapGenerating] = useState(false)
  const [roadmapStatusLoading, setRoadmapStatusLoading] = useState(false);
  const [recommendations, setRecommendations] = useState([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [noResultMessage, setNoResultMessage] = useState('')

  const requestedResultId = searchParams.get('resultId')

  const getFeedbackType = (text, score = 0) => {
    const normalized = String(text || '').toLowerCase()

    const positiveKeywords = [
      'excellent', 'great', 'good', 'well', 'strong', 'impressive', 'solid', 'clear', 'confident', 'accurate'
    ]
    const warningKeywords = ['improve', 'work on', 'can be better', 'needs more', 'consider', 'practice']
    const negativeKeywords = ['poor', 'incorrect', 'weak', 'lacking', 'insufficient', 'wrong', 'bad', 'failed']

    if (positiveKeywords.some((keyword) => normalized.includes(keyword))) return 'positive'
    if (negativeKeywords.some((keyword) => normalized.includes(keyword))) return 'negative'
    if (warningKeywords.some((keyword) => normalized.includes(keyword))) return 'warning'

    return Number(score || 0) >= 70 ? 'positive' : 'warning'
  }

  const fetchRoadmapStatus = async (resultId) => {
    if (!resultId) return
    setRoadmapStatusLoading(true)
    try {
      const status = await getRoadmapStatus(resultId)
      setRoadmapStatus({ generated: status?.generated ?? false, ...status })
      if (status?.roadmapDetails) {
        setRoadmapDetails(status.roadmapDetails)
      }
    } catch (err) {
      console.error('Failed to load roadmap status:', err)
    } finally {
      setRoadmapStatusLoading(false)
    }
  }

  const handleGenerateRoadmap = async () => {
    const resultId = result?.resultId || result?.id || result?._id || requestedResultId
    if (!resultId) return

    setRoadmapGenerating(true)
    try {
      const data = await generateRoadmap(resultId)
      setRoadmapStatus({ generated: true, ...data })
      setRoadmapDetails(data?.roadmapDetails || data?.roadmap || roadmapDetails)
    } catch (err) {
      console.error('Failed to generate roadmap:', err)
    } finally {
      setRoadmapGenerating(false)
    }
  }

  // Normalize backend result to frontend structure
  const normalizeResult = (data) => {
    if (!data) return null

    const rawTitle = String(data.type || data.sessionType || data.mode || data.topic || data.role || data.targetRole || '').toLowerCase()
    const isAptitudeSession = /aptitude|coding aptitude|aptitude practice|objective/i.test(rawTitle)
    const isMcqSession = /mcq|multiple choice|mcq practice/i.test(rawTitle)

    const hasMcq = data.mcqScore != null || data.mcq_score != null || data.mcq != null
    const hasAptitude = data.aptitudeScore != null || data.aptitude_score != null || data.aptitude != null
    const hasResume = data.resumeScore != null || data.resume_score != null || data.resume != null

    let mcqScore = Number(data.mcqScore ?? data.mcq_score ?? data.mcq ?? 0)
    let aptitudeScore = Number(data.aptitudeScore ?? data.aptitude_score ?? data.aptitude ?? 0)
    const resumeScore = Number(data.resumeScore ?? data.resume_score ?? data.resume ?? 0)

    // Remap ambiguous objective score fields by session type.
    if (isAptitudeSession && !hasAptitude && hasMcq) {
      aptitudeScore = mcqScore
      mcqScore = 0
    }
    if (isMcqSession && !hasMcq && hasAptitude) {
      mcqScore = aptitudeScore
      aptitudeScore = 0
    }

    const sections = []
    if (isMcqSession) {
      if (mcqScore > 0 || hasMcq) sections.push({ name: 'MCQ', score: mcqScore })
    }
    if (isAptitudeSession) {
      if (aptitudeScore > 0 || hasAptitude || hasMcq) sections.push({ name: 'Aptitude', score: aptitudeScore })
    }
    if (!isMcqSession && !isAptitudeSession) {
      if (mcqScore > 0 || hasMcq) sections.push({ name: 'MCQ', score: mcqScore })
      if (aptitudeScore > 0 || hasAptitude) sections.push({ name: 'Aptitude', score: aptitudeScore })
    }
    if (hasResume) sections.push({ name: 'Resume', score: resumeScore })

    const sectionCount = sections.length
    const totalSectionScore = sections.reduce((sum, section) => sum + section.score, 0)
    const averageSectionScore = sectionCount ? Math.round(totalSectionScore / sectionCount) : 0
    const score = Number(data.overallScore ?? data.score ?? averageSectionScore ?? 0)
    const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : 'D'
    const verdict = score >= 85 ? 'Excellent performance' : score >= 70 ? 'Good performance' : score >= 55 ? 'Average performance' : 'Needs improvement'

    const completedDate = data.displayDate || data.completedAt || data.createdAt
    const dateObj = completedDate ? new Date(completedDate) : new Date()
    const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

    const startedAt = data.startedAt ? new Date(data.startedAt) : null
    const completedAt = data.completedAt ? new Date(data.completedAt) : null
    const derivedDurationMinutes = startedAt && completedAt
      ? Math.max(0, Math.round((completedAt.getTime() - startedAt.getTime()) / 60000))
      : 0
    const durationMinutes = Number(data.durationMinutes ?? derivedDurationMinutes ?? 0)
    const formattedDuration = durationMinutes ? `${Math.round(durationMinutes)} min` : '-'
    const totalQuestions = Number.isInteger(data.questionsCount) ? data.questionsCount : null
    const answeredQuestions = Number.isInteger(data.questionsAnswered)
      ? data.questionsAnswered
      : totalQuestions

    // Parse feedback into items
    const aiFeedback = []
    if (data.feedback && typeof data.feedback === 'string') {
      // Split by new lines and bullet points while avoiding mid-sentence hyphen splits.
      const items = data.feedback.split(/\n+|•/).filter(i => i.trim())
      items.forEach(item => {
        const text = item.trim()
        if (text.length > 0) {
          const type = getFeedbackType(text, score)
          aiFeedback.push({ type, text })
        }
      })
    }

    if (!aiFeedback.length) {
      aiFeedback.push({
        type: score >= 70 ? 'positive' : 'warning',
        text: data.feedback || 'Session completed. Keep practicing role-specific questions and improve answer structure for stronger performance.',
      })
    }

    // Derive strengths and improvements only from sections that were actually shown.
    const computedSections = sections
    const strengths = computedSections.filter(s => s.score >= 75).map(s => s.name)
    const improvements = computedSections.filter(s => s.score < 75).map(s => s.name)

    if (!strengths.length) {
      strengths.push(score >= 70 ? 'Consistent interview performance' : 'Completed full interview flow')
    }

    if (!improvements.length) {
      improvements.push(score >= 85 ? 'Keep this consistency' : 'Deepen role-specific fundamentals')
    }

    return {
      ...data,
      role: data.role || data.targetRole || '-',
      date: formattedDate,
      duration: formattedDuration,
      questionsAnswered: answeredQuestions,
      questionsCount: totalQuestions,
      grade,
      verdict,
      mcqScore,
      aptitudeScore,
      resumeScore,
      totalSectionScore,
      averageSectionScore,
      overallScore: score,
      score,
      sections,
      aiFeedback,
      strengths,
      improvements,
    }
  }

  useEffect(() => {
    let active = true

    const fetchResult = async () => {
      try {
        const response = requestedResultId
          ? await getResultById(requestedResultId)
          : await getLatestResult()

        if (!active) return

        // Extract result from response (backend wraps it in { success, result: {...} })
        const resultData = response?.result || response
        const normalized = normalizeResult(resultData)
        setResult(normalized)
        setRoadmapDetails(normalized?.roadmapDetails || null)
        setNoResultMessage('')

        const resultId = resultData?.resultId || resultData?.id || resultData?._id || requestedResultId
        if (!resultId) return

        fetchRoadmapStatus(resultId)

        const recommendationResponse = await getRecommendations(resultId)
        if (!active) return

        const list = Array.isArray(recommendationResponse)
          ? recommendationResponse
          : Array.isArray(recommendationResponse?.recommendations)
          ? recommendationResponse.recommendations
          : []

        setRecommendations(list)
      } catch (err) {
        if (!active) return
        const msg = String(err?.message || '').toLowerCase()
        if (msg.includes('no completed result found') || msg.includes('404')) {
          setNoResultMessage('No completed interview result found yet. Start an interview to see your report.')
          setResult(null)
          setRecommendations([])
        }
        console.error('Failed to fetch result:', err)
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchResult()

    return () => {
      active = false
    }
  }, [requestedResultId])

  const recommendationItems = useMemo(() => {
    if (recommendations.length) return recommendations
    if (!result) return []
    if (Array.isArray(result.recommendations) && result.recommendations.length) return result.recommendations
    return [
      'Practice one timed mock interview daily and review your answers.',
      'Use STAR format to structure behavioral responses clearly.',
      'Revise role-specific concepts and explain trade-offs out loud.',
      'Reattempt weak topics through MCQ practice and track improvements.',
    ]
  }, [recommendations, result])

  const jobItems = useMemo(() => {
    if (!Array.isArray(result?.jobRecommendations)) return []
    return result.jobRecommendations
      .filter((item) => item?.title && item?.applyUrl)
      .slice(0, 5)
  }, [result])

  const exportId = result?.resultId || result?.id || result?._id || requestedResultId

  const handleExport = async () => {
    if (!exportId) return

    setExporting(true)
    try {
      const blob = await exportResultPDF(exportId)
      const blobUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = blobUrl
      anchor.download = `prepai-result-${exportId}.pdf`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(blobUrl)
    } catch (err) {
      console.error('Failed to export result:', err)
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Loading result...</p>
        </div>
      </DashboardLayout>
    )
  }

  if (!result) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto bg-white border border-gray-100 rounded-2xl p-8 text-center">
          <h1 className="text-xl font-bold text-gray-900">Interview Report</h1>
          <p className="text-sm text-gray-500 mt-2">{noResultMessage || 'No result available right now.'}</p>
          <div className="mt-6 flex justify-center gap-3">
            <SecondaryButton variant="outline" size="md" onClick={() => navigate('/dashboard')}>
              Dashboard
            </SecondaryButton>
            <PrimaryButton size="md" onClick={() => navigate('/interview')}>
              Start Interview <ArrowRight size={14} />
            </PrimaryButton>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  const r = result
  const hasRoadmap = Boolean(roadmapDetails?.nodes?.length || roadmapDetails?.resources?.length)

  return (
    <DashboardLayout>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Interview Report</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {r.role || '-'} | {r.date || '-'} | {r.duration || '-'} | {r.questionsAnswered ?? '-'} questions answered
          </p>
        </div>
        <div className="flex gap-2.5">
          <SecondaryButton variant="outline" size="sm" onClick={() => navigate('/interview')}>
            <RotateCcw size={13} />
            Retry
          </SecondaryButton>
          <SecondaryButton variant="ghost" size="sm" onClick={handleExport} disabled={!exportId || exporting}>
            <Download size={13} />
            {exporting ? 'Exporting...' : 'Export PDF'}
          </SecondaryButton>
          <PrimaryButton size="sm" onClick={() => navigate('/dashboard')}>
            Dashboard <ArrowRight size={14} />
          </PrimaryButton>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="space-y-5">
          <div className="bg-white border border-gray-100 rounded-2xl p-7 flex flex-col items-center shadow-sm">
            <ScoreGauge score={r.overallScore} grade={r.grade} verdict={r.verdict} />

            <div className="w-full mt-6 pt-5 border-t border-gray-50 space-y-4">
              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">Strengths</p>
                <div className="flex flex-wrap gap-1.5">
                  {(r.strengths || []).map((item) => (
                    <span key={item} className="text-[11px] font-medium bg-purple-50 text-purple-700 border border-purple-100 px-2.5 py-1 rounded-full">
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-2.5">Improve</p>
                <div className="flex flex-wrap gap-1.5">
                  {(r.improvements || []).map((item) => (
                    <span key={item} className="text-[11px] font-medium bg-orange-50 text-orange-700 border border-orange-100 px-2.5 py-1 rounded-full">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest mb-4">Session Details</p>
            <div className="space-y-3">
              {[
                { label: 'Role', value: r.role },
                { label: 'Date', value: r.date },
                { label: 'Duration', value: r.duration },
                { label: 'Questions', value: `${r.questionsAnswered ?? r.questionsCount ?? '-'} answered` },
                { label: 'Grade', value: r.grade },
                { label: 'Verdict', value: r.verdict },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">{label}</span>
                  <span className="font-semibold text-gray-800">{value || '-'}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-100 rounded-2xl p-7 shadow-sm">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Section Scores</h3>
                <p className="text-xs text-gray-400">MCQ, Aptitude, and Resume performance breakdown.</p>
              </div>
              <div className="text-right">
                <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Total / Average</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{r.totalSectionScore}</p>
                <p className="text-sm text-gray-500">{r.averageSectionScore}% average</p>
              </div>
            </div>
            <div className="space-y-4">
              {(r.sections || []).map((section) => (
                <ScoreBar key={section.name} label={section.name} score={section.score} />
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-7 shadow-sm">
            <h3 className="font-bold text-gray-900 text-base mb-1">AI Feedback</h3>
            <p className="text-xs text-gray-400 mb-5">Detailed analysis of your interview performance</p>
            <div className="space-y-3.5">
              {(r.aiFeedback || []).map((item, index) => (
                <FeedbackItem key={index} type={item?.type} text={item?.text || ''} />
              ))}
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-7 shadow-sm">
            <h3 className="font-bold text-gray-900 text-base mb-1 flex items-center gap-2">
              <Lightbulb size={17} className="text-purple-600" />
              Recommended Next Steps
            </h3>
            <p className="text-xs text-gray-400 mb-5">Action items to improve your score for next time</p>
            <ol className="space-y-3.5">
              {recommendationItems.map((item, index) => (
                <li key={index} className="flex items-start gap-3.5">
                  <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {index + 1}
                  </span>
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {typeof item === 'string' ? item : item?.text || item?.title || 'Recommendation'}
                  </p>
                </li>
              ))}
            </ol>
          </div>

          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                <BookOpen size={19} className="text-purple-700" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Reinforce weak areas with MCQ practice</p>
                <p className="text-xs text-gray-500 mt-0.5">Use topic mode to improve targeted concepts.</p>
              </div>
            </div>
            <PrimaryButton size="sm" onClick={() => navigate('/objective')}>
              Go to MCQ <ArrowRight size={14} />
            </PrimaryButton>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Keep momentum with daily practice</h3>
                <p className="text-xs text-gray-400 mt-1">Jump into flashcards, challenges, or compare your progress globally.</p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <PrimaryButton size="sm" onClick={() => navigate('/challenge')}>
                Daily Challenge
              </PrimaryButton>
              <SecondaryButton size="sm" onClick={() => navigate('/flashcards')}>
                Review Flashcards
              </SecondaryButton>
              <SecondaryButton size="sm" onClick={() => navigate('/leaderboard')}>
                View Leaderboard
              </SecondaryButton>
            </div>
          </div>

          {!!jobItems.length && (
            <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm space-y-4">
              <div>
                <h3 className="font-bold text-gray-900 text-base flex items-center gap-2">
                  <Briefcase size={17} className="text-purple-600" />
                  Relevant Jobs For {r.role || 'Your Role'}
                </h3>
                <p className="text-xs text-gray-400 mt-1">Fetched after interview completion based on your target position.</p>
              </div>

              <div className="grid gap-3">
                {jobItems.map((job, index) => (
                  <div key={`${job.title}-${index}`} className="border border-gray-100 rounded-xl p-4 bg-gray-50/70">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{job.title}</p>
                        <p className="text-xs text-gray-500 mt-1">{job.employerName || 'Company'} | {job.location || 'Location not specified'}</p>
                        {job.employmentType ? (
                          <p className="text-xs text-gray-500 mt-1">Type: {job.employmentType}</p>
                        ) : null}
                      </div>
                      <a
                        href={job.applyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold bg-purple-600 text-white px-3 py-2 rounded-lg hover:bg-purple-700 transition-colors"
                      >
                        Apply Now
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white border border-emerald-100 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Learning Roadmap</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Generate a persistent roadmap for this interview result, or review the saved roadmap if one already exists.
                </p>
              </div>
              <PrimaryButton
                size="sm"
                onClick={handleGenerateRoadmap}
                disabled={roadmapStatusLoading || roadmapGenerating || roadmapStatus?.generated}
              >
                {roadmapGenerating
                  ? 'Generating...'
                  : roadmapStatus?.generated
                  ? 'Roadmap Generated'
                  : 'Generate Roadmap'}
              </PrimaryButton>
            </div>
            <div className={`rounded-2xl border p-6 text-sm ${hasRoadmap ? 'border-purple-100 bg-purple-50 text-purple-900' : 'border-gray-100 bg-gray-50 text-gray-500'}`}>
              {hasRoadmap
                ? 'A persisted roadmap has been generated for this session. Scroll down to review the saved roadmap details.'
                : roadmapStatus?.generated
                ? 'Roadmap generation completed for this session. Refresh the page if the saved details do not appear yet.'
                : 'No persisted roadmap exists yet. Click the button above to generate and save one for this session.'}
            </div>
          </div>

          <div className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Roadmap Details</h3>
                <p className="text-xs text-gray-400 mt-1">
                  Review the saved roadmap steps and resources generated for this session.
                </p>
              </div>
              {roadmapDetails?.generatedBy && (
                <span className="inline-flex rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                  {roadmapDetails.generatedBy === 'cache' ? 'Cached copy' : 'Live generated'}
                </span>
              )}
            </div>

            {hasRoadmap ? (
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {Array.isArray(roadmapDetails.nodes) && roadmapDetails.nodes.map((node) => (
                  <div key={node.nodeId} className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-semibold text-gray-900">{node.title}</p>
                        <p className="text-sm text-gray-500 mt-1">{node.phase ? `${node.phase} • ${node.level || 'level'}` : node.level || 'Roadmap step'}</p>
                      </div>
                      {node.durationWeeks ? (
                        <span className="rounded-full bg-violet-50 px-3 py-1 text-[11px] font-semibold text-violet-700">
                          {node.durationWeeks} week{node.durationWeeks > 1 ? 's' : ''}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm text-gray-600 mt-4 leading-relaxed">{node.summary || node.description || 'Follow this step to progress through the roadmap.'}</p>
                    {node.resources && Array.isArray(node.resources) && node.resources.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Resources</p>
                        <div className="flex flex-wrap gap-2">
                          {node.resources.slice(0, 3).map((resource, idx) => (
                            <span key={`${resource.key || resource.title}-${idx}`} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-700">
                              {resource.title || resource.key || 'Resource'}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 p-8 text-center text-sm text-gray-500">
                {roadmapStatusLoading ? 'Checking roadmap status…' : 'No roadmap details are available yet. Generate a roadmap above to view the card-based roadmap details.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
