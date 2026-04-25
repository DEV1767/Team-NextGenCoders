import Session from "../model/session.model.js"
import User from "../model/user.model.js"
import Groq from "groq-sdk"
import {
    logAiCacheHit,
    logAiFailure,
    logAiFallback,
    logAiRequest,
    logAiSuccess
} from "../utils/ai.logger.js"

const escapePdfText = (value = "") => String(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[\r\n]+/g, " ")

const compactText = (value = "", maxLength = 0) => {
    const text = String(value || "").replace(/\s+/g, " ").trim()
    return maxLength > 0 ? text.slice(0, maxLength) : text
}

const DEFAULT_YOUTUBE_VIDEO_ID = "PkZNo7MFNFg"

const extractYoutubeVideoId = (url = "") => {
    const raw = compactText(url, 220)
    if (!raw) return ""

    try {
        const parsed = new URL(raw)
        const host = parsed.hostname.replace(/^www\./, "").toLowerCase()

        if (host === "youtu.be") {
            return parsed.pathname.split("/").filter(Boolean)[0] || ""
        }

        if (host === "youtube.com" || host === "m.youtube.com") {
            if (parsed.pathname === "/watch") {
                return parsed.searchParams.get("v") || ""
            }

            if (parsed.pathname.startsWith("/shorts/")) {
                return parsed.pathname.split("/").filter(Boolean)[1] || ""
            }

            if (parsed.pathname.startsWith("/embed/")) {
                return parsed.pathname.split("/").filter(Boolean)[1] || ""
            }
        }

        return ""
    } catch {
        return ""
    }
}

const buildYoutubeEmbedUrlFromId = (videoId = "") => {
    const id = compactText(videoId, 20)
    return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1` : ""
}

const buildYoutubeThumbnailUrlFromId = (videoId = "") => {
    const id = compactText(videoId, 20)
    return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : ""
}

const buildYoutubeWatchUrlFromId = (videoId = "") => {
    const id = compactText(videoId, 20)
    return id ? `https://www.youtube.com/watch?v=${id}` : ""
}

const buildRoadmapPreviewUrl = (baseUrl = "", resultId = "", resourceKey = "") => {
    const apiBase = compactText(baseUrl, 220).replace(/\/$/, "")
    const safeResultId = compactText(resultId, 64)
    const safeResourceKey = compactText(resourceKey, 64)
    if (!apiBase || !safeResultId || !safeResourceKey) return ""
    return `${apiBase}/api/v1/results/${safeResultId}/roadmap/preview/${encodeURIComponent(safeResourceKey)}`
}

const ROADMAP_INFO_CATALOG = [
    {
        key: "core-fundamentals",
        matchers: ["core concepts", "fundamentals", "syntax", "basics", "javascript"],
        title: "JavaScript Crash Course",
        provider: "PrepAI Learning",
        channelLink: "",
        learn: ["JS syntax", "variables and functions", "control flow", "arrays and objects"],
        reason: "Strong foundation for modern web development"
    },
    {
        key: "dsa-practice",
        matchers: ["dsa", "leetcode", "data structures", "algorithms", "problem solving"],
        title: "Python for Beginners",
        provider: "PrepAI Learning",
        channelLink: "",
        learn: ["problem solving", "loops and conditions", "basic logic", "timed practice"],
        reason: "Helps with logic building and problem solving"
    },
    {
        key: "system-design",
        matchers: ["system design", "architecture", "scaling", "distributed", "backend"],
        title: "Node.js and Express",
        provider: "PrepAI Learning",
        channelLink: "",
        learn: ["APIs", "server flow", "routing", "database integration"],
        reason: "Useful for backend architecture and APIs"
    },
    {
        key: "backend-engineering",
        matchers: ["backend", "api", "server", "database", "node"],
        title: "React Course for Beginners",
        provider: "PrepAI Learning",
        channelLink: "",
        learn: ["components", "props", "state", "UI structure"],
        reason: "Helpful for frontend structure and component thinking"
    },
    {
        key: "mock-interview",
        matchers: ["mock interview", "interview", "confidence", "communication"],
        title: "Interview Communication Practice",
        provider: "PrepAI Learning",
        channelLink: "",
        learn: ["answer structure", "confidence", "clarity", "follow-up handling"],
        reason: "Stable learning reference for practice"
    }
]

const asArray = (value) => (Array.isArray(value) ? value : [])

const buildManualRoadmapVideo = (matchText = "", fallbackIndex = 0) => {
    const text = compactText(matchText, 200).toLowerCase()
    const matched = ROADMAP_INFO_CATALOG.find((item) => item.matchers.some((matcher) => text.includes(matcher.toLowerCase())))
        || ROADMAP_INFO_CATALOG[fallbackIndex % ROADMAP_INFO_CATALOG.length]

    return {
        key: matched.key,
        title: matched.title,
        provider: matched.provider,
        type: "info",
        url: "",
        channelLink: "",
        channelName: matched.provider,
        learn: matched.learn,
        reason: matched.reason
    }
}

const roadmapPayloadFromParsed = (parsed = {}) => {
    return parsed?.roadmapDetails
        || parsed?.roadmap
        || parsed?.data
        || parsed?.result
        || parsed
}

