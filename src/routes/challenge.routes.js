import express from "express"
import { verifyjwt } from "../middleware/auth.middleware.js"
import { getDailyChallenge, submitDailyChallenge, evaluateChallengeAnswer, resetDailyChallenge } from "../controller/challenge.controller.js"

const router = express.Router()

router.get("/", verifyjwt, getDailyChallenge)
router.post("/evaluate", verifyjwt, evaluateChallengeAnswer)
router.post("/submit", verifyjwt, submitDailyChallenge)
router.post("/reset", verifyjwt, resetDailyChallenge)

export default router
