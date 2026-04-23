
import mongoose from "mongoose"

const questionSchema = new mongoose.Schema(
    {
        questionNumber: {
            type: Number,
            required: true,
            min: 1
        },
        questionText: {
            type: String,
            required: true,
            trim: true
        },
        questionType: {
            type: String,
            enum: ["mcq", "interview"],
            default: "mcq"
        },
        category: {
            type: String,
            enum: ["coding", "theory", "behavioral"],
            default: "theory"
        },
        options: {
            type: [String],
            default: []
        },
        correctOptionIndex: {
            type: Number,
            default: null
        },
        tone: {
            type: String,
            enum: ["normal", "fun"],
            default: "normal"
        },
        userAnswer: {
            type: String,
            default: ""
        },
        answerMode: {
            type: String,
            enum: ["voice", "text"],
            default: "text"
        },
        score: {
            type: Number,
            min: 0,
            max: 100,
            default: 0
        },
        feedback: {
            type: String,
            default: ""
        },
        answeredAt: {
            type: Date,
            default: null
        }
    },
    { _id: false }
)

const roadmapNodeSchema = new mongoose.Schema(
    {
        nodeId: { type: String, required: true, trim: true },
        title: { type: String, required: true, trim: true },
        phase: { type: String, default: "core", trim: true },
        level: { type: String, default: "beginner", trim: true },
        durationWeeks: { type: Number, default: 1, min: 1 },
        summary: { type: String, default: "", trim: true },
        hoverTip: { type: String, default: "", trim: true },
        dependsOn: { type: [String], default: [] },
        resourceKeys: { type: [String], default: [] }
    },
    { _id: false }
)

const roadmapResourceSchema = new mongoose.Schema(
    {
        key: { type: String, required: true, trim: true },
        title: { type: String, required: true, trim: true },
        provider: { type: String, default: "", trim: true },
        type: { type: String, default: "video", trim: true },
        url: { type: String, default: "", trim: true },
        reason: { type: String, default: "", trim: true }
    },
    { _id: false }
)

const roadmapDetailsSchema = new mongoose.Schema(
    {
        version: { type: Number, default: 1, min: 1 },
        generatedBy: { type: String, default: "", trim: true },
        generatedAt: { type: Date, default: null },
        summary: { type: String, default: "", trim: true },
        totalWeeks: { type: Number, default: 0, min: 0 },
        nodes: { type: [roadmapNodeSchema], default: [] },
        resources: { type: [roadmapResourceSchema], default: [] }
    },
    { _id: false }
)

const sessionSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Users",
            required: true
        },
        mode: {
            type: String,
            enum: ["mcq_practice", "interview_mock"],
            required: true
        },
        difficulty: {
            type: String,
            enum: ["basic", "easy", "medium", "hard", "advance"],
            default: "medium"
        },
        targetRole: {
            type: String,
            required: true,
            trim: true
        },
        topic: {
            type: String,
            default: ""
        },
        status: {
            type: String,
            enum: ["generating", "ongoing", "completed", "abandoned"],
            default: "ongoing"
        },
        generationStartedAt: {
            type: Date,
            default: Date.now
        },
        generationCompletedAt: {
            type: Date,
            default: null
        },
        resumeSnapshot: {
            fileName: { type: String, default: "" },
            fileURL: { type: String, default: "" },
            publicId: { type: String, default: "" },
            summary: { type: String, default: "" },
            candidateName: { type: String, default: "" }
        },
        questions: {
            type: [questionSchema],
            default: []
        },
        overallScore: { type: Number, default: 0, min: 0, max: 100 },
        technicalScore: { type: Number, default: 0, min: 0, max: 100 },
        clarityScore: { type: Number, default: 0, min: 0, max: 100 },
        confidenceScore: { type: Number, default: 0, min: 0, max: 100 },
        finalFeedback: { type: String, default: "" },
        roadmap: { type: [String], default: [] },
        roadmapDetails: { type: roadmapDetailsSchema, default: null },
        verdict: {
            verdict: { type: String, enum: ["HIRE", "NO HIRE", "MAYBE"], default: "MAYBE" },
            reason: { type: String, default: "" }
        },
        readinessByCompanyType: {
            startup: { score: { type: Number, default: 0, min: 0, max: 100 }, reason: { type: String, default: "" } },
            midsize: { score: { type: Number, default: 0, min: 0, max: 100 }, reason: { type: String, default: "" } },
            faang: { score: { type: Number, default: 0, min: 0, max: 100 }, reason: { type: String, default: "" } }
        },
        tabSwitches: { type: Number, default: 0, min: 0 },
        tabSwitchTimestamps: { type: [Date], default: [] },
        startedAt: { type: Date, default: Date.now },
        completedAt: { type: Date, default: null },
        durationMinutes: { type: Number, default: 0, min: 0 }
    },
    { timestamps: true }
)

export default mongoose.model("Session", sessionSchema)