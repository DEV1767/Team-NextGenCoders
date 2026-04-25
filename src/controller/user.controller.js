
import User from "../model/user.model.js"
import Groq from "groq-sdk"
import {
    logAiCacheHit,
    logAiFailure,
    logAiFallback,
    logAiRequest,
    logAiSuccess
} from "../utils/ai.logger.js"

const extractJsonFromText = (text = "") => {
    const trimmed = String(text || "").trim()
    if (!trimmed) return null

    const codeBlockMatch = trimmed.match(/```json\s*([\s\S]*?)```/i) || trimmed.match(/```\s*([\s\S]*?)```/i)
    const candidate = codeBlockMatch ? codeBlockMatch[1].trim() : trimmed

    try {
        return JSON.parse(candidate)
    } catch {
        const firstBrace = candidate.indexOf("{")
        const lastBrace = candidate.lastIndexOf("}")
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            try {
                return JSON.parse(candidate.slice(firstBrace, lastBrace + 1))
            } catch {
                return null
            }
        }
        return null
    }
}

const callGroqJson = async (prompt, systemPrompt, { maxTokens = 900, temperature = 0.25 } = {}) => {
    const groqKeys = [
        process.env.GROQ_API_KEY,
        process.env.GROQ_API_KEY_2,
        process.env.GROQ_API_KEY_3
    ].filter(Boolean)

    if (groqKeys.length === 0) {
        throw new Error("No Groq API keys configured")
    }

    for (let i = 0; i < groqKeys.length; i++) {
        const groqKey = groqKeys[i]
        const keyLabel = i === 0 ? "Primary" : `Fallback ${i}`

        try {
            const client = new Groq({ apiKey: groqKey })

            let message
            try {
                message = await client.chat.completions.create({
                    model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
                    max_tokens: maxTokens,
                    temperature,
                    response_format: { type: "json_object" },
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: prompt }
                    ]
                })
            } catch {
                message = await client.chat.completions.create({
                    model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
                    max_tokens: maxTokens,
                    temperature,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: prompt }
                    ]
                })
            }

            const text = message.choices?.[0]?.message?.content || ""
            const parsed = extractJsonFromText(text)
            if (!parsed) {
                throw new Error("Groq returned invalid JSON")
            }

            console.log(`[AI:user] Groq ${keyLabel} succeeded`)
            return parsed

        } catch (error) {
            console.warn(`[AI:user] Groq ${keyLabel} failed:`, error.message)
            if (i < groqKeys.length - 1) {
                continue
            }
            throw error
        }
    }
}

export const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            })
        }

        const resumeStatus = user.resume?.url
            ? {
                  uploaded: true,
                  analyzed: user.resume.analyzed || false,
                  score: user.resume.score || 0,
                  feedback: user.resume.feedback || null,
                  fileName: user.resume.fileName || null,
                  analyzedAt: user.resume.analyzedAt || null,
                  canAnalyze: !user.resume.analyzed,
                  buttonLabel: user.resume.analyzed ? "Verified" : "Verify Resume"
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

        const challengeStats = user.challengeStats || {}

        return res.status(200).json({
            success: true,
            user: {
                id: user._id,
                name: user.username,
                email: user.email,
                role: user.role || "",
                experience: user.experience || "",
                collegeName: user.collegeName,
                course: user.course,
                graduationYear: user.graduationYear,
                resume: resumeStatus,
                challengeStats: {
                    currentStreak: challengeStats.currentStreak || 0,
                    bestStreak: challengeStats.bestStreak || 0,
                    challengesCompleted: challengeStats.challengesCompleted || 0,
                    streakBadge: challengeStats.streakBadge || "None",
                    lastChallengeType: challengeStats.lastChallengeType || "none"
                },
                leaderboardPoints: user.leaderboardPoints || 0
            }
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server issue"
        })
    }
}

