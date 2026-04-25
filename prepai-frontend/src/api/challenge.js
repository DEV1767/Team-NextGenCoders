import { apiRequest } from './client'

export async function getDailyChallenge() {
  return apiRequest('/challenge')
}

export async function evaluateChallengeAnswer(data) {
  return apiRequest('/challenge/evaluate', {
    method: 'POST',
    body: data,
  })
}

export async function submitDailyChallenge(challengeType) {
  return apiRequest('/challenge/submit', {
    method: 'POST',
    body: { challengeType },
  })
}