const normalizeRoadmapNode = (node, index) => {
    const titleSource = typeof node === "string" ? node : (node?.title || node?.name || node?.label || `Step ${index + 1}`)
    return {
        nodeId: compactText((typeof node === "object" && node?.nodeId) || `node-${index + 1}`, 32),
        title: compactText(titleSource, 90),
        phase: compactText((typeof node === "object" && (node?.phase || node?.stage)) || "core", 24),
        level: compactText((typeof node === "object" && node?.level) || "beginner", 20),
        durationWeeks: Math.max(1, Math.min(12, Number(typeof node === "object" ? node?.durationWeeks || node?.weeks || node?.duration : 1) || 1)),
        summary: compactText((typeof node === "object" && (node?.summary || node?.description)) || `Focus on ${String(titleSource).toLowerCase()}.`, 160),
        hoverTip: compactText((typeof node === "object" && (node?.hoverTip || node?.tip)) || `Practice ${String(titleSource).toLowerCase()} daily.`, 140),
        dependsOn: Array.isArray(node?.dependsOn) ? node.dependsOn.slice(0, 4).map((item) => compactText(item, 32)).filter(Boolean) : [],
        resourceKeys: Array.isArray(node?.resourceKeys) ? node.resourceKeys.slice(0, 5).map((item) => compactText(item, 32)).filter(Boolean) : []
    }
}

const normalizeRoadmapResource = (resource, index, fallbackQuery = "", baseUrl = "", resultId = "") => {
    const title = compactText(typeof resource === "string" ? resource : (resource?.title || resource?.name || resource?.label || "Learning Resource"), 90)
    const provider = compactText(typeof resource === "object" ? (resource?.provider || resource?.channel || resource?.source || "") : "", 45)
    const type = compactText(typeof resource === "object" ? (resource?.type || resource?.kind || "info") : "info", 20).toLowerCase()
    const urlSource = typeof resource === "object" ? (resource?.url || resource?.link || "") : ""
    const manualInfo = buildManualRoadmapVideo(`${title} ${provider} ${fallbackQuery}`, index)
    const channelLink = compactText(typeof resource === "object" ? (resource?.channelLink || resource?.channelUrl || resource?.link || manualInfo.channelLink || "") : (manualInfo.channelLink || ""), 220)
    const learn = Array.isArray(resource?.learn)
        ? resource.learn.slice(0, 4).map((item) => compactText(item, 60)).filter(Boolean)
        : Array.isArray(resource?.topics)
            ? resource.topics.slice(0, 4).map((item) => compactText(item, 60)).filter(Boolean)
            : Array.isArray(manualInfo.learn)
                ? manualInfo.learn
                : []
    const previewKey = compactText(typeof resource === "object" ? (resource?.key || `res-${index + 1}`) : `res-${index + 1}`, 32)
    const previewUrl = buildRoadmapPreviewUrl(baseUrl, resultId, previewKey)

    return {
        key: compactText(typeof resource === "object" ? (resource?.key || `res-${index + 1}`) : `res-${index + 1}`, 32),
        title,
        provider,
        type: "info",
        url: channelLink || previewUrl || compactText(urlSource, 180),
        previewUrl,
        channelLink,
        channelName: provider || manualInfo.provider,
        boxTitle: title,
        boxSubtitle: provider || manualInfo.provider,
        boxDescription: compactText(typeof resource === "object" ? (resource?.reason || resource?.summary || manualInfo.reason || "") : (manualInfo.reason || ""), 160),
        learn,
        hoverText: compactText(typeof resource === "object" ? (resource?.reason || resource?.summary || manualInfo.reason || "") : (manualInfo.reason || ""), 160),
        reason: compactText(typeof resource === "object" ? (resource?.reason || resource?.summary || "") : "", 120)
    }
}

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
    // Collect all available Groq API keys (prioritized order)
    const groqKeys = [
        process.env.GROQ_API_KEY,      // New key 1 (highest priority)
        process.env.GROQ_API_KEY_2,    // New key 2 (medium priority)
        process.env.GROQ_API_KEY_3     // Current key (lowest priority/fallback)
    ].filter(Boolean)

    if (groqKeys.length === 0) {
        throw new Error("No Groq API keys configured")
    }

    // Try each Groq key in sequence
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
                throw new Error("Groq returned invalid JSON for roadmap")
            }

            console.log(`[AI:results] Groq ${keyLabel} succeeded`)
            return parsed

        } catch (error) {
            console.warn(`[AI:results] Groq ${keyLabel} failed:`, error.message)
            // Continue to next key if available
            if (i < groqKeys.length - 1) {
                continue
            }
            // All keys failed, throw the last error
            throw error
        }
    }
}

const callGroqRoadmapJson = async ({ prompt, maxTokens = 900 }) => {
    // Collect all available Groq API keys (prioritized order)
    const groqKeys = [
        process.env.GROQ_API_KEY,      // New key 1 (highest priority)
        process.env.GROQ_API_KEY_2,    // New key 2 (medium priority)
        process.env.GROQ_API_KEY_3     // Current key (lowest priority/fallback)
    ].filter(Boolean)

    if (groqKeys.length === 0) {
        throw new Error("No Groq API keys configured")
    }

    const systemPrompt = "You are a roadmap generator. Return valid JSON only. No markdown, no explanation, no extra text."
    logAiRequest({
        feature: "roadmap",
        provider: "Groq",
        model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
        promptTokens: Math.ceil(String(prompt || "").length / 4),
        maxTokens,
        temperature: 0.25
    })

    try {
        const result = await callGroqJson(prompt, systemPrompt, {
            feature: "roadmap",
            maxTokens,
            temperature: 0.25
        })

        logAiSuccess({
            feature: "roadmap",
            provider: "Groq",
            model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile"
        })

        return result
    } catch (error) {
        logAiFailure({
            feature: "roadmap",
            provider: "Groq",
            model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
            message: error?.message || "Roadmap generation failed"
        })
        throw error
    }
}

