import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Lightbulb,
  Loader2,
  Mic,
  Play,
  Send,
  Square,
  Video,
  Volume2,
  Wifi,
  XCircle,
  TrendingUp,
} from 'lucide-react'
import DashboardLayout from '../layout/DashboardLayout'
import PrimaryButton from '../components/PrimaryButton'
import SecondaryButton from '../components/SecondaryButton'
import { getCurrentUser } from '../api/user'
import { completeSession, logTabSwitch, startInterviewSession, submitAnswer, generateHints, clarifyInterviewQuestion } from '../api/interview'
import { hasUploadedResume } from '../utils/userState'

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function toBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = String(reader.result || '')
      const base64 = result.includes(',') ? result.split(',')[1] : result
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function safeStringify(value) {
  if (!value) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }
  return String(value)
}

function readQuestion(response) {
  return response?.currentQuestion || response?.nextQuestion || response?.question || ''
}

function extractQuestionText(questionPayload) {
  if (!questionPayload) return ''

  if (typeof questionPayload === 'string') {
    return questionPayload
  }

  if (typeof questionPayload === 'object') {
    const textValue =
      questionPayload.questionText ||
      questionPayload.question ||
      questionPayload.text ||
      questionPayload.prompt ||
      ''

    if (typeof textValue === 'string') return textValue
    return textValue ? String(textValue) : ''
  }

  return String(questionPayload)
}

function extractAnswerMode(questionPayload) {
  if (!questionPayload || typeof questionPayload !== 'object') return ''
  const mode = questionPayload.answerMode
  return mode === 'voice' || mode === 'text' ? mode : ''
}

function readSessionId(response) {
  return response?.sessionId || response?.session?.id || response?.id || ''
}

function isSessionFinished(response) {
  return Boolean(
    response?.completed ||
      response?.isCompleted ||
      response?.status === 'completed' ||
      response?.result ||
      typeof response?.overallScore === 'number',
  )
}

const DEFAULT_LIVE_INTERVIEW_QUESTION_COUNT = 7
const MIN_LIVE_INTERVIEW_QUESTION_COUNT = 3
const MAX_LIVE_INTERVIEW_QUESTION_COUNT = 15

const SETUP_STEPS = [
  { key: 'internet', label: 'Checking internet connection', icon: Wifi },
  { key: 'media', label: 'Checking microphone and camera', icon: Camera },
  { key: 'ai', label: 'Generating interview question', icon: Loader2 },
  { key: 'countdown', label: 'Interview starts in', icon: Video },
]

function SetupStepRow({ step, status }) {
  const Icon = step.icon

  if (status === 'done') {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
        <CheckCircle2 size={17} className="text-green-600" />
        <p className="text-sm text-green-800 font-medium">{step.label}</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
        <XCircle size={17} className="text-red-600" />
        <p className="text-sm text-red-800 font-medium">{step.label}</p>
      </div>
    )
  }

  if (status === 'running') {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-purple-200 bg-purple-50 px-4 py-3">
        <Loader2 size={17} className="text-purple-600 animate-spin" />
        <p className="text-sm text-purple-800 font-medium">{step.label}</p>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
      <Icon size={17} className="text-gray-400" />
      <p className="text-sm text-gray-600">{step.label}</p>
    </div>
  )
}

