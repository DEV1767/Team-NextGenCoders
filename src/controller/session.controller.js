import User from "../model/user.model.js"
import Session from "../model/session.model.js"
import { startSessionValidator } from "../middleware/joi.validator.js"
import Groq from "groq-sdk"
import {
    clearInterviewLoopState,
    getInterviewLoopState,
    saveInterviewLoopState
} from "../utils/redis.utils.js"
import {
    logAiCacheHit,
    logAiFailure,
    logAiFallback,
    logAiRequest,
    logAiSuccess
} from "../utils/ai.logger.js"
import { createFlashcardsForSession } from "../controller/flashcard.controller.js"
import { computeLeaderboardPoints } from "../controller/challenge.controller.js"

const codingKeywords = [
    "code",
    "coding",
    "algorithm",
    "complexity",
    "array",
    "string",
    "binary tree",
    "graph",
    "dynamic programming",
    "sql",
    "query"
]

const normalizeModeForValidation = (mode = "") => {
    if (mode === "mcq_practise") return "mcq_practice"
    if (mode === "live_interview") return "interview_mock"
    return mode
}

const modeForClient = (mode = "") => {
    if (mode === "interview_mock") return "live_interview"
    return mode
}

const isCodingQuestion = (text = "") => {
    const value = text.toLowerCase()
    return codingKeywords.some((keyword) => value.includes(keyword))
}

const isCodingAptitudeRequest = ({ role = "", topic = "" } = {}) => {
    const value = `${String(role || "")} ${String(topic || "")}`.toLowerCase()
    const signals = [
        "aptitude",
        "coding aptitude",
        "programming logic",
        "oops",
        "dbms",
        "operating systems",
        "computer networks",
        "code"
    ]
    return signals.some((signal) => value.includes(signal))
}

const average = (arr = []) => {
    if (!arr.length) return 0
    return Math.round(arr.reduce((sum, item) => sum + item, 0) / arr.length)
}

const compactText = (value = "", maxLength = 0) => {
    const text = String(value || "").replace(/\s+/g, " ").trim()
    return maxLength > 0 ? text.slice(0, maxLength) : text
}

const normalizeJobRecommendation = (item = {}) => {
    const title = compactText(item?.job_title || item?.title || "", 120)
    const employerName = compactText(item?.employer_name || item?.company_name || "", 100)
    const location = compactText(
        item?.job_city && item?.job_country
            ? `${item.job_city}, ${item.job_country}`
            : item?.job_location || item?.location || "Remote",
        120
    )
    const applyUrl = compactText(item?.job_apply_link || item?.job_google_link || item?.apply_url || "", 260)

    return {
        title,
        employerName,
        employerLogo: compactText(item?.employer_logo || "", 260),
        location,
        employmentType: compactText(item?.job_employment_type || item?.employment_type || item?.type || "", 40),
        salaryRange: compactText(item?.salary || item?.salary_range || item?.job_salary || "", 80),
        description: compactText(item?.job_description || "", 280),
        applyUrl,
        source: "jsearch"
    }
}

const fetchRelevantJobsForRole = async ({ role = "", location = "india", limit = 5 } = {}) => {
    const apiKey = process.env.JSEARCH_API_KEY
    if (!apiKey) return []

    const endpoint = process.env.JSEARCH_API_URL || "https://jsearch.p.rapidapi.com/search"
    const queryRole = compactText(role, 80)
    if (!queryRole) return []

    const url = new URL(endpoint)
    url.searchParams.set("query", `${queryRole} in ${location}`)
    url.searchParams.set("page", "1")
    url.searchParams.set("num_pages", "1")

    const host = process.env.JSEARCH_API_HOST || "jsearch.p.rapidapi.com"
    const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
            "x-rapidapi-key": apiKey,
            "x-rapidapi-host": host
        }
    })

    if (!response.ok) {
        throw new Error(`JSearch request failed with status ${response.status}`)
    }

    const payload = await response.json().catch(() => ({}))
    const jobs = Array.isArray(payload?.data) ? payload.data : []

    return jobs
        .slice(0, Math.max(1, Math.min(10, Number(limit) || 5)))
        .map((item) => normalizeJobRecommendation(item))
        .filter((item) => item.title && item.applyUrl)
}

const normalizeAnswerSignal = (value = "") => String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

const isLowSignalAnswer = (value = "") => {
    const normalized = normalizeAnswerSignal(value)
    if (!normalized) return true

    const fillerSet = new Set([
        "hmm",
        "hmmm",
        "uh",
        "uhh",
        "umm",
        "ok",
        "okay",
        "yes",
        "no",
        "idk",
        "i dont know",
        "i do not know",
        "dont know",
        "do not know",
        "skip",
        "pass",
        "na",
        "n a"
    ])

    if (fillerSet.has(normalized)) return true
    return normalized.length < 8
}

const filterMeaningfulInterviewAnswers = (questions = []) => {
    return (Array.isArray(questions) ? questions : []).filter((item) => {
        const answer = compactText(item?.userAnswer || "", 1200)
        return Boolean(item?.answeredAt) && !isLowSignalAnswer(answer)
    })
}

const RESUME_PERSONALIZED_QUESTION_LIMIT = 3
const INTERVIEW_MIN_CODING_QUESTIONS = 1
const INTERVIEW_TARGET_CODING_QUESTIONS = 2
const INTERVIEW_MAX_RESUME_CONTEXT_CHARS = 220
const INTERVIEW_MAX_LAST_ANSWER_CHARS = 180
const INTERVIEW_TURN_MAX_ANSWER_CHARS = 1000
const INTERVIEW_TURN_HISTORY_LIMIT = 4
const INTERVIEW_TURN_HISTORY_ANSWER_CHARS = 150
const INTERVIEW_CLARIFICATION_PER_QUESTION_LIMIT = 1
const INTERVIEW_CLARIFICATION_TOTAL_LIMIT = 2

const countCodingQuestions = (history = []) => history.filter((item) => item?.category === "coding").length

const shouldForceCodingQuestion = ({ totalAsked = 0, codingAsked = 0 } = {}) => {
    return totalAsked > 0 && codingAsked < INTERVIEW_TARGET_CODING_QUESTIONS
}

const buildResumeInterviewSummary = (resumeText = "") => {
    const cleaned = compactText(resumeText, 6000)
    if (!cleaned) return ""

    const lines = cleaned
        .split(/[\n\r]+|\s*•\s*|\s*\|\s*/)
        .map((item) => compactText(item, 120))
        .filter(Boolean)

    const summary = lines.slice(0, 6).join("; ")
    return compactText(summary || cleaned, 420)
}

const compactHistoryForPrompt = (history = [], limit = 6, answerLength = 240) => {
    return history.slice(-limit).map((item) => ({
        questionText: compactText(item?.questionText, 160),
        category: compactText(item?.category, 40),
        score: Number(item?.score || 0),
        userAnswer: compactText(item?.userAnswer, answerLength)
    }))
}

const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile"
const GROQ_CACHE_TTL_MS = 2 * 60 * 1000
const GROQ_MAX_RETRIES = 2
const GROQ_RATE_LIMIT_COOLDOWN_MS = 35 * 60 * 1000

const AI_FEATURE_CONFIG = {
    default: { maxTokens: 650, temperature: 0.45 },
    mcq: { maxTokens: 700, temperature: 0.8 },
    "question-gen": { maxTokens: 700, temperature: 0.65 },
    interview: { maxTokens: 700, temperature: 0.45 },
    "interview-next": { maxTokens: 300, temperature: 0.55 },
    "interview-turn": { maxTokens: 360, temperature: 0.45 },
    "interview-eval": { maxTokens: 220, temperature: 0.25 },
    "interview-hints": { maxTokens: 120, temperature: 0.35 },
    "interview-clarify": { maxTokens: 180, temperature: 0.25 },
    "interview-vague": { maxTokens: 140, temperature: 0.3 },
    "interview-verdict": { maxTokens: 120, temperature: 0.25 },
    "interview-readiness": { maxTokens: 180, temperature: 0.25 },
    "interview-analysis": { maxTokens: 900, temperature: 0.35 }
}

const resolveAiConfig = ({ feature = "default", maxTokens, temperature } = {}) => {
    const base = AI_FEATURE_CONFIG[feature] || AI_FEATURE_CONFIG.default
    const resolvedMaxTokens = Number.isFinite(Number(maxTokens)) && Number(maxTokens) > 0
        ? Math.round(Number(maxTokens))
        : base.maxTokens
    const resolvedTemperature = Number.isFinite(Number(temperature))
        ? Math.max(0, Math.min(1, Number(temperature)))
        : base.temperature

    return {
        maxTokens: resolvedMaxTokens,
        temperature: resolvedTemperature
    }
}

const groqResponseCache = new Map()
const groqInFlightRequests = new Map()
let groqBlockedUntil = 0

const getCacheKey = (prompt, systemPrompt, options = {}) => `${GROQ_MODEL}::${options?.maxTokens || "na"}::${options?.temperature || "na"}::${systemPrompt || ""}::${prompt}`

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const isRateLimitError = (error) => {
    const status = Number(error?.status || error?.response?.status || error?.error?.status)
    const message = String(error?.message || error?.error?.message || "").toLowerCase()
    return status === 429 || message.includes("rate limit") || message.includes("too many requests")
}

const isTransientAiError = (error) => {
    const status = Number(error?.status || error?.response?.status || error?.error?.status)
    return status === 429 || status === 503 || isRateLimitError(error)
}

const logAiBackend = (feature, provider) => {
    console.log(`[AI:${feature}] Using ${provider}`)
}

const estimateTokenCount = (text = "") => {
    const normalized = String(text || "").trim()
    if (!normalized) return 0

    return Math.max(1, Math.ceil(normalized.length / 4))
}

const extractJsonFromText = (text = "") => {
    const trimmed = String(text).trim()
    if (!trimmed) return null

    const codeBlockMatch = trimmed.match(/```json\s*([\s\S]*?)```/i) || trimmed.match(/```\s*([\s\S]*?)```/i)
    const candidate = codeBlockMatch ? codeBlockMatch[1].trim() : trimmed

    try {
        return JSON.parse(candidate)
    } catch {
        const firstBrace = candidate.indexOf("{")
        const lastBrace = candidate.lastIndexOf("}")
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            const sliced = candidate.slice(firstBrace, lastBrace + 1)
            return JSON.parse(sliced)
        }
        return null
    }
}