const buildFallbackRoadmapDetails = (session, baseUrl = "", resultId = "") => {
    const role = String(session?.targetRole || "Software Engineer")
    const topic = compactText(session?.topic || "core skills", 80)
    const feedback = compactText(session?.finalFeedback || "", 180)
    const weakTopics = Array.isArray(session?.roadmap) && session.roadmap.length
        ? session.roadmap.slice(0, 5).join(", ")
        : "technical fundamentals"

    const fallbackSteps = [
        `Strengthen ${topic} fundamentals`,
        `Practice weak topics: ${weakTopics}`,
        `Build real interview tasks and sample problems`,
        `Improve communication, clarity, and confidence`,
        `Review mistakes and rehearse with mock sessions`
    ]

    const nodes = fallbackSteps.map((step, index) => ({
        nodeId: `phase-${index + 1}`,
        title: `${role}: ${step}`,
        phase: index < 2 ? "foundation" : index < 4 ? "applied" : "interview",
        level: index < 2 ? "beginner" : index < 4 ? "intermediate" : "advanced",
        durationWeeks: index === 0 ? 2 : 1,
        summary: `Focus on ${step.toLowerCase()} using short daily practice sessions. ${feedback ? `Key feedback: ${feedback}.` : ""}`.trim(),
        hoverTip: `Spend focused practice on ${step.toLowerCase()} at least 3 times this week.`,
        dependsOn: index > 0 ? [`phase-${index}`] : [],
        resourceKeys: [`res-${index + 1}`]
    }))

    const resources = ROADMAP_INFO_CATALOG.map((item, index) => ({
        key: item.key || `res-${index + 1}`,
        title: item.title,
        provider: item.provider,
        type: "info",
        url: buildRoadmapPreviewUrl(baseUrl, resultId, item.key || `res-${index + 1}`),
        previewUrl: buildRoadmapPreviewUrl(baseUrl, resultId, item.key || `res-${index + 1}`),
        channelLink: "",
        channelName: item.provider,
        boxTitle: item.title,
        boxSubtitle: item.provider,
        boxDescription: item.reason,
        learn: item.learn,
        hoverText: item.reason,
        reason: item.reason
    }))

    return {
        version: 1,
        generatedBy: "fallback",
        generatedAt: new Date(),
        summary: `A practical ${role} roadmap focused on ${topic}. ${feedback ? `Feedback used: ${feedback}` : ""}`.trim(),
        totalWeeks: nodes.reduce((sum, node) => sum + (node.durationWeeks || 0), 0),
        nodes,
        resources
    }
}

const normalizeRoadmapDetails = (parsed, session, baseUrl = "", resultId = "") => {
    const payload = roadmapPayloadFromParsed(parsed)
    const nodesSource = asArray(payload?.nodes).length
        ? payload.nodes
        : asArray(payload?.phases).length
            ? payload.phases
            : asArray(payload?.steps).length
                ? payload.steps
                : asArray(payload?.roadmap)

    const resourcesSource = asArray(payload?.resources).length
        ? payload.resources
        : asArray(payload?.videos).length
            ? payload.videos
            : asArray(payload?.links)

    let safeNodes = nodesSource.slice(0, 18).map((node, index) => normalizeRoadmapNode(node, index))
    let safeResources = resourcesSource.slice(0, 30).map((resource, index) => normalizeRoadmapResource(resource, index, `${payload?.summary || session.targetRole || ""}`, baseUrl, resultId))

    if (!safeNodes.length && safeResources.length) {
        safeNodes = safeResources.slice(0, 10).map((resource, index) => ({
            nodeId: `node-${index + 1}`,
            title: resource.title,
            phase: index < 2 ? "foundation" : index < 6 ? "applied" : "interview",
            level: index < 2 ? "beginner" : index < 6 ? "intermediate" : "advanced",
            durationWeeks: 1,
            summary: resource.reason || `Study ${resource.title}.`,
            hoverTip: resource.reason || `Review ${resource.title} in detail.`,
            dependsOn: index > 0 ? [`node-${index}`] : [],
            resourceKeys: [resource.key]
        }))
    }

    // If Groq returns nodes but sparse resources, derive resource cards from nodes
    // instead of dropping to global fallback.
    if (safeNodes.length && !safeResources.length) {
        safeResources = safeNodes.slice(0, 12).map((node, index) => {
            const manualInfo = buildManualRoadmapVideo(`${node.title} ${node.summary || ""} ${session?.targetRole || ""}`, index)
            const key = compactText((node.resourceKeys?.[0]) || `res-${index + 1}`, 32)
            const previewUrl = buildRoadmapPreviewUrl(baseUrl, resultId, key)
            return {
                key,
                title: compactText(node.title || manualInfo.title, 90),
                provider: compactText(manualInfo.provider, 45),
                type: "info",
                url: manualInfo.channelLink || previewUrl,
                previewUrl,
                channelLink: manualInfo.channelLink,
                channelName: manualInfo.provider,
                boxTitle: compactText(node.title || manualInfo.title, 90),
                boxSubtitle: compactText(manualInfo.provider, 45),
                boxDescription: compactText(node.summary || node.hoverTip || manualInfo.reason, 160),
                learn: Array.isArray(manualInfo.learn) ? manualInfo.learn : [],
                hoverText: compactText(node.hoverTip || node.summary || manualInfo.reason, 160),
                reason: compactText(node.summary || manualInfo.reason, 120)
            }
        })

        safeNodes = safeNodes.map((node, index) => ({
            ...node,
            resourceKeys: Array.isArray(node.resourceKeys) && node.resourceKeys.length
                ? node.resourceKeys
                : [safeResources[index % safeResources.length]?.key].filter(Boolean)
        }))
    }

    if ((!safeNodes.length || !safeResources.length) && payload !== parsed) {
        return normalizeRoadmapDetails(payload, session, baseUrl, resultId)
    }

    if (!safeNodes.length || !safeResources.length) {
        return buildFallbackRoadmapDetails(session, baseUrl, resultId)
    }

    return {
        version: Number(payload?.version) > 0 ? Number(payload.version) : 1,
        generatedBy: compactText(payload?.generatedBy || "groq", 32),
        generatedAt: new Date(),
        summary: compactText(payload?.summary || `Roadmap for ${session.targetRole}`, 220),
        totalWeeks: Math.max(1, Math.min(52, Number(payload?.totalWeeks) || safeNodes.reduce((sum, node) => sum + (node.durationWeeks || 0), 0))),
        nodes: safeNodes,
        resources: safeResources
    }
}

