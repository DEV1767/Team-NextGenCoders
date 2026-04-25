// Frontend Audio Recording Utility (copy this to your frontend project)

export class AudioRecorder {
    constructor() {
        this.mediaRecorder = null
        this.audioChunks = []
        this.stream = null
        this.isRecording = false
    }

    async startRecording() {
        try {
            this.audioChunks = []
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            this.mediaRecorder = new MediaRecorder(this.stream, {
                mimeType: "audio/webm"
            })

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data)
                }
            }

            this.mediaRecorder.start()
            this.isRecording = true
            console.log("Recording started...")
            return { success: true, message: "Recording started" }
        } catch (error) {
            console.error("Error accessing microphone:", error)
            return { success: false, error: error.message }
        }
    }

    stopRecording() {
        return new Promise((resolve) => {
            if (!this.mediaRecorder) {
                resolve({ success: false, error: "No active recording" })
                return
            }

            this.mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(this.audioChunks, { type: "audio/webm" })
                this.isRecording = false

                // Stop all tracks
                if (this.stream) {
                    this.stream.getTracks().forEach((track) => track.stop())
                }

                // Convert blob to base64
                const reader = new FileReader()
                reader.onloadend = () => {
                    const base64Audio = reader.result.split(",")[1] // Remove data:audio/webm;base64, prefix
                    resolve({
                        success: true,
                        audioBuffer: base64Audio,
                        mimeType: "audio/webm",
                        duration: Math.round(audioBlob.size / 16000) // Rough estimate
                    })
                }
                reader.readAsDataURL(audioBlob)
            }

            this.mediaRecorder.stop()
            console.log("Recording stopped...")
        })
    }

    isCurrentlyRecording() {
        return this.isRecording
    }
}

// Ask interviewer to clarify current question without submitting an answer.
export const requestInterviewClarification = async ({ sessionId, doubtText }) => {
    const response = await fetch("/api/v1/session/clarify", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            sessionId,
            doubtText
        })
    })

    return response.json()
}

// Generate or fetch persisted detailed roadmap after interview completion.
export const fetchDetailedRoadmap = async ({ resultId, regenerate = false }) => {
    const response = await fetch(`/api/v1/results/${resultId}/roadmap`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ regenerate })
    })

    return response.json()
}

// Frontend helper to animate completion state while /session/complete runs.
// You can display these messages in a modal, toast, progress area, etc.
export const createSessionCompletionAnimator = (options = {}) => {
    const messages = Array.isArray(options.messages) && options.messages.length
        ? options.messages
        : [
            "Interview is ending...",
            "Calculating your result...",
            "Analyzing technical answers...",
            "Scoring communication and confidence...",
            "Building your personalized roadmap...",
            "Finalizing report..."
        ]

    const stepDurationMs = Number(options.stepDurationMs) > 0
        ? Number(options.stepDurationMs)
        : 900

    const minTotalDurationMs = Number(options.minTotalDurationMs) >= stepDurationMs
        ? Number(options.minTotalDurationMs)
        : 4200

    const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

    return {
        async run(onStep) {
            const startedAt = Date.now()

            for (let index = 0; index < messages.length; index += 1) {
                const progress = Math.round(((index + 1) / messages.length) * 100)
                if (typeof onStep === "function") {
                    onStep({
                        index,
                        message: messages[index],
                        progress
                    })
                }
                await wait(stepDurationMs)
            }

            const elapsed = Date.now() - startedAt
            if (elapsed < minTotalDurationMs) {
                await wait(minTotalDurationMs - elapsed)
            }
        }
    }
}

// Optional helper for interviewer emoji avatar animation.
// Hook this to your camera/interviewer panel if those elements exist in the page.
export const createInterviewerAvatarController = ({
    avatarSelector = "#interviewerEmojiAvatar",
    statusSelector = "#interviewerSpeakingStatus",
    speakingClass = "is-speaking"
} = {}) => {
    const avatar = typeof document !== "undefined" ? document.querySelector(avatarSelector) : null
    const status = typeof document !== "undefined" ? document.querySelector(statusSelector) : null
    let speakingTimer = null

    const setStatusText = (text) => {
        if (status) {
            status.textContent = text
        }
    }

    const setSpeaking = (isSpeaking) => {
        if (!avatar) return
        avatar.classList.toggle(speakingClass, Boolean(isSpeaking))
        setStatusText(isSpeaking ? "Interviewer is speaking..." : "Interviewer is listening...")
    }

    const speakFor = (message = "", minMs = 900, maxMs = 2800) => {
        const lengthFactor = Math.max(1, String(message || "").length / 40)
        const speakMs = Math.max(minMs, Math.min(maxMs, Math.round(lengthFactor * 1000)))

        if (speakingTimer) {
            clearTimeout(speakingTimer)
            speakingTimer = null
        }

        setSpeaking(true)
        speakingTimer = setTimeout(() => {
            setSpeaking(false)
            speakingTimer = null
        }, speakMs)
    }

    const destroy = () => {
        if (speakingTimer) {
            clearTimeout(speakingTimer)
            speakingTimer = null
        }
        setSpeaking(false)
    }

    return {
        setSpeaking,
        speakFor,
        destroy
    }
}

// USAGE EXAMPLE:
/*
const recorder = new AudioRecorder()

// Start recording when user clicks "Record Answer"
document.getElementById("recordBtn").onclick = async () => {
    await recorder.startRecording()
    document.getElementById("recordBtn").disabled = true
    document.getElementById("stopBtn").disabled = false
}

// Stop recording when user clicks "Stop"
document.getElementById("stopBtn").onclick = async () => {
    const { audioBuffer, mimeType } = await recorder.stopRecording()
    document.getElementById("recordBtn").disabled = false
    document.getElementById("stopBtn").disabled = true

    // Send to backend
    const response = await fetch("/api/v1/session/answer", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            sessionId: "your_session_id",
            audioBuffer: audioBuffer,
            mimeType: mimeType
        })
    })

    const result = await response.json()
    if (result.success) {
        console.log("Next question:", result.nextQuestion)
        displayQuestion(result.nextQuestion)
    }
}

// Completion animation example:
const completeBtn = document.getElementById("completeInterviewBtn")
const statusText = document.getElementById("completionStatus")
const progressBar = document.getElementById("completionProgress")
const loaderModal = document.getElementById("completionLoaderModal")

const animator = createSessionCompletionAnimator()

completeBtn.onclick = async () => {
    loaderModal.style.display = "block"

    try {
        const completeRequest = fetch("/api/v1/session/complete", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ sessionId: "your_session_id" })
        }).then((res) => res.json())

        const [result] = await Promise.all([
            completeRequest,
            animator.run(({ message, progress }) => {
                statusText.textContent = message
                progressBar.style.width = `${progress}%`
            })
        ])

        loaderModal.style.display = "none"
        navigateToResult(result.sessionId || result.resultId)
    } catch (error) {
        loaderModal.style.display = "none"
        alert("Failed to complete session. Please try again.")
    }
}
*/
