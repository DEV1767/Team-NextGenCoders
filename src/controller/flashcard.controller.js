import Flashcard from "../model/flashcard.model.js"

const REVIEW_DELAY_BY_DIFFICULTY = {
    easy: 1,
    medium: 2,
    hard: 3
}

const normalizeDifficulty = (index) => {
    if (index === 0) return "easy"
    if (index === 1) return "medium"
    return "hard"
}

const reviewDelayForDifficulty = (difficulty = "medium") => {
    return REVIEW_DELAY_BY_DIFFICULTY[difficulty] || REVIEW_DELAY_BY_DIFFICULTY.medium
}

const computeNextReviewAt = (status, delayDays) => {
    const now = new Date()
    if (status === "unseen") {
        return now
    }
    return new Date(now.getTime() + (delayDays || 1) * 24 * 60 * 60 * 1000)
}

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

const callOpenRouterJson = async ({ prompt, systemPrompt = "You are a helpful assistant. Return valid JSON only. No extra text.", apiKey, model = "openai/gpt-oss-20b:free", temperature = 0.2, maxTokens = 250 }) => {
    const key = apiKey || process.env.INTERVIEW_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY
    if (!key) {
        throw new Error("OpenRouter API key is not configured")
    }

    const messages = [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
    ]

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model,
            messages,
            temperature,
            max_tokens: maxTokens
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
    return parsed
}

const evaluateFlashcardAnswerWithAI = async ({ question, answer, userAnswer }) => {
    const prompt = `You are a strict technical interviewer evaluating a candidate's flashcard answer. Be critical and thorough.

QUESTION:
"${question}"

EXPECTED ANSWER:
"${answer}"

CANDIDATE ANSWER:
"${userAnswer}"

Evaluate the candidate's answer:
- Check for accuracy, completeness, and understanding
- Penalize for missing key points, incorrect information, or vagueness
- Give partial credit for partially correct answers
- Be especially strict for technical concepts

Return ONLY JSON with these fields:
{
  "score": <integer 0-100, be strict: 90-100 for excellent, 70-89 for good, 50-69 for partial, 0-49 for poor>,
  "feedback": "<specific, constructive feedback up to 60 words. Point out what's missing or incorrect>",
  "match": "yes" | "no"  // Only "yes" if answer is comprehensive and accurate
}
`
    try {
        const result = await callOpenRouterJson({ prompt })
        const score = Number(result?.score)
        return {
            score: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : 0,
            feedback: String(result?.feedback || "Review the expected answer and try again."),
            match: result?.match === "yes" ? "yes" : "no"
        }
    } catch (error) {
        console.warn("[flashcard AI eval]", error.message)
        const fallbackScore = Math.min(100, Math.max(0, Math.floor((String(userAnswer || "")).length / 10)))
        return {
            score: fallbackScore,
            feedback: "Unable to analyze with AI, but your answer was recorded.",
            match: fallbackScore >= 85 ? "yes" : "no"
        }
    }
}

const buildFlashcardForTopic = (topic, role, dayNumber, index) => {
    const difficulty = normalizeDifficulty(index)
    const reviewAfterDays = reviewDelayForDifficulty(difficulty)
    const baseTopic = String(topic || "core concept").trim()

    // Generate different questions based on difficulty
    let question, answer

    switch (difficulty) {
        case "easy":
            question = `What is ${baseTopic} in the context of ${role} responsibilities?`
            answer = `${baseTopic} is a fundamental concept. It refers to [basic definition]. It matters because [simple importance]. Apply it when [basic use case].`
            break
        case "medium":
            question = `Explain ${baseTopic} in the context of ${role} responsibilities. What is it, why does it matter, and when should it be applied?`
            answer = `Focus on ${baseTopic} with a concise definition, a practical example, and one key caveat. Use this concept when solving ${role}-related problems.`
            break
        case "hard":
            question = `Analyze ${baseTopic} in ${role} responsibilities. What are its key components, potential challenges, and advanced applications?`
            answer = `Deep analysis of ${baseTopic}: Key components include [detailed breakdown]. Challenges involve [complex issues]. Advanced applications require [sophisticated approaches]. Consider edge cases like [specific scenarios].`
            break
        default:
            question = `Explain ${baseTopic} in the context of ${role} responsibilities.`
            answer = `Basic explanation of ${baseTopic} for ${role} role.`
    }

    // Stagger initial review times to avoid showing same question multiple times
    const initialDelayDays = index // 0=easy (immediate), 1=medium (1 day), 2=hard (2 days)
    const nextReviewAt = new Date(Date.now() + initialDelayDays * 24 * 60 * 60 * 1000)

    return {
        question,
        answer,
        category: baseTopic,
        difficulty,
        tags: [role || "General", baseTopic, "weak area"],
        status: "unseen",
        dayNumber,
        reviewAfterDays,
        nextReviewAt
    }
}