// ============= FEATURE: WHISPER COACH (Real-Time Hints) =============
function WhisperCoachHints({ hints, show, answerMode }) {
  if (!show || !hints || hints.length === 0) return null

  return (
    <div className={`${
      answerMode === 'voice' 
        ? 'absolute bottom-4 right-4 z-40' 
        : 'mt-3'
    } space-y-2 max-w-xs`}>
      {hints.map((hint, idx) => (
        <div
          key={idx}
          className="animate-fadeIn bg-gradient-to-r from-yellow-50 to-amber-50 border-l-4 border-yellow-400 rounded-lg p-3 shadow-lg backdrop-blur-sm hover:shadow-xl transition-shadow"
          style={{
            animation: `fadeIn 0.4s ease-in forwards`,
            animationDelay: `${idx * 0.1}s`,
          }}
        >
          <div className="flex gap-2 items-start">
            <Lightbulb size={16} className="text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-yellow-700 uppercase">Tip</p>
              <p className="text-sm text-yellow-800 font-medium mt-0.5">{hint}</p>
            </div>
          </div>
        </div>
      ))}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.4s ease-in forwards; }
      `}</style>
    </div>
  )
}

export default function InterviewPage() {
  const navigate = useNavigate()
  const recorderRef = useRef(null)
  const recognitionRef = useRef(null)
  const chunksRef = useRef([])
  const previewStreamRef = useRef(null)
  const tempRecordingStreamRef = useRef(null)
  const autoStopTimerRef = useRef(null)
  const videoRef = useRef(null)
  const answerModeRef = useRef('text')
  const sessionActiveRef = useRef(false)
  const submitAfterStopRef = useRef(false)

  const [user, setUser] = useState(null)
  const [userLoading, setUserLoading] = useState(true)

  const [role, setRole] = useState('')
  const [difficulty, setDifficulty] = useState('medium')
  const [questionCount, setQuestionCount] = useState(DEFAULT_LIVE_INTERVIEW_QUESTION_COUNT)

  const [sessionId, setSessionId] = useState('')
  const [currentQuestion, setCurrentQuestion] = useState('')
  const [remainingQuestions, setRemainingQuestions] = useState(0)

  const [answerMode, setAnswerMode] = useState('text')
  const [textAnswer, setTextAnswer] = useState('')
  const [audioBase64, setAudioBase64] = useState('')
  const [recording, setRecording] = useState(false)
  const [autoVoiceEnabled] = useState(true)
  const [liveTranscript, setLiveTranscript] = useState('')

  const [lastUserAnswer, setLastUserAnswer] = useState('')
  const [lastAnswerMode, setLastAnswerMode] = useState('text')
  const [analyzing, setAnalyzing] = useState(false)

  const [starting, setStarting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [completing, setCompleting] = useState(false)

  const [sessionResult, setSessionResult] = useState(null)
  const [error, setError] = useState('')

  const [previewReady, setPreviewReady] = useState(false)
  const [isAiSpeaking, setIsAiSpeaking] = useState(false)

  const [setupOpen, setSetupOpen] = useState(false)
  const [setupStatus, setSetupStatus] = useState({
    internet: 'pending',
    media: 'pending',
    ai: 'pending',
    countdown: 'pending',
  })
  const [setupCountdown, setSetupCountdown] = useState(null)

  // ============= NEW: Whisper Coach & Vague Detection =============
  const [whisperHints, setWhisperHints] = useState([])
  const [showWhisperHints, setShowWhisperHints] = useState(false)
  const [vagueFollowUp, setVagueFollowUp] = useState(null)
  const [doubtText, setDoubtText] = useState('')
  const [clarifyLoading, setClarifyLoading] = useState(false)
  const [clarifyResult, setClarifyResult] = useState(null)
  const hintsFetchTimeRef = useRef(0)

  // ============= NEW: Recording Countdown Timer =============
  const [recordingCountdown, setRecordingCountdown] = useState(null)
  const countdownIntervalRef = useRef(null)

  const sessionActive = Boolean(sessionId && !sessionResult)
  const safeQuestionCount = useMemo(() => {
    const parsedCount = Number(questionCount)
    if (!Number.isFinite(parsedCount)) return DEFAULT_LIVE_INTERVIEW_QUESTION_COUNT
    return Math.max(MIN_LIVE_INTERVIEW_QUESTION_COUNT, Math.min(MAX_LIVE_INTERVIEW_QUESTION_COUNT, Math.round(parsedCount)))
  }, [questionCount])
  const canStart = useMemo(() => role && difficulty && safeQuestionCount >= MIN_LIVE_INTERVIEW_QUESTION_COUNT, [role, difficulty, safeQuestionCount])

  useEffect(() => {
    answerModeRef.current = answerMode
  }, [answerMode])

  useEffect(() => {
    sessionActiveRef.current = sessionActive
  }, [sessionActive])

  const stopPreviewStream = () => {
    if (previewStreamRef.current) {
      previewStreamRef.current.getTracks().forEach((track) => track.stop())
      previewStreamRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setPreviewReady(false)
  }

  const clearAutoStopTimer = () => {
    if (autoStopTimerRef.current) {
      window.clearTimeout(autoStopTimerRef.current)
      autoStopTimerRef.current = null
    }
  }

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.onresult = null
      recognitionRef.current.onerror = null
      recognitionRef.current.onend = null
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
  }

  const startPreviewStream = async () => {
    if (previewStreamRef.current) {
      return previewStreamRef.current
    }

    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    previewStreamRef.current = stream

    if (videoRef.current) {
      videoRef.current.srcObject = stream
      videoRef.current.play().catch(() => {})
    }

    setPreviewReady(true)
    return stream
  }

  useEffect(() => {
    if (videoRef.current && previewStreamRef.current) {
      videoRef.current.srcObject = previewStreamRef.current
      videoRef.current.play().catch(() => {})
      setPreviewReady(true)
    }
  }, [sessionActive, setupOpen, analyzing])

  const speakText = (text, options = {}) => {
    const { autoStartVoiceCapture = false } = options

    if (!text) return

    if (!window.speechSynthesis) {
      if (
        autoStartVoiceCapture &&
        autoVoiceEnabled &&
        answerModeRef.current === 'voice' &&
        sessionActiveRef.current
      ) {
        startRecording()
      }
      return
    }

    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    // Improved voice quality for natural, clear speech
    utterance.rate = 0.92
    utterance.pitch = 1.0
    utterance.volume = 0.98
    utterance.lang = 'en-US'
    
    // Select a high-quality English voice
    const voices = window.speechSynthesis.getVoices()
    const preferredVoice = voices.find((voice) => 
      voice.lang?.toLowerCase().startsWith('en') && 
      (voice.name.includes('Google') || voice.name.includes('Natural') || voice.name.includes('Female'))
    ) || voices.find((voice) => voice.lang?.toLowerCase().startsWith('en'))
    if (preferredVoice) utterance.voice = preferredVoice
    
    utterance.onstart = () => setIsAiSpeaking(true)
    utterance.onend = async () => {
      setIsAiSpeaking(false)

      if (
        autoStartVoiceCapture &&
        autoVoiceEnabled &&
        answerModeRef.current === 'voice' &&
        sessionActiveRef.current
      ) {
        await startRecording()
      }
    }
    utterance.onerror = async () => {
      setIsAiSpeaking(false)

      if (
        autoStartVoiceCapture &&
        autoVoiceEnabled &&
        answerModeRef.current === 'voice' &&
        sessionActiveRef.current
      ) {
        await startRecording()
      }
    }

    window.speechSynthesis.speak(utterance)
  }

  useEffect(() => {
    let active = true

    const fetchUser = async () => {
      try {
        const me = await getCurrentUser()
        if (!active) return

        setUser(me)
        setRole(me?.role || '')
      } catch (err) {
        if (!active) return
        setError(err.message || 'Unable to load user profile.')
      } finally {
        if (active) setUserLoading(false)
      }
    }

    fetchUser()

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden && sessionId) {
        logTabSwitch(sessionId).catch(() => {})
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [sessionId])

  useEffect(() => {
    return () => {
      clearAutoStopTimer()
      stopSpeechRecognition()
      if (tempRecordingStreamRef.current) {
        tempRecordingStreamRef.current.getTracks().forEach((track) => track.stop())
      }
      stopPreviewStream()
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel()
      }
    }
  }, [])

  const runSetupAndStart = async () => {
    setSetupOpen(true)
    setSetupCountdown(null)
    setSetupStatus({ internet: 'pending', media: 'pending', ai: 'pending', countdown: 'pending' })

    try {
      setSetupStatus((prev) => ({ ...prev, internet: 'running' }))
      await sleep(450)
      if (!navigator.onLine) {
        setSetupStatus((prev) => ({ ...prev, internet: 'error' }))
        throw new Error('No internet connection. Please reconnect and try again.')
      }
      setSetupStatus((prev) => ({ ...prev, internet: 'done' }))

      setSetupStatus((prev) => ({ ...prev, media: 'running' }))
      if (!navigator.mediaDevices?.getUserMedia) {
        setSetupStatus((prev) => ({ ...prev, media: 'error' }))
        throw new Error('Camera and microphone are not supported in this browser.')
      }

      await startPreviewStream()
      await sleep(300)
      setSetupStatus((prev) => ({ ...prev, media: 'done' }))

      setSetupStatus((prev) => ({ ...prev, ai: 'running' }))
      const response = await startInterviewSession({
        mode: 'live_interview',
        role,
        difficulty,
        questionCount: safeQuestionCount,
      })
      setSetupStatus((prev) => ({ ...prev, ai: 'done' }))

      const nextSessionId = readSessionId(response)
      const questionPayload = readQuestion(response)
      const questionText = extractQuestionText(questionPayload)
      const suggestedAnswerMode = extractAnswerMode(questionPayload)

      if (!nextSessionId || !questionText) {
        throw new Error('Invalid start session response from server.')
      }

      setSetupStatus((prev) => ({ ...prev, countdown: 'running' }))
      for (const n of [3, 2, 1]) {
        setSetupCountdown(n)
        await sleep(650)
      }
      setSetupCountdown(null)
      setSetupStatus((prev) => ({ ...prev, countdown: 'done' }))

      setSessionId(nextSessionId)
      setCurrentQuestion(questionText)
      if (suggestedAnswerMode) setAnswerMode(suggestedAnswerMode)
      setRemainingQuestions(Number(response?.remainingQuestions ?? response?.remaining ?? 0))
      setSessionResult(null)
      setTextAnswer('')
      setAudioBase64('')

      setSetupOpen(false)
      speakText(questionText, { autoStartVoiceCapture: true })
    } catch (err) {
      setSetupOpen(false)
      throw err
    }
  }

  const handleStartSession = async () => {
    if (!canStart) return

    setStarting(true)
    setError('')

    try {
      await runSetupAndStart()
    } catch (err) {
      setError(err.message || 'Failed to start interview session.')
    } finally {
      setStarting(false)
    }
  }

  const startRecording = async () => {
    if (recording) return

    try {
      setError('')
      chunksRef.current = []
      setLiveTranscript('')

      let recordingStream = null
      if (previewStreamRef.current?.getAudioTracks()?.length) {
        recordingStream = new MediaStream(previewStreamRef.current.getAudioTracks())
      } else {
        recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        tempRecordingStreamRef.current = recordingStream
      }

      const recorder = new MediaRecorder(recordingStream, { mimeType: 'audio/webm' })
      recorderRef.current = recorder

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data)
        }
      }

      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const base64 = await toBase64(blob)
        setAudioBase64(base64)
        setRecording(false)

        if (submitAfterStopRef.current) {
          submitAfterStopRef.current = false
          await submitRecordedVoiceAnswer(base64)
        }

        if (tempRecordingStreamRef.current) {
          tempRecordingStreamRef.current.getTracks().forEach((track) => track.stop())
          tempRecordingStreamRef.current = null
        }
      }

      recorder.start()
      setRecording(true)

      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      if (SpeechRecognition) {
        stopSpeechRecognition()
        const recognition = new SpeechRecognition()
        recognition.lang = 'en-US'
        recognition.interimResults = true
        recognition.continuous = true

        recognition.onresult = (event) => {
          let transcript = ''
          for (let i = 0; i < event.results.length; i += 1) {
            const result = event.results[i]
            const text = result?.[0]?.transcript || ''
            if (text) transcript += `${text}${result.isFinal ? ' ' : ''}`
          }
          setLiveTranscript(transcript.trim())
        }

        recognition.onerror = () => {
          stopSpeechRecognition()
        }

        recognition.onend = () => {
          recognitionRef.current = null
        }

        recognitionRef.current = recognition
        try {
          recognition.start()
        } catch {
          recognitionRef.current = null
        }
      }
    } catch {
      setError('Microphone access denied or unavailable.')
    }
  }

  const stopRecording = (submitOnStop = false) => {
    clearAutoStopTimer()
    stopSpeechRecognition()
    // Clear countdown timer
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current)
      countdownIntervalRef.current = null
    }
    setRecordingCountdown(null)
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      submitAfterStopRef.current = submitOnStop
      recorderRef.current.stop()
    }
  }

  const submitRecordedVoiceAnswer = async (recordedBase64) => {
    if (!sessionId) return

    if (!recordedBase64) {
      setError('Please record your voice answer first.')
      return
    }

    const payload = {
      answerMode: 'voice',
      userAnswer: recordedBase64,
    }

    const answerToDisplay = 'Voice recording submitted'
    setLastUserAnswer(answerToDisplay)
    setLastAnswerMode('voice')
    setSubmitting(true)
    setError('')
    setAnalyzing(true)

    try {
      const response = await submitAnswer(sessionId, payload)

      if (response?.is_vague && response?.vague_follow_up) {
        setVagueFollowUp(response.vague_follow_up)
        setCurrentQuestion(response.vague_follow_up)
        setTextAnswer('')
        setAudioBase64('')
        setLiveTranscript('')
        speakText(response.vague_follow_up, { autoStartVoiceCapture: true })
        setAnalyzing(false)
        return
      }

      if (isSessionFinished(response)) {
        setSessionResult(response?.result || response)
        stopPreviewStream()
        setAnalyzing(false)
        return
      }

      const nextQuestionPayload = readQuestion(response)
      const nextQuestionText = extractQuestionText(nextQuestionPayload)
      const suggestedAnswerMode = extractAnswerMode(nextQuestionPayload)

      if (nextQuestionText) {
        setCurrentQuestion(nextQuestionText)
        speakText(nextQuestionText, { autoStartVoiceCapture: true })
      }
      if (suggestedAnswerMode) setAnswerMode(suggestedAnswerMode)
      setRemainingQuestions(Number(response?.remainingQuestions ?? response?.remaining ?? 0))
      setVagueFollowUp(null)
      setTextAnswer('')
      setAudioBase64('')
      setLiveTranscript('')
      setAnalyzing(false)
    } catch (err) {
      setError(err.message || 'Failed to submit answer.')
      setAnalyzing(false)
    } finally {
      setSubmitting(false)
    }
  }

  // ============= FEATURE: Fetch Whisper Coach Hints - DISABLED =============
  // Disabled to save tokens - answers are now submitted only once after recording completes
  // useEffect(() => {
  //   if (!sessionId || !currentQuestion) return
  //   const isActive = (recording && answerMode === 'voice') || (textAnswer.length > 10 && answerMode === 'text')
  //   if (!isActive) return
  //   const hintsFetchInterval = setInterval(async () => {
  //     try {
  //       const now = Date.now()
  //       if (now - hintsFetchTimeRef.current < 15000) return
  //       hintsFetchTimeRef.current = now
  //       const partialTranscript = answerMode === 'text' 
  //         ? textAnswer 
  //         : lastUserAnswer || currentQuestion
  //       if (!partialTranscript || partialTranscript.trim().length < 8) {
  //         return
  //       }
  //       const hints = await generateHints(sessionId, partialTranscript)
  //       if (hints?.hints && Array.isArray(hints.hints) && hints.hints.length > 0) {
  //         setWhisperHints(hints.hints.slice(0, 2))
  //         setShowWhisperHints(true)
  //         setTimeout(() => setShowWhisperHints(false), 8000)
  //       }
  //     } catch (err) {
  //       console.debug('[Whisper Coach] Failed to fetch hints:', err.message)
  //     }
  //   }, 5000)
  //   return () => clearInterval(hintsFetchInterval)
  // }, [recording, sessionId, currentQuestion, textAnswer, answerMode, lastUserAnswer])

  const handleSubmitAnswer = async () => {
    if (!sessionId) return

    if (answerMode === 'voice' && recording) {
      stopRecording(true)
      return
    }

    if (answerMode === 'voice') {
      if (!audioBase64) {
        setError('Please record your voice answer first.')
        return
      }
      await submitRecordedVoiceAnswer(audioBase64)
      return
    }

    let payload = null
    if (!textAnswer.trim()) {
      setError('Please enter your answer before submitting.')
      return
    }

    payload = {
      answerMode: 'text',
      userAnswer: textAnswer.trim(),
    }

    setSubmitting(true)
    setError('')
    const answerToDisplay = textAnswer
    setLastUserAnswer(answerToDisplay)
    setLastAnswerMode('text')
    setAnalyzing(true)

    try {
      const response = await submitAnswer(sessionId, payload)

      if (response?.is_vague && response?.vague_follow_up) {
        setVagueFollowUp(response.vague_follow_up)
        setCurrentQuestion(response.vague_follow_up)
        setTextAnswer('')
        setAudioBase64('')
        speakText(response.vague_follow_up, { autoStartVoiceCapture: true })
        setAnalyzing(false)
        return
      }

      if (isSessionFinished(response)) {
        setSessionResult(response?.result || response)
        stopPreviewStream()
        setAnalyzing(false)
        return
      }

      const nextQuestionPayload = readQuestion(response)
      const nextQuestionText = extractQuestionText(nextQuestionPayload)
      const suggestedAnswerMode = extractAnswerMode(nextQuestionPayload)

      if (nextQuestionText) {
        setCurrentQuestion(nextQuestionText)
        speakText(nextQuestionText, { autoStartVoiceCapture: true })
      }
      if (suggestedAnswerMode) setAnswerMode(suggestedAnswerMode)
      setRemainingQuestions(Number(response?.remainingQuestions ?? response?.remaining ?? 0))
      setVagueFollowUp(null)
      setTextAnswer('')
      setAudioBase64('')
      setLiveTranscript('')
      setAnalyzing(false)
    } catch (err) {
      setError(err.message || 'Failed to submit answer.')
      setAnalyzing(false)
    } finally {
      setSubmitting(false)
    }
  }

  const handleClarifyQuestion = async () => {
    if (!sessionId || !doubtText.trim()) return

    setClarifyLoading(true)
    setError('')

    try {
      const response = await clarifyInterviewQuestion(sessionId, doubtText.trim())
      const clarification = response?.clarification || null
      setClarifyResult(clarification)
      if (clarification?.clarification) {
        speakText(clarification.clarification)
      }
    } catch (err) {
      setError(err.message || 'Failed to clarify question.')
    } finally {
      setClarifyLoading(false)
    }
  }

  const handleCompleteSession = async () => {
    if (!sessionId) return

    setCompleting(true)
    setAnalyzing(true)
    setError('')

    try {
      const response = await completeSession(sessionId)
      setSessionResult(response?.result || response)
      stopPreviewStream()
      stopSpeechRecognition()
    } catch (err) {
      setError(err.message || 'Failed to complete session.')
      setAnalyzing(false)
    } finally {
      setCompleting(false)
    }
  }

  if (userLoading) {
    return (
      <DashboardLayout>
        <div className="h-64 flex items-center justify-center">
          <p className="text-sm text-gray-500">Loading interview setup...</p>
        </div>
      </DashboardLayout>
    )
  }

  if (user && !hasUploadedResume(user)) {
    return (
      <DashboardLayout>
        <div className="max-w-2xl mx-auto bg-white border border-amber-200 rounded-2xl p-6">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-600 mt-0.5" />
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Resume required before interview</h1>
              <p className="text-sm text-gray-600 mt-1">
                Your backend requires extracted resume text before /session/start can run. Upload resume first.
              </p>
              <div className="mt-4">
                <PrimaryButton size="md" onClick={() => navigate('/setup')}>
                  Go to Resume Upload
                </PrimaryButton>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto py-10 space-y-6">
        {error && (
          <div className="rounded-3xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 shadow-sm">
            {error}
          </div>
        )}

        {!sessionActive && !sessionResult && (
          <div className="grid gap-6 lg:grid-cols-[1.6fr_0.9fr]">
            <div className="space-y-6">
              <div className="rounded-3xl border border-gray-100 bg-white p-7 shadow-sm">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">Session setup</h2>
                    <p className="text-sm text-gray-500 mt-1">Configure your interview parameters before starting.</p>
                  </div>
                  <div className="rounded-full bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700">
                    Live Interview
                  </div>
                </div>

                <div className="mt-6 grid gap-4 lg:grid-cols-2">
                  <label className="space-y-2 text-sm text-gray-600">
                    <span className="font-semibold text-gray-900">Role</span>
                    <input
                      value={role}
                      onChange={(event) => setRole(event.target.value)}
                      className="w-full rounded-3xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                      placeholder="Frontend Developer"
                    />
                  </label>

                  <label className="space-y-2 text-sm text-gray-600">
                    <span className="font-semibold text-gray-900">Difficulty</span>
                    <select
                      value={difficulty}
                      onChange={(event) => setDifficulty(event.target.value)}
                      className="w-full rounded-3xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </label>

                  <label className="space-y-2 text-sm text-gray-600">
                    <span className="font-semibold text-gray-900">Question count</span>
                    <input
                      type="number"
                      min={MIN_LIVE_INTERVIEW_QUESTION_COUNT}
                      max={MAX_LIVE_INTERVIEW_QUESTION_COUNT}
                      value={questionCount}
                      onChange={(event) => setQuestionCount(event.target.value)}
                      className="w-full rounded-3xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Recommended: 7-10 questions for a realistic interview experience.
                    </p>
                  </label>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <PrimaryButton size="md" onClick={handleStartSession} disabled={!canStart || starting} loading={starting}>
                    <Play size={14} />
                    Start Interview
                  </PrimaryButton>
                </div>
              </div>

              {setupOpen && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4">
                  <div className="w-full max-w-lg rounded-3xl border border-gray-200 bg-white p-7 shadow-2xl">
                    <h3 className="text-lg font-bold text-gray-900">Setting up your interview</h3>
                    <p className="text-sm text-gray-500 mt-1 mb-6">Preparing environment, verifying devices, and generating questions.</p>

                    <div className="space-y-3">
                      {SETUP_STEPS.map((step) => (
                        <SetupStepRow key={step.key} step={step} status={setupStatus[step.key]} />
                      ))}
                    </div>

                    <div className="mt-6 min-h-[54px] rounded-3xl border border-purple-200 bg-purple-50 flex items-center justify-center">
                      {setupCountdown ? (
                        <span className="text-3xl font-black text-purple-700">{setupCountdown}</span>
                      ) : (
                        <p className="text-sm text-purple-700 font-medium">Please wait...</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-gray-100 bg-white p-7 shadow-sm">
              <h3 className="text-lg font-semibold text-gray-900">Why live interviews</h3>
              <div className="mt-5 grid gap-3 sm:grid-cols-1">
                <div className="rounded-3xl bg-violet-50 p-4">
                  <p className="text-sm font-semibold text-violet-700">Realistic experience</p>
                  <p className="text-sm text-gray-600 mt-2">Practice with voice prompts, camera, and natural conversation flow.</p>
                </div>
                <div className="rounded-3xl bg-blue-50 p-4">
                  <p className="text-sm font-semibold text-blue-700">Instant feedback</p>
                  <p className="text-sm text-gray-600 mt-2">Get real-time hints and clarification options during your responses.</p>
                </div>
                <div className="rounded-3xl bg-emerald-50 p-4">
                  <p className="text-sm font-semibold text-emerald-700">Build confidence</p>
                  <p className="text-sm text-gray-600 mt-2">Develop speaking skills and learn to articulate technical concepts clearly.</p>
                </div>
                <div className="rounded-3xl bg-slate-50 p-4">
                  <p className="text-sm font-semibold text-slate-700">Adaptive difficulty</p>
                  <p className="text-sm text-gray-600 mt-2">Choose your challenge level and get personalized performance insights.</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {sessionActive && !analyzing && (
          <div className="rounded-3xl border border-gray-100 bg-white p-3 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between mb-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-gray-400">Live Session</p>
                <h2 className="text-2xl font-semibold text-gray-900 mt-2">Interview in Progress</h2>
                <p className="text-sm text-gray-500 mt-1">Answer the questions and build your confidence.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-violet-50 px-3 py-1 text-[11px] font-semibold text-violet-700">
                  {remainingQuestions} remaining
                </span>
                <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                  isAiSpeaking
                    ? 'bg-green-50 text-green-700'
                    : 'bg-gray-50 text-gray-600'
                }`}>
                  {isAiSpeaking ? 'AI speaking...' : 'AI listening'}
                </span>
                <SecondaryButton size="xs" variant="outline" onClick={handleCompleteSession} disabled={completing || analyzing}>
                  {completing ? 'Completing...' : 'Complete Session'}
                </SecondaryButton>
              </div>
            </div>

            <div className="space-y-3">
              {/* Top row: camera and AI side by side */}
              <div className="grid gap-2 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="rounded-xl border border-gray-200 overflow-hidden bg-black min-h-[100px] relative">
                  <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
                  {!previewReady && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white/90 gap-1 bg-black/70">
                      <Video size={16} />
                      <p className="text-[11px]">Camera preview will appear after setup</p>
                    </div>
                  )}
                  {previewReady && (
                    <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                      LIVE
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-sky-50 p-1.5 min-h-[85px] flex flex-col justify-center">
                  <div className="flex items-start gap-1.5">
                    <div
                      className={`interviewer-avatar ${isAiSpeaking ? 'interviewer-avatar-speaking' : ''}`}
                      aria-label={isAiSpeaking ? 'Interviewer speaking' : 'Interviewer listening'}
                    >
                      {isAiSpeaking ? '🗣️' : '🙂'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-semibold uppercase tracking-wide text-indigo-600">AI Interviewer</p>
                      <p className="text-[10px] font-medium text-gray-900 mt-1">
                        {isAiSpeaking ? 'Asking question...' : 'Listening...'}
                      </p>

                      <div className="mt-1 flex items-center gap-1">
                        <span
                          className={`h-2 w-2 rounded-full ${isAiSpeaking ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}
                        />
                        <span className="text-[9px] text-gray-600 font-medium">
                          {isAiSpeaking ? 'Speaking' : 'Listening'}
                        </span>
                      </div>

                      <div className="interviewer-voice-bars mt-1.5" aria-hidden="true">
                        {[0, 1, 2, 3, 4].map((item) => (
                          <span
                            key={item}
                            className={`interviewer-voice-bar ${isAiSpeaking ? 'is-active' : ''}`}
                            style={{ animationDelay: `${item * 90}ms` }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom row: AI transcript and user transcript side by side */}
              <div className="grid gap-2 sm:grid-cols-2">
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-2">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">AI Speaking</p>
                    <button
                      type="button"
                      onClick={() => speakText(currentQuestion)}
                      className="text-[10px] font-semibold text-purple-700 hover:text-purple-900 inline-flex items-center gap-1"
                    >
                      <Volume2 size={11} /> Replay
                    </button>
                  </div>
                  <p className="text-sm text-gray-900 leading-relaxed">{currentQuestion}</p>
                </div>

                <div className="rounded-xl border border-gray-100 bg-gray-50 p-2">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] uppercase tracking-[0.3em] text-gray-400">Your Speech</p>
                    <span className="text-[10px] text-gray-400">{recording ? 'Speaking...' : 'Idle'}</span>
                  </div>
                  <p className="text-xs text-gray-900 leading-relaxed min-h-[30px]">
                    {liveTranscript || 'Your spoken answer will appear here while you talk.'}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-2 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-indigo-700">Need clarification?</p>
                  <span className="text-[10px] text-indigo-500">Ask one doubt before answering</span>
                </div>
                <textarea
                  value={doubtText}
                  onChange={(event) => setDoubtText(event.target.value)}
                  className="w-full min-h-[48px] rounded-xl border border-indigo-100 bg-white px-2 py-2 text-xs focus:outline-none focus:border-indigo-400"
                  placeholder="Type your doubt about the current question..."
                />
                <div className="flex items-center gap-2">
                  <SecondaryButton size="xs" variant="outline" onClick={handleClarifyQuestion} disabled={clarifyLoading || !doubtText.trim()}>
                    {clarifyLoading ? 'Clarifying...' : 'Ask Clarification'}
                  </SecondaryButton>
                  <button
                    type="button"
                    onClick={() => setDoubtText('')}
                    className="text-[10px] text-gray-500 hover:text-gray-700"
                  >
                    Clear
                  </button>
                </div>
                {clarifyResult?.clarification && (
                  <div className="rounded-xl border border-indigo-200 bg-white p-2 text-xs text-gray-700 space-y-1">
                    <p className="font-semibold text-indigo-800">Clarification</p>
                    <p>{clarifyResult.clarification}</p>
                    {clarifyResult.whatInterviewerExpects && <p className="text-[10px] text-gray-500">{clarifyResult.whatInterviewerExpects}</p>}
                    {clarifyResult.hint && <p className="text-[10px] text-indigo-600">Hint: {clarifyResult.hint}</p>}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className={`px-2 py-1 text-[10px] rounded-full border font-semibold transition-colors ${
                    answerMode === 'text' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => setAnswerMode('text')}
                >
                  Text Answer
                </button>
                <button
                  type="button"
                  className={`px-2 py-1 text-[10px] rounded-full border font-semibold transition-colors ${
                    answerMode === 'voice' ? 'bg-purple-600 text-white border-purple-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => setAnswerMode('voice')}
                >
                  Voice Answer
                </button>
              </div>

              {answerMode === 'text' ? (
                <div className="space-y-2">
                  <textarea
                    value={textAnswer}
                    onChange={(event) => setTextAnswer(event.target.value)}
                    className="w-full min-h-[80px] border border-gray-200 rounded-lg px-2 py-2 text-xs focus:outline-none focus:border-purple-500"
                    placeholder="Write your answer here..."
                  />
                  {/* ============= FEATURE: Whisper Coach Hints for Text Mode ============= */}
                  <WhisperCoachHints hints={whisperHints} show={showWhisperHints && textAnswer.length > 15} answerMode={answerMode} />
                </div>
              ) : (
                <div className="rounded-lg border border-gray-200 p-2 relative bg-gray-50 min-h-[70px]">
                  <p className="text-xs text-gray-600 mb-2">AI finishes speaking, then mic auto-starts. Stop recording to submit your answer.</p>
                  <div className="flex flex-wrap gap-1.5 items-center">
                    {!recording ? (
                      <SecondaryButton size="xs" variant="outline" onClick={startRecording}>
                        <Mic size={12} />
                        Record
                      </SecondaryButton>
                    ) : (
                      <>
                        <SecondaryButton size="xs" variant="outline" onClick={() => stopRecording(true)}>
                          <Square size={12} />
                          Stop
                        </SecondaryButton>
                      </>
                    )}

                    <span className="text-[10px] text-gray-500">
                      {recording ? 'Recording...' : audioBase64 ? 'Audio ready.' : 'No audio yet.'}
                    </span>
                  </div>

                  {/* ============= FEATURE: Whisper Coach Hints =============  */}
                  <WhisperCoachHints hints={whisperHints} show={showWhisperHints && recording} answerMode={answerMode} />
                </div>
              )}

              <div className="flex flex-wrap items-center gap-1">
                <PrimaryButton size="sm" onClick={handleSubmitAnswer} disabled={submitting} loading={submitting}>
                  <Send size={12} />
                  Submit Answer
                </PrimaryButton>

                <SecondaryButton size="sm" variant="ghost" onClick={handleCompleteSession} disabled={completing}>
                  Done
                </SecondaryButton>
              </div>
            </div>
            </div>
          )}

        {sessionActive && analyzing && (
          <div className="rounded-3xl border border-gray-100 bg-white p-8 shadow-sm">
            <div className="text-center space-y-4">
              <h2 className="text-2xl font-semibold text-gray-900">Analyzing Your Answer</h2>
              <p className="text-sm text-gray-500">Our AI is reviewing your response and preparing feedback...</p>
            </div>

            {lastUserAnswer && (
              <div className="rounded-3xl border border-blue-200 bg-blue-50 p-5 mt-6">
                <p className="text-xs font-semibold text-blue-600 uppercase mb-3">Your Answer</p>
                <p className="text-sm text-gray-900 leading-relaxed break-words">{lastUserAnswer}</p>
              </div>
            )}

            <div className="flex flex-col items-center justify-center gap-4 py-8 mt-6">
              <div className="grid w-full gap-2 sm:grid-cols-3">
                {['Completing session', 'Analyzing answer', 'Generating feedback'].map((label, index) => (
                  <div key={label} className="rounded-2xl border border-purple-100 bg-purple-50 px-3 py-3 text-xs text-gray-700 flex items-center justify-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full bg-purple-500 ${index === 0 ? 'animate-pulse' : 'opacity-50'}`} />
                    {label}
                  </div>
                ))}
              </div>
              <p className="text-sm text-gray-600">Please wait while we prepare your feedback.</p>
            </div>
          </div>
        )}

        {sessionResult && (
          <div className="rounded-3xl border border-gray-100 bg-white p-7 shadow-sm space-y-8">
            <div className="text-center space-y-3">
              <h2 className="text-3xl font-semibold text-gray-900">Interview Completed</h2>
              <p className="text-sm text-gray-500">Here's your comprehensive performance analysis</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ['Overall Score', sessionResult?.overallScore],
                ['Technical', sessionResult?.technicalScore],
                ['Clarity', sessionResult?.clarityScore],
                ['Confidence', sessionResult?.confidenceScore],
              ].map(([label, value]) => (
                <div key={label} className="rounded-3xl border border-gray-200 p-5 bg-gradient-to-br from-purple-50 to-blue-50 hover:shadow-lg transition-shadow">
                  <p className="text-xs text-gray-600 uppercase font-semibold">{label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-3">{typeof value === 'number' ? Math.round(value) : value ?? '-'}</p>
                </div>
              ))}
            </div>

            {sessionResult?.readinessScore !== undefined && (
              <div className="rounded-3xl border border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50 p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-indigo-900">Interview Readiness</p>
                    <p className="text-3xl font-bold text-indigo-700 mt-2">{Math.round(sessionResult.readinessScore)}%</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-indigo-600 uppercase font-semibold mb-2">Assessment</p>
                    <p className="text-sm font-bold text-indigo-900">{sessionResult?.readinessLabel || 'N/A'}</p>
                  </div>
                </div>
              </div>
            )}

            {/* ============= FEATURE: Hire / No-Hire Verdict ============= */}
            {sessionResult?.verdict && (
              <div className={`rounded-xl border-2 p-5 ${
                sessionResult.verdict.verdict === 'HIRE'
                  ? 'border-green-300 bg-gradient-to-r from-green-50 to-emerald-50'
                  : sessionResult.verdict.verdict === 'NO HIRE'
                  ? 'border-red-300 bg-gradient-to-r from-red-50 to-pink-50'
                  : 'border-yellow-300 bg-gradient-to-r from-yellow-50 to-amber-50'
              }`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className={`text-xs font-bold uppercase tracking-wide ${
                      sessionResult.verdict.verdict === 'HIRE'
                        ? 'text-green-700'
                        : sessionResult.verdict.verdict === 'NO HIRE'
                        ? 'text-red-700'
                        : 'text-yellow-700'
                    }`}>
                      Hiring Decision
                    </p>
                    <p className={`text-3xl font-black mt-2 ${
                      sessionResult.verdict.verdict === 'HIRE'
                        ? 'text-green-900'
                        : sessionResult.verdict.verdict === 'NO HIRE'
                        ? 'text-red-900'
                        : 'text-yellow-900'
                    }`}>
                      {sessionResult.verdict.verdict}
                    </p>
                  </div>
                  <div className={`text-4xl ${
                    sessionResult.verdict.verdict === 'HIRE'
                      ? 'text-green-300'
                      : sessionResult.verdict.verdict === 'NO HIRE'
                      ? 'text-red-300'
                      : 'text-yellow-300'
                  }`}>
                    {sessionResult.verdict.verdict === 'HIRE' ? '✓' : sessionResult.verdict.verdict === 'NO HIRE' ? '✕' : '?'}
                  </div>
                </div>
                <p className={`text-sm mt-3 font-medium ${
                  sessionResult.verdict.verdict === 'HIRE'
                    ? 'text-green-800'
                    : sessionResult.verdict.verdict === 'NO HIRE'
                    ? 'text-red-800'
                    : 'text-yellow-800'
                }`}>
                  {sessionResult.verdict.reason}
                </p>
              </div>
            )}

            {/* ============= FEATURE: Readiness by Company Type ============= */}
            {sessionResult?.readinessByCompanyType && (
              <div className="rounded-xl border border-gray-200 p-4 bg-gray-50 space-y-3">
                <p className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                  <TrendingUp size={16} />
                  Readiness by Company Type
                </p>
                <div className="grid sm:grid-cols-3 gap-3">
                  {[
                    { key: 'startup', label: 'Early Stage Startup', icon: '🚀' },
                    { key: 'midsize', label: 'Mid-size Product Co.', icon: '📊' },
                    { key: 'faang', label: 'FAANG / Top Tier', icon: '🏆' },
                  ].map(({ key, label, icon }) => {
                    const typeData = sessionResult.readinessByCompanyType[key]
                    const score = typeData?.score || 0
                    return (
                      <div key={key} className="border border-gray-300 rounded-lg p-3 bg-white">
                        <p className="text-sm font-semibold text-gray-900 mb-2">{icon} {label}</p>
                        <div className="mb-2">
                          <p className="text-2xl font-bold text-gray-900">{score}%</p>
                          <div className="w-full bg-gray-200 rounded-full h-1.5 mt-1">
                            <div
                              className={`h-1.5 rounded-full ${
                                score >= 75 ? 'bg-green-500' : score >= 55 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${score}%` }}
                            />
                          </div>
                        </div>
                        <p className="text-xs text-gray-600 leading-tight">{typeData?.reason || 'Based on your interview performance.'}</p>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-gray-200 p-4 bg-gray-50 space-y-3">
              <p className="text-sm font-semibold text-gray-900">Performance Summary</p>
              <p className="text-sm text-gray-700 leading-relaxed">{safeStringify(sessionResult?.feedback || sessionResult?.finalFeedback || 'No feedback available.')}</p>
            </div>

            {(sessionResult?.strongTopics || sessionResult?.weakTopics) && (
              <div className="grid sm:grid-cols-2 gap-4">
                {sessionResult?.strongTopics && (
                  <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                    <p className="text-sm font-semibold text-green-900 mb-2">Strong Areas</p>
                    <ul className="text-sm text-green-800 space-y-1">
                      {Array.isArray(sessionResult.strongTopics) ? (
                        sessionResult.strongTopics.map((topic, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <CheckCircle2 size={14} className="mt-0.5 flex-shrink-0" />
                            <span>{topic}</span>
                          </li>
                        ))
                      ) : (
                        <li>{sessionResult.strongTopics}</li>
                      )}
                    </ul>
                  </div>
                )}
                {sessionResult?.weakTopics && (
                  <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                    <p className="text-sm font-semibold text-orange-900 mb-2">Areas to Improve</p>
                    <ul className="text-sm text-orange-800 space-y-1">
                      {Array.isArray(sessionResult.weakTopics) ? (
                        sessionResult.weakTopics.map((topic, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
                            <span>{topic}</span>
                          </li>
                        ))
                      ) : (
                        <li>{sessionResult.weakTopics}</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {sessionResult?.perQuestionSummary && (
              <div className="rounded-xl border border-gray-200 p-4 bg-gray-50 space-y-4">
                <p className="text-sm font-semibold text-gray-900">Question-by-Question Analysis</p>
                <div className="space-y-3">
                  {Array.isArray(sessionResult.perQuestionSummary) ? (
                    sessionResult.perQuestionSummary.map((item, idx) => (
                      <div key={idx} className="border border-gray-300 rounded-lg p-3 bg-white">
                        <p className="text-xs font-semibold text-gray-600 mb-1">Question {idx + 1}</p>
                        <p className="text-sm text-gray-900 mb-2 font-medium">{item?.questionText || 'N/A'}</p>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">Score: {item?.score || '-'}</span>
                        </div>
                        <p className="text-xs font-semibold text-gray-600 mb-1">Ideal Answer:</p>
                        <p className="text-xs text-gray-700 mb-2">{item?.idealAnswer || 'N/A'}</p>
                        {item?.topicsToStudy && Array.isArray(item.topicsToStudy) && (
                          <div>
                            <p className="text-xs font-semibold text-gray-600 mb-1">Topics to Study:</p>
                            <div className="flex flex-wrap gap-1">
                              {item.topicsToStudy.map((topic, tidx) => (
                                <span key={tidx} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">{topic}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-700">{safeStringify(sessionResult.perQuestionSummary)}</p>
                  )}
                </div>
              </div>
            )}

            {sessionResult?.studyPlan && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
                <p className="text-sm font-semibold text-blue-900">Recommended Study Plan</p>
                {Array.isArray(sessionResult.studyPlan) ? (
                  <ul className="text-sm text-blue-800 space-y-2">
                    {sessionResult.studyPlan.map((step, idx) => (
                      <li key={idx} className="flex gap-2">
                        <span className="font-bold text-blue-600 flex-shrink-0">{idx + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-blue-800">{safeStringify(sessionResult.studyPlan)}</p>
                )}
              </div>
            )}

            {sessionResult?.roadmap && (
              <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 space-y-3">
                <p className="text-sm font-semibold text-purple-900">Growth Roadmap</p>
                {Array.isArray(sessionResult.roadmap) ? (
                  <ul className="text-sm text-purple-800 space-y-2">
                    {sessionResult.roadmap.map((step, idx) => (
                      <li key={idx} className="flex gap-2">
                        <span className="font-bold text-purple-600 flex-shrink-0">{idx + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-purple-800">{safeStringify(sessionResult.roadmap)}</p>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-4 pt-6">
              <PrimaryButton size="md" onClick={() => navigate('/result')}>
                View Full Results
              </PrimaryButton>
              <SecondaryButton size="md" variant="outline" onClick={() => window.location.reload()}>
                Start New Session
              </SecondaryButton>
            </div>
          </div>
        )}
      </div>

      {setupOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl border border-gray-200 bg-white p-7 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">Setting up your interview</h3>
            <p className="text-sm text-gray-500 mt-1 mb-6">Preparing environment, verifying devices, and generating questions.</p>

            <div className="space-y-3">
              {SETUP_STEPS.map((step) => (
                <SetupStepRow key={step.key} step={step} status={setupStatus[step.key]} />
              ))}
            </div>

            <div className="mt-6 min-h-[54px] rounded-3xl border border-purple-200 bg-purple-50 flex items-center justify-center">
              {setupCountdown ? (
                <span className="text-3xl font-black text-purple-700">{setupCountdown}</span>
              ) : (
                <p className="text-sm text-purple-700 font-medium">Please wait...</p>
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
