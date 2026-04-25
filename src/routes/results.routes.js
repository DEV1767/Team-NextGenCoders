import express from "express"
import { verifyjwt } from "../middleware/auth.middleware.js"
import {
    exportResultPdf,
    generateDetailedRoadmap,
    getLatestResult,
    getResultById,
    getResultRecommendations,
    getRoadmapStatus,
    getRoadmapVideoPreview,
    getResults
} from "../controller/results.controller.js"

const router = express.Router()

router.get("/latest", verifyjwt, getLatestResult)
router.get("/", verifyjwt, getResults)
router.get("/:resultId/export/pdf", verifyjwt, exportResultPdf)
router.get("/:resultId/recommendations", verifyjwt, getResultRecommendations)
router.get("/:resultId/roadmap/status", verifyjwt, getRoadmapStatus)
router.get("/:resultId/roadmap/preview/:resourceKey", verifyjwt, getRoadmapVideoPreview)
router.post("/:resultId/roadmap", verifyjwt, generateDetailedRoadmap)
router.get("/:resultId", verifyjwt, getResultById)

export default router
