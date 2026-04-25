import express from "express"
import { verifyjwt } from "../middleware/auth.middleware.js"
import { getMcqProgress, getMcqQuestions, submitMcqAttempt } from "../controller/mcq.controller.js"

const router = express.Router()

router.get("/questions", verifyjwt, getMcqQuestions)
router.post("/attempts", verifyjwt, submitMcqAttempt)
router.get("/progress", verifyjwt, getMcqProgress)

export default router
