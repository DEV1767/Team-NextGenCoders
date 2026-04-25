import express from "express"
import { getMe, getUser, updateMe, analyzeResume } from "../controller/user.controller.js"
import { verifyjwt } from "../middleware/auth.middleware.js"

const router = express.Router()

router.get("/me", verifyjwt, getMe)
router.patch("/me", verifyjwt, updateMe)
router.post("/resume/analyze", verifyjwt, analyzeResume)

router.get("/:id", verifyjwt, getUser)


export default router