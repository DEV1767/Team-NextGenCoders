import express from "express"
import { verifyjwt } from "../middleware/auth.middleware.js"
import { getLeaderboard } from "../controller/leaderboard.controller.js"

const router = express.Router()

router.get("/", verifyjwt, getLeaderboard)

export default router