const sanitizeStoredRoadmapDetails = (details, baseUrl = "", resultId = "") => {
    if (!details || typeof details !== "object") return null

    const plainDetails = typeof details?.toObject === "function"
        ? details.toObject({ depopulate: true, flattenMaps: true })
        : details

    const nodes = Array.isArray(plainDetails.nodes)
        ? plainDetails.nodes.slice(0, 24).map((node, index) => normalizeRoadmapNode(node, index))
        : []

    const resources = Array.isArray(plainDetails.resources)
        ? plainDetails.resources.map((resource) => {
            const title = compactText(resource?.title || "Learning Resource", 90)
            const provider = compactText(resource?.provider || "", 45)
            const type = compactText(resource?.type || "info", 20).toLowerCase()
            const manualInfo = buildManualRoadmapVideo(`${title} ${provider}`, 0)
            const previewKey = compactText(resource?.key || "", 32)
            const previewUrl = buildRoadmapPreviewUrl(baseUrl, resultId, previewKey)
            const learn = Array.isArray(resource?.learn) ? resource.learn.slice(0, 4).map((item) => compactText(item, 60)).filter(Boolean) : (Array.isArray(manualInfo.learn) ? manualInfo.learn : [])
            const channelLink = compactText(resource?.channelLink || manualInfo.channelLink || resource?.url || "", 220)

            return {
                ...resource,
                title,
                provider,
                type: "info",
                url: channelLink || previewUrl,
                previewUrl,
                channelLink,
                channelName: provider || manualInfo.provider,
                boxTitle: title,
                boxSubtitle: provider || manualInfo.provider,
                boxDescription: compactText(resource?.hoverText || resource?.reason || manualInfo.reason || "", 160),
                learn,
                hoverText: compactText(resource?.hoverText || resource?.reason || manualInfo.reason || "", 160),
                reason: compactText(resource?.reason || "", 120)
            }
        }).filter((resource) => resource.type !== "youtube" || Boolean(resource.url))
        : []

    const safeNodes = nodes.length
        ? nodes.map((node, index) => ({
            ...node,
            resourceKeys: Array.isArray(node.resourceKeys) && node.resourceKeys.length
                ? node.resourceKeys
                : [resources[index % Math.max(resources.length, 1)]?.key].filter(Boolean)
        }))
        : resources.slice(0, 12).map((resource, index) => ({
            nodeId: `node-${index + 1}`,
            title: resource.title,
            phase: index < 2 ? "foundation" : index < 6 ? "applied" : "interview",
            level: index < 2 ? "beginner" : index < 6 ? "intermediate" : "advanced",
            durationWeeks: 1,
            summary: resource.reason || `Study ${resource.title}.`,
            hoverTip: resource.hoverText || resource.reason || `Practice ${resource.title}.`,
            dependsOn: index > 0 ? [`node-${index}`] : [],
            resourceKeys: [resource.key]
        }))

    return {
        ...plainDetails,
        nodes: safeNodes,
        resources
    }
}

const shouldRefreshRoadmapDetails = (details = {}) => {
    const generatedBy = compactText(details?.generatedBy || "", 32).toLowerCase()
    return !generatedBy || generatedBy === "fallback" || generatedBy === "gemini"
}

const findReusableRoadmapDetails = async ({ userId, currentResultId, targetRole, difficulty, baseUrl }) => {
    const safeRole = compactText(targetRole, 80)
    if (!safeRole) return null

    const safeDifficulty = compactText(difficulty || "", 20)
    const query = {
        userId,
        _id: { $ne: currentResultId },
        targetRole: safeRole,
        "roadmapDetails.nodes.0": { $exists: true },
        "roadmapDetails.resources.0": { $exists: true }
    }

    if (safeDifficulty) {
        query.difficulty = safeDifficulty
    }

    const candidates = await Session.find(query)
        .sort({ updatedAt: -1 })
        .limit(8)

    for (const item of candidates) {
        const safe = sanitizeStoredRoadmapDetails(item.roadmapDetails, baseUrl, currentResultId)
        if (!safe) continue
        if (shouldRefreshRoadmapDetails(safe)) continue

        return {
            sourceResultId: item._id,
            roadmapDetails: {
                ...safe,
                generatedBy: "cache",
                generatedAt: new Date()
            }
        }
    }

    return null
}