export const updateMe = async (req, res) => {
    try {
        const { name, email, role, experience } = req.body
        const payload = {}

        if (name !== undefined) payload.username = name
        if (email !== undefined) payload.email = email
        if (role !== undefined) payload.role = role
        if (experience !== undefined) payload.experience = experience

        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            payload,
            { new: true, runValidators: true }
        )

        return res.status(200).json({
            success: true,
            message: "Profile updated",
            user: {
                id: updatedUser._id,
                name: updatedUser.username,
                email: updatedUser.email,
                role: updatedUser.role || "",
                experience: updatedUser.experience || ""
            }
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to update profile",
            error: error.message
        })
    }
}

export const getUser = async (req, res) => {
    try {
        const { id } = req.params
        const user = await User.findById(id)
        if (!user) {
            return res.status(400).json({
                success: false,
                message: "User not found"
            })
        }
        return res.status(200).json({
            success: true,
            user: {
                username: user.username,
                email: user.email,
                course: user.course,
                graduationyear: user.graduationYear,
                
            }
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server issue"
        })
    }
}

export const analyzeResume = async (req, res) => {
    try {
        const user = await User.findById(req.user._id)
        
        if (!user?.resume?.url) {
            return res.status(400).json({
                success: false,
                message: "No resume uploaded yet"
            })
        }

        if (user.resume.analyzed) {
            return res.status(200).json({
                success: true,
                message: "Resume already analyzed",
                resume: {
                    score: user.resume.score,
                    feedback: user.resume.feedback,
                    analyzed: user.resume.analyzed,
                    analyzedAt: user.resume.analyzedAt
                }
            })
        }

        const resumeText = user.resume.extractedText || ""
        if (!resumeText.trim()) {
            return res.status(400).json({
                success: false,
                message: "Could not extract text from resume. Please upload a valid PDF."
            })
        }

        logAiRequest({
            feature: "resume-analysis",
            provider: "Groq",
            model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
            promptTokens: Math.ceil(resumeText.length / 4)
        })

        const systemPrompt = `You are an expert resume reviewer. Analyze the resume and provide a structured evaluation.
Return ONLY valid JSON with no markdown, no explanation, no extra text.`

        const prompt = `Analyze this resume and provide:
1. Overall score (0-100)
2. Key strengths (top 3)
3. Areas to improve (top 3)
4. Specific feedback for improvement
5. Technical skills quality assessment

Resume:
${resumeText.substring(0, 3000)}

Return JSON format:
{
  "score": 75,
  "strengths": ["skill1", "skill2", "skill3"],
  "improvements": ["area1", "area2", "area3"],
  "feedback": "detailed feedback",
  "technicalStrength": "strong|moderate|weak"
}`

        const analysis = await callGroqJson(prompt, systemPrompt, {
            maxTokens: 800,
            temperature: 0.3
        })

        const clamp = (value) => {
            const n = Number(value)
            if (!Number.isFinite(n)) return 0
            return Math.max(0, Math.min(100, Math.round(n)))
        }

        const finalScore = clamp(analysis?.score || 65)
        const analyzedAt = new Date()

        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            {
                $set: {
                    "resume.analyzed": true,
                    "resume.score": finalScore,
                    "resume.feedback": String(analysis?.feedback || "Resume review completed"),
                    "resume.analyzedAt": analyzedAt
                }
            },
            { new: true }
        )

        logAiSuccess({
            feature: "resume-analysis",
            provider: "Groq",
            model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile"
        })

        return res.status(200).json({
            success: true,
            message: "Resume analyzed successfully",
            resume: {
                score: finalScore,
                feedback: String(analysis?.feedback || ""),
                strengths: Array.isArray(analysis?.strengths) ? analysis.strengths : [],
                improvements: Array.isArray(analysis?.improvements) ? analysis.improvements : [],
                technicalStrength: analysis?.technicalStrength || "moderate",
                analyzed: true,
                analyzedAt
            }
        })
    } catch (error) {
        console.error("[AI:user] Resume analysis failed:", error.message)
        
        logAiFailure({
            feature: "resume-analysis",
            provider: "Groq",
            model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
            message: error?.message || "Resume analysis failed"
        })

        return res.status(500).json({
            success: false,
            message: "Failed to analyze resume",
            error: error.message
        })
    }
}