const callGroqJson = async (prompt, systemPrompt, aiOptions = {}) => {
    const sysMsg = systemPrompt || "You are a helpful assistant. Return valid JSON only. No markdown, no explanation, no extra text."
    const { maxTokens, temperature } = resolveAiConfig(aiOptions)
    // Collect all available Groq API keys (prioritized order)
    const groqKeys = [
        process.env.GROQ_API_KEY,      // New key 1 (highest priority)
        process.env.GROQ_API_KEY_2,    // New key 2 (medium priority)
        process.env.GROQ_API_KEY_3     // Current key (lowest priority/fallback)
    ].filter(Boolean)

    if (groqKeys.length === 0) {
        throw new Error("No Groq API keys configured")
    }

    if (Date.now() < groqBlockedUntil) {
        const cooldownMinutes = Math.max(1, Math.ceil((groqBlockedUntil - Date.now()) / 60000))
        const error = new Error(`Groq is temporarily rate limited. Try again in about ${cooldownMinutes} minute(s).`)
        error.status = 429
        throw error
    }

    const cacheKey = getCacheKey(prompt, sysMsg, { maxTokens, temperature })
    const cached = groqResponseCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
        logAiCacheHit({
            feature: aiOptions?.feature || "unknown",
            provider: "Groq",
            model: GROQ_MODEL,
            promptTokens: estimateTokenCount(prompt),
            systemPromptTokens: estimateTokenCount(systemPrompt)
        })
        return cached.value
    }

    if (groqInFlightRequests.has(cacheKey)) {
        return groqInFlightRequests.get(cacheKey)
    }

    const requestPromise = (async () => {
        // Try each Groq key in sequence
        for (let keyIndex = 0; keyIndex < groqKeys.length; keyIndex++) {
            const groqKey = groqKeys[keyIndex]
            const keyLabel = keyIndex === 0 ? "Primary" : `Fallback ${keyIndex}`
            const client = new Groq({
                apiKey: groqKey
            })

            logAiRequest({
                feature: aiOptions?.feature || "unknown",
                provider: `Groq ${keyLabel}`,
                model: GROQ_MODEL,
                promptTokens: estimateTokenCount(prompt),
                systemPromptTokens: estimateTokenCount(systemPrompt),
                maxTokens,
                temperature
            })

            let lastError = null

            for (let attempt = 0; attempt <= GROQ_MAX_RETRIES; attempt += 1) {
            try {
                let message
                try {
                    message = await client.chat.completions.create({
                        model: GROQ_MODEL,
                        max_tokens: maxTokens,
                        temperature,
                        response_format: { type: "json_object" },
                        messages: [
                            {
                                role: "system",
                                content: sysMsg
                            },
                            {
                                role: "user",
                                content: prompt
                            }
                        ]
                    })
                } catch {
                    // Fallback for models/endpoints that may not support response_format
                    message = await client.chat.completions.create({
                        model: GROQ_MODEL,
                        max_tokens: maxTokens,
                        temperature,
                        messages: [
                            {
                                role: "system",
                                content: sysMsg
                            },
                            {
                                role: "user",
                                content: prompt
                            }
                        ]
                    })
                }

                const text = message.choices?.[0]?.message?.content || ""
                const parsed = extractJsonFromText(text)

                if (!parsed) {
                    throw new Error("Groq returned invalid JSON")
                }

                groqResponseCache.set(cacheKey, {
                    value: parsed,
                    expiresAt: Date.now() + GROQ_CACHE_TTL_MS
                })

                logAiSuccess({
                    feature: aiOptions?.feature || "unknown",
                    provider: `Groq ${keyLabel}`,
                    model: GROQ_MODEL,
                    promptTokens: estimateTokenCount(prompt),
                    maxTokens,
                    temperature
                })

                return parsed
            } catch (error) {
                lastError = error
                if (!isRateLimitError(error) || attempt === GROQ_MAX_RETRIES) {
                    if (isRateLimitError(error)) {
                        groqBlockedUntil = Date.now() + GROQ_RATE_LIMIT_COOLDOWN_MS
                    }
                    logAiFailure({
                        feature: aiOptions?.feature || "unknown",
                        provider: `Groq ${keyLabel}`,
                        model: GROQ_MODEL,
                        message: error?.message || "Groq request failed"
                    })

                    // If this is not the last key, continue to next key
                    if (keyIndex < groqKeys.length - 1) {
                        console.warn(`[AI:groq] Groq ${keyLabel} failed, trying next key...`)
                        break // Break retry loop to try next key
                    } else {
                        throw error // Last key failed, throw error
                    }
                }

                groqBlockedUntil = Date.now() + GROQ_RATE_LIMIT_COOLDOWN_MS
                const backoffMs = 500 * (attempt + 1)
                await sleep(backoffMs)
            }
        }

        // If we get here, all retries for this key failed, continue to next key
    }

    throw lastError || new Error("All Groq API keys failed")
    })()

    groqInFlightRequests.set(cacheKey, requestPromise)

    try {
        return await requestPromise
    } finally {
        groqInFlightRequests.delete(cacheKey)
    }
}

