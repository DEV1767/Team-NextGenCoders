import { useEffect, useState } from 'react'
import { BookOpen, CheckCircle, RotateCcw, Brain, Target } from 'lucide-react'
import DashboardLayout from '../layout/DashboardLayout'
import PrimaryButton from '../components/PrimaryButton'
import SecondaryButton from '../components/SecondaryButton'
import { getDueFlashcards, reviewFlashcard, answerFlashcard } from '../api/flashcards'

export default function FlashcardsPage() {
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatingId, setUpdatingId] = useState(null)
  const [answers, setAnswers] = useState({})
  const [answeringId, setAnsweringId] = useState(null)
  const [evaluationResults, setEvaluationResults] = useState({})

  useEffect(() => {
    let active = true
    const fetchCards = async () => {
      setLoading(true)
      try {
        const response = await getDueFlashcards()
        if (!active) return
        const resultCards = Array.isArray(response?.flashcards)
          ? response.flashcards
          : Array.isArray(response)
            ? response
            : []
        setCards(resultCards)
        setError('')
      } catch (err) {
        console.error('Unable to load flashcards:', err)
        if (!active) return
        setError(err?.message || 'Unable to load flashcards.')
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchCards()
    return () => { active = false }
  }, [])

  const handleReview = async (cardId, status) => {
    setUpdatingId(cardId)
    try {
      await reviewFlashcard(cardId, status)
      setCards((prev) => prev.filter((card) => card._id !== cardId))
      setError('')
    } catch (err) {
      console.error('Review failed:', err)
      setError(err?.message || 'Unable to update flashcard status.')
    } finally {
      setUpdatingId(null)
    }
  }

  const handleAnswerChange = (cardId, value) => {
    setAnswers((prev) => ({ ...prev, [cardId]: value }))
  }

  const handleSubmitAnswer = async (cardId) => {
    const userAnswer = String(answers[cardId] || '').trim()
    if (!userAnswer) {
      setError('Please enter an answer before submitting.')
      return
    }

    setAnsweringId(cardId)
    try {
      const result = await answerFlashcard(cardId, userAnswer)
      setEvaluationResults((prev) => ({ ...prev, [cardId]: result }))
      setError('')
      if (result?.isMastered) {
        setCards((prev) => prev.filter((card) => (card._id || card.id) !== cardId))
      }
    } catch (err) {
      console.error('Answer evaluation failed:', err)
      setError(err?.message || 'Unable to evaluate your answer.')
    } finally {
      setAnsweringId(null)
    }
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-gradient-to-r from-purple-500 to-blue-500 p-3">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Flashcards Review</h1>
              <p className="text-sm text-gray-500 mt-1">
                Review your due flashcards and reinforce the ideas from your recent sessions.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-3xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-6">
          <div className="rounded-3xl border border-gray-100 bg-gradient-to-r from-white to-gray-50 p-6 shadow-lg">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-blue-100 p-2">
                  <Target className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Due Flashcards</h2>
                  <p className="text-sm text-gray-500 mt-1">Cards ready for review today.</p>
                </div>
              </div>
              <div className="rounded-full bg-gradient-to-r from-purple-500 to-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-md">
                {loading ? 'Loading...' : `${cards.length} due`}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm text-sm text-gray-500">Loading your flashcards...</div>
          ) : !cards.length ? (
            <div className="rounded-3xl border border-dashed border-gray-300 bg-gradient-to-br from-gray-50 to-white p-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-lg font-semibold text-gray-900">All caught up!</p>
              <p className="mt-2 text-sm text-gray-600">No flashcards due right now. Complete another session to generate new review cards.</p>
            </div>
          ) : (
            <div className="grid gap-5">
              {cards.map((card) => {
                const cardId = card._id || card.id || card.cardId
                return (
                  <div key={cardId || card.question} className="group rounded-3xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 p-8 shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-[1.02]">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-gradient-to-r from-blue-500 to-purple-500 p-2">
                          <Brain className="h-4 w-4 text-white" />
                        </div>
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-gray-400">Flashcard</p>
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            card.status === 'mastered' ? 'bg-green-100 text-green-700' :
                            card.status === 'learning' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {card.status || 'new'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-400">Review interval</p>
                        <p className="text-sm font-semibold text-gray-700">{card.interval || 0} day(s)</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-2xl bg-gradient-to-r from-blue-50 to-purple-50 p-6 border border-blue-100">
                        <h3 className="text-xl font-bold text-gray-900 mb-3">{card.question}</h3>
                        <p className="text-sm text-gray-600 leading-relaxed">{card.answer}</p>
                      </div>

                      <div>
                        <label htmlFor={`flashcard-answer-${cardId}`} className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                          <RotateCcw className="h-4 w-4" />
                          Your answer
                        </label>
                        <textarea
                          id={`flashcard-answer-${cardId}`}
                          value={answers[cardId] || ''}
                          onChange={(event) => handleAnswerChange(cardId, event.target.value)}
                          className="w-full min-h-[120px] rounded-2xl border border-gray-200 bg-white p-4 text-sm text-gray-800 focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition-all duration-200 resize-none"
                          placeholder="Type your answer here and submit for AI evaluation..."
                        />
                      </div>

                      {evaluationResults[cardId] && (
                        <div className={`rounded-2xl border p-4 text-sm ${
                          evaluationResults[cardId].isMastered
                            ? 'border-green-200 bg-green-50 text-green-800'
                            : 'border-blue-200 bg-blue-50 text-blue-800'
                        }`}>
                          <div className="flex items-center gap-2 mb-2">
                            <CheckCircle className="h-4 w-4" />
                            <p className="font-semibold">AI Evaluation</p>
                          </div>
                          <p className="mb-1">Score: <span className="font-bold">{evaluationResults[cardId].score ?? '-'}/100</span></p>
                          <p className="mb-2">Feedback: {evaluationResults[cardId].feedback}</p>
                          {evaluationResults[cardId].isMastered && (
                            <p className="text-sm font-medium">🎉 Marked as mastered!</p>
                          )}
                        </div>
                      )}

                      <div className="flex flex-wrap gap-3 pt-2">
                        <PrimaryButton
                          size="sm"
                          onClick={() => handleSubmitAnswer(cardId)}
                          disabled={answeringId === cardId}
                          className="flex items-center gap-2"
                        >
                          {answeringId === cardId ? 'Checking...' : (
                            <>
                              <Brain className="h-4 w-4" />
                              Submit answer
                            </>
                          )}
                        </PrimaryButton>
                        <PrimaryButton
                          variant="outline"
                          size="sm"
                          onClick={() => handleReview(cardId, 'learning')}
                          disabled={updatingId === cardId}
                          className="flex items-center gap-2"
                        >
                          {updatingId === cardId ? 'Saving...' : (
                            <>
                              <RotateCcw className="h-4 w-4" />
                              Need more review
                            </>
                          )}
                        </PrimaryButton>
                        <SecondaryButton
                          size="sm"
                          onClick={() => handleReview(cardId, 'mastered')}
                          disabled={updatingId === cardId}
                          className="flex items-center gap-2"
                        >
                          <CheckCircle className="h-4 w-4" />
                          Mark as mastered
                        </SecondaryButton>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
