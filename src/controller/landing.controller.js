export const getLandingFeatures = async (req, res) => {
    return res.status(200).json({
        success: true,
        features: [
            {
                id: 1,
                title: "AI Interview Coach",
                description: "Practice realistic interviews with role-specific questions and instant scoring."
            },
            {
                id: 2,
                title: "Resume-Aware Questions",
                description: "Get personalized questions generated from your uploaded resume."
            },
            {
                id: 3,
                title: "Actionable Feedback",
                description: "Receive clarity, confidence, and technical insights after each session."
            }
        ]
    })
}

export const getLandingHowItWorks = async (req, res) => {
    return res.status(200).json({
        success: true,
        steps: [
            { id: 1, title: "Create Account", description: "Sign up and complete your profile." },
            { id: 2, title: "Choose Role", description: "Select your target role and experience level." },
            { id: 3, title: "Start Practice", description: "Attempt interviews and MCQ rounds." },
            { id: 4, title: "Track Growth", description: "Review trends and improve with recommendations." }
        ]
    })
}

export const getLandingTestimonials = async (req, res) => {
    return res.status(200).json({
        success: true,
        testimonials: [
            {
                id: 1,
                name: "Aarav Singh",
                role: "SDE-1 Aspirant",
                quote: "PrepAI made my interview practice structured and confidence-building."
            },
            {
                id: 2,
                name: "Nisha Verma",
                role: "Data Analyst Candidate",
                quote: "The feedback was specific and helped me improve fast."
            },
            {
                id: 3,
                name: "Rohit Jain",
                role: "Full Stack Developer",
                quote: "Great mock experience, especially the role-based question flow."
            }
        ]
    })
}
