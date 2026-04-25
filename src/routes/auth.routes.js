import express from "express"
import { registeruser, login, logout, resetPassword } from "../controller/auth.controller.js"
import { verifyjwt } from "../middleware/auth.middleware.js"

const router = express.Router()

router.post("/register", registeruser)
router.post("/login", login)
router.post("/logout",verifyjwt, logout)
router.post("/resetpassword", verifyjwt, resetPassword)
router.post("/restepassword", verifyjwt, resetPassword)

export default router