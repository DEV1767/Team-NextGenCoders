/**
 * InterviewPanel
 * Renders either the "AI Interviewer" panel or the "You / Candidate" panel
 * on the Interview page.
 *
 * Props:
 *  variant       – 'ai' | 'user'
 *  isActive      – boolean — whether this panel is currently "speaking"
 *  micActive     – boolean — (user panel only) microphone is recording
 *  question      – string — current question text (ai panel only)
 *  status        – string — status label to display
 *  children      – extra content rendered inside panel body
 */
export default function InterviewPanel({
  variant   = 'ai',
  isActive  = false,
  micActive = false,
  question  = '',
  status    = '',
  children,
}) {
  const isAI   = variant === 'ai'
  const isUser = variant === 'user'

  // Waveform bar heights (decorative static heights, animated via CSS)
  const BARS = [12, 20, 14, 28, 18, 32, 16, 24, 12, 22, 18, 30, 14]

  return (
    <div
      className={[
        'flex flex-col rounded-2xl border-2 transition-all duration-300 overflow-hidden',
        isActive
          ? 'border-purple-400 shadow-md shadow-purple-100'
          : 'border-gray-100 shadow-sm',
      ].join(' ')}
    >
      {/* ── Panel header ── */}
      <div
        className={`flex items-center justify-between px-5 py-4 border-b ${
          isActive ? 'border-purple-100 bg-purple-50' : 'border-gray-100 bg-gray-50'
        }`}
      >
        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
              isAI
                ? 'bg-purple-600 text-white'
                : 'bg-gray-200 text-gray-700'
            }`}
          >
            {isAI ? 'AI' : 'YOU'}
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-800">
              {isAI ? 'PrepAI Interviewer' : 'You (Candidate)'}
            </p>
            <p className="text-xs text-gray-400">
              {isAI ? 'AI-powered · adaptive' : 'Alex Johnson'}
            </p>
          </div>
        </div>

        {/* Status badge */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            isActive
              ? 'bg-purple-100 text-purple-700'
              : 'bg-gray-100 text-gray-400'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isActive ? 'bg-purple-500 animate-pulse' : 'bg-gray-300'
            }`}
          />
          {status || (isActive ? 'Active' : 'Idle')}
        </div>
      </div>

      {/* ── Panel body ── */}
      <div className="flex-1 p-5 bg-white min-h-[180px] flex flex-col justify-center">
        {/* AI panel: show question */}
        {isAI && question && (
          <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
            <p className="text-xs font-semibold text-purple-600 uppercase tracking-wider mb-2">
              Current Question
            </p>
            <p className="text-sm text-gray-800 leading-relaxed font-medium">
              {question}
            </p>
          </div>
        )}

        {/* AI panel: idle state */}
        {isAI && !question && (
          <div className="text-center py-4">
            <div className="w-14 h-14 bg-purple-50 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <p className="text-sm text-gray-400">Waiting to start…</p>
          </div>
        )}

        {/* User panel: mic waveform or idle */}
        {isUser && (
          <div className="flex flex-col items-center justify-center gap-4">
            {micActive ? (
              <>
                {/* Waveform */}
                <div className="flex items-center gap-1 h-10">
                  {BARS.map((h, i) => (
                    <span
                      key={i}
                      className="sound-wave-bar"
                      style={{
                        height: `${h}px`,
                        animationDelay: `${i * 55}ms`,
                        animationDuration: `${500 + (i % 3) * 120}ms`,
                      }}
                    />
                  ))}
                </div>
                <p className="text-sm font-semibold text-purple-700">
                  Recording…
                </p>
                <p className="text-xs text-gray-400">Speak clearly into your microphone</p>
              </>
            ) : (
              <>
                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={1.5}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-400">Microphone off</p>
              </>
            )}
          </div>
        )}

        {/* Extra injected content */}
        {children}
      </div>
    </div>
  )
}
