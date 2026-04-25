import Users from "../model/user.model.js"
import { registerUserSchema, loginUserschema, resetPasswordSchema } from "../middleware/joi.validator.js"
import {
    cacheUserSession,
    incrementLoginAttempts,
    isUserRateLimited,
    blockUserLogin,
    resetLoginAttempts,
    storeRefreshToken,
    blacklistToken
} from "../utils/redis.utils.js"



export const registeruser = async (req, res) => {
    try {
        const { error, value } = registerUserSchema.validate(req.body)
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            })
        }
        const {
            username,
            email,
            password,
            collegeName,
            course,
            graduationYear,
            batchYear
        } = value
        const resolvedGraduationYear = graduationYear || batchYear
        const resolvedCourse = course || "General"
        const isUserpresent = await Users.findOne({ email })
        if (isUserpresent) {
            return res.status(400).json({
                success: false,
                message: "User already Present"
            })
        }

        const newUser = await Users.create({
            username,
            email,
            password,
            collegeName,
            course: resolvedCourse,
            graduationYear: resolvedGraduationYear
        })


        await cacheUserSession(newUser._id, {
            id: newUser._id,
            username: newUser.username,
            email: newUser.email,
            collegeName: newUser.collegeName,
            course: newUser.course,
            graduationYear: newUser.graduationYear
        })

        return res.status(201).json({
            success: true,
            message: "Register successfully",
            newUser: {
                username: newUser.username,
                email: newUser.email,
                collegeName: newUser.collegeName,
                course: newUser.course,
                graduationYear: newUser.graduationYear
            }
        })
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            success: false,
            message: "Internal server Error"

        })
    }
}

export const login = async (req, res) => {
    try {
        const { error, value } = loginUserschema.validate(req.body)
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            })
        }
        const { email, password } = value


        const rateLimited = await isUserRateLimited(email)
        if (rateLimited) {
            return res.status(429).json({
                success: false,
                message: "Too many failed attempts. Try again after 15 minutes."
            })
        }

        const user = await Users.findOne({ email })
        if (!user) {

            await incrementLoginAttempts(email)
            return res.status(400).json({
                success: false,
                message: "User not found Please register"
            })
        }
        const isPasswordValid = await user.isPasswordCorrect(password)
        if (!isPasswordValid) {

            const attempts = await incrementLoginAttempts(email)
            if (attempts >= 5) {

                await blockUserLogin(email)
                return res.status(429).json({
                    success: false,
                    message: "Account locked due to too many failed attempts. Try again after 15 minutes."
                })
            }
            return res.status(401).json({
                success: false,
                message: "Invalid password"
            })
        }


        await resetLoginAttempts(email)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
        user.refreshToken = refreshToken
        await user.save()


        await storeRefreshToken(user._id, refreshToken)


        await cacheUserSession(user._id, {
            id: user._id,
            username: user.username,
            email: user.email,
            collegeName: user.collegeName,
            course: user.course,
            graduationYear: user.graduationYear
        })


        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        })


        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 1000 // 1 hour
        })

        return res.status(200).json({
            success: true,
            message: "Logged in successfully",
            accessToken,
            user: {
                id: user._id,
                username: user.username,
                email: user.email
            }
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        })
    }
}

export const logout = async (req, res) => {
    try {
        const userId = req.user._id;

        const token = req.cookies?.accessToken;

        await Users.findByIdAndUpdate(
            userId,
            { refreshToken: null },
            { returnDocument: 'after' }
        );

        if (token) {
            await blacklistToken(token, 3600);
        }

        const cookieOptions = {
            httpOnly: true,
            sameSite: "lax",
            secure: false,
            path: "/"
        };

        res.clearCookie("accessToken", cookieOptions);
        res.clearCookie("refreshToken", cookieOptions);

        return res.status(200).json({
            success: true,
            message: "Logged out successfully"
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

export const resetPassword = async (req, res) => {
    try {
        const { error, value } = resetPasswordSchema.validate(req.body)
        if (error) {
            return res.status(400).json({
                success: false,
                message: error.details[0].message
            })
        }

        const { oldpassword, newpassword } = value
        const userId = req.user._id
        const user = await Users.findById(userId)

        if (!user) {
            return res.status(400).json({
                success: false,
                message: "User not found"
            })
        }


        const isPasswordValid = await user.isPasswordCorrect(oldpassword)

        if (!isPasswordValid) {
            return res.status(400).json({
                success: false,
                message: "Incorrect current password"
            })
        }

        user.password = newpassword
        await user.save()

        return res.status(200).json({
            success: true,
            message: "Password reset successfully"
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        })
    }
}