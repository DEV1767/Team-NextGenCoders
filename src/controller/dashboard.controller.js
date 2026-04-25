import Session from "../model/session.model.js"
import User from "../model/user.model.js"

const getWeekStart = () => {
    const now = new Date()
    const day = now.getDay()
    const diff = now.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(now.setDate(diff))
    monday.setHours(0, 0, 0, 0)
    return monday
}

export const getDashboardSummary = async (req, res) => {
    try {
        const userId = req.user._id
        const user = await User.findById(userId).select("resume username email")

        const totalSessions = await Session.countDocuments({ userId })
        const completedSessions = await Session.countDocuments({ userId, status: "completed" })
        const avgResult = await Session.aggregate([
            { $match: { userId, status: "completed" } },
            { $group: { _id: null, avgScore: { $avg: "$overallScore" } } }
        ])

        const resumeStatus = user?.resume?.url
            ? {
                  uploaded: true,
                  analyzed: user.resume.analyzed || false,
                  score: user.resume.score || 0,
                  feedback: user.resume.feedback || null,
                  fileName: user.resume.fileName || null,
                  analyzedAt: user.resume.analyzedAt || null,
                  canAnalyze: !user.resume.analyzed,
                  buttonLabel: user.resume.analyzed ? "Verified ✓" : "Verify Resume"
              }
            : {
                  uploaded: false,
                  analyzed: false,
                  score: 0,
                  feedback: null,
                  fileName: null,
                  analyzedAt: null,
                  canAnalyze: false,
                  buttonLabel: "Upload Resume First"
              }

        return res.status(200).json({
            success: true,
            summary: {
                totalSessions,
                completedSessions,
                averageScore: Math.round(avgResult?.[0]?.avgScore || 0),
                resume: resumeStatus
            }
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch dashboard summary",
            error: error.message
        })
    }
}

export const getDashboardStats = async (req, res) => {
    try {
        const userId = req.user._id
        const user = await User.findById(userId).select("resume")
        const sessions = await Session.find({ userId }).select("mode status overallScore tabSwitches createdAt")

        const interviewCount = sessions.filter((s) => s.mode === "interview_mock").length
        const mcqCount = sessions.filter((s) => s.mode === "mcq_practice").length
        const abandonedCount = sessions.filter((s) => s.status === "abandoned").length
        const avgScore = sessions.length
            ? Math.round(sessions.reduce((sum, s) => sum + (s.overallScore || 0), 0) / sessions.length)
            : 0

        return res.status(200).json({
            success: true,
            stats: [
                { key: "interviews", label: "Interview Sessions", value: interviewCount },
                { key: "mcq", label: "MCQ Sessions", value: mcqCount },
                { key: "average", label: "Average Score", value: avgScore },
                { key: "abandoned", label: "Abandoned", value: abandonedCount },
                { key: "resume", label: "Resume Uploaded", value: Boolean(user?.resume?.url) ? 1 : 0 }
            ]
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch dashboard stats",
            error: error.message
        })
    }
}

export const getWeeklyActivity = async (req, res) => {
    try {
        const userId = req.user._id
        const start = getWeekStart()

        const data = await Session.aggregate([
            {
                $match: {
                    userId,
                    createdAt: { $gte: start }
                }
            },
            {
                $group: {
                    _id: { $dayOfWeek: "$createdAt" },
                    count: { $sum: 1 }
                }
            }
        ])

        const weekdayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        const normalized = weekdayNames.map((day, index) => {
            const mongoDay = index + 1
            const matched = data.find((item) => item._id === mongoDay)
            return {
                day,
                sessions: matched ? matched.count : 0
            }
        })

        return res.status(200).json({
            success: true,
            weeklyActivity: normalized
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch weekly activity",
            error: error.message
        })
    }
}

export const getScoreTrend = async (req, res) => {
    try {
        const userId = req.user._id
        const latestCompleted = await Session.find({ userId, status: "completed" })
            .sort({ completedAt: -1 })
            .limit(10)
            .select("overallScore completedAt")

        const scoreTrend = latestCompleted
            .reverse()
            .map((item, index) => ({
                index: index + 1,
                score: item.overallScore || 0,
                date: item.completedAt
            }))

        return res.status(200).json({
            success: true,
            scoreTrend
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch score trend",
            error: error.message
        })
    }
}
