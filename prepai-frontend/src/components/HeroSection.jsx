/**
 * HeroSection
 * The main hero on the Landing Page.
 * Shows headline, subtitle, two CTA buttons, and a visual mockup preview.
 *
 * Props:
 *  onGetStarted – callback for primary CTA
 *  onKnowMore   – callback for secondary CTA
 */
import PrimaryButton   from './PrimaryButton'
import SecondaryButton from './SecondaryButton'
import { ArrowRight, Play, Zap, CheckCircle } from 'lucide-react'

const TRUST_ITEMS = [
  'No credit card required',
  'Free to get started',
  'AI-powered in real time',
]

export default function HeroSection({ onGetStarted, onKnowMore }) {
  return (
    <section className="relative w-full overflow-hidden bg-white pt-16 pb-20 md:pt-24 md:pb-28">

      {/* ── Background dots pattern ── */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{
          backgroundImage: 'radial-gradient(#e9d5ff 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />
      {/* Fade overlay to keep dots subtle at edges */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(255,255,255,0) 30%, rgba(255,255,255,1) 100%)'
        }}
      />

      <div className="relative max-w-6xl mx-auto px-5 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center gap-14 lg:gap-10">

          {/* ── Left: copy ── */}
          <div className="flex-1 flex flex-col items-start lg:items-start text-left max-w-xl">
            {/* Eyebrow badge */}
            <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-purple-50 border border-purple-200 text-purple-700 text-xs font-semibold uppercase tracking-widest rounded-full mb-6">
              <Zap size={11} className="fill-purple-600 text-purple-600" />
              AI-Powered Interview Coach
            </span>

            {/* Headline */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight mb-5">
              Ace Every Interview{' '}
              <span className="text-purple-600">
                With AI Confidence
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg text-gray-500 leading-relaxed mb-8 max-w-lg">
              PrepAI runs personalized mock interviews based on{' '}
              <strong className="text-gray-700 font-semibold">your resume</strong>,
              scores every answer instantly, and gives you the actionable feedback
              top candidates use to land their dream roles.
            </p>

            {/* CTA buttons */}
            <div className="flex flex-wrap gap-3 mb-8">
              <PrimaryButton size="xl" onClick={onGetStarted}>
                Get Started — It's Free
                <ArrowRight size={18} />
              </PrimaryButton>
              <SecondaryButton size="xl" onClick={onKnowMore}>
                <Play size={16} className="fill-purple-600 text-purple-600" />
                Know More
              </SecondaryButton>
            </div>

            {/* Trust strip */}
            <div className="flex flex-wrap gap-4">
              {TRUST_ITEMS.map((item) => (
                <span key={item} className="flex items-center gap-1.5 text-sm text-gray-500">
                  <CheckCircle size={14} className="text-purple-500 shrink-0" />
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* ── Right: visual mock of the interview UI ── */}
          <div className="flex-1 w-full max-w-[480px]">
            <div className="bg-white border border-gray-200 rounded-3xl shadow-2xl shadow-gray-200/80 overflow-hidden">
              {/* Mock top bar */}
              <div className="bg-gray-50 border-b border-gray-200 px-5 py-3 flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <span className="ml-2 text-xs text-gray-400 font-medium">PrepAI Interview Session</span>
              </div>

              <div className="p-5 space-y-4">
                {/* Status bar */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                    <span className="text-xs font-semibold text-purple-700">AI Speaking</span>
                  </div>
                  <span className="text-xs text-gray-400 font-medium">Q 3 / 7</span>
                </div>

                {/* AI Panel mock */}
                <div className="border border-purple-200 bg-purple-50 rounded-xl p-4">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-7 h-7 bg-purple-600 rounded-full flex items-center justify-center text-[10px] font-bold text-white">AI</div>
                    <div>
                      <p className="text-xs font-semibold text-gray-800">PrepAI Interviewer</p>
                      <p className="text-[10px] text-gray-400">Active</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-700 leading-relaxed">
                    "How does React's virtual DOM improve performance over direct DOM manipulation?"
                  </p>
                </div>

                {/* User Panel mock */}
                <div className="border border-gray-200 bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-7 h-7 bg-gray-300 rounded-full flex items-center justify-center text-[10px] font-bold text-gray-700">YOU</div>
                    <div>
                      <p className="text-xs font-semibold text-gray-800">Alex Johnson</p>
                      <p className="text-[10px] text-gray-400">Recording…</p>
                    </div>
                  </div>
                  {/* Mini waveform */}
                  <div className="flex items-center gap-0.5 h-6">
                    {[8,14,10,20,12,24,9,18,13,22,10,16].map((h, i) => (
                      <span
                        key={i}
                        className="sound-wave-bar"
                        style={{ height: `${h}px`, animationDelay: `${i * 60}ms` }}
                      />
                    ))}
                  </div>
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                    <span>Progress</span>
                    <span>43%</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full w-[43%] bg-purple-500 rounded-full" />
                  </div>
                </div>

                {/* Scores mini */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Technical', val: '88' },
                    { label: 'Clarity',   val: '79' },
                    { label: 'Depth',     val: '82' },
                  ].map((s) => (
                    <div key={s.label} className="bg-gray-50 border border-gray-100 rounded-lg p-2 text-center">
                      <p className="text-sm font-bold text-purple-700">{s.val}</p>
                      <p className="text-[9px] text-gray-400 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Floating badge */}
            <div className="mt-3 flex justify-end">
              <div className="bg-white border border-gray-200 rounded-xl px-4 py-2 shadow-md flex items-center gap-2 text-xs">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="font-semibold text-gray-700">AI feedback in seconds</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
