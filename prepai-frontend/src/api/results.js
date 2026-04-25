import { apiRequest } from './client'

export async function getLatestResult() {
  return apiRequest('/results/latest')
}

export async function getResultById(resultId) {
  return apiRequest(`/results/${resultId}`)
}

export async function getResultsList(page = 1, limit = 20) {
  return apiRequest(`/results?type=interview&page=${page}&limit=${limit}`)
}

export async function exportResultPDF(resultId) {
  return apiRequest(`/results/${resultId}/export/pdf`, {
    responseType: 'blob',
  })
}

export async function getRecommendations(resultId) {
  return apiRequest(`/results/${resultId}/recommendations`)
}

export async function getRoadmapStatus(resultId) {
  return apiRequest(`/results/${resultId}/roadmap/status`)
}

export async function generateRoadmap(resultId, regenerate = false) {
  return apiRequest(`/results/${resultId}/roadmap`, {
    method: 'POST',
    body: { regenerate },
  })
}