const getApiBaseUrl = (req) => `${req.protocol}://${req.get("host")}`

const renderRoadmapVideoPreviewHtml = ({ title, provider, reason, learn = [], channelLink = "" }) => `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapePdfText(title || "Roadmap Video")}</title>
    <style>
        :root { color-scheme: dark; }
        html, body { margin: 0; width: 100%; height: 100%; background: #0f1115; font-family: Inter, Segoe UI, Arial, sans-serif; }
        .wrap { min-height: 100%; display: grid; place-items: center; padding: 22px; box-sizing: border-box; background: radial-gradient(circle at top, rgba(112,76,255,0.16), transparent 35%), #0f1115; }
        .card { width: min(960px, 100%); background: linear-gradient(180deg, #171a21 0%, #10131a 100%); border: 1px solid rgba(255,255,255,0.09); border-radius: 28px; overflow: hidden; box-shadow: 0 24px 80px rgba(0,0,0,0.5); }
        .header { padding: 22px 24px 14px; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .kicker { font-size: 11px; text-transform: uppercase; letter-spacing: .18em; color: #8ea0ff; margin-bottom: 10px; }
        h1 { margin: 0; font-size: 24px; line-height: 1.15; color: #f5f7ff; }
        .subtitle { margin-top: 10px; color: #c7cbe6; font-size: 14px; line-height: 1.6; max-width: 70ch; }
        .content { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 16px; padding: 18px 24px 24px; }
        .panel { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 16px; }
        .panelTitle { margin: 0 0 12px; color: #eef2ff; font-size: 13px; text-transform: uppercase; letter-spacing: .14em; }
        .steps { display: grid; gap: 12px; }
        .step { display: grid; grid-template-columns: 44px 1fr; gap: 12px; align-items: start; padding: 14px; border-radius: 16px; background: linear-gradient(180deg, rgba(143, 107, 255, 0.16), rgba(255,255,255,0.04)); border: 1px solid rgba(142,160,255,0.18); }
        .stepIndex { width: 44px; height: 44px; border-radius: 14px; display: grid; place-items: center; background: linear-gradient(180deg, #8f6bff, #6a42f5); color: white; font-weight: 800; font-size: 18px; box-shadow: 0 12px 28px rgba(106,66,245,0.35); }
        .stepLabel { color: #ffffff; font-weight: 700; margin: 0 0 4px; }
        .stepText { margin: 0; color: #c7cbe6; font-size: 14px; line-height: 1.55; }
        .infoRow { display: grid; gap: 10px; }
        .infoBox { padding: 14px; border-radius: 16px; background: rgba(15,17,21,0.8); border: 1px solid rgba(255,255,255,0.07); }
        .meta { margin: 0; color: #c7cbe6; font-size: 14px; line-height: 1.7; }
        .meta strong { color: #eef2ff; }
        .cta { margin-top: 14px; display: inline-flex; align-items: center; justify-content: center; gap: 10px; padding: 12px 18px; border-radius: 999px; background: linear-gradient(180deg, #ffffff, #e8ebff); color: #12131a; text-decoration: none; font-weight: 800; }
        .cta:hover { transform: translateY(-1px); }
        .note { margin-top: 12px; font-size: 12px; color: #94a3b8; }
        .summaryCard { margin-top: 14px; padding: 14px; border-radius: 16px; background: rgba(143, 107, 255, 0.12); border: 1px solid rgba(142,160,255,0.18); }
        .summaryTitle { margin: 0 0 6px; color: #fff; font-size: 14px; font-weight: 700; }
        .summaryText { margin: 0; color: #c7cbe6; font-size: 14px; line-height: 1.55; }
        @media (max-width: 820px) { .content { grid-template-columns: 1fr; } }
    </style>
</head>
<body>
    <div class="wrap">
        <div class="card">
            <div class="header">
                <div class="kicker">Hover Card</div>
                <h1>${escapePdfText(title || "Roadmap topic")}</h1>
            </div>
            <div class="content">
                <div class="panel">
                    <p class="panelTitle">First Steps</p>
                    <div class="steps">
                        ${(Array.isArray(learn) ? learn : []).slice(0, 3).map((item, index) => `
                            <div class="step">
                                <div class="stepIndex">${index + 1}</div>
                                <div>
                                    <p class="stepLabel">Step ${index + 1}</p>
                                    <p class="stepText">${escapePdfText(item)}</p>
                                </div>
                            </div>
                        `).join("") || `
                            <div class="step">
                                <div class="stepIndex">1</div>
                                <div>
                                    <p class="stepLabel">Step 1</p>
                                    <p class="stepText">Core concepts</p>
                                </div>
                            </div>
                            <div class="step">
                                <div class="stepIndex">2</div>
                                <div>
                                    <p class="stepLabel">Step 2</p>
                                    <p class="stepText">Practice examples</p>
                                </div>
                            </div>
                            <div class="step">
                                <div class="stepIndex">3</div>
                                <div>
                                    <p class="stepLabel">Step 3</p>
                                    <p class="stepText">Review and revise</p>
                                </div>
                            </div>
                        `}
                    </div>
                    <div class="summaryCard">
                        <p class="summaryTitle">Quick summary</p>
                        <p class="summaryText">${escapePdfText(reason || "Use these first steps to build momentum before moving deeper into the roadmap.")}</p>
                    </div>
                </div>
                <div class="panel">
                    <p class="panelTitle">Channel Card</p>
                    <div class="infoRow">
                        <div class="infoBox">
                            <p class="meta"><strong>Channel:</strong> ${escapePdfText(provider || "YouTube")}</p>
                            <p class="meta"><strong>Focus:</strong> ${escapePdfText(reason || "Focus on this topic next.")}</p>
                            <p class="meta"><strong>Link:</strong> ${escapePdfText(channelLink || "")}</p>
                        </div>
                        <div class="infoBox">
                            <p class="meta"><strong>What to do:</strong> Open the channel, watch the related lesson, then try one short practice task.</p>
                        </div>
                    </div>
                    <a class="cta" href="${channelLink || '#'}" target="_blank" rel="noopener noreferrer">Open Channel</a>
                    <div class="note">This is a hover/info card, not a video player.</div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>`

