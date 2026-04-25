const formatMeta = (meta = {}) => JSON.stringify(meta)

const log = (level, message, meta = {}) => {
    const timestamp = new Date().toISOString()
    const payload = formatMeta(meta)
    console.log(`[AI:${level}] ${timestamp} ${message} ${payload}`)
}

export const logAiRequest = (meta = {}) => log("REQUEST", `${meta.feature || "unknown"} via ${meta.provider || "unknown"}`, meta)
export const logAiCacheHit = (meta = {}) => log("CACHE", `${meta.feature || "unknown"} cache hit`, meta)
export const logAiSuccess = (meta = {}) => log("SUCCESS", `${meta.feature || "unknown"} completed`, meta)
export const logAiFailure = (meta = {}) => log("FAILURE", `${meta.feature || "unknown"} failed`, meta)
export const logAiFallback = (meta = {}) => log("FALLBACK", `${meta.feature || "unknown"} used fallback`, meta)