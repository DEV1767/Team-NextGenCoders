import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config()

const URL = process.env.MONGO_URL

export const connect_db = async () => {
    try {
        if (!URL) {
            throw new Error("URL is missing")
        }
        await mongoose.connect(URL)
        console.log("Database is connected")
    } catch (error) {
        console.log("Database connection error:", error);
    }

}

