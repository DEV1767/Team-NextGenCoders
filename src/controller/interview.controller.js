export const getQuestionBank = async (req, res) => {
    const { role = "General", experience = "junior" } = req.query

    const bank = [
        {
            id: 1,
            role,
            experience,
            category: "technical",
            question: `As a ${role}, explain a project where you solved a real production issue.`
        },
        {
            id: 2,
            role,
            experience,
            category: "problem-solving",
            question: `How would you approach debugging a critical bug in a ${role} workflow?`
        },
        {
            id: 3,
            role,
            experience,
            category: "behavioral",
            question: `Describe how you handled disagreements with teammates while delivering a feature.`
        },
        {
            id: 4,
            role,
            experience,
            category: "system-design",
            question: `Design a scalable architecture relevant to ${role} responsibilities.`
        }
    ]

    return res.status(200).json({
        success: true,
        role,
        experience,
        questions: bank
    })
}
