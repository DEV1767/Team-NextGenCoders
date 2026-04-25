import User from "../model/user.model.js"

const DAY_MS = 24 * 60 * 60 * 1000

const isSameCalendarDay = (a, b) => {
    if (!a || !b) return false
    const dateA = new Date(a)
    const dateB = new Date(b)
    return dateA.getUTCFullYear() === dateB.getUTCFullYear()
        && dateA.getUTCMonth() === dateB.getUTCMonth()
        && dateA.getUTCDate() === dateB.getUTCDate()
}

const isYesterday = (date) => {
    if (!date) return false
    const today = new Date()
    const yesterday = new Date(today.getTime() - DAY_MS)
    return isSameCalendarDay(date, yesterday)
}

const nextChallengeType = (lastType = "mcq") => {
    return lastType === "interview" ? "mcq" : "interview"
}

const calculateStreakBadge = (streak) => {
    if (streak >= 100) return "Gold"
    if (streak >= 30) return "Silver"
    if (streak >= 7) return "Bronze"
    return "None"
}

export const computeLeaderboardPoints = ({ currentStreak = 0, challengesCompleted = 0, averageInterviewScore = 0 } = {}) => {
    const score = (Number(currentStreak) * 10)
        + (Number(challengesCompleted) * 5)
        + (Number(averageInterviewScore) * 2)
    return Math.max(0, Math.round(score))
}

const buildInterviewChallenge = (role = "General") => ({
    type: "interview",
    prompt: `Describe a real problem you solved in ${role} interview context. Explain your approach, trade-offs, and results.`,
    category: "behavioral",
    difficulty: "medium"
})

const buildMcqChallenge = (role = "General") => ({
    type: "mcq",
    prompt: `Which statement is most important for ${role} preparation?`,
    options: [
        "Practice explanation and reasoning alongside code",
        "Focus only on memorizing answers",
        "Avoid revising the fundamentals",
        "Complete as many questions as possible without reflection"
    ],
    correctOptionIndex: 0,
    category: "theory",
    difficulty: "medium"
})

const extractJsonFromText = (text = "") => {
    if (typeof text !== "string") return null
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    try {
        return JSON.parse(jsonMatch[0])
    } catch {
        return null
    }
}

const evaluateChallengeAnswerWithAI = async ({ prompt, userAnswer, challengeType, options = [] }) => {
    const apiKey = process.env.INTERVIEW_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY
    if (!apiKey) {
        throw new Error("OpenRouter API key is not configured")
    }

    let evaluationPrompt = ""
    if (challengeType === "interview") {
        evaluationPrompt = `You are an experienced interview coach evaluating a candidate's response to an interview question.

QUESTION/PROMPT:
"${prompt}"

CANDIDATE ANSWER:
"${userAnswer}"

Provide constructive feedback on:
1. Answer structure (problem-solving approach)
2. Clarity and communication
3. Technical depth
4. Areas for improvement

Return ONLY valid JSON:
{
  "score": <integer 0-100>,
  "feedback": "<detailed feedback up to 100 words>",
  "strengths": ["strength1", "strength2"],
  "improvements": ["area1", "area2"]
}
`
    } else {
        evaluationPrompt = `You are evaluating a student's response to a multiple-choice question.

QUESTION/PROMPT:
"${prompt}"

OPTIONS:
${options.map((opt, idx) => `${String.fromCharCode(65 + idx)}. ${opt}`).join("\n")}

STUDENT ANSWER:
"${userAnswer}"

Evaluate their response and provide feedback.

Return ONLY valid JSON:
{
  "score": <integer 0-100>,
  "feedback": "<feedback up to 80 words>",
  "isCorrect": true/false,
  "explanation": "<why this is correct or incorrect>"
}
`
    }

    const messages = [
        { role: "system", content: "You are a helpful educational evaluator. Return valid JSON only. No extra text." },
        { role: "user", content: evaluationPrompt }
    ]

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "openai/gpt-3.5-turbo",
            messages,
            temperature: 0.7,
            max_tokens: 400
        })
    })

    if (!response.ok) {
        const text = await response.text()
        throw new Error(`OpenRouter request failed ${response.status}: ${text}`)
    }

    const data = await response.json()
    const text = data?.choices?.[0]?.message?.content || ""
    const parsed = extractJsonFromText(text)
    if (!parsed) {
        throw new Error("OpenRouter returned invalid JSON")
    }

    const score = Number(parsed?.score)
    return {
        score: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0,
        feedback: parsed?.feedback || "Good attempt!",
        strengths: parsed?.strengths || [],
        improvements: parsed?.improvements || [],
        isCorrect: parsed?.isCorrect,
        explanation: parsed?.explanation
    }
}