export const createFlashcardsForSession = async (session, userId, weakTopics = []) => {
    if (!session || !userId) return []

    const normalizedTopics = new Map()
    if (Array.isArray(weakTopics)) {
        weakTopics.forEach((topic) => {
            const cleanTopic = String(topic || "").trim()
            const normalized = cleanTopic.toLowerCase()
            if (cleanTopic && !normalizedTopics.has(normalized)) {
                normalizedTopics.set(normalized, cleanTopic)
            }
        })
    }

    const uniqueTopics = Array.from(normalizedTopics.values())

    if (!uniqueTopics.length) {
        console.log(`[Flashcard] No weak topics found for session ${session._id}`)
        return []
    }

    console.log(`[Flashcard] Processing ${uniqueTopics.length} unique topics:`, uniqueTopics)

    // Delete existing flashcards for this session first
    const deletedCount = await Flashcard.countDocuments({ userId, sessionId: session._id })
    await Flashcard.deleteMany({ userId, sessionId: session._id })
    console.log(`[Flashcard] Deleted ${deletedCount} existing flashcards for session ${session._id}`)

    // Get existing flashcards for this user to avoid duplicates (same topic + difficulty or same question)
    const existingCards = await Flashcard.find({ userId }).select('category difficulty question')
    const existingTopicDifficulties = new Set(
        existingCards.map(card => `${card.category.toLowerCase().trim()}-${card.difficulty}`)
    )
    const existingQuestions = new Set(
        existingCards.map(card => String(card.question || "").trim())
    )
    console.log(`[Flashcard] Found ${existingCards.length} existing flashcards for user`)

    const flashcards = []
    const newQuestionSet = new Set()

    uniqueTopics.forEach((topic, topicIndex) => {
        const dayNumber = topicIndex + 1
        for (let cardIndex = 0; cardIndex < 3; cardIndex += 1) {
            const difficulty = normalizeDifficulty(cardIndex)
            const topicKey = `${topic.toLowerCase().trim()}-${difficulty}`
            const flashcardData = buildFlashcardForTopic(topic, session.targetRole || "General", dayNumber, cardIndex)
            const questionKey = String(flashcardData.question || "").trim()

            if (existingTopicDifficulties.has(topicKey) || existingQuestions.has(questionKey) || newQuestionSet.has(questionKey)) {
                console.log(`[Flashcard] Skipped duplicate: ${topic} (${difficulty}) ${existingTopicDifficulties.has(topicKey) ? '[topic+difficulty]' : ''}${existingQuestions.has(questionKey) ? '[existing question]' : ''}${newQuestionSet.has(questionKey) ? '[new duplicate question]' : ''}`)
                continue
            }

            newQuestionSet.add(questionKey)
            flashcards.push({
                userId,
                sessionId: session._id,
                ...flashcardData
            })
            console.log(`[Flashcard] Created: ${topic} (${difficulty})`)
        }
    })

    console.log(`[Flashcard] Created ${flashcards.length} new flashcards for session ${session._id}`)
    return Flashcard.insertMany(flashcards)
}

export const getAllFlashcards = async (req, res) => {
    try {
        const cards = await Flashcard.find({ userId: req.user._id }).sort({ createdAt: -1 })

        return res.status(200).json({
            success: true,
            flashcards: cards
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch flashcards",
            error: error.message
        })
    }
}

export const getDueFlashcards = async (req, res) => {
    try {
        const now = new Date()
        const allCards = await Flashcard.find({ userId: req.user._id })
        const cards = await Flashcard.find({
            userId: req.user._id,
            nextReviewAt: { $lte: now }
        }).sort({ dayNumber: 1, difficulty: 1, createdAt: 1 })

        const uniqueCards = []
        const seenQuestions = new Set()
        cards.forEach((card) => {
            const questionKey = String(card.question || "").trim()
            if (!seenQuestions.has(questionKey)) {
                seenQuestions.add(questionKey)
                uniqueCards.push(card)
            }
        })

        console.log(`[Flashcards] User ${req.user._id}: ${allCards.length} total cards, ${cards.length} due, ${uniqueCards.length} unique due`)
        if (allCards.length > 0) {
            console.log(`[Flashcards] Next review dates:`, allCards.map(c => ({ id: c._id, nextReviewAt: c.nextReviewAt, status: c.status })))
        }

        return res.status(200).json({
            success: true,
            flashcards: uniqueCards,
            debug: {
                totalCards: allCards.length,
                dueCards: cards.length,
                uniqueDueCards: uniqueCards.length
            }
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch flashcards",
            error: error.message
        })
    }
}

export const reviewFlashcard = async (req, res) => {
    try {
        const { status } = req.body
        const allowedStatuses = ["unseen", "learning", "mastered"]

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Allowed statuses: ${allowedStatuses.join(", ")}`
            })
        }

        const card = await Flashcard.findOne({
            _id: req.params.id,
            userId: req.user._id
        })

        if (!card) {
            return res.status(404).json({
                success: false,
                message: "Flashcard not found"
            })
        }

        card.status = status
        card.reviewAfterDays = reviewDelayForDifficulty(card.difficulty)
        card.nextReviewAt = computeNextReviewAt(status, card.reviewAfterDays)
        await card.save()

        return res.status(200).json({
            success: true,
            flashcard: card
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to update flashcard",
            error: error.message
        })
    }
}

export const answerFlashcard = async (req, res) => {
    try {
        const { userAnswer } = req.body
        if (!userAnswer || !String(userAnswer).trim()) {
            return res.status(400).json({
                success: false,
                message: "Please provide an answer to evaluate."
            })
        }

        const card = await Flashcard.findOne({
            _id: req.params.id,
            userId: req.user._id
        })

        if (!card) {
            return res.status(404).json({
                success: false,
                message: "Flashcard not found"
            })
        }

        const evaluation = await evaluateFlashcardAnswerWithAI({
            question: card.question,
            answer: card.answer,
            userAnswer: String(userAnswer).trim()
        })

        const mastered = evaluation.match === "yes" || evaluation.score >= 85
        card.status = mastered ? "mastered" : "learning"
        card.reviewAfterDays = reviewDelayForDifficulty(card.difficulty)
        card.nextReviewAt = computeNextReviewAt(card.status, card.reviewAfterDays)
        await card.save()

        return res.status(200).json({
            success: true,
            flashcard: card,
            score: evaluation.score,
            feedback: evaluation.feedback,
            isMastered: mastered
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to evaluate flashcard answer",
            error: error.message
        })
    }
}
