import { useEffect, useState } from 'react'
import { CheckCircle, AlertTriangle, XCircle, Target, Zap, Trophy, Calendar, Flame } from 'lucide-react'
import DashboardLayout from '../layout/DashboardLayout'
import PrimaryButton from '../components/PrimaryButton'
import SecondaryButton from '../components/SecondaryButton'
import { getDailyChallenge, submitDailyChallenge, evaluateChallengeAnswer } from '../api/challenge'

function EvaluationItem({ type, text }) {
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

export default function ChallengePage() {
  const [challenge, setChallenge] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [evaluating, setEvaluating] = useState(false)
  const [error, setError] = useState('')
  const [userAnswer, setUserAnswer] = useState('')
  const [evaluation, setEvaluation] = useState(null)
  const [answerSubmitted, setAnswerSubmitted] = useState(false)

  useEffect(() => {
    let active = true

    const fetchChallenge = async () => {
      setLoading(true)
      try {
        const response = await getDailyChallenge()
        if (!active) return
        const data = response?.challenge || response
        setChallenge(data)
        setError('')
        setUserAnswer('')
        setEvaluation(null)
        setAnswerSubmitted(false)
      } catch (err) {
        console.error('Failed to load challenge:', err)
        if (!active) return
        setError(err?.message || 'Unable to load daily challenge.')
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchChallenge()
    return () => { active = false }
  }, [])

  const handleEvaluateAnswer = async () => {
    if (!userAnswer.trim()) {
      setError('Please enter an answer before evaluating.')
      return
    }

    setEvaluating(true)
    setError('')
    try {
      const result = await evaluateChallengeAnswer({
        challengeType: challenge.type,
        userAnswer: userAnswer.trim(),
        prompt: challenge.prompt,
        options: challenge.options || []
      })

      const eval_data = result?.evaluation || result
      setEvaluation(eval_data)
      setAnswerSubmitted(true)
    } catch (err) {
      console.error('Challenge evaluation failed:', err)
      setError(err?.message || 'Unable to evaluate answer.')
    } finally {
      setEvaluating(false)
    }
  }

  const handleComplete = async () => {
    if (!challenge?.type) return
    setSubmitting(true)
    try {
      await submitDailyChallenge(challenge.type)
      const response = await getDailyChallenge()
      const data = response?.challenge || response
      setChallenge(data)
      setUserAnswer('')
      setEvaluation(null)
      setAnswerSubmitted(false)
      setError('')
    } catch (err) {
      console.error('Challenge submission failed:', err)
      setError(err?.message || 'Unable to submit challenge.')
    } finally {
      setSubmitting(false)
    }
  }

  const renderOptions = () => {
    if (!challenge || challenge.type !== 'mcq') return null
    if (!Array.isArray(challenge.options)) return null

    return (
      <div className="grid gap-3">
        {challenge.options.map((option, index) => (
          <div key={index} className="rounded-2xl border border-gray-200 bg-gradient-to-r from-white to-gray-50 p-4 text-sm text-gray-700 hover:border-purple-300 transition-colors duration-200">
            <span className="font-semibold text-purple-600 mr-2">{String.fromCharCode(65 + index)}.</span> {option}
          </div>
        ))}
      </div>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-gradient-to-r from-orange-500 to-red-500 p-3">
              <Target className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Daily Prep Challenge</h1>
              <p className="text-sm text-gray-500 mt-1">
                Alternate daily between interview and MCQ practice for stronger streak building.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-3xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="bg-gradient-to-br from-white to-gray-50 border border-gray-200 rounded-3xl p-8 shadow-lg">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-gradient-to-r from-blue-500 to-purple-500 p-2">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">Today's challenge</p>
                  <h2 className="text-xl font-semibold text-gray-900 mt-1">{challenge?.type === 'interview' ? 'Interview prompt' : 'MCQ prompt'}</h2>
                </div>
              </div>
              <span className={`inline-flex rounded-full px-4 py-2 text-xs font-semibold ${
                challenge?.type === 'interview' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
              }`}>
                {challenge?.type?.toUpperCase() || 'N/A'}
              </span>
            </div>

            {loading ? (
              <p className="text-sm text-gray-500">Loading challenge...</p>
            ) : error ? (
              <p className="text-sm text-red-500">{error}</p>
            ) : challenge ? (
              <div className="space-y-6">
                <div className="rounded-2xl bg-gradient-to-r from-blue-50 to-purple-50 p-6 border border-blue-100">
                  <p className="text-base text-gray-800 leading-7 font-medium">{challenge.prompt}</p>
                </div>
                {renderOptions()}

                <div className="rounded-2xl border border-gray-200 bg-white p-6">
                  <label htmlFor="challenge-answer" className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
                    <Target className="h-4 w-4" />
                    Your Answer
                  </label>
                  <textarea
                    id="challenge-answer"
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    placeholder={challenge.type === 'interview' 
                      ? 'Describe your approach, trade-offs, and results...' 
                      : 'Enter your answer...'}
                    className="w-full min-h-[140px] rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-800 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all duration-200 resize-none"
                    disabled={challenge.completedToday}
                  />
                </div>

                {evaluation && (
                  <div className="space-y-4 rounded-2xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-6 shadow-md">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-gradient-to-r from-purple-500 to-blue-500 p-2">
                          <CheckCircle className="h-5 w-5 text-white" />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900">AI Evaluation</h3>
                      </div>
                      <div className="text-3xl font-bold text-purple-600">{evaluation.score}/100</div>
                    </div>

                    <div className="bg-white rounded-xl p-4 border border-gray-100">
                      <p className="text-sm text-gray-700 leading-relaxed">{evaluation.feedback}</p>
                    </div>

                    {evaluation.strengths && evaluation.strengths.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2.5">Strengths</p>
                        <div className="flex flex-wrap gap-1.5">
                          {evaluation.strengths.map((item) => (
                            <span key={item} className="text-xs font-medium bg-green-50 text-green-700 border border-green-100 px-2.5 py-1 rounded-full">
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {evaluation.improvements && evaluation.improvements.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2.5">Areas to Improve</p>
                        <div className="flex flex-wrap gap-1.5">
                          {evaluation.improvements.map((item) => (
                            <span key={item} className="text-xs font-medium bg-orange-50 text-orange-700 border border-orange-100 px-2.5 py-1 rounded-full">
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {evaluation.isCorrect !== undefined && (
                      <EvaluationItem 
                        type={evaluation.isCorrect ? 'positive' : 'warning'} 
                        text={evaluation.explanation || (evaluation.isCorrect ? 'Correct answer!' : 'Incorrect answer. Review the explanation above.')}
                      />
                    )}
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-orange-50 to-red-50 p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Flame className="h-4 w-4 text-orange-600" />
                      <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Current Streak</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{challenge.currentStreak ?? 0} days</p>
                  </div>
                  <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-blue-50 to-purple-50 p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Trophy className="h-4 w-4 text-blue-600" />
                      <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Best Streak</p>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{challenge.bestStreak ?? 0} days</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gradient-to-br from-green-50 to-emerald-50 p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 text-green-600" />
                    <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Completed Challenges</p>
                  </div>
                  <p className="text-lg font-bold text-gray-900">{challenge.challengesCompleted ?? 0}</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {!answerSubmitted ? (
                    <>
                      <PrimaryButton 
                        size="md" 
                        onClick={handleEvaluateAnswer} 
                        disabled={challenge.completedToday || evaluating || !userAnswer.trim()}
                        className="flex items-center gap-2"
                      >
                        {evaluating ? 'Evaluating...' : (
                          <>
                            <CheckCircle className="h-4 w-4" />
                            Evaluate Answer
                          </>
                        )}
                      </PrimaryButton>
                      <SecondaryButton 
                        size="md" 
                        onClick={() => window.location.reload()}
                        disabled={challenge.completedToday}
                        className="flex items-center gap-2"
                      >
                        <Target className="h-4 w-4" />
                        Refresh
                      </SecondaryButton>
                    </>
                  ) : (
                    <>
                      <PrimaryButton 
                        size="md" 
                        onClick={handleComplete} 
                        disabled={challenge.completedToday || submitting}
                        className="flex items-center gap-2"
                      >
                        {challenge.completedToday ? 'Completed Today' : submitting ? 'Submitting...' : (
                          <>
                            <Trophy className="h-4 w-4" />
                            Mark Completed
                          </>
                        )}
                      </PrimaryButton>
                      <SecondaryButton 
                        size="md" 
                        onClick={() => {
                          setUserAnswer('')
                          setEvaluation(null)
                          setAnswerSubmitted(false)
                        }}
                        disabled={challenge.completedToday}
                        className="flex items-center gap-2"
                      >
                        <Target className="h-4 w-4" />
                        Try Again
                      </SecondaryButton>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No challenge available right now.</p>
            )}
          </div>

          <div className="space-y-6">
            <div className="bg-gradient-to-br from-white to-blue-50 border border-blue-200 rounded-3xl p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-3">
                <div className="rounded-full bg-blue-100 p-2">
                  <Target className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Why this challenge?</h3>
              </div>
              <p className="text-sm text-gray-600 leading-6">
                These daily prompts alternate between interview storytelling and MCQ preparation so you can develop confidence, retention, and consistency across both skills.
              </p>
            </div>
            <div className="bg-gradient-to-br from-white to-purple-50 border border-purple-200 rounded-3xl p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-3">
                <div className="rounded-full bg-purple-100 p-2">
                  <Zap className="h-5 w-5 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">How it works</h3>
              </div>
              <p className="text-sm text-gray-600 leading-6">
                1. Read the prompt<br/>
                2. Type your answer<br/>
                3. Get instant AI feedback<br/>
                4. Mark complete to build your streak
              </p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
