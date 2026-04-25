import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CheckCircle,
  ChevronRight,
  Loader2,
  Mic,
  RotateCcw,
  Sparkles,
  Trophy,
  XCircle,
} from 'lucide-react'
import DashboardLayout from '../layout/DashboardLayout'
import PrimaryButton from '../components/PrimaryButton'
import SecondaryButton from '../components/SecondaryButton'
import { getCurrentUser } from '../api/user'
import {
  completeMCQPracticeSession,
  startMCQPracticeSession,
  submitMCQPracticeAnswer,
} from '../api/mcq'
import { getSession } from '../api/interview'
import { hasUploadedResume } from '../utils/userState'

const PRACTICE_CONFIG = {
  mcq: {
    title: 'MCQ Practice',
    loadingLabel: 'Preparing MCQ session...',
    emptyStateDescription: 'Generate an AI-backed MCQ session from your backend when you are ready.',
    roleOptions: ['Frontend Developer', 'Backend Developer', 'Full Stack Developer', 'Software Engineer', 'DevOps Engineer'],
    topicOptions: ['JavaScript', 'React', 'Node.js', 'CSS', 'Data Structures', 'Databases'],
    defaultRole: 'Frontend Developer',
    defaultTopic: 'JavaScript',
    requiresResume: true,
  },
  aptitude: {
    title: 'Coding Aptitude',
    loadingLabel: 'Preparing coding aptitude session...',
    emptyStateDescription: 'Generate AI coding aptitude questions focused on programming logic and core CS fundamentals.',
    roleOptions: ['Coding Aptitude'],
    topicOptions: ['Programming Logic', 'OOPs', 'DBMS', 'Operating Systems', 'Computer Networks', 'Mixed Coding Aptitude'],
    defaultRole: 'Coding Aptitude',
    defaultTopic: 'Programming Logic',
    requiresResume: false,
  },
}

function safeText(value, fallback = '') {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'string' || typeof value === 'number') return String(value)
  if (typeof value === 'object') {
    const candidate = value.text || value.label || value.value || value.title || fallback
    return typeof candidate === 'string' || typeof candidate === 'number' ? String(candidate) : fallback
  }
  return fallback
}

function toQuestionList(response) {
  if (Array.isArray(response)) return response
  if (!response || typeof response !== 'object') return []
  if (Array.isArray(response.questions)) return response.questions

  const firstArray = Object.values(response).find(Array.isArray)
  return firstArray || []
}

function normalizeOptions(question) {
  const rawOptions =
    question?.options ||
    question?.choices ||
    question?.answers ||
    question?.answerOptions ||
    []

  const optionFields = [question?.optionA, question?.optionB, question?.optionC, question?.optionD]
    .map((option) => safeText(option, ''))
    .filter(Boolean)

  if (Array.isArray(rawOptions)) {
    const list = rawOptions.map((option) => safeText(option, '')).filter(Boolean)
    if (list.length) return list
  }

  if (rawOptions && typeof rawOptions === 'object') {
    const sorted = ['A', 'B', 'C', 'D']
      .map((key) => safeText(rawOptions[key] ?? rawOptions[key.toLowerCase()], ''))
      .filter(Boolean)

    if (sorted.length) return sorted

    const values = Object.values(rawOptions).map((option) => safeText(option, '')).filter(Boolean)
    if (values.length) return values
  }

  return optionFields
}

function readCorrectIndex(question, options) {
  const indexCandidates = [
    question?.correct,
    question?.correctIndex,
    question?.correctOptionIndex,
    question?.answerIndex,
    question?.correct_answer_index,
  ]

  for (const candidate of indexCandidates) {
    const parsed = Number(candidate)
    if (Number.isInteger(parsed) && parsed >= 0 && parsed < options.length) {
      return parsed
    }
  }

  const answerText = safeText(
    question?.correctAnswer || question?.correctOption || question?.answer || question?.correct_answer,
    '',
  ).trim()

  const answerLetter = answerText.toUpperCase()
  if (/^[A-Z]$/.test(answerLetter)) {
    const letterIndex = answerLetter.charCodeAt(0) - 65
    if (letterIndex >= 0 && letterIndex < options.length) return letterIndex
  }

  if (answerText) {
    const textMatch = options.findIndex((option) => option.trim().toLowerCase() === answerText.toLowerCase())
    if (textMatch >= 0) return textMatch
  }

  return -1
}

