import { apiRequest } from './client'

function appendIfValue(params, key, value) {
  if (value === undefined || value === null || value === '') return
  params.append(key, String(value))
}

export async function getMCQQuestions(topic, limit, options = {}) {
  const params = new URLSearchParams()
  appendIfValue(params, 'topic', topic)
  appendIfValue(params, 'limit', limit)
  appendIfValue(params, 'difficulty', options.difficulty)
  appendIfValue(params, 'role', options.role)
  appendIfValue(params, 'experience', options.experience)
  appendIfValue(params, 'source', options.source)
  appendIfValue(params, 'regenerate', options.regenerate)
  appendIfValue(params, 'ai', options.ai)

  const query = params.toString()
  return apiRequest(query ? `/mcq/questions?${query}` : '/mcq/questions')
}

export async function generateMCQQuestions(config = {}) {
  const {
    topic,
    limit,
    difficulty,
    role,
    experience,
  } = config

  return getMCQQuestions(topic, limit, {
    difficulty,
    role,
    experience,
    source: 'ai',
    ai: true,
    regenerate: true,
  })
}

export async function startMCQPracticeSession(payload = {}) {
  const {
    role,
    topic,
    questionCount,
    difficulty,
  } = payload

  return apiRequest('/session/start', {
    method: 'POST',
    body: {
      mode: 'mcq_practice',
      role,
      topic,
      questionCount,
      difficulty,
    },
  })
}

export async function submitMCQPracticeAnswer(payload = {}) {
  const {
    sessionId,
    questionNumber,
    selectedOptionIndex,
  } = payload

  return apiRequest('/session/answer', {
    method: 'POST',
    body: {
      sessionId,
      questionNumber,
      selectedOptionIndex,
    },
  })
}

export async function completeMCQPracticeSession(sessionId) {
  return apiRequest('/session/complete', {
    method: 'POST',
    body: { sessionId },
  })
}

export async function submitMCQAttempt(payload) {
  return apiRequest('/mcq/attempts', {
    method: 'POST',
    body: payload,
  })
}

export async function getMCQProgress() {
  return apiRequest('/mcq/progress')
}
