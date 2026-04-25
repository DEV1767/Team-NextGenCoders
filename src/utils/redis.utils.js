import redisClient from "../config/redis.js";

// Cache user session data
export const cacheUserSession = async (userId, userData) => {
    try {
        await redisClient.setEx(`user:${userId}`, 3600, JSON.stringify(userData));
    } catch (error) {
        console.log("Cache user session error:", error);
    }
};

// Get cached user data
export const getCachedUser = async (userId) => {
    try {
        const cachedUser = await redisClient.get(`user:${userId}`);
        return cachedUser ? JSON.parse(cachedUser) : null;
    } catch (error) {
        console.log("Get cached user error:", error);
        return null;
    }
};

// Blacklist a token (for logout)
export const blacklistToken = async (token, expiryTime) => {
    try {
        await redisClient.setEx(`blacklist:${token}`, expiryTime, 'true');
    } catch (error) {
        console.log("Blacklist token error:", error);
    }
};

// Check if token is blacklisted
export const isTokenBlacklisted = async (token) => {
    try {
        const isBlacklisted = await redisClient.get(`blacklist:${token}`);
        return isBlacklisted ? true : false;
    } catch (error) {
        console.log("Check blacklist error:", error);
        return false;
    }
};

// Rate limiting - increment login attempts
export const incrementLoginAttempts = async (email) => {
    try {
        const attempts = await redisClient.incr(`login_attempts:${email}`);
        if (attempts === 1) {
            // Set expiry only on first attempt
            await redisClient.expire(`login_attempts:${email}`, 900); // 15 minutes
        }
        return attempts;
    } catch (error) {
        console.log("Increment login attempts error:", error);
        return 0;
    }
};

// Check if user is rate limited
export const isUserRateLimited = async (email) => {
    try {
        const blocked = await redisClient.get(`login_blocked:${email}`);
        return blocked ? true : false;
    } catch (error) {
        console.log("Check rate limit error:", error);
        return false;
    }
};

// Block user after too many attempts
export const blockUserLogin = async (email) => {
    try {
        await redisClient.setEx(`login_blocked:${email}`, 900, 'true'); // Block for 15 minutes
    } catch (error) {
        console.log("Block user login error:", error);
    }
};

// Reset login attempts
export const resetLoginAttempts = async (email) => {
    try {
        await redisClient.del(`login_attempts:${email}`);
    } catch (error) {
        console.log("Reset login attempts error:", error);
    }
};

// Store refresh token
export const storeRefreshToken = async (userId, token) => {
    try {
        await redisClient.setEx(`refresh_token:${userId}`, 604800, token); // 7 days
    } catch (error) {
        console.log("Store refresh token error:", error);
    }
};

// Get stored refresh token
export const getStoredRefreshToken = async (userId) => {
    try {
        return await redisClient.get(`refresh_token:${userId}`);
    } catch (error) {
        console.log("Get refresh token error:", error);
        return null;
    }
};

// Remove refresh token (logout)
export const removeRefreshToken = async (userId) => {
    try {
        await redisClient.del(`refresh_token:${userId}`);
    } catch (error) {
        console.log("Remove refresh token error:", error);
    }
};

const getInterviewStateKey = (sessionId, userId) => `interview_state:${userId}:${sessionId}`;

// Store live interview loop state in Redis so interview questions are not persisted in MongoDB
export const saveInterviewLoopState = async (sessionId, userId, state, ttlSeconds = 7200) => {
    try {
        const key = getInterviewStateKey(sessionId, userId);
        await redisClient.setEx(key, ttlSeconds, JSON.stringify(state));
    } catch (error) {
        console.log("Save interview state error:", error);
    }
};

// Get live interview loop state from Redis
export const getInterviewLoopState = async (sessionId, userId) => {
    try {
        const key = getInterviewStateKey(sessionId, userId);
        const state = await redisClient.get(key);
        return state ? JSON.parse(state) : null;
    } catch (error) {
        console.log("Get interview state error:", error);
        return null;
    }
};

// Clear live interview loop state after completion or abandonment
export const clearInterviewLoopState = async (sessionId, userId) => {
    try {
        const key = getInterviewStateKey(sessionId, userId);
        await redisClient.del(key);
    } catch (error) {
        console.log("Clear interview state error:", error);
    }
};