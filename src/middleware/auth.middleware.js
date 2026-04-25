import jwt from "jsonwebtoken"
import User from "../model/user.model.js"

export const verifyjwt = async (req, res, next) => {
    try {
        let token = req.cookies?.accessToken;
        if (!token && req.headers.authorization) {
            token = req.headers.authorization.split(" ")[1]
        }
        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Accesstoken is missing from cookies or headers"
            })
        }

        const decodetoken = jwt.verify(
            token,
            process.env.ACCESS_TOKEN_SECRET
        )
        const user = await User.findById(decodetoken._id)
        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid access token"
            })
        }
        req.user = user;
        next()
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired access token"
        });
    }

}