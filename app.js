import express from "express"
import cookieParser from "cookie-parser"
import cors from "cors"
import authRoute from "./src/routes/auth.routes.js"
import userRouter from "./src/routes/user.route.js"
import uploadRoutes from "./src/routes/upload.routes.js"
import sessionRoutes from "./src/routes/session.routes.js"
import onboardingRoutes from "./src/routes/onboarding.routes.js"
import dashboardRoutes from "./src/routes/dashboard.routes.js"
import interviewRoutes from "./src/routes/interview.routes.js"
import resultsRoutes from "./src/routes/results.routes.js"
import mcqRoutes from "./src/routes/mcq.routes.js"
import landingRoutes from "./src/routes/landing.routes.js"
import flashcardRoutes from "./src/routes/flashcard.routes.js"
import challengeRoutes from "./src/routes/challenge.routes.js"
import leaderboardRoutes from "./src/routes/leaderboard.routes.js"

const app = express()

// CORS configuration
const corsOptions = {
    origin: [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        "http://localhost:8000"
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}

app.use(cors(corsOptions))
app.use(express.json({ limit: "50mb" }))
app.use(express.urlencoded({ limit: "50mb", extended: true }))
app.use(cookieParser())

app.get("/ping", (req, res) => {
    res.send("PONG")
})

app.use("/api/v1/auth", authRoute)
app.use("/api/v1/user", userRouter)
app.use("/api/v1/upload",uploadRoutes)
app.use("/api/v1/session", sessionRoutes)
app.use("/api/v1", onboardingRoutes)
app.use("/api/v1/dashboard", dashboardRoutes)
app.use("/api/v1/interview", interviewRoutes)
app.use("/api/v1/results", resultsRoutes)
app.use("/api/v1/mcq", mcqRoutes)
app.use("/api/v1/landing", landingRoutes)
app.use("/api/v1/flashcards", flashcardRoutes)
app.use("/api/v1/challenge", challengeRoutes)
app.use("/api/v1/leaderboard", leaderboardRoutes)
export default app