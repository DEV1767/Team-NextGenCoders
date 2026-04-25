import mongoose from "mongoose"

const flashcardSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Users",
            required: true
        },
        sessionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Session"
        },
        question: {
            type: String,
            required: true,
            trim: true
        },
        answer: {
            type: String,
            required: true,
            trim: true
        },
        category: {
            type: String,
            default: "General",
            trim: true
        },
        difficulty: {
            type: String,
            enum: ["easy", "medium", "hard"],
            default: "medium",
            lowercase: true,
            trim: true
        },
        tags: {
            type: [String],
            default: []
        },
        status: {
            type: String,
            enum: ["unseen", "learning", "mastered"],
            default: "unseen",
            lowercase: true,
            trim: true
        },
        dayNumber: {
            type: Number,
            default: 1,
            min: 1
        },
        reviewAfterDays: {
            type: Number,
            default: 1,
            min: 1,
            max: 3
        },
        nextReviewAt: {
            type: Date,
            default: Date.now
        }
    },
    { timestamps: true }
)

export default mongoose.model("Flashcard", flashcardSchema)
