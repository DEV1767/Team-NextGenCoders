import { apiRequest } from './client'

export async function getDashboardSummary() {
  return apiRequest('/dashboard/summary')
}

export async function getDashboardStats() {
  return apiRequest('/dashboard/stats')
}

export async function getRecentSessions(limit = 10) {
  return apiRequest(`/session?limit=${limit}`)
}

export async function getWeeklyActivity() {
  return apiRequest('/dashboard/weekly-activity')
}

export async function getScoreTrend() {
  return apiRequest('/dashboard/score-trend')
}