const extractRoadmapFocusHints = (session) => {
    const weakTopics = Array.isArray(session?.roadmap) ? session.roadmap.slice(0, 5).join(", ") : ""
    const feedback = compactText(session?.finalFeedback || "", 220)
    const weakQuestions = Array.isArray(session?.questions)
        ? session.questions.filter((q) => Number(q.score || 0) < 60)
        : []

    const weakCategories = [...new Set(
        weakQuestions
            .map((q) => String(q.category || "general").toLowerCase())
            .filter(Boolean)
    )]

    const questionHints = weakQuestions.slice(0, 4).map((q) => compactText(q.questionText, 120)).join("; ")

    return compactText(
        [
            weakTopics ? `Weak topics: ${weakTopics}` : "",
            feedback ? `Feedback: ${feedback}` : "",
            weakCategories.length ? `Low-performing categories: ${weakCategories.join(", ")}` : "",
            questionHints ? `Example weak questions: ${questionHints}` : ""
        ]
            .filter(Boolean)
            .join(" | "),
        280
    )
}

const buildRoadmapPrompt = (session) => {
    const role = compactText(session.targetRole, 80)
    const difficulty = compactText(session.difficulty || "medium", 20)
    const score = Number(session?.overallScore || 0)
    const technicalScore = Number(session?.technicalScore || 0)
    const clarityScore = Number(session?.clarityScore || 0)
    const confidenceScore = Number(session?.confidenceScore || 0)
    const mode = compactText(session.mode || "interview_mock", 40)
    const topic = compactText(session.topic || "general", 80)
    const focusHints = extractRoadmapFocusHints(session) || `Use the interview result and feedback to create the best next learning roadmap.`

    return `
Create a compact role roadmap JSON for one learner.
Role: ${role}
Mode: ${mode}
Topic: ${topic}
Difficulty: ${difficulty}
Overall score: ${score}
Technical score: ${technicalScore}
Clarity score: ${clarityScore}
Confidence score: ${confidenceScore}
Focus hints: ${focusHints}

Instructions:
- Generate a practical, detailed roadmap that connects the user's interview result, score breakdown, and feedback.
- Use up to 14 roadmap nodes and up to 18 supporting resources.
- Keep learning order logical, dependency-aware, and actionable.
- Titles should be concise and each node summary should explain what to study and why.
- Resources should include real-looking providers when relevant, such as YouTube, docs, courses, or practice platforms.
- No markdown, no extra explanations, only valid JSON.

Return JSON only:
{
  "version": 1,
  "generatedBy": "groq",
  "summary": "...",
  "totalWeeks": 12,
  "nodes": [
    {
      "nodeId": "n1",
      "title": "...",
      "phase": "foundation|applied|interview",
      "level": "beginner|intermediate|advanced",
      "durationWeeks": 1,
      "summary": "...",
      "hoverTip": "...",
      "dependsOn": ["n0"],
      "resourceKeys": ["r1", "r2"]
    }
  ],
  "resources": [
    {
      "key": "r1",
      "title": "...",
      "provider": "...",
      "type": "youtube|course|docs|practice",
      "url": "",
      "reason": "..."
    }
  ]
}
`
}

const mapResult = (session, baseUrl = "") => ({
    resultId: session._id,
    sessionId: session._id,
    mode: session.mode,
    role: session.targetRole,
    topic: session.topic || "",
    status: session.status,
    overallScore: session.overallScore,
    mcqScore: session.mcqScore,
    aptitudeScore: session.aptitudeScore,
    resumeScore: session.resumeScore,
    technicalScore: session.technicalScore,
    clarityScore: session.clarityScore,
    confidenceScore: session.confidenceScore,
    feedback: session.finalFeedback,
    jobRecommendations: Array.isArray(session.jobRecommendations)
        ? session.jobRecommendations.map((item) => ({
            title: compactText(item?.title || "", 120),
            employerName: compactText(item?.employerName || "", 100),
            employerLogo: compactText(item?.employerLogo || "", 260),
            location: compactText(item?.location || "", 120),
            employmentType: compactText(item?.employmentType || "", 40),
            description: compactText(item?.description || "", 280),
            applyUrl: compactText(item?.applyUrl || "", 260),
            source: compactText(item?.source || "jsearch", 20)
        }))
        : [],
    roadmap: session.roadmap,
    roadmapDetails: sanitizeStoredRoadmapDetails(session.roadmapDetails, baseUrl, session._id) || null,
    questionsCount: Array.isArray(session.questions) ? session.questions.length : 0,
    questionsAnswered: Array.isArray(session.questions)
        ? session.questions.filter((question) => Boolean(question.userAnswer)).length
        : 0,
    durationMinutes: session.durationMinutes || 0,
    startedAt: session.startedAt,
    createdAt: session.createdAt,
    completedAt: session.completedAt,
    displayDate: session.completedAt || session.createdAt
})