export const getDailyChallenge = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" })
        }

        const stats = user.challengeStats || {}
        const lastDate = stats.lastChallengeDate
        const completedToday = isSameCalendarDay(lastDate, new Date())
        const nextType = nextChallengeType(stats.lastChallengeType || "mcq")
        const challengeType = completedToday ? (stats.lastChallengeType || nextType) : nextType
        const role = user.role || "General"
        const challenge = challengeType === "interview"
            ? buildInterviewChallenge(role)
            : buildMcqChallenge(role)

        return res.status(200).json({
            success: true,
            challenge: {
                ...challenge,
                completedToday,
                currentStreak: stats.currentStreak || 0,
                bestStreak: stats.bestStreak || 0,
                streakBadge: stats.streakBadge || "None",
                challengesCompleted: stats.challengesCompleted || 0
            }
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to load daily challenge",
            error: error.message
        })
    }
}

export const submitDailyChallenge = async (req, res) => {
    try {
        const { challengeType } = req.body
        const allowedTypes = ["interview", "mcq"]

        if (!allowedTypes.includes(challengeType)) {
            return res.status(400).json({
                success: false,
                message: `Invalid challenge type. Allowed types: ${allowedTypes.join(", ")}`
            })
        }

        const user = await User.findById(req.user._id)
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" })
        }

        const stats = user.challengeStats || {}
        const lastDate = stats.lastChallengeDate
        const today = new Date()

        if (isSameCalendarDay(lastDate, today)) {
            return res.status(400).json({
                success: false,
                message: "Daily challenge already submitted for today"
            })
        }

        const streakContinues = isYesterday(lastDate)
        const currentStreak = streakContinues ? (stats.currentStreak || 0) + 1 : 1
        const bestStreak = Math.max(stats.bestStreak || 0, currentStreak)
        const challengesCompleted = (stats.challengesCompleted || 0) + 1
        const streakBadge = calculateStreakBadge(currentStreak)

        user.challengeStats = {
            currentStreak,
            bestStreak,
            challengesCompleted,
            streakBadge,
            lastChallengeDate: today,
            lastChallengeType: challengeType
        }

        user.leaderboardPoints = computeLeaderboardPoints({
            currentStreak,
            challengesCompleted,
            averageInterviewScore: user.interviewStats?.averageInterviewScore || 0
        })

        await user.save()

        return res.status(200).json({
            success: true,
            message: "Daily challenge submitted",
            challengeStats: user.challengeStats,
            leaderboardPoints: user.leaderboardPoints
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to submit daily challenge",
            error: error.message
        })
    }
}

export const evaluateChallengeAnswer = async (req, res) => {
    try {
        const { challengeType, userAnswer, prompt, options } = req.body

        if (!userAnswer || !String(userAnswer).trim()) {
            return res.status(400).json({
                success: false,
                message: "Please provide an answer to evaluate."
            })
        }

        if (!challengeType || !["interview", "mcq"].includes(challengeType)) {
            return res.status(400).json({
                success: false,
                message: "Invalid challenge type."
            })
        }

        const evaluation = await evaluateChallengeAnswerWithAI({
            prompt: prompt || "Daily Challenge",
            userAnswer: String(userAnswer).trim(),
            challengeType,
            options: options || []
        })

        return res.status(200).json({
            success: true,
            evaluation
        })
    } catch (error) {
        console.error("Challenge evaluation failed:", error)
        return res.status(500).json({
            success: false,
            message: "Failed to evaluate challenge answer",
            error: error.message
        })
    }
}

export const resetDailyChallenge = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" })
        }

        const stats = user.challengeStats || {}
        const today = new Date()

        if (!isSameCalendarDay(stats.lastChallengeDate, today)) {
            return res.status(400).json({
                success: false,
                message: "No daily challenge submission found for today to reset"
            })
        }

        user.challengeStats.lastChallengeDate = null
        user.challengeStats.lastChallengeType = "none"
        user.challengeStats.currentStreak = Math.max(0, (stats.currentStreak || 0) - 1)
        user.challengeStats.challengesCompleted = Math.max(0, (stats.challengesCompleted || 0) - 1)
        user.challengeStats.streakBadge = calculateStreakBadge(user.challengeStats.currentStreak)

        user.leaderboardPoints = computeLeaderboardPoints({
            currentStreak: user.challengeStats.currentStreak,
            challengesCompleted: user.challengeStats.challengesCompleted,
            averageInterviewScore: user.interviewStats?.averageInterviewScore || 0
        })

        await user.save()

        return res.status(200).json({
            success: true,
            message: "Daily challenge reset successfully",
            challengeStats: user.challengeStats,
            leaderboardPoints: user.leaderboardPoints
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to reset daily challenge",
            error: error.message
        })
    }
}
