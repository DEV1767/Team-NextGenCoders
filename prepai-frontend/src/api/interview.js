import { apiRequest } from './client'

export async function startInterviewSession(payload) {
  return apiRequest('/session/start', {
    method: 'POST',
    body: payload,
  })
}

export async function getSession(sessionId) {
  return apiRequest(`/session/${sessionId}`)
}

export async function submitAnswer(sessionId, payload) {
  return apiRequest('/session/answer', {
    method: 'POST',
    body: { sessionId, ...payload },
  })
}

export async function logTabSwitch(sessionId) {
  return apiRequest('/session/tabswitch', {
    method: 'POST',
    body: { sessionId },
  })
}

export async function completeSession(sessionId) {
  return apiRequest('/session/complete', {
    method: 'POST',
    body: { sessionId },
  })
}

export async function clarifyInterviewQuestion(sessionId, doubtText) {
  return apiRequest('/session/clarify', {
    method: 'POST',
    body: { sessionId, doubtText },
  })
}

export async function generateHints(sessionId, partialTranscript) {
  return apiRequest('/session/hints', {
    method: 'POST',
    body: { sessionId, partialTranscript },
  })
}

export async function getInterviewQuestions(role, experience) {
  const params = new URLSearchParams()
  if (role) params.append('role', role)
  if (experience) params.append('experience', experience)

  return apiRequest(`/interview/question-bank?${params}`)
}
