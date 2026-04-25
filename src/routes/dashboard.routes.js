import express from "express"
import { verifyjwt } from "../middleware/auth.middleware.js"
import {
    getDashboardStats,
    getDashboardSummary,
    getScoreTrend,
    getWeeklyActivity
} from "../controller/dashboard.controller.js"

const router = express.Router()

router.get("/summary", verifyjwt, getDashboardSummary)
router.get("/stats", verifyjwt, getDashboardStats)
router.get("/weekly-activity", verifyjwt, getWeeklyActivity)
router.get("/score-trend", verifyjwt, getScoreTrend)

export default router