function normalizeQuestion(question, index, fallbackTopic = 'General') {
  if (!question || typeof question !== 'object') return null

  const options = normalizeOptions(question)
  const questionText = safeText(
    question.question || question.questionText || question.prompt || question.text,
    '',
  )

  if (!questionText || options.length < 2) return null

  const questionNumberRaw = Number(
    question.questionNumber ?? question.index ?? question.position ?? index + 1,
  )

  return {
    id: question.id || question._id || question.questionId || `${index + 1}`,
    questionNumber: Number.isInteger(questionNumberRaw) && questionNumberRaw > 0 ? questionNumberRaw : index + 1,
    topic: safeText(question.topic || question.category || question.subject || fallbackTopic, 'General'),
    question: questionText,
    options,
    correct: readCorrectIndex(question, options),
    explanation: safeText(
      question.explanation || question.reason || question.solution,
      'Review this concept and try similar questions for better accuracy.',
    ),
  }
}

function readSessionId(response) {
  return (
    response?.sessionId ||
    response?.session?.id ||
    response?.session?._id ||
    response?.id ||
    ''
  )
}

function readSessionIdFromRedirect(redirectTo = '') {
  const text = safeText(redirectTo, '').trim()
  if (!text) return ''
  const parts = text.split('/').filter(Boolean)
  return parts.length ? parts[parts.length - 1] : ''
}

function readAnswerEvaluation(response, question, selectedOptionIndex) {
  const scoreValue = Number(response?.score ?? response?.questionScore ?? response?.points ?? 0)

  const indexCandidates = [
    response?.correctOptionIndex,
    response?.correct_answer_index,
    response?.correctIndex,
    response?.answerIndex,
    question?.correct,
  ]

  let correctOptionIndex = -1
  for (const candidate of indexCandidates) {
    const parsed = Number(candidate)
    if (Number.isInteger(parsed) && parsed >= 0 && parsed < question.options.length) {
      correctOptionIndex = parsed
      break
    }
  }

  const correctAnswerText = safeText(
    response?.correctAnswer || response?.correctOption || response?.answer || response?.correct_answer,
    '',
  )

  let isCorrect = false
  if (typeof response?.isCorrect === 'boolean') {
    isCorrect = response.isCorrect
  } else if (typeof response?.correct === 'boolean') {
    isCorrect = response.correct
  } else if (correctOptionIndex >= 0) {
    isCorrect = selectedOptionIndex === correctOptionIndex
  } else if (correctAnswerText) {
    isCorrect = question.options[selectedOptionIndex]?.trim().toLowerCase() === correctAnswerText.trim().toLowerCase()
  } else {
    isCorrect = scoreValue > 0
  }

  const resolvedCorrectAnswer =
    correctOptionIndex >= 0
      ? question.options[correctOptionIndex]
      : correctAnswerText || question.options[question.correct] || 'N/A'

  return {
    isCorrect,
    scoreValue,
    correctOptionIndex,
    correctAnswer: resolvedCorrectAnswer,
    feedback: safeText(response?.feedback || response?.explanation, question.explanation),
  }
}

function OptionButton({ index, text, state, onClick, disabled }) {
  const letter = String.fromCharCode(65 + index)

  const styles = {
    default: 'option-default hover:border-purple-400 hover:bg-purple-50 cursor-pointer',
    selected: 'option-selected cursor-pointer',
    correct: 'option-correct cursor-default',
    wrong: 'option-wrong cursor-default',
    muted: 'option-muted cursor-not-allowed',
  }

  const letterStyles = {
    default: 'border-gray-300 text-gray-500 bg-white',
    selected: 'border-purple-500 text-purple-700 bg-purple-100',
    correct: 'border-green-500 text-green-700 bg-green-100',
    wrong: 'border-red-400 text-red-600 bg-red-100',
    muted: 'border-gray-200 text-gray-300 bg-gray-50',
  }

  return (
    <button
      onClick={() => (state === 'default' || state === 'selected') && onClick(index)}
      className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl border-2 text-sm font-medium transition-all duration-150 text-left ${styles[state]}`}
      disabled={disabled || state === 'muted' || state === 'correct' || state === 'wrong'}
    >
      <span className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold shrink-0 transition-all ${letterStyles[state]}`}>
        {letter}
      </span>
      <span className="flex-1 leading-relaxed">{text}</span>
      {state === 'correct' && <CheckCircle size={17} className="text-green-500 shrink-0" />}
      {state === 'wrong' && <XCircle size={17} className="text-red-400 shrink-0" />}
    </button>
  )
}

