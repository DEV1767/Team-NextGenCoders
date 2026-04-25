import { apiRequest } from './client'

export async function getLeaderboard() {
  return apiRequest('/leaderboard')
}
