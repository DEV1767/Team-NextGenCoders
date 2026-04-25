import Session from "../model/session.model.js"
import User from "../model/user.model.js"

const questionPool = {
    javascript: [
        {
            id: "js-1",
            question: "Which method converts a JSON string into a JavaScript object?",
            options: ["JSON.parse", "JSON.stringify", "Object.from", "parse.JSON"],
            answer: 0
        },
        {
            id: "js-2",
            question: "What is the output type of Array.prototype.map?",
            options: ["Object", "Array", "String", "Boolean"],
            answer: 1
        }
    ],
    dsa: [
        {
            id: "dsa-1",
            question: "Which data structure uses FIFO order?",
            options: ["Stack", "Queue", "Tree", "Graph"],
            answer: 1
        },
        {
            id: "dsa-2",
            question: "What is average time complexity of binary search?",
            options: ["O(n)", "O(log n)", "O(n log n)", "O(1)"],
            answer: 1
        }
    ]
}

export const getMcqQuestions = async (req, res) => {
    const { topic = "javascript", limit = 10 } = req.query
    const parsedLimit = Math.max(1, Math.min(50, Number(limit) || 10))
    const pool = questionPool[String(topic).toLowerCase()] || questionPool.javascript

    return res.status(200).json({
        success: true,
        topic,
        questions: pool.slice(0, parsedLimit).map((q) => ({
            id: q.id,
            question: q.question,
            options: q.options
        }))
    })
}

export const submitMcqAttempt = async (req, res) => {
    try {
        const { attemptedAnswers, score, topic = "javascript" } = req.body

        if (!Array.isArray(attemptedAnswers)) {
            return res.status(400).json({
                success: false,
                message: "attemptedAnswers must be an array"
            })
        }

        // Determine category based on topic
        const codinTopics = ["dsa", "algorithms", "data-structures", "coding"]
        const isCodingTopic = codinTopics.some((t) => String(topic).toLowerCase().includes(t))
        const defaultCategory = isCodingTopic ? "coding" : "theory"

        // Fetch user to check if resume is uploaded
        const user = await User.findById(req.user._id)
        const resumeScore = user?.resume?.url ? 100 : 0

        const session = await Session.create({
            userId: req.user._id,
            mode: "mcq_practice",
            difficulty: "easy",
            targetRole: "MCQ Practice",
            topic: String(topic).toLowerCase(),
            status: "completed",
            overallScore: Number(score) || 0,
            technicalScore: Number(score) || 0,
            clarityScore: Number(score) || 0,
            confidenceScore: Number(score) || 0,
            mcqScore: isCodingTopic ? 0 : Number(score) || 0,
            aptitudeScore: isCodingTopic ? Number(score) || 0 : 0,
            resumeScore: resumeScore,
            finalFeedback: "MCQ attempt submitted",
            roadmap: ["Review incorrect questions", "Practice daily for consistency"],
            questions: attemptedAnswers.map((item, idx) => ({
                questionNumber: idx + 1,
                questionText: String(item.question || `Question ${idx + 1}`),
                questionType: "mcq",
                category: String(item.category || defaultCategory).toLowerCase() === "coding" ? "coding" : "theory",
                options: Array.isArray(item.options) ? item.options : [],
                correctOptionIndex: typeof item.correctOptionIndex === "number" ? item.correctOptionIndex : null,
                userAnswer: String(item.selectedOptionIndex ?? ""),
                answerMode: "text",
                score: item.isCorrect ? 100 : 0,
                feedback: item.isCorrect ? "Correct" : "Incorrect",
                answeredAt: new Date()
            })),
            completedAt: new Date(),
            durationMinutes: 0
        })

        return res.status(201).json({
            success: true,
            message: "MCQ attempt submitted",
            attemptId: session._id
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to submit MCQ attempt",
            error: error.message
        })
    }
}

export const getMcqProgress = async (req, res) => {
    try {
        const attempts = await Session.find({ userId: req.user._id, mode: "mcq_practice" })
            .sort({ createdAt: -1 })
            .limit(20)

        const totalAttempts = attempts.length
        const averageScore = totalAttempts
            ? Math.round(attempts.reduce((sum, item) => sum + (item.overallScore || 0), 0) / totalAttempts)
            : 0

        return res.status(200).json({
            success: true,
            progress: {
                totalAttempts,
                averageScore,
                latestAttempts: attempts.map((item) => ({
                    id: item._id,
                    score: item.overallScore,
                    createdAt: item.createdAt
                }))
            }
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch MCQ progress",
            error: error.message
        })
    }
}
