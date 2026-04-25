import dotenv from "dotenv"
dotenv.config()

import { createClient } from "redis";


const redisClient = createClient({
    url: process.env.REDIS_URL
})

redisClient.on("error", (err) => {
    console.log("Redis Error:", err)
})


export const connectRedis = async () => {
    try {
        await redisClient.connect();
        console.log("Redis Connected")
    } catch (error) {
        console.log("Redis failed", error.message)
    }
}


connectRedis()
export default redisClient;