const callOpenRouterJson = async ({ feature = "ai", prompt, systemPrompt, apiKey, primaryModel, maxTokens, temperature }) => {
    const aiConfig = resolveAiConfig({ feature, maxTokens, temperature })
    if (process.env.GROQ_API_KEY) {
        logAiBackend(feature, `Groq (${process.env.GROQ_MODEL || GROQ_MODEL})`)
        console.log(`[AI:${feature}] token estimate`, {
            systemPromptTokens: estimateTokenCount(systemPrompt),
            promptTokens: estimateTokenCount(prompt),
            maxTokens: aiConfig.maxTokens,
            temperature: aiConfig.temperature
        })
        return callGroqJson(prompt, systemPrompt, { feature, ...aiConfig })
    }

    const key = apiKey || process.env.OPENROUTER_API_KEY || process.env.INTERVIEW_OPENROUTER_API_KEY
    const modelFromEnv = feature === "interview"
        ? process.env.INTERVIEW_OPENROUTER_MODEL
        : process.env.OPENROUTER_MODEL
    const modelPrimary = primaryModel || modelFromEnv || "openai/gpt-oss-20b:free"

    const fallbackModels = [
        modelPrimary,
        "openai/gpt-oss-20b:free",
        "openai/gpt-oss-120b",
        "mistral/mistral-7b-instruct:free"
    ]

    if (!key) {
        throw new Error("OPENROUTER API key is missing")
    }

    const messages = [
        {
            role: "system",
            content: systemPrompt || "You are a helpful assistant. Return valid JSON only. No markdown, no explanation, no extra text."
        },
        {
            role: "user",
            content: prompt
        }
    ]

    let lastError = null

    for (const model of [...new Set(fallbackModels)]) {
        try {
            logAiBackend(feature, `OpenRouter (${model})`)
            logAiRequest({
                feature,
                provider: "OpenRouter",
                model,
                promptTokens: estimateTokenCount(prompt),
                systemPromptTokens: estimateTokenCount(systemPrompt),
                maxTokens: aiConfig.maxTokens,
                temperature: aiConfig.temperature
            })
            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${key}`,
                    "Content-Type": "application/json",
                    ...(process.env.OPENROUTER_HTTP_REFERER ? { "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER } : {}),
                    ...(process.env.OPENROUTER_APP_TITLE ? { "X-OpenRouter-Title": process.env.OPENROUTER_APP_TITLE } : {})
                },
                body: JSON.stringify({
                    model,
                    messages,
                    temperature: aiConfig.temperature,
                    max_tokens: aiConfig.maxTokens
                })
            })

            if (!response.ok) {
                const errorText = await response.text()
                const error = new Error(`OpenRouter API error ${response.status}: ${errorText}`)
                error.status = response.status
                throw error
            }

            const data = await response.json()
            const text = data?.choices?.[0]?.message?.content || ""
            const parsed = extractJsonFromText(text)
            if (!parsed) {
                throw new Error("OpenRouter returned invalid JSON")
            }

            logAiSuccess({
                feature,
                provider: "OpenRouter",
                model,
                promptTokens: estimateTokenCount(prompt),
                maxTokens: aiConfig.maxTokens,
                temperature: aiConfig.temperature
            })

            return parsed
        } catch (error) {
            lastError = error
            if (!isTransientAiError(error)) {
                logAiFailure({
                    feature,
                    provider: "OpenRouter",
                    model,
                    message: error?.message || "OpenRouter request failed"
                })
                break
            }
            await sleep(250)
        }
    }

    throw lastError || new Error("OpenRouter request failed")
}

const callInterviewOpenRouterJson = async (prompt, systemPrompt, options = {}) => {
    const aiConfig = resolveAiConfig(options)
    if (process.env.GROQ_API_KEY) {
        logAiBackend("interview", `Groq (${process.env.GROQ_MODEL || GROQ_MODEL})`)
        return callGroqJson(prompt, systemPrompt, { feature: options?.feature || "interview", ...aiConfig })
    }

    const apiKey = process.env.INTERVIEW_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY
    if (!apiKey) {
        throw new Error("GROQ_API_KEY is missing (or configure OpenRouter fallback keys)")
    }

    return callOpenRouterJson({
        feature: options?.feature || "interview",
        prompt,
        systemPrompt,
        apiKey,
        primaryModel: process.env.INTERVIEW_OPENROUTER_MODEL || process.env.OPENROUTER_MODEL || "openai/gpt-oss-20b:free",
        ...aiConfig
    })
}

const callInterviewJson = async (prompt, systemPrompt, options = {}) => {
    const feature = options?.feature || "interview"
    const aiConfig = resolveAiConfig({ feature, ...options })

    // Collect all available Groq API keys (prioritized order)
    const groqKeys = [
        process.env.GROQ_API_KEY,      // New key 1 (highest priority)
        process.env.GROQ_API_KEY_2,    // New key 2 (medium priority)
        process.env.GROQ_API_KEY_3     // Current key (lowest priority/fallback)
    ].filter(Boolean)

    const hasOpenRouter = process.env.INTERVIEW_OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY

    if (groqKeys.length === 0 && !hasOpenRouter) {
        throw new Error("No AI API keys configured for interview")
    }

    console.log("[AI:interview] token estimate", {
        systemPromptTokens: estimateTokenCount(systemPrompt),
        promptTokens: estimateTokenCount(prompt),
        feature,
        maxTokens: aiConfig.maxTokens,
        temperature: aiConfig.temperature,
        availableProviders: {
            groqKeys: groqKeys.length,
            openRouter: !!hasOpenRouter
        }
    })

    // Try Groq keys first (primary and fallbacks)
    for (let i = 0; i < groqKeys.length; i++) {
        const groqKey = groqKeys[i]
        const keyLabel = i === 0 ? "Primary" : `Fallback ${i}`
        const modelName = process.env.GROQ_MODEL || GROQ_MODEL

        try {
            logAiBackend(feature, `Groq ${keyLabel} (${modelName})`)
            console.log(`[AI:interview] trying Groq ${keyLabel}`)

            const client = new Groq({ apiKey: groqKey })

            let message
            try {
                message = await client.chat.completions.create({
                    model: modelName,
                    max_tokens: aiConfig.maxTokens,
                    temperature: aiConfig.temperature,
                    response_format: { type: "json_object" },
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: prompt }
                    ]
                })
            } catch {
                message = await client.chat.completions.create({
                    model: modelName,
                    max_tokens: aiConfig.maxTokens,
                    temperature: aiConfig.temperature,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: prompt }
                    ]
                })
            }

            const text = message.choices?.[0]?.message?.content || ""
            const parsed = extractJsonFromText(text)

            if (!parsed) {
                throw new Error("Invalid JSON response from Groq")
            }

            logAiSuccess({
                feature,
                provider: `Groq ${keyLabel}`,
                model: modelName
            })

            return parsed

        } catch (error) {
            console.warn(`[AI:interview] Groq ${keyLabel} failed:`, error.message)
            logAiFallback({
                feature,
                provider: `Groq ${keyLabel}`,
                model: modelName,
                reason: `Groq ${keyLabel} failed: ${error.message}`
            })

            // Continue to next Groq key if available
            if (i < groqKeys.length - 1) {
                continue
            }
        }
    }

    // Try OpenRouter as final fallback
    if (hasOpenRouter) {
        try {
            logAiBackend(feature, `OpenRouter (${process.env.INTERVIEW_OPENROUTER_MODEL || process.env.OPENROUTER_MODEL || "openai/gpt-oss-20b:free"})`)
            return await callInterviewOpenRouterJson(prompt, systemPrompt, { feature, ...aiConfig })
        } catch (error) {
            console.warn("[AI:interview] OpenRouter failed:", error.message)
            logAiFallback({
                feature,
                provider: "OpenRouter",
                model: process.env.INTERVIEW_OPENROUTER_MODEL || process.env.OPENROUTER_MODEL || "openai/gpt-oss-20b:free",
                reason: `Final fallback failed: ${error.message}`
            })
        }
    }

    // All providers failed
    throw new Error("All AI providers failed - no fallback available")
}

const evaluateAnswerWithAI = async ({ question, userAnswer, role, difficulty }) => {
    const prompt = `
You are a senior ${role} interviewer evaluating a candidate's answer.
Be fair, professional, evidence-based, and non-demotivating.

---
CONTEXT:
- Role: ${role}
- Difficulty: ${difficulty}
- Question: "${question.questionText}"
- Question Category: ${question.category}

---
CANDIDATE ANSWER:
"${userAnswer}"

---
SCORING GUIDE:
- 0–30: Off-topic or mostly incorrect
- 31–55: Partial understanding, major gaps
- 56–75: Mostly correct, some missing depth or precision
- 76–89: Strong and clear, minor gaps
- 90–100: Excellent, precise and well-reasoned

---
RULES:
- Mention at least one strength when possible
- Keep feedback objective and constructive
- Max 45 words for feedback
- Do not use insulting or discouraging language
- Sound like a real interviewer note, not a robot

---
Return ONLY this JSON, no extra text:
{
    "score": <integer 0-100>,
    "feedback": "<short evaluator note, max 45 words>"
}
`

    try {
        const result = await callInterviewJson(prompt, null, { feature: "interview-eval" })
        const clamp = (val) => Math.max(0, Math.min(100, Math.round(Number(val) || 0)))

        return {
            score: clamp(result?.score),
            feedback: String(result?.feedback || "Review this concept for deeper understanding.")
        }
    } catch {
        // Fallback if AI fails
        const answerLength = userAnswer?.length || 0
        const fallbackScore = Math.min(100, Math.max(0, Math.floor(answerLength / 8)))
        logAiFallback({
            feature: "interview-eval",
            provider: process.env.GROQ_API_KEY ? "Groq" : "OpenRouter",
            model: process.env.GROQ_API_KEY ? (process.env.GROQ_MODEL || GROQ_MODEL) : (process.env.INTERVIEW_OPENROUTER_MODEL || process.env.OPENROUTER_MODEL || "openai/gpt-oss-20b:free"),
            reason: "Using local fallback scoring for answer evaluation"
        })
        return {
            score: fallbackScore,
            feedback: "Answer recorded. Practice structured responses and review key concepts."
        }
    }
}

const generateQuestionsWithAI = async ({ mode, role, topic, difficulty, questionCount, resumeText, avoidQuestionTexts = [] }) => {
    const diffLabel = String(difficulty || "medium").toLowerCase()
    const selectedTopic = String(topic || "").trim()
    const mcqTopic = selectedTopic || String(role || "general knowledge").trim() || "general knowledge"
    const codingAptitudeMode = mode === "mcq_practice" && isCodingAptitudeRequest({ role, topic: mcqTopic })
    const generationSeed = mode === "mcq_practice"
        ? `${Date.now()}-${Math.floor(Math.random() * 1000000)}`
        : "stable"
    const resumeSummary = compactText(resumeText || "No resume provided", 1200)
    const bannedQuestionSignatures = new Set(
        (Array.isArray(avoidQuestionTexts) ? avoidQuestionTexts : [])
            .map((item) => normalizeQuestionText(String(item || "")))
            .filter(Boolean)
    )
    const seenQuestionTexts = new Set([...bannedQuestionSignatures])
    const fallbackOffset = Math.floor(Math.random() * 1000) % 8

    console.log("[generateQuestionsWithAI] start", {
        mode,
        role,
        topic: mcqTopic,
        difficulty: diffLabel,
        questionCount,
        bannedQuestions: bannedQuestionSignatures.size
    })

    let diffRules = ""
    if (diffLabel === "basic") {
        diffRules = "BASIC: Only fundamental beginner questions. No prior experience assumed. Examples: What is a REST API? What is a database? NO advanced topics."
    } else if (diffLabel === "easy") {
        diffRules = "EASY: Beginner-friendly questions only. Examples: What is REST? How do you handle errors? Explain transactions. NO complex optimization or system design."
    } else if (diffLabel === "medium") {
        diffRules = "MEDIUM: Realistic workplace-level questions. Examples: Tell me about a feature you built. How would you debug this? What trade-offs would you consider?"
    } else if (diffLabel === "hard") {
        diffRules = "HARD: Challenging senior-level questions. Examples: Design a solution for millions of requests. Walk through a complex architectural decision."
    } else {
        diffRules = "ADVANCE: Expert-level questions for senior professionals. Examples: Design highly scalable distributed systems. Deep trade-off and architectural pattern analysis."
    }

    const categoryDistribution = {
        basic: "80% theory, 20% behavioral, 0% coding",
        easy: "60% theory, 30% behavioral, 10% coding",
        medium: "40% theory, 30% behavioral, 30% coding",
        hard: "20% theory, 20% behavioral, 60% coding",
        advance: "10% theory, 10% behavioral, 80% coding"
    }

    const codingAptitudeDistribution = {
        basic: "70% coding, 30% theory, 0% behavioral",
        easy: "70% coding, 30% theory, 0% behavioral",
        medium: "80% coding, 20% theory, 0% behavioral",
        hard: "90% coding, 10% theory, 0% behavioral",
        advance: "90% coding, 10% theory, 0% behavioral"
    }

    const fallbackQuestions = [
        (index) => ({
            questionText: `Question ${index + 1}: Which concept is most important when working with ${mcqTopic}?`,
            options: [
                `Core ${mcqTopic} fundamentals`,
                `A feature unrelated to ${mcqTopic}`,
                `A shortcut that skips ${mcqTopic} basics`,
                `A random assumption about ${mcqTopic}`
            ]
        }),
        (index) => ({
            questionText: `Question ${index + 1}: What is the best practical use of ${mcqTopic} in a real project?`,
            options: [
                `Use ${mcqTopic} to solve a production problem`,
                `Avoid ${mcqTopic} completely`,
                `Use ${mcqTopic} only for theory`,
                `Memorize ${mcqTopic} without context`
            ]
        }),
        (index) => ({
            questionText: `Question ${index + 1}: Which choice best shows a solid understanding of ${mcqTopic}?`,
            options: [
                `Explain the trade-offs of ${mcqTopic}`,
                `Guess the answer without reasoning`,
                `Use unrelated terminology instead of ${mcqTopic}`,
                `Pick the longest option`
            ]
        }),
        (index) => ({
            questionText: `Question ${index + 1}: When would you apply ${mcqTopic} in a frontend workflow?`,
            options: [
                `When it improves structure or performance`,
                `Only when asked in interviews`,
                `Never, because it is optional`,
                `Only for styling pages`
            ]
        }),
        (index) => ({
            questionText: `Question ${index + 1}: Which option best reflects strong ${mcqTopic} fundamentals?`,
            options: [
                `Understanding ${mcqTopic} and explaining why it matters`,
                `Memorizing one example only`,
                `Ignoring edge cases`,
                `Copying code without understanding`
            ]
        }),
        (index) => ({
            questionText: `Question ${index + 1}: What should you verify first before using ${mcqTopic} in production?`,
            options: [
                `Correctness, readability, and fit for the use case`,
                `Whether it looks impressive`,
                `Whether it is the newest trend`,
                `Whether it has the longest name`
            ]
        }),
        (index) => ({
            questionText: `Question ${index + 1}: Which habit most improves ${mcqTopic} knowledge over time?`,
            options: [
                `Practice and review real use cases`,
                `Rely only on memorization`,
                `Skip practice after reading once`,
                `Ignore mistakes and move on`
            ]
        }),
        (index) => ({
            questionText: `Question ${index + 1}: Which scenario is the best match for ${mcqTopic}?`,
            options: [
                `Solving a real frontend problem with ${mcqTopic}`,
                `Choosing a random tool without a reason`,
                `Using ${mcqTopic} only because it is popular`,
                `Avoiding the topic entirely`
            ]
        })
    ]

    const prompt = `
${mode === "mcq_practice"
        ? "You are an AI quiz generator creating MCQs for a user-selected topic."
        : `You are a ${role} interviewer generating interview questions.`}

---
CANDIDATE PROFILE:
${mode === "mcq_practice" ? `
- Selected Topic: ${mcqTopic}
- Use the selected topic as the only subject area for every question.
- Do not use resume details or candidate history to influence the questions.
- Avoid repeating common, overused beginner quiz phrasing.
` : `
- Target Role: ${role}
- Resume Summary: ${resumeSummary}
`}

---
SESSION CONFIG:
- Mode: ${mode}
- Difficulty: ${diffLabel}
- Total Questions Needed: ${questionCount}
- Generation Seed: ${generationSeed}

---
DIFFICULTY RULES — Follow strictly:
${diffRules}

---
CATEGORY DISTRIBUTION for ${diffLabel} difficulty:
${codingAptitudeMode
    ? (codingAptitudeDistribution[diffLabel] || codingAptitudeDistribution["medium"])
    : (categoryDistribution[diffLabel] || categoryDistribution["medium"])}

---
QUESTION RULES:
- ${mode === "mcq_practice" ? `Keep every question tightly focused on ${mcqTopic}. Do not drift into unrelated resume-based skills or experience.` : "Personalize questions using the candidate's resume skills where possible"}
- Keep each question under 35 words
- Make questions conversational, not textbook-style
- Progressively increase difficulty across the set
- No repeated or similar questions
- ${mode === "mcq_practice" ? "Use the Generation Seed to produce a fresh question set every call. Avoid recycling the same common quiz wording across different requests." : "Keep questions context-aware and non-repetitive."}

${mode === "mcq_practice" ? `
MCQ RULES:
- Every question must be type "mcq"
- Every question must have exactly 4 options
- correctOptionIndex must be 0, 1, 2, or 3
- Options must be realistic and not obviously wrong
- Keep option order varied across questions; do not always place the strongest answer in the same slot
- ${codingAptitudeMode
    ? "At least 70% questions must be category='coding'. Use code snippets/output prediction, bug finding, dry run, complexity, SQL logic, and OOP/OS/CN scenario questions."
    : "Use theory/behavioral/coding mix based on requested topic and difficulty."}
` : `
INTERVIEW RULES:
- Mix of coding, theory, and behavioral questions
- Include some questions based on candidate's resume skills
- Include realistic workplace scenarios
`}

---
Return ONLY this JSON, no extra text:
{
  "questions": [
    {
      "questionNumber": 1,
      "questionText": "...",
      "questionType": "${mode === "mcq_practice" ? "mcq" : "interview"}",
      "category": "coding" | "theory" | "behavioral",
      "options": ["...", "...", "...", "..."],
      "correctOptionIndex": 0,
      "tone": "normal" | "fun"
    }
  ]
}

For interview mode, options must be an empty array [].
For mcq mode, correctOptionIndex must be a number 0-3.
`

    const normalizedQuestions = []

    const normalizeMcqOptions = (rawOptions = [], rawCorrectIndex = 0) => {
        const options = Array.isArray(rawOptions)
            ? rawOptions.map((opt) => String(opt || "").trim()).filter(Boolean).slice(0, 4)
            : []

        while (options.length < 4) {
            options.push(`Option ${String.fromCharCode(65 + options.length)}`)
        }

        const safeCorrectIndex = Number.isInteger(rawCorrectIndex) && rawCorrectIndex >= 0 && rawCorrectIndex <= 3
            ? rawCorrectIndex
            : 0

        const withMeta = options.map((text, idx) => ({
            text,
            isCorrect: idx === safeCorrectIndex
        }))

        // Shuffle options so correct answer is not always in the same position.
        for (let i = withMeta.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1))
            const temp = withMeta[i]
            withMeta[i] = withMeta[j]
            withMeta[j] = temp
        }

        return {
            options: withMeta.map((item) => item.text),
            correctOptionIndex: withMeta.findIndex((item) => item.isCorrect)
        }
    }

    const pushQuestion = (questionText, options, correctOptionIndex = 0, category = "theory") => {
        const trimmedText = String(questionText || "").trim()
        if (!trimmedText) return false
        const signature = normalizeQuestionText(trimmedText)
        if (seenQuestionTexts.has(signature)) return false

        let safeOptions = options
        let safeCorrectIndex = correctOptionIndex
        if (mode === "mcq_practice") {
            const normalizedMcq = normalizeMcqOptions(options, correctOptionIndex)
            safeOptions = normalizedMcq.options
            safeCorrectIndex = normalizedMcq.correctOptionIndex
        }

        seenQuestionTexts.add(signature)
        normalizedQuestions.push({
            questionNumber: normalizedQuestions.length + 1,
            questionText: trimmedText,
            questionType: mode === "mcq_practice" ? "mcq" : "interview",
            category,
            options: safeOptions,
            correctOptionIndex: safeCorrectIndex,
            tone: "normal",
            answerMode: category === "coding" ? "text" : "voice",
            userAnswer: "",
            score: 0,
            feedback: "",
            answeredAt: null
        })
        return true
    }

    const disallowedTextList = [...bannedQuestionSignatures]
        .filter(Boolean)
        .slice(0, 30)
        .map((text) => `- ${text}`)
        .join("\n")

    const maxAiAttempts = mode === "mcq_practice" ? 3 : 1
    let aiError = null

    for (let attempt = 1; attempt <= maxAiAttempts; attempt += 1) {
        if (normalizedQuestions.length >= questionCount) break

        try {
            if (mode === "mcq_practice" && process.env.GROQ_API_KEY) {
                logAiBackend("mcq", `Groq (${process.env.GROQ_MODEL || GROQ_MODEL})`)
            }

            const attemptPrompt = mode === "mcq_practice"
                ? `${prompt}\n\nATTEMPT: ${attempt}\n${disallowedTextList ? `DISALLOWED QUESTION TEXTS (do not repeat or closely paraphrase):\n${disallowedTextList}\n` : ""}`
                : prompt

            const parsed = await callOpenRouterJson({
                feature: mode === "mcq_practice" ? "mcq" : "question-gen",
                prompt: attemptPrompt,
                primaryModel: process.env.OPENROUTER_MODEL || "openai/gpt-oss-20b:free",
                maxTokens: 700,
                temperature: mode === "mcq_practice" ? 0.8 : 0.65
            })

            const rawQuestions = Array.isArray(parsed?.questions) ? parsed.questions : []
            console.log("[generateQuestionsWithAI] ai response", {
                attempt,
                receivedQuestions: rawQuestions.length,
                requestedQuestions: questionCount,
                acceptedQuestions: normalizedQuestions.length
            })

            for (const q of rawQuestions.slice(0, questionCount)) {
                if (normalizedQuestions.length >= questionCount) break

                const questionText = String(q?.questionText || q?.question || `Question ${normalizedQuestions.length + 1}`)
                const questionType = mode === "mcq_practice" ? "mcq" : "interview"
                const options = questionType === "mcq"
                    ? Array.isArray(q?.options) && q.options.length === 4
                        ? q.options.map((opt) => String(opt))
                        : ["Option A", "Option B", "Option C", "Option D"]
                    : []

                const safeCorrectIndex = Number.isInteger(q?.correctOptionIndex) && q.correctOptionIndex >= 0 && q.correctOptionIndex <= 3
                    ? q.correctOptionIndex
                    : (questionType === "mcq" ? 0 : null)

                const category = ["coding", "theory", "behavioral"].includes(q?.category)
                    ? q.category
                    : (questionType === "mcq"
                        ? (codingAptitudeMode || isCodingQuestion(questionText) ? "coding" : "theory")
                        : (isCodingQuestion(questionText) ? "coding" : "behavioral"))

                pushQuestion(questionText, options, safeCorrectIndex, category)
            }
        } catch (error) {
            aiError = error
            console.error("[generateQuestionsWithAI] AI generation attempt failed:", error?.message || error)
        }
    }

    if (normalizedQuestions.length >= questionCount) {
        console.log("[generateQuestionsWithAI] completed with AI questions", {
            topic: mcqTopic,
            totalQuestions: normalizedQuestions.length
        })
        return normalizedQuestions
    }

    console.warn("[generateQuestionsWithAI] filling remaining questions with fallback", {
        topic: mcqTopic,
        aiQuestions: normalizedQuestions.length,
        requestedQuestions: questionCount,
        error: aiError?.message || null
    })

    for (let idx = normalizedQuestions.length; idx < questionCount; idx += 1) {
        const templateFactory = fallbackQuestions[(idx + fallbackOffset) % fallbackQuestions.length]
        const template = templateFactory(idx)

        const correctIndex = 0

        pushQuestion(
            template.questionText,
            template.options,
            correctIndex,
            "theory"
        )
    }

    console.log("[generateQuestionsWithAI] completed with fallback fill", {
        topic: mcqTopic,
        totalQuestions: normalizedQuestions.length
    })

    return normalizedQuestions
}

const normalizeInterviewQuestion = (question = {}, questionNumber = 1) => {
    const questionText = String(question?.questionText || `Interview question ${questionNumber}`)
    const category = ["coding", "theory", "behavioral"].includes(question?.category)
        ? question.category
        : (isCodingQuestion(questionText) ? "coding" : "behavioral")

    return {
        questionNumber,
        questionText,
        questionType: "interview",
        category,
        options: [],
        correctOptionIndex: null,
        tone: question?.tone === "fun" ? "fun" : "normal",
        answerMode: question?.answerMode === "voice" || question?.answerMode === "text"
            ? question.answerMode
            : (category === "coding" ? "text" : "voice")
    }
}

const normalizeQuestionText = (text = "") => String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()

const pickFallbackInterviewQuestion = ({ role, questionNumber, history = [], forceCoding = false }) => {
    const roleLabel = String(role || "this role").trim()
    const fallbackPool = [
        {
            questionText: `What are the core concepts someone in a ${roleLabel} role should understand first?`,
            category: "theory",
            tone: "normal",
            answerMode: "voice"
        },
        {
            questionText: `How would you debug a production issue in a ${roleLabel} feature step by step?`,
            category: "coding",
            tone: "normal",
            answerMode: "text"
        },
        {
            questionText: `How do you decide between a simple solution and a more scalable one in ${roleLabel} work?`,
            category: "theory",
            tone: "normal",
            answerMode: "voice"
        },
        {
            questionText: `Tell me about a time you had to learn a ${roleLabel} concept quickly and apply it under pressure.`,
            category: "behavioral",
            tone: "normal",
            answerMode: "voice"
        },
        {
            questionText: `If a ${roleLabel} solution is performing poorly, what would you check first and why?`,
            category: "coding",
            tone: "normal",
            answerMode: "text"
        }
    ]

    const askedSet = new Set(history.map((item) => normalizeQuestionText(item?.questionText)))
    const unseen = fallbackPool.filter((item) => !askedSet.has(normalizeQuestionText(item.questionText)))
    const unseenCoding = unseen.filter((item) => item.category === "coding")
    const sourcePool = forceCoding
        ? (unseenCoding.length ? unseenCoding : fallbackPool.filter((item) => item.category === "coding"))
        : (unseen.length ? unseen : fallbackPool)

    const selected = sourcePool.length
        ? sourcePool[(questionNumber - 1) % sourcePool.length]
        : {
            questionText: `Walk me through one challenging ${roleLabel} problem you solved and how you validated your solution.`,
            category: forceCoding ? "coding" : "behavioral",
            tone: "normal",
            answerMode: forceCoding ? "text" : "voice"
        }

    return normalizeInterviewQuestion(selected, questionNumber)
}

const generateNextInterviewQuestionWithAI = async ({ role, difficulty, resumeText, history = [], questionNumber = 1, candidateName = "" }) => {
    const roleLabel = String(role || "").trim()
    const diffLabel = String(difficulty || "medium").toLowerCase()
    const nameLabel = String(candidateName || "").trim().split(" ")[0] || "there"
    try {
        const lastItem = history.length > 0 ? history[history.length - 1] : null
        const lastScore = lastItem ? Number(lastItem.score || 0) : null
        const lastAnswer = lastItem ? String(lastItem.userAnswer || "").slice(0, INTERVIEW_MAX_LAST_ANSWER_CHARS) : null
        const lastQuestion = lastItem ? lastItem.questionText : null
        const totalAsked = history.length
        const codingAskedCount = countCodingQuestions(history)
        const forceCodingQuestion = shouldForceCodingQuestion({ totalAsked, codingAsked: codingAskedCount })
        const resumeContext = compactText(resumeText || "", INTERVIEW_MAX_RESUME_CONTEXT_CHARS)
        const shouldUseResumeContext = totalAsked < RESUME_PERSONALIZED_QUESTION_LIMIT
        const safeResumeContext = shouldUseResumeContext ? (resumeContext || "Not provided") : "Skip resume context now"
        const compactHistory = compactHistoryForPrompt(history, 3, 120)

        let adaptedDiffLabel = diffLabel
        if (lastScore !== null) {
            if (lastScore >= 80 && diffLabel === "easy") adaptedDiffLabel = "medium"
            else if (lastScore >= 80 && diffLabel === "medium") adaptedDiffLabel = "hard"
            else if (lastScore < 40 && diffLabel === "hard") adaptedDiffLabel = "medium"
            else if (lastScore < 40 && diffLabel === "medium") adaptedDiffLabel = "easy"
        }

        let diffRules = ""
        if (adaptedDiffLabel === "basic") {
            diffRules = "Ask only fundamental beginner questions. No prior experience assumed. No advanced topics whatsoever."
        } else if (adaptedDiffLabel === "easy") {
            diffRules = "Ask beginner-friendly questions. Real but simple concepts. No system design or complex optimization."
        } else if (adaptedDiffLabel === "medium") {
            diffRules = "Ask realistic workplace-level questions. Feature building, debugging, trade-offs, moderate depth."
        } else if (adaptedDiffLabel === "hard") {
            diffRules = "Ask challenging questions. Complex design decisions, performance, scalability, senior-level thinking."
        } else {
            diffRules = "Ask expert-level questions. Deep architectural analysis, distributed systems, advanced patterns."
        }

        const categoryDistribution = {
            basic: "80% theory, 20% behavioral, 0% coding",
            easy: "60% theory, 30% behavioral, 10% coding",
            medium: "40% theory, 30% behavioral, 30% coding",
            hard: "20% theory, 20% behavioral, 60% coding",
            advance: "10% theory, 10% behavioral, 80% coding"
        }

        let conversationStage = ""

        if (totalAsked === 0) {
            conversationStage = `
STAGE: WELCOME & INTRODUCTION
This is the very first moment of the interview. Be warm, casual, and human.
- Greet ${nameLabel} by name in a relaxed friendly way
- Ask how they are doing and express hope they are fine
- Mention that you will go through their resume and discuss various points
- Do NOT ask any technical question here at all
- Tone should feel like a friendly senior colleague, not a formal HR person
- Example: "Hey ${nameLabel}! Good morning, how are you? Hope you're doing fine. I'll go through your resume and discuss this and that."
`
        } else if (totalAsked === 1) {
            conversationStage = `
STAGE: RESUME QUESTIONS - EXPERIENCE
Ask about their experience from their resume.
- Ask 1 question about their work experience or background
- Keep it simple and conversational
- Example: "Looking at your resume, I see you've worked on [specific experience]. Can you tell me more about that experience?"
RESUME CONTEXT: ${resumeContext || "Not provided"}
`
        } else if (totalAsked === 2) {
            conversationStage = `
STAGE: RESUME QUESTIONS - SKILLS
Ask about their skills from their resume.
- Ask 1 question about their technical skills or technologies
- Keep it basic and straightforward
- Example: "I notice you have experience with [specific skill]. Can you walk me through how you use that skill in your work?"
RESUME CONTEXT: ${resumeContext || "Not provided"}
`
        } else if (totalAsked === 3) {
            conversationStage = `
STAGE: BASIC CODING QUESTION
Ask one small, basic coding question.
- Keep it very simple and beginner-friendly
- Focus on basic logic, debugging, or output prediction
- Make it easy to answer verbally or with simple text
- Example: "Let's do a quick coding exercise. What's the output of this simple code: console.log('Hello' + ' ' + 'World');"
- Category must be "coding"
- answerMode must be "text"
`
        } else {
            conversationStage = `
STAGE: ROLE-SPECIFIC QUESTIONS
Now focus on the ${roleLabel} role.
- Ask practical questions relevant to the ${roleLabel} position
- Keep it conversational and not too complex
- Build on what they've shared so far
- Example: "Based on what you've told me, how do you think your experience would help you in a ${roleLabel} role?"
`
        }

        const historyText = compactHistory.length > 0
            ? compactHistory.map((item, i) => `Q${i + 1}: "${item.questionText}" | A: "${item.userAnswer?.slice(0, 120)}" | Score: ${item.score}`).join("\n")
            : "No history yet — this is the first question."

        const prompt = `
INTERVIEW CONTEXT:
- Candidate: ${nameLabel}
- Role: ${roleLabel}
- Difficulty: ${adaptedDiffLabel} — ${diffRules}
- Resume highlights: ${safeResumeContext}
- Coding questions asked so far: ${codingAskedCount}
- Minimum coding goal: ${INTERVIEW_MIN_CODING_QUESTIONS}
- Target coding goal: ${INTERVIEW_TARGET_CODING_QUESTIONS}

CONVERSATION HISTORY:
${historyText}

YOUR TASK:
${conversationStage}

RULES:
- Stay 100% relevant to ${roleLabel} role only
- One focused question only, under 40 words
- Sound warm and human, not robotic
- You may add a short 1-line transition before the question (max 8 words)
- NEVER number the question or say "Question:"
- Last score: ${lastScore !== null ? lastScore + "/100 — " + (lastScore >= 75 ? "push harder" : lastScore < 50 ? "be supportive and easier" : "keep same pace") : "first question"}
- Category mix for ${adaptedDiffLabel}: ${categoryDistribution[adaptedDiffLabel] || categoryDistribution["medium"]}
- answerMode = "text" ONLY if category is "coding", otherwise "voice"
- Ask at least ${INTERVIEW_MIN_CODING_QUESTIONS} coding question in each interview, and aim for ${INTERVIEW_TARGET_CODING_QUESTIONS}
- If coding questions asked so far are below ${INTERVIEW_TARGET_CODING_QUESTIONS}, prioritize a coding question now
- For basic/easy, coding questions must be beginner-friendly and standard: simple debugging, dry run, output prediction, or basic logic
- Coding questions must expect typed answers in text format (answerMode = "text")
- Resume-based questions allowed only while totalAsked < ${RESUME_PERSONALIZED_QUESTION_LIMIT}
- After that, ask technical and scenario questions only

Return ONLY this JSON:
{
  "questionText": "transition + question here",
  "category": "theory" | "coding" | "behavioral",
  "tone": "normal",
  "answerMode": "voice" | "text"
}
`

        const interviewSystemPrompt = `You are Alex, a friendly and professional ${roleLabel} interviewer at a top tech company. You conduct real, human, conversational job interviews. Return valid JSON only — no markdown, no extra text.`
        const parsed = await callInterviewJson(prompt, interviewSystemPrompt, { feature: "interview-next" })
        const candidateQuestion = normalizeInterviewQuestion(parsed, questionNumber)

        if (!candidateQuestion.questionText) {
            return pickFallbackInterviewQuestion({ role, questionNumber, history, forceCoding: forceCodingQuestion })
        }

        if (forceCodingQuestion && candidateQuestion.category !== "coding") {
            return pickFallbackInterviewQuestion({ role, questionNumber, history, forceCoding: true })
        }

        return candidateQuestion
    } catch (err) {
        console.error("[generateNextInterviewQuestionWithAI] Error:", err?.message || err)
        const forceCodingQuestion = shouldForceCodingQuestion({
            totalAsked: Array.isArray(history) ? history.length : 0,
            codingAsked: countCodingQuestions(history)
        })
        return pickFallbackInterviewQuestion({ role, questionNumber, history, forceCoding: forceCodingQuestion })
    }
}

const evaluateAndGenerateNextInterviewTurnWithAI = async ({
    currentQuestion,
    userAnswer,
    role,
    difficulty,
    resumeText,
    history = [],
    questionNumber = 1,
    candidateName = "",
    generateNextQuestion = true
}) => {
    const roleLabel = String(role || "").trim() || "this role"
    const diffLabel = String(difficulty || "medium").toLowerCase()
    const nameLabel = String(candidateName || "").trim().split(" ")[0] || "there"
    const resumeContext = compactText(resumeText || "", INTERVIEW_MAX_RESUME_CONTEXT_CHARS)
    const historyCount = Array.isArray(history) ? history.length : 0
    const codingAskedBeforeCurrent = countCodingQuestions(history)
    const codingAskedIncludingCurrent = codingAskedBeforeCurrent + (currentQuestion?.category === "coding" ? 1 : 0)
    const forceCodingNextQuestion = generateNextQuestion
        ? shouldForceCodingQuestion({
            totalAsked: historyCount + 1,
            codingAsked: codingAskedIncludingCurrent
        })
        : false
    const shouldUseResumeContext = historyCount < RESUME_PERSONALIZED_QUESTION_LIMIT
    const safeResumeContext = shouldUseResumeContext ? (resumeContext || "Not provided") : "Skip resume context now"
    const compactHistory = history.slice(-INTERVIEW_TURN_HISTORY_LIMIT).map((item, idx) => ({
        questionNumber: item.questionNumber || idx + 1,
        questionText: item.questionText,
        category: item.category,
        score: Number(item.score || 0),
        userAnswer: String(item.userAnswer || "").slice(0, INTERVIEW_TURN_HISTORY_ANSWER_CHARS)
    }))

    const historyText = compactHistory.length
        ? JSON.stringify(compactHistory)
        : "[]"

    const prompt = `
You are Alex, a friendly and professional ${roleLabel} interviewer.
Evaluate the candidate's latest answer and optionally decide the next interview question.

---
CONTEXT:
- Candidate: ${nameLabel}
- Role: ${roleLabel}
- Difficulty: ${diffLabel}
- Resume Highlights: ${safeResumeContext}
- Coding questions asked so far (including current): ${codingAskedIncludingCurrent}
- Minimum coding goal: ${INTERVIEW_MIN_CODING_QUESTIONS}
- Target coding goal: ${INTERVIEW_TARGET_CODING_QUESTIONS}

---
CURRENT QUESTION:
${JSON.stringify({
        questionNumber: currentQuestion?.questionNumber || 1,
        questionText: String(currentQuestion?.questionText || ""),
        category: currentQuestion?.category || "theory",
        answerMode: currentQuestion?.answerMode || "voice"
    })}

---
CANDIDATE ANSWER:
"${String(userAnswer || "").slice(0, INTERVIEW_TURN_MAX_ANSWER_CHARS)}"

---
RECENT CONVERSATION HISTORY (without current answer):
${historyText}

---
TASK:
1) Evaluate the latest answer.
2) If generateNextQuestion is true, produce the next interviewer question based on full conversation flow.

SCORING GUIDE:
- 0-30: Off-topic or mostly incorrect
- 31-55: Partial understanding, major gaps
- 56-75: Mostly correct, some missing depth
- 76-89: Strong and clear, minor gaps
- 90-100: Excellent and precise

RULES:
- feedback must be max 45 words, constructive
- reaction must be one natural interviewer line
- idealAnswer must be max 60 words
- topicsToStudy must contain 2-3 specific topics
- shouldFollowUp is true if answer is vague/incomplete and needs same-topic probing
- If shouldFollowUp is true and generateNextQuestion is true, nextQuestion must be a follow-up on the same topic
- If generateNextQuestion is false, set nextQuestion to null
- nextQuestion.questionText must be under 40 words
- nextQuestion.category must be one of: coding, theory, behavioral
- nextQuestion.answerMode must be "text" only for coding, otherwise "voice"
- Ask at least ${INTERVIEW_MIN_CODING_QUESTIONS} coding question in each interview, and aim for ${INTERVIEW_TARGET_CODING_QUESTIONS}
- If coding questions asked so far are below ${INTERVIEW_TARGET_CODING_QUESTIONS} and generateNextQuestion is true, nextQuestion must be category "coding"
- For basic/easy difficulty, coding must stay beginner-friendly and standard (simple debugging, dry run, output prediction, basic logic)
- Ask resume-related questions only in the first ${RESUME_PERSONALIZED_QUESTION_LIMIT} turns
- After first ${RESUME_PERSONALIZED_QUESTION_LIMIT} turns, nextQuestion must be technical/scenario for ${roleLabel}

Return ONLY this JSON, no extra text:
{
  "score": <integer 0-100>,
  "feedback": "<max 45 words>",
  "reaction": "<one natural line>",
  "idealAnswer": "<max 60 words>",
  "topicsToStudy": ["topic1", "topic2", "topic3"],
  "shouldFollowUp": <true|false>,
  "nextQuestion": {
    "questionText": "...",
    "category": "coding" | "theory" | "behavioral",
    "tone": "normal",
    "answerMode": "voice" | "text"
  }
}

generateNextQuestion: ${generateNextQuestion ? "true" : "false"}
`

    try {
        const parsed = await callInterviewJson(prompt, null, { feature: "interview-turn" })
        const clamp = (val) => Math.max(0, Math.min(100, Math.round(Number(val) || 0)))

        const topicsToStudy = Array.isArray(parsed?.topicsToStudy)
            ? parsed.topicsToStudy.map((item) => String(item).trim()).filter(Boolean).slice(0, 3)
            : []

        let nextQuestion = null
        if (generateNextQuestion) {
            if (parsed?.nextQuestion && typeof parsed.nextQuestion === "object") {
                nextQuestion = normalizeInterviewQuestion(parsed.nextQuestion, questionNumber)
            } else {
                nextQuestion = pickFallbackInterviewQuestion({
                    role,
                    questionNumber,
                    history: [...history, {
                        questionText: currentQuestion?.questionText,
                        userAnswer
                    }],
                    forceCoding: forceCodingNextQuestion
                })
            }

            if (forceCodingNextQuestion && nextQuestion?.category !== "coding") {
                nextQuestion = pickFallbackInterviewQuestion({
                    role,
                    questionNumber,
                    history: [...history, {
                        questionText: currentQuestion?.questionText,
                        category: currentQuestion?.category,
                        userAnswer
                    }],
                    forceCoding: true
                })
            }
        }

        return {
            score: clamp(parsed?.score),
            feedback: String(parsed?.feedback || "Review this concept for deeper understanding."),
            reaction: String(parsed?.reaction || "Thanks for sharing that."),
            idealAnswer: String(parsed?.idealAnswer || "A stronger answer should be concise, role-specific, and include concrete technical reasoning."),
            topicsToStudy: topicsToStudy.length ? topicsToStudy : ["core fundamentals", "applied problem solving"],
            shouldFollowUp: Boolean(parsed?.shouldFollowUp),
            nextQuestion
        }
    } catch {
        logAiFallback({
            feature: mode === "mcq_practice" ? "mcq" : "question-gen",
            provider: process.env.GROQ_API_KEY ? "Groq" : "OpenRouter",
            model: process.env.GROQ_API_KEY ? (process.env.GROQ_MODEL || GROQ_MODEL) : (process.env.OPENROUTER_MODEL || "openai/gpt-oss-20b:free"),
            reason: "Using local fallback question templates"
        })
        const evaluation = await evaluateAnswerWithAI({
            question: currentQuestion,
            userAnswer,
            role,
            difficulty
        })

        const nextQuestion = generateNextQuestion
            ? await generateNextInterviewQuestionWithAI({
                role,
                difficulty,
                resumeText,
                history: [...history, {
                    questionText: currentQuestion?.questionText,
                    category: currentQuestion?.category,
                    userAnswer,
                    score: evaluation.score
                }],
                questionNumber,
                candidateName
            })
            : null

        return {
            ...evaluation,
            reaction: "Interesting, thanks for explaining that.",
            idealAnswer: "A stronger answer would define the concept clearly, include a practical example, explain trade-offs, and conclude with why that approach fits the use case.",
            topicsToStudy: ["core fundamentals", "practical implementation"],
            shouldFollowUp: false,
            nextQuestion
        }
    }
}

const analyzeSessionWithAI = async ({ role, difficulty, questions }) => {
    const answered = questions.filter((q) => q.answeredAt)
    const briefAnswers = answered.map((q) => ({
        questionNumber: q.questionNumber,
        questionText: compactText(q.questionText, 140),
        category: compactText(q.category, 40),
        answerMode: q.answerMode,
        userAnswer: compactText(q.userAnswer, 320),
        score: q.score || 0
    })).slice(-12)

    const answersStr = JSON.stringify(briefAnswers)

    const prompt = `
You are a professional interview coach evaluating a completed ${role} interview.

---
SESSION INFO:
- Role: ${role}
- Difficulty: ${difficulty}
- Total Questions Answered: ${answered.length}

---
CANDIDATE ANSWERS:
${answersStr}

---
EVALUATION RULES:
- Score all metrics from 0 to 100
- overallScore: weighted average of all answers
- technicalScore: based on coding and theory answers only
- clarityScore: based on how clearly and structuredly they answered
- confidenceScore: based on completeness and depth of answers
- finalFeedback: role-specific insight, mention ${role} skills explicitly, max 80 words
- roadmap: exactly 4-5 ${role}-specific actionable learning steps
- weakTopics: array of specific weak topics
- strongTopics: array of specific strong topics
- readinessScore: 0-100 (job readiness for ${role})
- readinessLabel: one of "Not Ready", "Needs Work", "Almost Ready", "Ready"
- perQuestionSummary: one object per answered question with questionText, score, idealAnswer (max 60 words), topicsToStudy (2-3 topics)
- studyPlan: exactly 5 actionable steps, each with a specific resource (docs/course/book/video/practice platform)

---
Return ONLY this JSON, no extra text:
{
  "overallScore": <0-100>,
  "technicalScore": <0-100>,
  "clarityScore": <0-100>,
  "confidenceScore": <0-100>,
  "finalFeedback": "<role-specific feedback string>",
    "roadmap": ["step1", "step2", "step3", "step4", "step5"],
    "weakTopics": ["topic1", "topic2", "topic3"],
    "strongTopics": ["topic1", "topic2", "topic3"],
    "readinessScore": <0-100>,
    "readinessLabel": "Not Ready" | "Needs Work" | "Almost Ready" | "Ready",
    "perQuestionSummary": [
        {
            "questionText": "...",
            "score": <0-100>,
            "idealAnswer": "...",
            "topicsToStudy": ["topic1", "topic2"]
        }
    ],
    "studyPlan": ["step1 with resource", "step2 with resource", "step3 with resource", "step4 with resource", "step5 with resource"]
}
`

    try {
        const parsed = await callInterviewJson(prompt, null, { feature: "interview-analysis" })

        const clamp = (value) => {
            const n = Number(value)
            if (!Number.isFinite(n)) return 0
            return Math.max(0, Math.min(100, Math.round(n)))
        }

        // Calculate breakdown scores from actual questions
        const mcqScore = average(answered.filter((q) => q.questionType === "mcq").map((q) => q.score || 0))
        const aptitudeScore = average(answered.filter((q) => q.questionType === "interview" && q.category === "coding").map((q) => q.score || 0))
        const resumeScore = average(answered.filter((q) => q.questionType === "interview" && q.category !== "coding").map((q) => q.score || 0))

        const allowedReadinessLabels = ["Not Ready", "Needs Work", "Almost Ready", "Ready"]
        const readinessLabel = allowedReadinessLabels.includes(parsed?.readinessLabel)
            ? parsed.readinessLabel
            : (clamp(parsed?.readinessScore) >= 80 ? "Ready" : clamp(parsed?.readinessScore) >= 65 ? "Almost Ready" : clamp(parsed?.readinessScore) >= 45 ? "Needs Work" : "Not Ready")

        const normalizeTopicArray = (value = [], fallback = []) => {
            const normalized = Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : []
            return normalized.length ? normalized.slice(0, 6) : fallback
        }

        const perQuestionSummary = Array.isArray(parsed?.perQuestionSummary)
            ? parsed.perQuestionSummary.map((item, idx) => ({
                questionText: String(item?.questionText || briefAnswers[idx]?.questionText || ""),
                score: clamp(item?.score),
                idealAnswer: String(item?.idealAnswer || "Focus on clear reasoning, practical examples, and trade-offs."),
                topicsToStudy: normalizeTopicArray(item?.topicsToStudy, ["core fundamentals", "practical application"]).slice(0, 3)
            })).slice(0, answered.length)
            : []

        return {
            overallScore: clamp(parsed?.overallScore),
            mcqScore: clamp(mcqScore),
            aptitudeScore: clamp(aptitudeScore),
            resumeScore: clamp(resumeScore),
            technicalScore: clamp(parsed?.technicalScore),
            clarityScore: clamp(parsed?.clarityScore),
            confidenceScore: clamp(parsed?.confidenceScore), // ✅ Fixed typo from confidCenceScore
            finalFeedback: String(parsed?.finalFeedback || "Interview completed. Keep improving consistency and clarity."),
            roadmap: Array.isArray(parsed?.roadmap) && parsed.roadmap.length
                ? parsed.roadmap.slice(0, 6).map((step) => String(step))
                : [
                    "Revise top 10 concepts for your role",
                    "Practice timed coding with explanation",
                    "Improve communication structure",
                    "Take one mock interview weekly"
                ],
            weakTopics: normalizeTopicArray(parsed?.weakTopics, ["advanced depth", "structured explanation"]),
            strongTopics: normalizeTopicArray(parsed?.strongTopics, ["baseline understanding"]),
            readinessScore: clamp(parsed?.readinessScore),
            readinessLabel,
            perQuestionSummary: perQuestionSummary.length
                ? perQuestionSummary
                : briefAnswers.map((item) => ({
                    questionText: item.questionText,
                    score: clamp(item.score),
                    idealAnswer: "A stronger answer should be concise, technically accurate, and include practical trade-offs.",
                    topicsToStudy: ["core fundamentals", "applied reasoning"]
                })),
            studyPlan: Array.isArray(parsed?.studyPlan) && parsed.studyPlan.length
                ? parsed.studyPlan.map((step) => String(step)).slice(0, 5)
                : [
                    `Study ${role} fundamentals using official docs and concise YouTube explainers`,
                    "Solve 5 role-specific problems on LeetCode or HackerRank with written explanations",
                    "Take one mock interview on Pramp/Interviewing.io and review mistakes",
                    "Read one system design or architecture case study relevant to your role",
                    "Build a small project feature and publish a short technical write-up"
                ]
        }
    } catch {
        const overallScore = average(answered.map((q) => q.score || 0))
        const mcqScore = average(answered.filter((q) => q.questionType === "mcq").map((q) => q.score || 0))
        const aptitudeScore = average(answered.filter((q) => q.questionType === "interview" && q.category === "coding").map((q) => q.score || 0))
        const resumeScore = average(answered.filter((q) => q.questionType === "interview" && q.category !== "coding").map((q) => q.score || 0))
        const technicalScore = average(answered.filter((q) => q.category === "coding").map((q) => q.score || 0))
        const clarityScore = average(answered.filter((q) => q.category === "theory").map((q) => q.score || 0))
        const confidenceScore = average(answered.filter((q) => q.answerMode === "voice").map((q) => q.score || 0))
        const readinessScore = overallScore
        const readinessLabel = readinessScore >= 80 ? "Ready" : readinessScore >= 65 ? "Almost Ready" : readinessScore >= 45 ? "Needs Work" : "Not Ready"

        return {
            overallScore,
            mcqScore,
            aptitudeScore,
            resumeScore,
            technicalScore,
            clarityScore,
            confidenceScore,
            finalFeedback: `Your interview performance as a ${role} candidate: ${overallScore}/100 (${difficulty} difficulty). Strengths: structured thinking and staying on-topic. Areas for growth: deepen technical knowledge relevant to ${role}, provide clearer trade-off analysis. Next steps: practice 3 more ${role} mock interviews this week focusing on reasoning.`,
            roadmap: [
                `Review core ${role} technical concepts`,
                "Practice explaining design decisions clearly",
                `Study real-world ${role} challenges and solutions`,
                "Record and review your mock interview responses"
            ],
            weakTopics: ["technical depth", "trade-off articulation"],
            strongTopics: ["structured responses", "staying on topic"],
            readinessScore,
            readinessLabel,
            perQuestionSummary: briefAnswers.map((item) => ({
                questionText: item.questionText,
                score: Math.max(0, Math.min(100, Math.round(Number(item.score) || 0))),
                idealAnswer: "A stronger answer should define the concept, include a concrete real-world example, and explain trade-offs clearly.",
                topicsToStudy: ["core fundamentals", "applied implementation"]
            })),
            studyPlan: [
                `Read official ${role} docs for weak fundamentals and make concise notes`,
                "Complete a role-specific guided course module from Coursera/Udemy this week",
                "Practice 5 interview problems on LeetCode/HackerRank and explain each solution aloud",
                "Watch two high-quality mock interview videos and copy the answer structure",
                "Do one timed mock interview and track recurring weak topics"
            ]
        }
    }
}

// ============= FEATURE: WHISPER COACH (Real-Time Hints) =============
const generateWhisperCoachHints = async ({ question, partialTranscript, role }) => {
    if (!partialTranscript || partialTranscript.trim().length < 8) {
        // Return generic hints if transcript too short
        return { 
            hints: [
                "Stay calm and think clearly",
                "Structure your answer with examples"
            ]
        }
    }

    const prompt = `
You are a silent coach. The candidate is answering this question:
"${String(question || '').slice(0, 150)}"

So far they have said:
"${String(partialTranscript || '').slice(0, 300)}"

What 1-2 KEY POINTS are they missing or should mention next?
Respond as short coaching hints, max 8 words each.
Be supportive, not critical.

Return JSON only:
{ "hints": ["hint1 (under 8 words)", "hint2 (under 8 words)"] }
`

    try {
        const parsed = await callInterviewJson(prompt, null, { feature: "interview-hints" })
        const hints = Array.isArray(parsed?.hints) ? parsed.hints.slice(0, 2) : []
        const validHints = hints.map((h) => String(h).trim()).filter(Boolean)
        
        if (validHints.length === 0) {
            return { hints: ["Think about real examples", "Explain the 'why' clearly"] }
        }
        
        return { hints: validHints }
    } catch {
        // Fallback hints if Groq fails
        return { 
            hints: [
                "Add specific examples",
                "Mention the key concepts"
            ]
        }
    }
}

// ============= FEATURE: VAGUE ANSWER DETECTOR =============
const detectVagueAnswer = async ({ question, answer, role }) => {
    const prompt = `
You are a strict interviewer evaluating if the candidate actually answered the question.

Question: "${String(question || '').slice(0, 150)}"
Candidate answer: "${String(answer || '').slice(0, 600)}"

Did they give a real, substantial answer or was it vague/surface-level/dodging?
If VAGUE: Generate ONE follow-up pressure question to dig deeper on SAME topic.
If GOOD: Set follow_up to null.

Return JSON:
{
  "is_vague": true/false,
  "follow_up": "follow-up question or null"
}
`

    try {
        const parsed = await callInterviewJson(prompt, null, { feature: "interview-vague" })
        return {
            is_vague: Boolean(parsed?.is_vague),
            follow_up: parsed?.is_vague ? String(parsed?.follow_up || "") : null
        }
    } catch {
        return { is_vague: false, follow_up: null }
    }
}

const generateInterviewClarificationWithAI = async ({ role, difficulty, question, doubtText }) => {
    const roleLabel = String(role || "this role").trim()
    const diffLabel = String(difficulty || "medium").toLowerCase()
    const safeQuestion = compactText(question || "", 180)
    const safeDoubt = compactText(doubtText || "", 220)

    const prompt = `
You are Alex, a friendly ${roleLabel} interviewer clarifying a candidate doubt.

CONTEXT:
- Role: ${roleLabel}
- Difficulty: ${diffLabel}
- Current question: "${safeQuestion}"
- Candidate doubt: "${safeDoubt}"

RULES:
- Clarify the question intent only. Do NOT provide the final answer.
- Keep response supportive and natural.
- Max 45 words total.
- If they ask for direct solution/code, refuse politely and guide approach.

Return JSON only:
{
  "clarification": "one concise clarification line",
  "whatInterviewerExpects": "one short expectation line",
  "hint": "optional directional hint"
}
`

    try {
        const parsed = await callInterviewJson(prompt, null, { feature: "interview-clarify" })
        return {
            clarification: compactText(parsed?.clarification || "Good question. Focus on your reasoning and assumptions for this scenario.", 140),
            whatInterviewerExpects: compactText(parsed?.whatInterviewerExpects || "I am looking for your structured approach, not the final perfect solution.", 140),
            hint: compactText(parsed?.hint || "State assumptions, then explain your step-by-step plan.", 100)
        }
    } catch {
        return {
            clarification: "Good question. Please explain your approach and assumptions for this problem.",
            whatInterviewerExpects: "I want your step-by-step thinking and trade-offs, not a perfect final answer.",
            hint: "Start with a simple approach, then refine it."
        }
    }
}

// ============= FEATURE: HIRE / NO-HIRE VERDICT =============
const generateHireNoHireVerdict = async ({ role, difficulty, questions, overallScore, weakTopics, strongTopics }) => {
    const answered = Array.isArray(questions) ? questions.filter((q) => q.answeredAt) : []
    const totalQuestionsAnswered = answered.length
    const avgScore = overallScore || 0

    const answerSummary = answered
        .slice(-5)
        .map((q, i) => `Q${i + 1}: "${String(q.userAnswer || '').slice(0, 80)}..." Score: ${q.score || 0}`)
        .join(" | ")

    const prompt = `
You are a senior ${role} hiring manager making a final call.
After this interview:
- Role: ${role} at ${difficulty} difficulty
- Avg Score: ${avgScore}/100
- Questions answered: ${totalQuestionsAnswered}
- Recent answers: ${answerSummary || 'N/A'}
- Strengths: ${Array.isArray(strongTopics) ? strongTopics.slice(0, 3).join(", ") : 'N/A'}
- Weaknesses: ${Array.isArray(weakTopics) ? weakTopics.slice(0, 3).join(", ") : 'N/A'}

Would you move this candidate forward?
Give ONE ONLY of: "HIRE", "NO HIRE", "MAYBE"
Then a brutally honest 1-line reason (max 15 words). No sugar-coating.

Return JSON:
{
  "verdict": "HIRE" | "NO HIRE" | "MAYBE",
  "reason": "short reason here"
}
`

    try {
        const parsed = await callInterviewJson(prompt, null, { feature: "interview-verdict" })
        const validVerdicts = ["HIRE", "NO HIRE", "MAYBE"]
        const verdict = validVerdicts.includes(String(parsed?.verdict).toUpperCase()) ? String(parsed?.verdict).toUpperCase() : "MAYBE"
        return {
            verdict,
            reason: String(parsed?.reason || "Candidate showed mixed performance across topics.")
        }
    } catch {
        return {
            verdict: avgScore >= 75 ? "HIRE" : avgScore >= 55 ? "MAYBE" : "NO HIRE",
            reason: "Unable to generate verdict. Based on score."
        }
    }
}

// ============= FEATURE: READINESS BY COMPANY TYPE =============
const generateReadinessByCompanyType = async ({ role, difficulty, questions, overallScore, weakTopics, strongTopics }) => {
    const answered = Array.isArray(questions) ? questions.filter((q) => q.answeredAt) : []

    const prompt = `
You are evaluating a ${role} candidate at ${difficulty} level.
- Overall Score: ${overallScore}/100
- Questions answered: ${answered.length}
- Weak areas: ${Array.isArray(weakTopics) ? weakTopics.slice(0, 3).join(", ") : 'N/A'}
- Strong areas: ${Array.isArray(strongTopics) ? strongTopics.slice(0, 3).join(", ") : 'N/A'}

Score readiness for ${role} at EACH company type 0-100.
Be honest — startups want scrappy, FAANG wants rigorous.

Return JSON:
{
  "startup": { "score": XX, "reason": "one-line reason" },
  "midsize": { "score": XX, "reason": "one-line reason" },
  "faang":   { "score": XX, "reason": "one-line reason" }
}
`

    try {
        const parsed = await callInterviewJson(prompt, null, { feature: "interview-readiness" })
        const clamp = (v) => Math.max(0, Math.min(100, Math.round(Number(v) || 0)))
        return {
            startup: { score: clamp(parsed?.startup?.score), reason: String(parsed?.startup?.reason || "Mixed readiness.") },
            midsize: { score: clamp(parsed?.midsize?.score), reason: String(parsed?.midsize?.reason || "Moderate fit.") },
            faang: { score: clamp(parsed?.faang?.score), reason: String(parsed?.faang?.reason || "Higher bar needed.") }
        }
    } catch {
        return {
            startup: { score: overallScore, reason: "Startup readiness score." },
            midsize: { score: Math.max(0, overallScore - 10), reason: "Midsize readiness score." },
            faang: { score: Math.max(0, overallScore - 20), reason: "FAANG readiness score." }
        }
    }
}

export const startsession = async (req, res) => {
    try {
        const { error, value } = startSessionValidator.validate(req.body)
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            })
        }

        const requestedMode = value.mode
        const mode = normalizeModeForValidation(requestedMode)
        const { role, questionCount, difficulty, topic } = value
    const selectedTopic = String(topic || role || "").trim()

        const user = await User.findById(req.user._id)
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            })
        }

        const resumeText = String(user.resume?.extractedText || "")
        const resumeSummary = buildResumeInterviewSummary(resumeText)

        if (mode !== "mcq_practice" && !resumeText) {
            return res.status(400).json({
                success: false,
                message: "Upload resume first. Resume text is required."
            })
        }

        const session = await Session.create({
            userId: user._id,
            mode,
            difficulty,
            targetRole: role,
            topic: mode === "mcq_practice" ? selectedTopic : "",
            resumeSnapshot: {
                fileName: user.resume?.fileName || "",
                fileURL: user.resume?.url || "",
                publicId: user.resume?.publicId || "",
                summary: resumeSummary,
                candidateName: user.username || ""
            },
            status: "ongoing"
        })

        if (mode === "mcq_practice") {
            const recentMcqSessions = await Session.find({
                userId: user._id,
                mode: "mcq_practice",
                topic: selectedTopic
            })
                .sort({ createdAt: -1 })
                .limit(12)
                .select("questions.questionText")

            const avoidQuestionTexts = recentMcqSessions
                .flatMap((item) => Array.isArray(item.questions) ? item.questions.map((q) => q.questionText) : [])
                .filter(Boolean)

            const generatedQuestions = await generateQuestionsWithAI({
                mode,
                role,
                topic: selectedTopic,
                difficulty,
                questionCount,
                resumeText: "",
                avoidQuestionTexts
            })

            session.questions = generatedQuestions
            await session.save()

            return res.status(201).json({
                success: true,
                message: "MCQ session ready",
                sessionId: session._id,
                mode: modeForClient(session.mode),
                difficulty,
                role: session.targetRole,
                topic: session.topic,
                questionCount: session.questions.length,
                generatedCount: session.questions.length,
                redirectTo: `/mcq/session/${session._id}`,
                questions: session.questions
            })
        }

        const firstQuestion = await generateNextInterviewQuestionWithAI({
            role,
            difficulty,
            resumeText: resumeSummary,
            history: [],
            questionNumber: 1,
            candidateName: user.username || ""
        })

        await saveInterviewLoopState(
            String(session._id),
            String(user._id),
            {
                targetQuestionCount: questionCount,
                askedQuestionsCount: 0,
                currentQuestion: firstQuestion,
                history: [],
                totalClarificationsUsed: 0,
                currentQuestionClarificationCount: 0,
                lastClarification: null
            },
            7200
        )

        return res.status(201).json({
            success: true,
            message: "Live interview started",
            sessionId: session._id,
            mode: modeForClient(session.mode),
            difficulty,
            role: session.targetRole,
            questionCount,
            currentQuestion: firstQuestion,
            remainingQuestions: Math.max(0, questionCount - 1)
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to start session",
            error: error.message
        })
    }
}

export const submitAnswer = async (req, res) => {
    try {
        const { sessionId, questionNumber, selectedOptionIndex, userAnswer, submittedCode, answerMode } = req.body

        const session = await Session.findOne({ _id: sessionId, userId: req.user._id })
        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Session not found or unauthorized"
            })
        }

        if (session.status !== "ongoing") {
            const message = session.status === "abandoned" 
                ? "Session was abandoned due to excessive tab switching. Please complete the session to view results."
                : "Session is not active"
            return res.status(400).json({
                success: false,
                message
            })
        }

        if (session.mode === "mcq_practice") {
            if (!questionNumber) {
                return res.status(400).json({
                    success: false,
                    message: "questionNumber is required for MCQ mode"
                })
            }

            if (typeof selectedOptionIndex !== "number") {
                return res.status(400).json({
                    success: false,
                    message: "selectedOptionIndex must be a number (0-3)"
                })
            }

            const question = session.questions.find((q) => q.questionNumber === Number(questionNumber))
            if (!question) {
                return res.status(404).json({
                    success: false,
                    message: "Question not found in session"
                })
            }

            const isCorrect = selectedOptionIndex === question.correctOptionIndex
            const score = isCorrect ? 100 : 0
            const feedback = isCorrect ? "Correct answer." : "Incorrect answer. Review this concept."

            question.userAnswer = String(selectedOptionIndex)
            question.answerMode = "text"
            question.score = score
            question.feedback = feedback
            question.answeredAt = new Date()

            await session.save()

            return res.status(200).json({
                success: true,
                message: "Answer submitted",
                questionNumber: Number(questionNumber),
                score,
                feedback
            })
        }

        const loopState = await getInterviewLoopState(String(session._id), String(req.user._id))
        if (!loopState || !loopState.currentQuestion) {
            return res.status(410).json({
                success: false,
                message: "Live interview state expired. Start a new session."
            })
        }

        const answerText = String(userAnswer || "").trim()
        const codeText = String(submittedCode || "").trim()

        if (!answerText && !codeText) {
            return res.status(400).json({
                success: false,
                message: "Please provide your answer (userAnswer or submittedCode)"
            })
        }

        const askedQuestionsCount = Number(loopState.askedQuestionsCount || 0) + 1
        const MAX_INTERVIEW_QUESTIONS = 15
        // Always try to generate next question unless we hit hard max
        const shouldGenerateNextQuestion = askedQuestionsCount < MAX_INTERVIEW_QUESTIONS
        const fullAnswer = answerText || codeText

        if (isLowSignalAnswer(fullAnswer)) {
            return res.status(400).json({
                success: false,
                message: "No meaningful answer detected. Please speak/type a complete answer before submitting."
            })
        }

        const evaluation = await evaluateAndGenerateNextInterviewTurnWithAI({
            currentQuestion: loopState.currentQuestion,
            userAnswer: fullAnswer,
            role: session.targetRole,
            difficulty: session.difficulty || "medium",
            resumeText: session.resumeSnapshot?.summary || "",
            history: Array.isArray(loopState.history) ? loopState.history : [],
            questionNumber: askedQuestionsCount + 1,
            candidateName: session.resumeSnapshot?.candidateName || "",
            generateNextQuestion: shouldGenerateNextQuestion
        })

        // ============= FEATURE: Vague Answer Detection =============
        const vagueAnalysis = await detectVagueAnswer({
            question: loopState.currentQuestion.questionText,
            answer: fullAnswer,
            role: session.targetRole
        })

        const updatedHistory = [
            ...(Array.isArray(loopState.history) ? loopState.history : []),
            {
                questionNumber: loopState.currentQuestion.questionNumber,
                questionText: loopState.currentQuestion.questionText,
                category: loopState.currentQuestion.category,
                answerMode: answerMode || loopState.currentQuestion.answerMode || "text",
                userAnswer: fullAnswer,
                score: evaluation.score,
                feedback: evaluation.feedback,
                reaction: evaluation.reaction,
                idealAnswer: evaluation.idealAnswer,
                topicsToStudy: evaluation.topicsToStudy,
                shouldFollowUp: evaluation.shouldFollowUp,
                is_vague: vagueAnalysis.is_vague,
                vague_follow_up: vagueAnalysis.follow_up,
                answeredAt: new Date().toISOString()
            }
        ]

        // Only end interview if we hit the hard max question limit
        if (askedQuestionsCount >= MAX_INTERVIEW_QUESTIONS) {
            await saveInterviewLoopState(
                String(session._id),
                String(req.user._id),
                {
                    ...loopState,
                    askedQuestionsCount,
                    history: updatedHistory,
                    currentQuestion: null,
                    currentQuestionClarificationCount: 0,
                    lastClarification: null
                },
                1800
            )

            return res.status(200).json({
                success: true,
                message: "Answer submitted. Live interview has reached maximum questions. Please complete the session to see final feedback.",
                questionNumber: loopState.currentQuestion.questionNumber,
                score: evaluation.score,
                feedback: evaluation.feedback,
                reaction: evaluation.reaction,
                idealAnswer: evaluation.idealAnswer,
                topicsToStudy: evaluation.topicsToStudy,
                shouldFollowUp: evaluation.shouldFollowUp,
                is_vague: vagueAnalysis.is_vague,
                vague_follow_up: vagueAnalysis.follow_up,
                done: true,
                remainingQuestions: 0
            })
        }

        const forceCodingQuestion = shouldForceCodingQuestion({
            totalAsked: askedQuestionsCount,
            codingAsked: countCodingQuestions(updatedHistory)
        })

        let nextQuestion = evaluation.nextQuestion
        if (!nextQuestion || (forceCodingQuestion && nextQuestion.category !== "coding")) {
            nextQuestion = pickFallbackInterviewQuestion({
                role: session.targetRole,
                questionNumber: askedQuestionsCount + 1,
                history: updatedHistory,
                forceCoding: forceCodingQuestion
            })
        }

        await saveInterviewLoopState(
            String(session._id),
            String(req.user._id),
            {
                ...loopState,
                askedQuestionsCount,
                history: updatedHistory,
                currentQuestion: nextQuestion,
                currentQuestionClarificationCount: 0,
                lastClarification: null
            },
            7200
        )

        return res.status(200).json({
            success: true,
            message: "Answer submitted. Interview continues—you can keep answering or click 'Complete Session' anytime.",
            questionNumber: loopState.currentQuestion.questionNumber,
            score: evaluation.score,
            feedback: evaluation.feedback,
            reaction: evaluation.reaction,
            idealAnswer: evaluation.idealAnswer,
            topicsToStudy: evaluation.topicsToStudy,
            shouldFollowUp: evaluation.shouldFollowUp,
            is_vague: vagueAnalysis.is_vague,
            vague_follow_up: vagueAnalysis.follow_up,
            done: false,
            nextQuestion,
            remainingQuestions: Math.max(0, MAX_INTERVIEW_QUESTIONS - askedQuestionsCount)
        })
    } catch (error) {
        console.error("[submitAnswer] Error:", error.message)
        return res.status(500).json({
            success: false,
            message: "Failed to submit answer",
            error: error.message
        })
    }
}

export const logTabSwitch = async (req, res) => {
    try {
        const { sessionId } = req.body

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: "sessionId is required"
            })
        }

        const session = await Session.findOne({ _id: sessionId, userId: req.user._id })
        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Session not found"
            })
        }

        session.tabSwitches += 1
        session.tabSwitchTimestamps.push(new Date())

        if (session.tabSwitches >= 3 && session.status === "ongoing") {
            session.status = "abandoned"
            session.completedAt = new Date()
        }

        await session.save()

        if (session.status === "abandoned" && session.mode === "interview_mock") {
            await clearInterviewLoopState(String(session._id), String(req.user._id))
        }

        return res.status(200).json({
            success: true,
            tabSwitches: session.tabSwitches,
            status: session.status,
            abandoned: session.status === "abandoned"
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to log tab switch",
            error: error.message
        })
    }
}

export const clarifyInterviewQuestion = async (req, res) => {
    try {
        const { sessionId, doubtText } = req.body

        const session = await Session.findOne({ _id: sessionId, userId: req.user._id })
        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Session not found"
            })
        }

        if (session.mode !== "interview_mock") {
            return res.status(400).json({
                success: false,
                message: "Clarification is available only in live interview mode"
            })
        }

        if (session.status !== "ongoing") {
            const message = session.status === "abandoned" 
                ? "Session was abandoned due to excessive tab switching. Please complete the session to view results."
                : "Session is not active"
            return res.status(400).json({
                success: false,
                message
            })
        }

        const loopState = await getInterviewLoopState(String(session._id), String(req.user._id))
        if (!loopState || !loopState.currentQuestion) {
            return res.status(410).json({
                success: false,
                message: "Live interview state expired. Start a new session."
            })
        }

        const usedForCurrent = Number(loopState.currentQuestionClarificationCount || 0)
        const usedTotal = Number(loopState.totalClarificationsUsed || 0)

        if (usedForCurrent >= INTERVIEW_CLARIFICATION_PER_QUESTION_LIMIT) {
            return res.status(400).json({
                success: false,
                message: "Clarification already used for this question. Please answer and continue."
            })
        }

        if (usedTotal >= INTERVIEW_CLARIFICATION_TOTAL_LIMIT) {
            return res.status(400).json({
                success: false,
                message: "You have reached the total clarification limit for this interview."
            })
        }

        const clarification = await generateInterviewClarificationWithAI({
            role: session.targetRole,
            difficulty: session.difficulty || "medium",
            question: loopState.currentQuestion.questionText,
            doubtText
        })

        await saveInterviewLoopState(
            String(session._id),
            String(req.user._id),
            {
                ...loopState,
                totalClarificationsUsed: usedTotal + 1,
                currentQuestionClarificationCount: usedForCurrent + 1,
                lastClarification: {
                    doubtText: compactText(doubtText, 300),
                    clarification,
                    createdAt: new Date().toISOString()
                }
            },
            7200
        )

        return res.status(200).json({
            success: true,
            message: "Clarification ready",
            clarification,
            clarificationUsage: {
                usedForCurrentQuestion: usedForCurrent + 1,
                remainingForCurrentQuestion: Math.max(0, INTERVIEW_CLARIFICATION_PER_QUESTION_LIMIT - (usedForCurrent + 1)),
                usedTotal: usedTotal + 1,
                remainingTotal: Math.max(0, INTERVIEW_CLARIFICATION_TOTAL_LIMIT - (usedTotal + 1))
            },
            currentQuestion: loopState.currentQuestion
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to clarify question",
            error: error.message
        })
    }
}

// ============= FEATURE: WHISPER COACH (Real-Time Hints) =============
export const generateHints = async (req, res) => {
    try {
        const { sessionId, partialTranscript } = req.body

        const session = await Session.findOne({ _id: sessionId, userId: req.user._id })
        if (!session) {
            return res.status(404).json({ success: false, message: "Session not found" })
        }

        if (session.mode !== "interview_mock") {
            return res.status(400).json({ success: false, message: "Hints only available in interview mode" })
        }

        const loopState = await getInterviewLoopState(String(session._id), String(req.user._id))
        if (!loopState || !loopState.currentQuestion) {
            return res.status(410).json({ success: false, message: "Interview state expired" })
        }

        // If no transcript provided, use session history as context
        const contextTranscript = partialTranscript || 
            (Array.isArray(loopState.history) && loopState.history.length > 0
                ? loopState.history[loopState.history.length - 1]?.userAnswer || ""
                : "")

        const hints = await generateWhisperCoachHints({
            question: loopState.currentQuestion.questionText,
            partialTranscript: contextTranscript,
            role: session.targetRole
        })

        return res.status(200).json({
            success: true,
            hints: hints.hints || []
        })
    } catch (error) {
        console.error("[generateHints] Error:", error.message)
        // Return fallback hints instead of error
        return res.status(200).json({ 
            success: true, 
            hints: ["Think about key points", "Structure your answer clearly"]
        })
    }
}

export const completeSession = async (req, res) => {
    try {
        const { sessionId } = req.body

        if (!sessionId) {
            return res.status(400).json({
                success: false,
                message: "sessionId is required"
            })
        }

        const session = await Session.findOne({ _id: sessionId, userId: req.user._id })
        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Session not found"
            })
        }

        let questionsForAnalysis = session.questions

        if (session.mode === "interview_mock") {
            const loopState = await getInterviewLoopState(String(session._id), String(req.user._id))
            questionsForAnalysis = Array.isArray(loopState?.history)
                ? loopState.history.map((item, idx) => ({
                    questionNumber: item.questionNumber || idx + 1,
                    questionText: item.questionText || "",
                    category: item.category || "theory",
                    answerMode: item.answerMode || "text",
                    userAnswer: item.userAnswer || "",
                    score: Number(item.score || 0),
                    answeredAt: item.answeredAt ? new Date(item.answeredAt) : new Date()
                }))
                : []

            questionsForAnalysis = filterMeaningfulInterviewAnswers(questionsForAnalysis)

            // For abandoned sessions, allow completion even with no answers
            if (!questionsForAnalysis.length && session.status !== "abandoned") {
                return res.status(400).json({
                    success: false,
                    message: "No meaningful interview answers found for analysis. Please submit at least one complete answer."
                })
            }

            // Persist answered interview turns for results/history APIs.
            if (questionsForAnalysis.length > 0) {
                session.questions = questionsForAnalysis.map((item) => ({
                    ...item,
                    questionType: "interview",
                    options: [],
                    correctOptionIndex: null,
                    feedback: "",
                    tone: "normal"
                }))
            }
        }

        // For abandoned sessions with no answers, provide default analysis
        let analysis;
        if (questionsForAnalysis.length === 0 && session.status === "abandoned") {
            analysis = {
                overallScore: 0,
                technicalScore: 0,
                clarityScore: 0,
                confidenceScore: 0,
                mcqScore: 0,
                aptitudeScore: 0,
                resumeScore: 0,
                finalFeedback: "Session was abandoned due to excessive tab switching. No answers were recorded for analysis.",
                roadmap: {
                    summary: "Unable to generate roadmap due to session abandonment.",
                    topics: []
                },
                weakTopics: [],
                strongTopics: []
            }
        } else {
            analysis = await analyzeSessionWithAI({
                role: session.targetRole,
                difficulty: req.body?.difficulty || session.difficulty || "medium",
                questions: questionsForAnalysis
            })
        }

        // ============= FEATURE: Hire/No-Hire Verdict =============
        const verdict = questionsForAnalysis.length === 0 && session.status === "abandoned"
            ? "Unable to determine - session abandoned"
            : await generateHireNoHireVerdict({
                role: session.targetRole,
                difficulty: session.difficulty || "medium",
                questions: questionsForAnalysis,
                overallScore: analysis.overallScore,
                weakTopics: analysis.weakTopics,
                strongTopics: analysis.strongTopics
            })

        // ============= FEATURE: Readiness by Company Type =============
        const readinessByType = questionsForAnalysis.length === 0 && session.status === "abandoned"
            ? {}
            : await generateReadinessByCompanyType({
                role: session.targetRole,
                difficulty: session.difficulty || "medium",
                questions: questionsForAnalysis,
                overallScore: analysis.overallScore,
                weakTopics: analysis.weakTopics,
                strongTopics: analysis.strongTopics
            })

        session.overallScore = analysis.overallScore
        session.technicalScore = analysis.technicalScore
        session.clarityScore = analysis.clarityScore
        session.confidenceScore = analysis.confidenceScore
        session.mcqScore = analysis.mcqScore
        session.aptitudeScore = analysis.aptitudeScore
        session.resumeScore = analysis.resumeScore
        session.finalFeedback = analysis.finalFeedback
        session.roadmap = analysis.roadmap
        session.verdict = verdict
        session.readinessByCompanyType = readinessByType

        session.completedAt = new Date()
        session.durationMinutes = Math.max(
            0,
            Math.round((session.completedAt - session.startedAt) / 60000)
        )

        if (session.status !== "abandoned") {
            session.status = "completed"
        }

        if (session.mode === "interview_mock" && (!Array.isArray(session.jobRecommendations) || !session.jobRecommendations.length)) {
            try {
                const jobs = await fetchRelevantJobsForRole({
                    role: session.targetRole,
                    limit: 5
                })
                if (Array.isArray(jobs) && jobs.length) {
                    session.jobRecommendations = jobs
                }
            } catch (error) {
                console.error("[JSearch] Failed to fetch jobs:", error.message)
            }
        }

        await session.save()

        // Create flashcards for all completed sessions (both interview and MCQ)
        try {
            const user = await User.findById(req.user._id)
            if (user && questionsForAnalysis.length > 0) {
                const flashcardTopics = Array.isArray(analysis.weakTopics) ? [...analysis.weakTopics] : []
                const hasMcqQuestions = questionsForAnalysis.some((q) => q.questionType === "mcq")
                const hasInterviewQuestions = questionsForAnalysis.some((q) => q.questionType === "interview")
                const hasAptitudeQuestions = questionsForAnalysis.some((q) => q.questionType === "interview" && q.category === "coding")

                if (hasMcqQuestions && !flashcardTopics.some((topic) => /mcq/i.test(topic))) {
                    flashcardTopics.push("MCQ fundamentals")
                }
                if (hasInterviewQuestions && !flashcardTopics.some((topic) => /interview/i.test(topic))) {
                    flashcardTopics.push("Interview preparation")
                }
                if (hasAptitudeQuestions && !flashcardTopics.some((topic) => /aptitude|problem solving|coding/i.test(topic))) {
                    flashcardTopics.push("Aptitude problem solving")
                }

                if (!flashcardTopics.length) {
                    flashcardTopics.push("Core concepts")
                }

                await createFlashcardsForSession(session, user._id, flashcardTopics)
            }
        } catch (flashcardErr) {
            console.error("Failed to create flashcards:", flashcardErr.message)
        }

        if (session.mode === "interview_mock") {
            const user = await User.findById(req.user._id)
            if (user) {
                user.interviewStats = {
                    totalInterviewScore: (user.interviewStats?.totalInterviewScore || 0) + session.overallScore,
                    sessionsCompleted: (user.interviewStats?.sessionsCompleted || 0) + 1,
                    averageInterviewScore: 0
                }
                user.interviewStats.averageInterviewScore = user.interviewStats.sessionsCompleted > 0
                    ? Math.round(user.interviewStats.totalInterviewScore / user.interviewStats.sessionsCompleted)
                    : 0
                user.leaderboardPoints = computeLeaderboardPoints({
                    currentStreak: user.challengeStats?.currentStreak || 0,
                    challengesCompleted: user.challengeStats?.challengesCompleted || 0,
                    averageInterviewScore: user.interviewStats.averageInterviewScore
                })
                await user.save()
            }

            await clearInterviewLoopState(String(session._id), String(req.user._id))
        }

        // Update MCQ stats for MCQ practice sessions
        if (session.mode === "mcq_practice") {
            const user = await User.findById(req.user._id)
            if (user) {
                user.mcqStats = {
                    totalMcqScore: (user.mcqStats?.totalMcqScore || 0) + session.mcqScore,
                    sessionsCompleted: (user.mcqStats?.sessionsCompleted || 0) + 1,
                    averageMcqScore: 0
                }
                user.mcqStats.averageMcqScore = user.mcqStats.sessionsCompleted > 0
                    ? Math.round(user.mcqStats.totalMcqScore / user.mcqStats.sessionsCompleted)
                    : 0
                user.leaderboardPoints = computeLeaderboardPoints({
                    currentStreak: user.challengeStats?.currentStreak || 0,
                    challengesCompleted: user.challengeStats?.challengesCompleted || 0,
                    averageInterviewScore: user.interviewStats?.averageInterviewScore || 0
                })
                await user.save()
            }
        }

        const questionsCount = Array.isArray(session.questions) ? session.questions.length : 0
        const questionsAnswered = Array.isArray(session.questions)
            ? session.questions.filter((question) => Boolean(question.userAnswer)).length
            : 0

        return res.status(200).json({
            success: true,
            message: "Session completed and analyzed",
            sessionId: session._id,
            mode: modeForClient(session.mode),
            role: session.targetRole,
            overallScore: session.overallScore,
            technicalScore: session.technicalScore,
            clarityScore: session.clarityScore,
            confidenceScore: session.confidenceScore,
            mcqScore: session.mcqScore,
            aptitudeScore: session.aptitudeScore,
            resumeScore: session.resumeScore,
            durationMinutes: session.durationMinutes,
            questionsCount,
            questionsAnswered,
            feedback: session.finalFeedback,
            roadmap: session.roadmap,
            weakTopics: analysis.weakTopics,
            strongTopics: analysis.strongTopics,
            readinessScore: analysis.readinessScore,
            readinessLabel: analysis.readinessLabel,
            perQuestionSummary: analysis.perQuestionSummary,
            studyPlan: analysis.studyPlan,
            jobRecommendations: Array.isArray(session.jobRecommendations) ? session.jobRecommendations : [],
            verdict: session.verdict,
            readinessByCompanyType: session.readinessByCompanyType,
            tabSwitches: session.tabSwitches,
            status: session.status
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to complete session",
            error: error.message
        })
    }
}

export const getAllSessions = async (req, res) => {
    try {
        const sessions = await Session.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .select("mode targetRole status overallScore completedAt durationMinutes tabSwitches createdAt")

        const normalizedSessions = sessions.map((session) => ({
            ...session.toObject(),
            mode: modeForClient(session.mode)
        }))

        return res.status(200).json({
            success: true,
            count: normalizedSessions.length,
            sessions: normalizedSessions
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch sessions",
            error: error.message
        })
    }
}

export const getSessionById = async (req, res) => {
    try {
        const session = await Session.findOne({ _id: req.params.id, userId: req.user._id })

        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Session not found"
            })
        }

        const normalizedSession = {
            ...session.toObject(),
            mode: modeForClient(session.mode)
        }

        return res.status(200).json({
            success: true,
            session: normalizedSession
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch session",
            error: error.message
        })
    }
}