import { apiRequest } from './client'

export async function uploadResume(file) {
  const formData = new FormData()
  formData.append('resume', file)

  return apiRequest('/upload/resume', {
    method: 'POST',
    body: formData,
  })
}

export async function getRoles() {
  return apiRequest('/roles')
}

export async function getExperienceLevels() {
  return apiRequest('/experience-levels')
}

export async function completeOnboarding(payload) {
  return apiRequest('/onboarding', {
    method: 'PUT',
    body: payload,
  })
}
