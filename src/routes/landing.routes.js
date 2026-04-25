import express from "express"
import {
    getLandingFeatures,
    getLandingHowItWorks,
    getLandingTestimonials
} from "../controller/landing.controller.js"

const router = express.Router()

router.get("/features", getLandingFeatures)
router.get("/how-it-works", getLandingHowItWorks)
router.get("/testimonials", getLandingTestimonials)

export default router
