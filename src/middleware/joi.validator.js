import joi from "joi";

export const registerUserSchema = joi.object({
    username: joi.string().min(5).required(),
    email: joi.string().email().required(),
    collegeName: joi.string().min(5).required(),
    password: joi.string().min(6).required(),
    course: joi.string().min(2).optional(),
    graduationYear: joi.number()
        .integer()
        .min(2000)
        .max(new Date().getFullYear() + 10)
        .optional(),
    batchYear: joi.number()
        .integer()
        .min(2000)
        .max(new Date().getFullYear() + 10)
        .optional()
}).custom((value, helper) => {
    if (!value.graduationYear && !value.batchYear) {
        return helper.message("graduationYear or batchYear is required")
    }
    return value
});

export const loginUserschema = joi.object({
    email: joi.string().email().required(),
    password: joi.string().min(6).required()

})


export const resetPasswordSchema = joi.object({
    oldpassword: joi.string().required(),
    password: joi.string().min(5).required()
})

export const roleValidator = joi.object({
    role: joi.string().min(5).required()
})

export const startSessionValidator = joi.object({
    mode: joi.string().valid("mcq_practise", "mcq_practice", "live_interview", "interview_mock").required(),
    role: joi.string().min(2).required(),
    topic: joi.string().trim().min(2).optional(),
    questionCount: joi.number().integer().min(1).optional(),
    difficulty: joi.string().valid("basic", "easy", "medium", "hard", "advance").required()
}).custom((value, helper) => {
    if (["mcq_practise", "mcq_practice"].includes(value.mode) && !value.questionCount) {
        return helper.message("questionCount is required for MCQ mode")
    }
    if (["mcq_practise", "mcq_practice"].includes(value.mode) && value.questionCount > 30) {
        return helper.message("MCQ max is 30 Question")
    }
    if (["live_interview", "interview_mock"].includes(value.mode) && value.questionCount && value.questionCount > 15) {
        return helper.message("Live interview max is 15 question")
    }
    return value
})

export const submitAnswerValidator = joi.object({
    sessionId: joi.string().required(),
    userAnswer: joi.string().optional(),
    submittedCode: joi.string().optional(),
    answerMode: joi.string().valid("text", "voice").optional(),
    questionNumber: joi.number().integer().optional(),
    selectedOptionIndex: joi.number().integer().min(0).max(3).optional()
}).custom((value, helper) => {
    if (value.selectedOptionIndex !== undefined && value.selectedOptionIndex !== null && 
        typeof value.userAnswer === "undefined" && typeof value.submittedCode === "undefined") {
        // MCQ mode: selectedOptionIndex is enough
        return value
    }
    if (!value.userAnswer && !value.submittedCode) {
        return helper.message("Either userAnswer or submittedCode is required")
    }
    return value
})

export const clarifyInterviewValidator = joi.object({
    sessionId: joi.string().required(),
    doubtText: joi.string().trim().min(2).max(300).required()
})