import express from "express"
import { verifyjwt } from "../middleware/auth.middleware.js"
import { getExperienceLevels, getRoles, saveOnboarding } from "../controller/onboarding.controller.js"

const router = express.Router()

router.get("/roles", getRoles)
router.get("/experience-levels", getExperienceLevels)
router.put("/onboarding", verifyjwt, saveOnboarding)

export default router
