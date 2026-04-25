export function isMissingOnboarding(user) {
  if (!user) return true

  const source = user?.user || user?.profile || user
  const onboarding = source?.onboarding || source?.preferences || {}

  const roleValue = source.role || source.targetRole || onboarding.role
  const experienceValue = source.experience || source.experienceLevel || onboarding.experience

  const role = typeof roleValue === 'string' ? roleValue.trim() : roleValue
  const experience = typeof experienceValue === 'string' ? experienceValue.trim() : experienceValue

  return !role || !experience
}

export function hasUploadedResume(user) {
  if (!user) return false

  const source = user?.user || user?.profile || user
  const resumeMeta = source?.resumeMeta || source?.resume || {}

  return Boolean(
    source.resumeUrl ||
      source.resumeFile ||
      source.extractedText ||
      source.resumeExtractedText ||
      resumeMeta.url ||
      resumeMeta.filename ||
      resumeMeta.fileName,
  )
}

export function getAppState(user) {
  if (!user) return 'unauthenticated'
  if (isMissingOnboarding(user)) return 'needs_onboarding'
  if (!hasUploadedResume(user)) return 'onboarding_done'
  return 'practice_ready'
}

export function getPostLoginPath(user) {
  if (isMissingOnboarding(user)) return '/onboarding'
  if (!hasUploadedResume(user)) return '/setup'
  return '/dashboard'
}