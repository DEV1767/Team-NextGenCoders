import User from "../model/user.model.js"

export const getRoles = async (req, res) => {
    return res.status(200).json({
        success: true,
        roles: [
            "Frontend Developer",
            "Backend Developer",
            "Full Stack Developer",
            "Data Analyst",
            "Data Scientist",
            "Machine Learning Engineer",
            "DevOps Engineer",
            "QA Engineer",
            "Product Manager"
        ]
    })
}

export const getExperienceLevels = async (req, res) => {
    return res.status(200).json({
        success: true,
        experienceLevels: ["fresher", "junior", "mid", "senior"]
    })
}

export const saveOnboarding = async (req, res) => {
    try {
        const { role, experience, resume } = req.body

        if (!role || !experience) {
            return res.status(400).json({
                success: false,
                message: "role and experience are required"
            })
        }

        const updatePayload = {
            role,
            experience
        }

        if (resume && typeof resume === "object") {
            updatePayload.resume = {
                ...(req.user?.resume || {}),
                ...resume
            }
        }

        const updatedUser = await User.findByIdAndUpdate(
            req.user._id,
            updatePayload,
            { new: true }
        )

        return res.status(200).json({
            success: true,
            message: "Onboarding saved",
            onboarding: {
                role: updatedUser.role,
                experience: updatedUser.experience,
                resume: updatedUser.resume || null
            }
        })
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to save onboarding",
            error: error.message
        })
    }
}
