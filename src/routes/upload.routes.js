import express from "express"
import { uploadResume, handleUploadError } from "../controller/upload.controller.js"
import { verifyjwt } from "../middleware/auth.middleware.js"
import { upload } from "../middleware/upload.middleware.js"

const router = express.Router()

router.post("/resume", verifyjwt, upload.single('resume'), uploadResume, handleUploadError)

export default router
