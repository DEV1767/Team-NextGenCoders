import User from "../model/user.model.js"

export const getLeaderboard = async (req, res) => {
    try {
        const users = await User.find({})
            .select("username collegeName challengeStats interviewStats leaderboardPoints")
            .sort({ leaderboardPoints: -1, "challengeStats.challengesCompleted": -1, "interviewStats.averageInterviewScore": -1 })
            .lean()

        const topUsers = users.slice(0, 10).map((user, index) => ({
            rank: index + 1,
            username: user.username,
            collegeName: user.collegeName,
            currentStreak: user.challengeStats?.currentStreak || 0,
            bestStreak: user.challengeStats?.bestStreak || 0,
            challengesCompleted: user.challengeStats?.challengesCompleted || 0,
            averageInterviewScore: user.interviewStats?.averageInterviewScore || 0,
            leaderboardPoints: user.leaderboardPoints || 0
        }))

        const currentIndex = users.findIndex((user) => String(user._id) === String(req.user._id))
        const currentRank = currentIndex === -1 ? null : currentIndex + 1
        const currentUser = currentIndex === -1 ? null : users[currentIndex]

        const neighborStart = currentIndex > 3 ? currentIndex - 3 : 0
        const neighborEnd = Math.min(users.length, (currentIndex === -1 ? 0 : currentIndex + 4))
        const neighbors = users.slice(neighborStart, neighborEnd).map((user, index) => ({
            rank: neighborStart + index + 1,
            username: user.username,
            collegeName: user.collegeName,
            currentStreak: user.challengeStats?.currentStreak || 0,
            bestStreak: user.challengeStats?.bestStreak || 0,
            challengesCompleted: user.challengeStats?.challengesCompleted || 0,
            averageInterviewScore: user.interviewStats?.averageInterviewScore || 0,
            leaderboardPoints: user.leaderboardPoints || 0
        }))

        return res.status(200).json({
            success: true,
            topUsers,
            currentUser: currentUser
                ? {
                    rank: currentRank,
                    username: currentUser.username,
                    collegeName: currentUser.collegeName,
                    currentStreak: currentUser.challengeStats?.currentStreak || 0,
                    bestStreak: currentUser.challengeStats?.bestStreak || 0,
                    challengesCompleted: currentUser.challengeStats?.challengesCompleted || 0,
                    averageInterviewScore: currentUser.interviewStats?.averageInterviewScore || 0,
                    leaderboardPoints: currentUser.leaderboardPoints || 0
                }
                : null,
            neighbors
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to load leaderboard",
            error: error.message
        })
    }
}