const serializeResultResponse = (session, baseUrl = "", user = null) => {
    const mapped = mapResult(session, baseUrl)

    // Use user's resume analysis score if available
    const finalResumeScore = user?.resume?.analyzed && user?.resume?.score 
        ? user.resume.score 
        : mapped.resumeScore

    return {
        ...mapped,
        resumeScore: finalResumeScore,
        result: {
            ...mapped,
            resumeScore: finalResumeScore
        },
        roadmapDetails: mapped.roadmapDetails,
        roadmap: mapped.roadmap,
        nodes: mapped.roadmapDetails?.nodes || [],
        resources: mapped.roadmapDetails?.resources || [],
        resultId: mapped.resultId,
        sessionId: mapped.sessionId,
        layout: mapped.roadmapDetails?.resources?.length ? "box" : "default",
        displayMode: mapped.roadmapDetails?.resources?.length ? "box" : "default",
        resumeAnalysis: user?.resume?.analyzed ? {
            analyzed: true,
            score: user.resume.score,
            feedback: user.resume.feedback,
            analyzedAt: user.resume.analyzedAt
        } : {
            analyzed: false,
            score: 0,
            feedback: null,
            analyzedAt: null
        }
    }
}

export const getLatestResult = async (req, res) => {
    try {
        const baseUrl = getApiBaseUrl(req)
        const latest = await Session.findOne({ userId: req.user._id, status: "completed" })
            .sort({ completedAt: -1 })

        if (!latest) {
            return res.status(404).json({
                success: false,
                message: "No completed result found"
            })
        }

        const user = await User.findById(req.user._id)

        return res.status(200).json({
            success: true,
            ...serializeResultResponse(latest, baseUrl, user)
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch latest result",
            error: error.message
        })
    }
}

export const getResultById = async (req, res) => {
    try {
        const baseUrl = getApiBaseUrl(req)
        const result = await Session.findOne({ _id: req.params.resultId, userId: req.user._id })

        if (!result) {
            return res.status(404).json({
                success: false,
                message: "Result not found"
            })
        }

        const user = await User.findById(req.user._id)

        return res.status(200).json({
            success: true,
            ...serializeResultResponse(result, baseUrl, user)
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch result",
            error: error.message
        })
    }
}

export const getResults = async (req, res) => {
    try {
        const baseUrl = getApiBaseUrl(req)
        const { type, page = 1, limit = 20 } = req.query
        const parsedPage = Math.max(1, Number(page) || 1)
        const parsedLimit = Math.max(1, Math.min(100, Number(limit) || 20))

        const filter = { userId: req.user._id }
        if (type === "interview") filter.mode = "interview_mock"
        if (type === "mcq") filter.mode = "mcq_practice"

        const [items, total] = await Promise.all([
            Session.find(filter)
                .sort({ createdAt: -1 })
                .skip((parsedPage - 1) * parsedLimit)
                .limit(parsedLimit),
            Session.countDocuments(filter)
        ])

        return res.status(200).json({
            success: true,
            page: parsedPage,
            limit: parsedLimit,
            total,
            results: items.map((item) => serializeResultResponse(item, baseUrl))
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch results",
            error: error.message
        })
    }
}

export const exportResultPdf = async (req, res) => {
    try {
        const result = await Session.findOne({ _id: req.params.resultId, userId: req.user._id })

        if (!result) {
            return res.status(404).json({
                success: false,
                message: "Result not found"
            })
        }

        const lines = [
            "PrepAI Result",
            `Role: ${escapePdfText(result.targetRole || "N/A")}`,
            `Mode: ${escapePdfText(result.mode || "N/A")}`,
            `Status: ${escapePdfText(result.status || "N/A")}`,
            `Overall Score: ${Number(result.overallScore || 0)}`,
            `Technical Score: ${Number(result.technicalScore || 0)}`,
            `Clarity Score: ${Number(result.clarityScore || 0)}`,
            `Confidence Score: ${Number(result.confidenceScore || 0)}`,
            `Questions Answered: ${Array.isArray(result.questions) ? result.questions.filter((q) => Boolean(q.userAnswer)).length : 0}`,
            `Feedback: ${escapePdfText(result.finalFeedback || "N/A")}`
        ]

        const contentOps = lines
            .map((line, index) => `${index === 0 ? "50 760 Td" : "0 -18 Td"} (${line}) Tj`)
            .join(" ")

        const contentStream = `BT /F1 12 Tf ${contentOps} ET`
        const contentLength = Buffer.byteLength(contentStream, "utf8")

        const pdfText = `%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length ${contentLength}>>stream\n${contentStream}\nendstream endobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\nxref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000117 00000 n \n0000000243 00000 n \n0000000415 00000 n \ntrailer<</Root 1 0 R/Size 6>>\nstartxref\n490\n%%EOF`

        res.setHeader("Content-Type", "application/pdf")
        res.setHeader("Content-Disposition", `attachment; filename=result-${result._id}.pdf`)
        return res.status(200).send(Buffer.from(pdfText))
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to export result PDF",
            error: error.message
        })
    }
}

export const getResultRecommendations = async (req, res) => {
    try {
        const result = await Session.findOne({ _id: req.params.resultId, userId: req.user._id })

        if (!result) {
            return res.status(404).json({
                success: false,
                message: "Result not found"
            })
        }

        const recommendations = result.roadmap?.length
            ? result.roadmap
            : [
                "Practice one timed mock interview daily",
                "Improve answer structure using STAR format",
                "Strengthen role-specific fundamentals",
                "Review mistakes and reattempt weak topics"
            ]

        return res.status(200).json({
            success: true,
            resultId: result._id,
            recommendations
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch recommendations",
            error: error.message
        })
    }
}

