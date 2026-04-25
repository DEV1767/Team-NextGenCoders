import express from "express"
import { verifyjwt } from "../middleware/auth.middleware.js"
import { getDueFlashcards, getAllFlashcards, reviewFlashcard, answerFlashcard } from "../controller/flashcard.controller.js"

const router = express.Router()

router.get("/due", verifyjwt, getDueFlashcards)
router.get("/all", verifyjwt, getAllFlashcards)
router.patch("/:id/review", verifyjwt, reviewFlashcard)
router.post("/:id/answer", verifyjwt, answerFlashcard)

export default router
