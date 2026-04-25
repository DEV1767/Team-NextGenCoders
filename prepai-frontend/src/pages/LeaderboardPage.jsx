import { useEffect, useState } from 'react'
import { Trophy, Medal, Crown, Star, TrendingUp, RefreshCw, Award, Target } from 'lucide-react'
import DashboardLayout from '../layout/DashboardLayout'
import PrimaryButton from '../components/PrimaryButton'
import { getLeaderboard } from '../api/leaderboard'

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const fetchLeaderboard = async () => {
      setLoading(true)
      try {
        const data = await getLeaderboard()
        if (!active) return
        setLeaderboard(data)
        setError('')
      } catch (err) {
        console.error('Failed to load leaderboard:', err)
        if (!active) return
        setError(err?.message || 'Unable to load leaderboard.')
      } finally {
        if (active) setLoading(false)
      }
    }

    fetchLeaderboard()
    return () => { active = false }
  }, [])

  const topUsers = Array.isArray(leaderboard?.topUsers) ? leaderboard.topUsers : []
  const neighbors = Array.isArray(leaderboard?.neighbors) ? leaderboard.neighbors : []
  const currentUser = leaderboard?.currentUser || null

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 p-3">
              <Trophy className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Global Leaderboard</h1>
              <p className="text-sm text-gray-500 mt-1">
                Track PrepAI progress across challenge streaks, interview performance, and leaderboard points.
              </p>
            </div>
          </div>
          <PrimaryButton size="md" onClick={() => window.location.reload()} className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </PrimaryButton>
        </div>

        {error && (
          <div className="rounded-3xl border border-red-100 bg-red-50 p-5 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div className="overflow-hidden rounded-3xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 shadow-lg">
              <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-yellow-50 to-orange-50">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 p-2">
                    <Crown className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Top Performers</h2>
                    <p className="text-sm text-gray-500 mt-1">Top 10 users ranked by leaderboard points.</p>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-gray-100">
                {loading ? (
                  <div className="p-6 text-sm text-gray-500">Loading leaderboard...</div>
                ) : topUsers.length ? (
                  topUsers.map((user) => {
                    const getRankIcon = (rank) => {
                      if (rank === 1) return <Crown className="h-4 w-4 text-yellow-500" />
                      if (rank === 2) return <Medal className="h-4 w-4 text-gray-400" />
                      if (rank === 3) return <Award className="h-4 w-4 text-amber-600" />
                      return null
                    }
                    const getRankBg = (rank) => {
                      if (rank === 1) return 'bg-gradient-to-r from-yellow-400 to-orange-400 text-white'
                      if (rank === 2) return 'bg-gradient-to-r from-gray-300 to-gray-400 text-white'
                      if (rank === 3) return 'bg-gradient-to-r from-amber-400 to-orange-400 text-white'
                      return 'bg-purple-50 text-purple-700'
                    }
                    return (
                      <div key={user.rank} className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 hover:bg-gray-50 transition-colors duration-200">
                        <div className="flex items-center gap-3">
                          <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${getRankBg(user.rank)} font-bold text-sm`}>
                            {user.rank <= 3 ? getRankIcon(user.rank) : user.rank}
                          </span>
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{user.username}</div>
                            <p className="text-xs text-gray-500">{user.collegeName}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900 text-lg">{user.leaderboardPoints} pts</p>
                          <p className="text-xs text-gray-500 flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" />
                            Streak: {user.currentStreak}
                          </p>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="p-6 text-sm text-gray-500">No leaderboard data available.</div>
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-gray-200 bg-gradient-to-br from-white to-gray-50 shadow-lg">
              <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-gradient-to-r from-blue-500 to-purple-500 p-2">
                    <Target className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">Your Neighbors</h2>
                    <p className="text-sm text-gray-500 mt-1">Users closest to your current rank.</p>
                  </div>
                </div>
              </div>
              <div className="divide-y divide-gray-100">
                {loading ? (
                  <div className="p-6 text-sm text-gray-500">Loading neighbors...</div>
                ) : neighbors.length ? (
                  neighbors.map((user) => (
                    <div key={`${user.rank}-${user.username}`} className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 hover:bg-gray-50 transition-colors duration-200">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white font-bold text-sm">
                          #{user.rank}
                        </span>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{user.username}</div>
                          <p className="text-xs text-gray-500">{user.collegeName}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-gray-900 text-lg">{user.leaderboardPoints} pts</p>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                          <Star className="h-3 w-3" />
                          Rank #{user.rank}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-sm text-gray-500">No nearby ranks available.</div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-gray-200 bg-gradient-to-br from-white to-green-50 p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="rounded-full bg-gradient-to-r from-green-500 to-emerald-500 p-2">
                  <Star className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Your Rank</h3>
              </div>
              {loading ? (
                <p className="text-sm text-gray-500">Loading...</p>
              ) : currentUser ? (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-green-500 to-emerald-500 text-white font-bold text-2xl shadow-lg">
                      #{currentUser.rank}
                    </div>
                    <p className="mt-2 text-2xl font-bold text-gray-900">{currentUser.leaderboardPoints} pts</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-white p-3 border border-gray-100">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Streak</p>
                      <p className="font-semibold text-gray-900">{currentUser.currentStreak} days</p>
                    </div>
                    <div className="rounded-xl bg-white p-3 border border-gray-100">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Best</p>
                      <p className="font-semibold text-gray-900">{currentUser.bestStreak} days</p>
                    </div>
                    <div className="rounded-xl bg-white p-3 border border-gray-100 col-span-2">
                      <p className="text-xs text-gray-500 uppercase tracking-wide">Avg Score</p>
                      <p className="font-semibold text-gray-900">{currentUser.averageInterviewScore}%</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No current user position available.</p>
              )}
            </div>

            <div className="rounded-3xl border border-gray-200 bg-gradient-to-br from-white to-purple-50 p-6 shadow-lg">
              <div className="flex items-center gap-3 mb-4">
                <div className="rounded-full bg-gradient-to-r from-purple-500 to-blue-500 p-2">
                  <TrendingUp className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">How it works</h3>
              </div>
              <ul className="space-y-3 text-sm text-gray-600">
                <li className="flex items-start gap-3">
                  <div className="rounded-full bg-purple-100 p-1 mt-0.5">
                    <Target className="h-3 w-3 text-purple-600" />
                  </div>
                  <span>Complete daily challenges to grow your streak.</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="rounded-full bg-blue-100 p-1 mt-0.5">
                    <Award className="h-3 w-3 text-blue-600" />
                  </div>
                  <span>Finish AI interview sessions to improve your average score.</span>
                </li>
                <li className="flex items-start gap-3">
                  <div className="rounded-full bg-green-100 p-1 mt-0.5">
                    <Trophy className="h-3 w-3 text-green-600" />
                  </div>
                  <span>Leaderboard points increase with consistency and performance.</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
