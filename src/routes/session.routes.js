import express from "express"
import {
    clarifyInterviewQuestion,
    completeSession,
    getAllSessions,
    getSessionById,
    logTabSwitch,
    startsession,
    submitAnswer,
    generateHints
} from "../controller/session.controller.js"
import { verifyjwt } from "../middleware/auth.middleware.js"
import { clarifyInterviewValidator, submitAnswerValidator, startSessionValidator } from "../middleware/joi.validator.js"

const validateRequest = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, { abortEarly: false })
        if (error) {
            const messages = error.details.map(e => e.message).join("; ")
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: messages
            })
        }
        req.body = value
        next()
    }
}

const router = express.Router()

router.post("/start", verifyjwt, validateRequest(startSessionValidator), startsession)
router.post("/answer", verifyjwt, validateRequest(submitAnswerValidator), submitAnswer)
router.post("/clarify", verifyjwt, validateRequest(clarifyInterviewValidator), clarifyInterviewQuestion)
router.post("/hints", verifyjwt, generateHints)
router.post("/tabswitch", verifyjwt, logTabSwitch)
router.post("/complete", verifyjwt, completeSession)
router.get("/", verifyjwt, getAllSessions)
router.get("/:id", verifyjwt, getSessionById)

export default router