function ResultsScreen({ score, total, answers, result, onRetry, onInterview }) {
  const pct = Number(result?.overallScore ?? Math.round((score / Math.max(total, 1)) * 100))

  const verdict =
    pct >= 85
      ? { label: 'Outstanding! 🏆', color: 'text-green-700', bg: 'bg-green-50', ring: 'ring-green-400' }
      : pct >= 70
        ? { label: 'Well Done! 👍', color: 'text-blue-700', bg: 'bg-blue-50', ring: 'ring-blue-400' }
        : pct >= 50
          ? { label: 'Keep Going! 💪', color: 'text-yellow-700', bg: 'bg-yellow-50', ring: 'ring-yellow-400' }
          : { label: 'Keep Practising', color: 'text-red-700', bg: 'bg-red-50', ring: 'ring-red-400' }

  return (
    <div className="max-w-lg mx-auto py-10 text-center page-enter">
      <div className={`w-32 h-32 rounded-full ring-4 ${verdict.ring} ${verdict.bg} flex flex-col items-center justify-center mx-auto mb-6 shadow-lg`}>
        <Trophy size={28} className={verdict.color} />
        <span className={`text-3xl font-black mt-1 ${verdict.color}`}>{pct}%</span>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 mb-1">{verdict.label}</h2>
      <p className="text-gray-500 text-sm mb-2">
        You scored <strong className="text-gray-800">{score} out of {total}</strong> questions correctly.
      </p>
      {result?.feedback && <p className="text-xs text-gray-500 mb-8">{result.feedback}</p>}

      <div className="space-y-2.5 text-left mb-8">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Question Review</p>
        {answers.filter(Boolean).map((answer, index) => (
          <div
            key={`${answer.question}-${index}`}
            className={`flex items-start gap-3 p-4 rounded-xl text-sm ${
              answer.correct ? 'bg-green-50 border border-green-100' : 'bg-red-50 border border-red-100'
            }`}
          >
            {answer.correct ? (
              <CheckCircle size={15} className="text-green-600 mt-0.5 shrink-0" />
            ) : (
              <XCircle size={15} className="text-red-500 mt-0.5 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className={`font-medium text-xs leading-relaxed ${answer.correct ? 'text-green-800' : 'text-red-800'}`}>
                Q{index + 1}: {answer.question}
              </p>
              {!answer.correct && (
                <p className="text-[11px] text-red-600 mt-1">Correct: <strong>{answer.correctAnswer}</strong></p>
              )}
              {answer.feedback && <p className="text-[11px] text-gray-600 mt-1">{answer.feedback}</p>}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <SecondaryButton variant="outline" size="md" onClick={onRetry}>
          <RotateCcw size={14} />
          Retry Quiz
        </SecondaryButton>
        <PrimaryButton size="md" onClick={onInterview}>
          <Mic size={14} />
          Start AI Interview
        </PrimaryButton>
      </div>
    </div>
  )
}

export default function ObjectivePage({ initialPracticeType = 'mcq' }) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const practiceType = initialPracticeType === 'aptitude' ? 'aptitude' : 'mcq'
  const currentPractice = PRACTICE_CONFIG[practiceType]

  const [user, setUser] = useState(null)
  const [checkingPrereq, setCheckingPrereq] = useState(true)
  const [sessionId, setSessionId] = useState('')
  const [mcqQuestions, setMcqQuestions] = useState([])
  const [currentIdx, setCurrent] = useState(0)
  const [selected, setSelected] = useState(null)
  const [answered, setAnswered] = useState(false)
  const [score, setScore] = useState(0)
  const [answers, setAnswers] = useState([])
  const [finished, setFinished] = useState(false)
  const [completionResult, setCompletionResult] = useState(null)

  const [loading, setLoading] = useState(false)
  const [fetchingSet, setFetchingSet] = useState(false)
  const [answering, setAnswering] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [generationStepIndex, setGenerationStepIndex] = useState(0)

  const generationSteps = [
    'Preparing session',
    'Generating questions',
    'Saving to database',
    'Starting session',
  ]

  const [generatorConfig, setGeneratorConfig] = useState({
    role: currentPractice.defaultRole,
    topic: currentPractice.defaultTopic,
    difficulty: 'easy',
    questionCount: 5,
  })

  useEffect(() => {
    setGeneratorConfig((previous) => ({
      ...previous,
      role: currentPractice.defaultRole,
      topic: currentPractice.defaultTopic,
    }))
  }, [currentPractice.defaultRole, currentPractice.defaultTopic])

  useEffect(() => {
    if (!fetchingSet) {
      setGenerationStepIndex(0)
      return undefined
    }

    const timer = window.setInterval(() => {
      setGenerationStepIndex((previous) => (previous + 1) % generationSteps.length)
    }, 800)

    return () => window.clearInterval(timer)
  }, [fetchingSet])

  useEffect(() => {
    const requestedSessionId = searchParams.get('sessionId')
    if (!requestedSessionId || requestedSessionId === sessionId) return

    let active = true
    setFetchingSet(true)
    setFetchError('')

    const hydrateSession = async () => {
      try {
        const response = await getSession(requestedSessionId)
        if (!active) return

        const sessionPayload = response?.session || response
        const fallbackTopic = safeText(sessionPayload?.targetRole || generatorConfig.role, 'General')
        const normalized = toQuestionList(sessionPayload)
          .map((question, index) => normalizeQuestion(question, index, fallbackTopic))
          .filter(Boolean)

        if (!normalized.length) {
          throw new Error('No MCQ questions found for this session.')
        }

        setSessionId(requestedSessionId)
        setMcqQuestions(normalized)
        setCurrent(0)
        setSelected(null)
        setAnswered(false)
        setScore(0)
        setAnswers([])
        setFinished(false)
        setCompletionResult(null)
      } catch (error) {
        if (!active) return
        setSessionId('')
        setMcqQuestions([])
        setFetchError(error?.message || 'Failed to load MCQ session. Please generate again.')
        setSearchParams({}, { replace: true })
      } finally {
        if (active) setFetchingSet(false)
      }
    }

    hydrateSession()

    return () => {
      active = false
    }
  }, [generatorConfig.role, searchParams, sessionId, setSearchParams])

  useEffect(() => {
    let active = true

    const bootstrapUser = async () => {
      try {
        const currentUser = await getCurrentUser()
        if (active) setUser(currentUser)
      } catch {
        if (active) setUser(null)
      } finally {
        if (active) setCheckingPrereq(false)
      }
    }

    bootstrapUser()

    return () => {
      active = false
    }
  }, [])

  const startSession = async ({ keepLoader = true } = {}) => {
    if (keepLoader) {
      setLoading(true)
    } else {
      setFetchingSet(true)
    }

    setFetchError('')
    try {
      const response = await startMCQPracticeSession({
        role: generatorConfig.role,
        topic: generatorConfig.topic,
        questionCount: generatorConfig.questionCount,
        difficulty: generatorConfig.difficulty,
      })

      const session = readSessionId(response) || readSessionIdFromRedirect(response?.redirectTo)
      const fallbackTopic = safeText(response?.topic || generatorConfig.role, 'General')
      const normalized = toQuestionList(response)
        .map((question, index) => normalizeQuestion(question, index, fallbackTopic))
        .filter(Boolean)

      if (!session) {
        throw new Error('Session was not created. Please try again.')
      }

      if (!normalized.length) {
        throw new Error('No MCQ questions were generated. Please try again.')
      }

      setSessionId(session)
      setMcqQuestions(normalized)
      setCurrent(0)
      setSelected(null)
      setAnswered(false)
      setScore(0)
      setAnswers([])
      setFinished(false)
      setCompletionResult(null)
      setSearchParams({ sessionId: session }, { replace: true })
    } catch (error) {
      setSessionId('')
      setMcqQuestions([])
      setFetchError(error?.message || 'Failed to start MCQ session. Please try again.')
      setSearchParams({}, { replace: true })
    } finally {
      if (keepLoader) {
        setLoading(false)
      } else {
        setFetchingSet(false)
      }
    }
  }

  const applyGeneratorConfig = (patch) => {
    setGeneratorConfig((prev) => ({ ...prev, ...patch }))
  }

  const handleGenerateNewSet = () => {
    if (answering || completing) return
    startSession({ keepLoader: false })
  }

  const total = mcqQuestions.length
  const question = mcqQuestions[currentIdx]
  const currentAnswer = answers[currentIdx] || null
  const isResumeRequired = currentPractice.requiresResume
  const hasRequiredResume = hasUploadedResume(user)
  const canStartPractice = !isResumeRequired || hasRequiredResume

  const optionState = (index) => {
    if (!answered) return selected === index ? 'selected' : 'default'

    const hasKnownCorrect = Number.isInteger(currentAnswer?.correctOptionIndex) && currentAnswer.correctOptionIndex >= 0
    if (!hasKnownCorrect) return selected === index ? 'selected' : 'muted'
    if (index === currentAnswer.correctOptionIndex) return 'correct'
    if (index === selected && index !== currentAnswer.correctOptionIndex) return 'wrong'
    return 'muted'
  }

  const handleSelect = async (selectedIndex) => {
    if (!question || !sessionId || answered || answering) return

    setSelected(selectedIndex)
    setAnswering(true)

    try {
      const response = await submitMCQPracticeAnswer({
        sessionId,
        questionNumber: question.questionNumber,
        selectedOptionIndex: selectedIndex,
      })

      const evaluation = readAnswerEvaluation(response, question, selectedIndex)

      if (evaluation.isCorrect) {
        setScore((previous) => previous + 1)
      }

      setAnswers((previous) => {
        const next = [...previous]
        next[currentIdx] = {
          question: question.question,
          options: question.options,
          selectedOptionIndex: selectedIndex,
          correctOptionIndex: evaluation.correctOptionIndex,
          correctAnswer: evaluation.correctAnswer,
          correct: evaluation.isCorrect,
          feedback: evaluation.feedback,
        }
        return next
      })

      setAnswered(true)
    } catch (error) {
      setFetchError(error?.message || 'Failed to submit answer. Please try again.')
    } finally {
      setAnswering(false)
    }
  }

  const handleNext = async () => {
    if (!answered || answering || completing) return

    if (currentIdx + 1 < total) {
      setCurrent((previous) => previous + 1)
      setSelected(null)
      setAnswered(false)
      return
    }

    if (!sessionId) {
      setFinished(true)
      return
    }

    setCompleting(true)
    try {
      const response = await completeMCQPracticeSession(sessionId)
      setCompletionResult(response)
      setFinished(true)
    } catch (error) {
      setFetchError(error?.message || 'Failed to complete session. Please try again.')
    } finally {
      setCompleting(false)
    }
  }

  const handleRetry = () => {
    if (answering || completing) return
    startSession({ keepLoader: false })
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">{currentPractice.loadingLabel}</p>
        </div>
      </DashboardLayout>
    )
  }

  if (!sessionId && !mcqQuestions.length) {
    return (
      <DashboardLayout>
        <div className="max-w-6xl mx-auto py-14 space-y-10">
          <div className="rounded-[34px] bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-700 p-8 text-white shadow-2xl overflow-hidden">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="space-y-4">
                <p className="text-xs uppercase tracking-[0.3em] text-indigo-100">AI practice studio</p>
                <h1 className="text-3xl sm:text-4xl font-black leading-tight">{currentPractice.title}</h1>
                <p className="max-w-2xl text-sm text-indigo-100/90 leading-relaxed">
                  {currentPractice.emptyStateDescription} Choose a topic, difficulty, and question count to start a focused practice session that adapts to your pace.
                </p>
              </div>
              <div className="rounded-3xl bg-white/10 border border-white/15 px-5 py-4 text-sm font-semibold text-white backdrop-blur-sm shadow-lg">
                <p className="text-xs uppercase tracking-[0.3em] text-white/80">Practice Type</p>
                <p className="mt-1 text-lg font-bold">{currentPractice.title}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.6fr_0.9fr]">
            <div className="space-y-6">
              <div className="rounded-3xl border border-gray-100 bg-white p-7 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Session setup</h2>
                    <p className="text-sm text-gray-500 mt-1">Customize your session before generating the practice set.</p>
                  </div>
                  <div className="rounded-full bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700">
                    {currentPractice.defaultRole}
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  <label className="space-y-2 text-sm text-gray-600">
                    <span className="font-semibold text-gray-900">Role</span>
                    <select
                      className="w-full rounded-3xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                      value={generatorConfig.role}
                      onChange={(event) => applyGeneratorConfig({ role: event.target.value })}
                    >
                      {currentPractice.roleOptions.map((roleOption) => (
                        <option key={roleOption} value={roleOption}>{roleOption}</option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2 text-sm text-gray-600">
                    <span className="font-semibold text-gray-900">Topic</span>
                    <select
                      className="w-full rounded-3xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                      value={generatorConfig.topic}
                      onChange={(event) => applyGeneratorConfig({ topic: event.target.value })}
                    >
                      {currentPractice.topicOptions.map((topicOption) => (
                        <option key={topicOption} value={topicOption}>{topicOption}</option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-2 text-sm text-gray-600">
                    <span className="font-semibold text-gray-900">Difficulty</span>
                    <select
                      className="w-full rounded-3xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                      value={generatorConfig.difficulty}
                      onChange={(event) => applyGeneratorConfig({ difficulty: event.target.value })}
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </label>

                  <label className="space-y-2 text-sm text-gray-600">
                    <span className="font-semibold text-gray-900">Question count</span>
                    <select
                      className="w-full rounded-3xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                      value={generatorConfig.questionCount}
                      onChange={(event) => applyGeneratorConfig({ questionCount: Number(event.target.value) })}
                    >
                      <option value={5}>5</option>
                      <option value={8}>8</option>
                      <option value={10}>10</option>
                    </select>
                  </label>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <PrimaryButton size="md" onClick={handleGenerateNewSet} disabled={fetchingSet || !canStartPractice}>
                    {fetchingSet ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    {fetchingSet ? 'Generating...' : 'Generate AI set'}
                  </PrimaryButton>
                </div>
              </div>

              {fetchError && (
                <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
                  {fetchError}
                </div>
              )}

              {isResumeRequired && !hasRequiredResume && (
                <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
                  Resume upload is required before this session can start.
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-gray-100 bg-white p-7 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">Why this practice</h3>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl bg-violet-50 p-4">
                  <p className="text-sm font-semibold text-violet-700">Fast question sets</p>
                  <p className="text-sm text-gray-600 mt-2">Generate focused questions instantly and keep your momentum.</p>
                </div>
                <div className="rounded-3xl bg-blue-50 p-4">
                  <p className="text-sm font-semibold text-blue-700">Smart feedback</p>
                  <p className="text-sm text-gray-600 mt-2">Receive immediate answer review and targeted guidance.</p>
                </div>
                <div className="rounded-3xl bg-emerald-50 p-4">
                  <p className="text-sm font-semibold text-emerald-700">Built for consistency</p>
                  <p className="text-sm text-gray-600 mt-2">Track progress across sessions with easier follow-up practice.</p>
                </div>
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-700">Adaptive mode</p>
                  <p className="text-sm text-gray-600 mt-2">Choose topics that match your current skill area and grow steadily.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (checkingPrereq) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-gray-500">Checking resume setup...</p>
        </div>
      </DashboardLayout>
    )
  }

  if (isResumeRequired && !hasRequiredResume && !fetchError) {
    return (
      <DashboardLayout>
        <div className="max-w-xl mx-auto py-16 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Upload your resume first</h2>
          <p className="text-sm text-gray-500 mb-6">
            Your backend MCQ session needs extracted resume text before it can start.
          </p>
          <div className="flex items-center justify-center gap-3">
            <SecondaryButton variant="outline" size="md" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </SecondaryButton>
            <PrimaryButton size="md" onClick={() => navigate('/setup')}>
              Upload Resume
            </PrimaryButton>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (fetchError && total === 0) {
    return (
      <DashboardLayout>
        <div className="max-w-xl mx-auto py-16 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">MCQ session unavailable</h2>
          <p className="text-sm text-gray-500 mb-6">{fetchError}</p>
          <div className="flex items-center justify-center gap-3">
            <SecondaryButton variant="outline" size="md" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </SecondaryButton>
            <PrimaryButton size="md" onClick={() => startSession({ keepLoader: true })}>
              Retry
            </PrimaryButton>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  if (!question && !finished) {
    return (
      <DashboardLayout>
        <div className="max-w-xl mx-auto py-16 text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-2">Ready to generate {practiceType === 'aptitude' ? 'aptitude' : 'MCQ'} questions</h2>
          <p className="text-sm text-gray-500 mb-6">Click generate to start an AI-powered practice session.</p>
          <PrimaryButton size="md" onClick={handleGenerateNewSet} disabled={fetchingSet}>
            Generate AI Set
          </PrimaryButton>
        </div>
      </DashboardLayout>
    )
  }

  if (finished) {
    return (
      <DashboardLayout>
        <ResultsScreen
          score={score}
          total={total}
          answers={answers}
          result={completionResult}
          onRetry={handleRetry}
          onInterview={() => navigate('/interview')}
        />
      </DashboardLayout>
    )
  }

  const progressPct = ((currentIdx + (answered ? 1 : 0)) / Math.max(total, 1)) * 100

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-8 pb-10">
        <div className="rounded-[30px] bg-gradient-to-r from-slate-950 via-indigo-950 to-purple-950 p-8 text-white shadow-2xl overflow-hidden">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Practice session</p>
              <h1 className="text-3xl sm:text-4xl font-black">{currentPractice.title}</h1>
              <p className="mt-3 max-w-3xl text-sm text-slate-300 leading-relaxed">
                {question.topic} · Question {currentIdx + 1} of {total} · Score: {score}/{currentIdx + (answered ? 1 : 0)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-white ring-1 ring-white/15">
                {question.topic}
              </span>
              <PrimaryButton size="sm" onClick={handleRetry} className="bg-white text-slate-950 hover:bg-slate-100">
                <RotateCcw size={14} />
                Restart
              </PrimaryButton>
            </div>
          </div>
        </div>

        {fetchError && (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 shadow-sm">
            {fetchError}
          </div>
        )}

        <div className="grid gap-8 xl:grid-cols-[1.05fr_0.45fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-gray-100 bg-white p-7 shadow-sm">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Question</p>
                  <h2 className="text-2xl font-semibold text-gray-900 mt-2 leading-snug">{question.question}</h2>
                </div>
                <div className="rounded-3xl bg-violet-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-violet-700 shadow-sm">
                  {currentIdx + 1} / {total} answered
                </div>
              </div>

              <div className="mt-8 space-y-4">
                {question.options.map((option, index) => (
                  <OptionButton
                    key={index}
                    index={index}
                    text={option}
                    state={optionState(index)}
                    onClick={handleSelect}
                    disabled={answering || completing}
                  />
                ))}
              </div>

              {answered && currentAnswer && (
                <div
                  className={`mt-6 rounded-3xl border p-5 flex items-start gap-3 ${
                    currentAnswer.correct ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                  }`}
                >
                  {currentAnswer.correct ? (
                    <CheckCircle size={20} className="text-green-500 mt-0.5" />
                  ) : (
                    <XCircle size={20} className="text-red-500 mt-0.5" />
                  )}
                  <div>
                    <p className={`text-sm font-semibold ${currentAnswer.correct ? 'text-green-800' : 'text-red-800'}`}>
                      {currentAnswer.correct ? 'Correct answer' : 'Incorrect answer'}
                    </p>
                    <p className={`mt-1 text-sm leading-relaxed ${currentAnswer.correct ? 'text-green-700' : 'text-red-700'}`}>
                      {currentAnswer.feedback}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-gray-500">
                {!answered && 'Select an answer to submit this question.'}
                {answering && 'Submitting your answer...'}
                {completing && 'Finalizing session...'}
              </div>
              <div className="w-full sm:w-auto">
                <PrimaryButton
                  size="md"
                  onClick={handleNext}
                  disabled={!answered || answering || completing}
                >
                  {currentIdx + 1 === total ? 'Finish & See Results' : 'Next Question'}
                  <ChevronRight size={16} />
                </PrimaryButton>
              </div>
            </div>
          </div>

          <aside className="space-y-5">
            <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Session progress</p>
              <div className="mt-4 rounded-3xl bg-gray-100 p-3">
                <div className="flex items-center justify-between text-sm mb-3">
                  <span>Progress</span>
                  <span className="font-semibold text-gray-900">{Math.round(progressPct)}%</span>
                </div>
                <div className="h-3 rounded-full bg-slate-200 overflow-hidden">
                  <div className="h-full bg-purple-600" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Session info</p>
              <div className="mt-4 space-y-3 text-sm text-gray-700">
                <div className="flex items-center justify-between">
                  <span>Topic</span>
                  <span className="font-semibold text-gray-900">{question.topic}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Question count</span>
                  <span className="font-semibold text-gray-900">{total}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Answered</span>
                  <span className="font-semibold text-gray-900">{currentIdx + (answered ? 1 : 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Current score</span>
                  <span className="font-semibold text-gray-900">{score}</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  )
}