export const generateDetailedRoadmap = async (req, res) => {
    try {
        const baseUrl = getApiBaseUrl(req)
        const result = await Session.findOne({ _id: req.params.resultId, userId: req.user._id })

        if (!result) {
            return res.status(404).json({
                success: false,
                message: "Result not found"
            })
        }

        const regenerate = Boolean(req.body?.regenerate)
        const cachedRoadmap = sanitizeStoredRoadmapDetails(result.roadmapDetails, baseUrl, result._id)
        const shouldRefreshCachedRoadmap = Boolean(cachedRoadmap) && shouldRefreshRoadmapDetails(cachedRoadmap)

        if (cachedRoadmap && !regenerate && !shouldRefreshCachedRoadmap) {
            logAiCacheHit({
                feature: "roadmap",
                provider: cachedRoadmap?.generatedBy || "cache",
                source: "result-session"
            })
            return res.status(200).json({
                success: true,
                resultId: result._id,
                cached: true,
                roadmapDetails: cachedRoadmap
            })
        }

        if (!regenerate) {
            const reusable = await findReusableRoadmapDetails({
                userId: req.user._id,
                currentResultId: result._id,
                targetRole: result.targetRole,
                difficulty: result.difficulty,
                baseUrl
            })

            if (reusable?.roadmapDetails) {
                logAiCacheHit({
                    feature: "roadmap",
                    provider: reusable.roadmapDetails?.generatedBy || "cache",
                    source: "user-history",
                    sourceResultId: String(reusable.sourceResultId || "")
                })
                result.roadmapDetails = reusable.roadmapDetails
                if (!Array.isArray(result.roadmap) || !result.roadmap.length) {
                    result.roadmap = reusable.roadmapDetails.nodes.slice(0, 6).map((node) => node.title)
                }
                await result.save()

                return res.status(200).json({
                    success: true,
                    resultId: result._id,
                    cached: true,
                    reused: true,
                    sourceResultId: reusable.sourceResultId,
                    roadmapDetails: sanitizeStoredRoadmapDetails(result.roadmapDetails, baseUrl, result._id)
                })
            }
        }

        let roadmapDetails
        try {
            const prompt = buildRoadmapPrompt(result)
            const parsed = await callGroqRoadmapJson({ prompt, maxTokens: 900 })
            roadmapDetails = normalizeRoadmapDetails(parsed, result, baseUrl, result._id)
            if (String(roadmapDetails?.generatedBy || "").toLowerCase() === "fallback") {
                logAiFallback({
                    feature: "roadmap",
                    provider: "Groq",
                    reason: "normalized-to-fallback"
                })
            }
        } catch {
            logAiFallback({
                feature: "roadmap",
                provider: "Groq",
                reason: "groq-call-failed"
            })
            roadmapDetails = buildFallbackRoadmapDetails(result, baseUrl, result._id)
        }

        result.roadmapDetails = roadmapDetails
        if (!Array.isArray(result.roadmap) || !result.roadmap.length) {
            result.roadmap = roadmapDetails.nodes.slice(0, 6).map((node) => node.title)
        }
        await result.save()

        return res.status(200).json({
            success: true,
            resultId: result._id,
            cached: false,
            roadmapDetails: sanitizeStoredRoadmapDetails(result.roadmapDetails, baseUrl, result._id)
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to generate detailed roadmap",
            error: error.message
        })
    }
}

export const getRoadmapStatus = async (req, res) => {
    try {
        const result = await Session.findOne({ _id: req.params.resultId, userId: req.user._id })

        if (!result) {
            return res.status(404).json({
                success: false,
                message: "Result not found"
            })
        }

        const generated = Boolean(result.roadmapDetails && Array.isArray(result.roadmapDetails.nodes) && result.roadmapDetails.nodes.length)

        return res.status(200).json({
            success: true,
            resultId: result._id,
            generated,
            generatedAt: result.roadmapDetails?.generatedAt || null,
            roadmapDetails: generated ? sanitizeStoredRoadmapDetails(result.roadmapDetails, getApiBaseUrl(req), result._id) : null,
            roadmap: result.roadmap || []
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch roadmap status",
            error: error.message
        })
    }
}

export const getRoadmapVideoPreview = async (req, res) => {
    try {
        const result = await Session.findOne({ _id: req.params.resultId, userId: req.user._id })

        if (!result || !result.roadmapDetails?.resources?.length) {
            return res.status(404).send("Preview not found")
        }

        const resource = result.roadmapDetails.resources.find((item) => String(item?.key || "") === String(req.params.resourceKey || ""))

        if (!resource) {
            return res.status(404).send("Video not found")
        }

        const learn = Array.isArray(resource.learn) ? resource.learn : []
        const channelLink = compactText(resource.channelLink || resource.url || "", 220)
        const html = renderRoadmapVideoPreviewHtml({
            title: resource.title,
            provider: resource.provider,
            reason: resource.reason,
            learn,
            channelLink
        })

        res.setHeader("Content-Type", "text/html; charset=utf-8")
        res.setHeader("Cache-Control", "no-store")
        return res.status(200).send(html)
    } catch (error) {
        return res.status(500).send("Failed to load preview")
    }
}
