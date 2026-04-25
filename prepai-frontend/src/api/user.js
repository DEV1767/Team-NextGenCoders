import { apiRequest } from './client'

function pickFirst(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') {
      return value
    }
  }
  return ''
}

function normalizeCurrentUser(raw) {
  const source = raw?.user || raw?.profile || raw || {}
  const onboarding = source?.onboarding || source?.preferences || {}
  const resumeMeta = source?.resumeMeta || source?.resume || {}

  return {
    ...source,
    id: pickFirst(source.id, source._id, source.userId),
    name: pickFirst(source.name, source.fullName, source.username),
    email: pickFirst(source.email, source.mail),
    role: pickFirst(source.role, source.targetRole, onboarding.role),
    experience: pickFirst(source.experience, source.experienceLevel, onboarding.experience),
    extractedText: pickFirst(source.extractedText, source.resumeExtractedText),
    resumeUrl: pickFirst(source.resumeUrl, source.resumeLink, resumeMeta.url),
    resumeFile: pickFirst(source.resumeFile, source.resumeFilename, resumeMeta.fileName),
    resumeMeta,
    resume: {
      uploaded: resumeMeta?.uploaded !== false,
      analyzed: resumeMeta?.analyzed || false,
      score: resumeMeta?.score || 0,
      feedback: resumeMeta?.feedback || null,
      fileName: resumeMeta?.fileName || null,
      analyzedAt: resumeMeta?.analyzedAt || null,
      canAnalyze: resumeMeta?.canAnalyze !== false,
      buttonLabel: resumeMeta?.buttonLabel || 'Verify Resume'
    }
  }
}

export async function getCurrentUser() {
  const response = await apiRequest('/user/me')
  return normalizeCurrentUser(response)
}

export async function updateUserProfile(payload) {
  return apiRequest('/user/me', {
    method: 'PATCH',
    body: payload,
  })
}

export async function analyzeResume() {
  const response = await apiRequest('/user/resume/analyze', {
    method: 'POST',
  })
  return response?.resume || response
}
