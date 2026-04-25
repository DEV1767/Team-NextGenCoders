import cloudinary from "../config/cloudinary.js"
import Users from "../model/user.model.js"
import PDFParser from "pdf2json"

const safeDecodePdfText = (value = "") => {
    const raw = String(value || "")
    if (!raw) return ""

    try {
        return decodeURIComponent(raw)
    } catch {
        // Keep parsing resilient even when PDF contains malformed URI sequences.
        return raw
    }
}

export const uploadResume = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "No files uploaded. Expected field name: 'resume'"
            })
        }

        // Extract text from PDF
        let extractedText = null
        if (req.file.mimetype === 'application/pdf') {
            try {
                const pdfParser = new PDFParser()
                await new Promise((resolve, reject) => {
                    pdfParser.on("pdfParser_dataError", (error) => {
                        console.log("PDF parse error:", error)
                        reject(error)
                    })
                    pdfParser.on("pdfParser_dataReady", (pdfData) => {
                        // Extract text from all pages
                        if (pdfData && pdfData.Pages) {
                            let text = ""
                            pdfData.Pages.forEach(page => {
                                if (page.Texts) {
                                    page.Texts.forEach(textObj => {
                                        if (textObj.R) {
                                            textObj.R.forEach(r => {
                                                if (r.T) {
                                                    text += safeDecodePdfText(r.T) + " "
                                                }
                                            })
                                        }
                                    })
                                }
                            })
                            extractedText = text.trim()
                        }
                        resolve()
                    })
                    pdfParser.parseBuffer(req.file.buffer, 0)
                })
            } catch (parseError) {
                console.log("PDF parsing failed:", parseError)
                // Continue upload even if parsing fails
            }
        }

        const stream = cloudinary.uploader.upload_stream(
            { folder: "uploads" },
            async (error, result) => {
                if (error) {
                    return res.status(500).json({ error })
                }

                const uploadedAt = new Date()
                
                // Save the latest resume data so interview setup can use the newest upload.
                const updatedUser = await Users.findByIdAndUpdate(
                    req.user._id,
                    {
                        $set: {
                            resume: {
                                url: result.secure_url,
                                publicId: result.public_id,
                                fileName: req.file.originalname,
                                extractedText: extractedText,
                                uploadedAt,
                                analyzed: false,
                                score: 0,
                                feedback: null,
                                analyzedAt: null
                            }
                        }
                    },
                    { new: true, runValidators: true }
                )
                
                return res.json({
                    success: true,
                    resumeUrl: result.secure_url,
                    extractedTextPreview: extractedText ? extractedText.substring(0, 200) : null,
                    nextPage: "/interview",
                    resume: updatedUser?.resume || null
                })
            }
        )
        stream.end(req.file.buffer)
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Upload failed",
            error: error.message
        })
    }
}

export const handleUploadError = (err, req, res, next) => {
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
            success: false,
            message: "File too large. Max size: 5MB"
        })
    }
    if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
            success: false,
            message: "Unexpected field name. Must use field name: 'resume'"
        })
    }
    
    res.status(400).json({
        success: false,
        message: err.message || "Upload error"
    })
}