import express from "express"
import { verifyjwt } from "../middleware/auth.middleware.js"
import { getQuestionBank } from "../controller/interview.controller.js"

const router = express.Router()

router.get("/question-bank", verifyjwt, getQuestionBank)

export default router
