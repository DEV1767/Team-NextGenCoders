export const transcribeAudio = async (audioBuffer, mimeType = "audio/webm") => {
    try {
        if (!audioBuffer) {
            throw new Error("Audio buffer is empty")
        }

        if (!process.env.DEEPGRAM_API_KEY) {
            throw new Error("DEEPGRAM_API_KEY not configured")
        }

        console.log(`[Deepgram] Transcribing ${audioBuffer.length} bytes of audio`)

        // Use REST API with optimal parameters for speech-to-text
        const params = new URLSearchParams({
            model: "nova-2",           // Best model for accuracy
            language: "en",
            smart_format: "true",      // Smart punctuation
            punctuate: "true",
            diarize: "false",
            redact: "false",
            search: "false",
            profanity_filter: "false"
        })

        const response = await fetch(`https://api.deepgram.com/v1/listen?${params.toString()}`, {
            method: "POST",
            headers: {
                Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
                "Content-Type": mimeType
            },
            body: audioBuffer
        })

        if (!response.ok) {
            const errorText = await response.text()
            console.error(`[Deepgram] API error ${response.status}:`, errorText)
            throw new Error(`Deepgram API error ${response.status}: ${errorText}`)
        }

        const data = await response.json()

        const transcript = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript || ""
        const confidence = data?.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0

        if (!transcript) {
            console.error("[Deepgram] Empty transcript in response:", JSON.stringify(data).slice(0, 300))
            throw new Error("No transcription found")
        }

        console.log(`[Deepgram] ✅ Success: "${transcript.slice(0, 80)}..." (confidence: ${(confidence * 100).toFixed(1)}%)`)

        return {
            success: true,
            transcript: transcript.trim(),
            confidence: parseFloat((confidence * 100).toFixed(2)),
            language: "en"
        }
    } catch (error) {
        console.error("[Deepgram] ❌ Error:", error.message)
        return {
            success: false,
            transcript: "",
            confidence: 0,
            error: error.message
        }
    }
}
