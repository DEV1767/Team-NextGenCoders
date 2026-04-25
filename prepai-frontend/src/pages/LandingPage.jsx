import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  ArrowRight, Star, CheckCircle,
  FileText, Mic, Brain, TrendingUp, Target, BookOpen,
  Upload, Zap,
} from 'lucide-react'
import MainLayout     from '../layout/MainLayout'
import HeroSection    from '../components/HeroSection'
import SectionTitle   from '../components/SectionTitle'
import FeatureCard    from '../components/FeatureCard'
import PrimaryButton  from '../components/PrimaryButton'
import SecondaryButton from '../components/SecondaryButton'
import { getFeatures, getHowItWorks, getTestimonials } from '../api/landing'

// Map icon string → Lucide component for features & how-it-works
const ICON_MAP = {
  FileText, Mic, Brain, TrendingUp, Target,
  BookOpen, Upload, Zap,
  FileBarChart: TrendingUp, // alias
}

// Score bar for how it works stats section
function MiniStat({ label, value, color }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{label}</span>
        <span className="font-semibold text-gray-700">{value}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full fill-bar ${color}`}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}

export default function LandingPage() {
  const navigate = useNavigate()
  const [features, setFeatures] = useState([])
  const [howItWorks, setHowItWorks] = useState([])
  const [testimonials, setTestimonials] = useState([])
  const [loading, setLoading] = useState(true)

  const toList = (value, preferredKey) => {
    if (Array.isArray(value)) return value
    if (!value || typeof value !== 'object') return []
    if (Array.isArray(value[preferredKey])) return value[preferredKey]

    const firstArray = Object.values(value).find(Array.isArray)
    return firstArray || []
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [feats, steps, testis] = await Promise.all([
          getFeatures(),
          getHowItWorks(),
          getTestimonials(),
        ])
        setFeatures(toList(feats, 'features'))
        setHowItWorks(toList(steps, 'howItWorks'))
        setTestimonials(toList(testis, 'testimonials'))
      } catch (err) {
        console.error('Failed to fetch landing data:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <MainLayout>
        <div className="min-h-[60vh] flex items-center justify-center">
          <p className="text-gray-500">Loading...</p>
        </div>
      </MainLayout>
    )
  }

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <MainLayout>

      {/* ── HERO ────────────────────────────────────────────── */}
      <HeroSection
        onGetStarted={() => navigate('/signup')}
        onKnowMore={() => scrollTo('features')}
      />

      {/* ── Social proof strip ─────────────────────────────── */}
      <div className="bg-gray-50 border-y border-gray-100 py-5">
        <div className="max-w-6xl mx-auto px-5 lg:px-8 flex flex-wrap items-center justify-center gap-8 text-sm text-gray-500">
          {[
            { val: '10,000+', label: 'Candidates Trained' },
            { val: '94%',     label: 'Offer Success Rate' },
            { val: '50+',     label: 'Target Roles' },
            { val: '4.9★',    label: 'Average Rating' },
          ].map(({ val, label }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="font-bold text-purple-700 text-base">{val}</span>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── FEATURES ───────────────────────────────────────── */}
      <section id="features" className="py-20 md:py-28 bg-white">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <div className="flex justify-center mb-14">
            <SectionTitle
              eyebrow="Why PrepAI"
              heading="Everything you need to prepare and win"
              subtext="PrepAI combines resume intelligence, voice AI, real-time scoring, and structured progress tracking — all in one clean platform built for serious candidates."
              align="center"
            />
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => {
              const Icon = ICON_MAP[f.icon] ?? Mic
              return (
                <FeatureCard
                  key={f.id || f.title || i}
                  icon={Icon}
                  title={f.title}
                  description={f.description}
                  index={i}
                />
              )
            })}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────── */}
      <section id="how-it-works" className="py-20 md:py-28 bg-gray-50 border-y border-gray-100">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <div className="flex justify-center mb-14">
            <SectionTitle
              eyebrow="How It Works"
              heading="From resume to offer — in 4 steps"
              subtext="PrepAI guides you through the entire preparation journey, from uploading your resume to receiving a detailed report you can actually act on."
              align="center"
            />
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {howItWorks.map((step, i) => {
              const Icon = ICON_MAP[step.icon] ?? Upload
              return (
                <div
                  key={step.id || step.step || step.title || i}
                  className="relative bg-white border border-gray-100 rounded-2xl p-7 hover:border-purple-200 hover:shadow-md transition-all duration-200"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  {/* Step number */}
                  <span className="inline-block text-5xl font-black text-gray-100 leading-none mb-4 select-none">
                    {step.step}
                  </span>
                  {/* Icon */}
                  <div className="w-10 h-10 bg-purple-50 border border-purple-100 rounded-xl flex items-center justify-center mb-4">
                    <Icon size={19} className="text-purple-600" strokeWidth={1.8} />
                  </div>
                  {/* Text */}
                  <h3 className="text-sm font-semibold text-gray-900 mb-2">{step.title}</h3>
                  <p className="text-xs text-gray-500 leading-relaxed">{step.desc}</p>

                  {/* Connector arrow (not on last) */}
                  {i < howItWorks.length - 1 && (
                    <div className="hidden lg:flex absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 bg-white border border-gray-200 rounded-full items-center justify-center z-10 shadow-sm">
                      <ArrowRight size={13} className="text-purple-500" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── INTERVIEW PREVIEW split section ────────────────── */}
      <section className="py-20 md:py-28 bg-white">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-14 items-center">

            {/* Left: copy */}
            <div>
              <SectionTitle
                eyebrow="The Interview Experience"
                heading="Voice-first. AI-driven. Surprisingly real."
                subtext="Our AI interviewer listens to your responses, follows up with clarifying questions, evaluates every answer in real time, and adjusts difficulty based on how you're doing."
                align="left"
              />
              <ul className="mt-8 space-y-3">
                {[
                  'Natural conversation flow — no robotic scripts',
                  'Resume-derived questions you can\'t Google',
                  'Scores each answer across 5 dimensions',
                  'Saves full session transcript to your dashboard',
                  'Works with voice or keyboard — your choice',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-gray-600">
                    <CheckCircle size={16} className="text-purple-500 mt-0.5 shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <PrimaryButton size="lg" onClick={() => navigate('/signup')}>
                  Try a Mock Interview
                  <ArrowRight size={17} />
                </PrimaryButton>
              </div>
            </div>

            {/* Right: result preview card */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
              {/* Header */}
              <div className="bg-gray-900 px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Session Report</p>
                  <p className="text-white font-bold text-sm mt-0.5">Frontend Developer · Apr 17, 2026</p>
                </div>
                <div className="w-12 h-12 rounded-full border-2 border-purple-400 flex items-center justify-center">
                  <span className="text-purple-300 font-black text-base">82</span>
                </div>
              </div>
              {/* Body */}
              <div className="p-5 space-y-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Performance Breakdown</p>
                <div className="space-y-3">
                  {[
                    { label: 'Technical Knowledge', score: 88 },
                    { label: 'Communication',       score: 79 },
                    { label: 'Problem Solving',     score: 85 },
                    { label: 'Code Quality',        score: 76 },
                  ].map((s) => (
                    <MiniStat key={s.label} label={s.label} value={s.score} color="bg-purple-500" />
                  ))}
                </div>
                <div className="pt-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">AI Feedback</p>
                  <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-xs text-green-800 leading-relaxed">
                    ✓ Excellent React hooks knowledge — well-structured answer with clear real-world examples.
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {['React Hooks', 'CSS Grid', 'REST APIs', 'Async/Await'].map((s) => (
                    <span key={s} className="text-[10px] font-medium bg-purple-50 text-purple-700 border border-purple-100 px-2.5 py-0.5 rounded-full">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ───────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-gray-50 border-t border-gray-100">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <div className="flex justify-center mb-14">
            <SectionTitle
              eyebrow="Success Stories"
              heading="Candidates who prepared with PrepAI"
              align="center"
            />
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {testimonials.map((t, i) => (
              <div
                key={t.id || t.name || i}
                className="bg-white border border-gray-100 rounded-2xl p-7 hover:shadow-md transition-shadow duration-200"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                {/* Stars */}
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.stars }).map((_, j) => (
                    <Star key={j} size={14} className="text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                {/* Quote */}
                <p className="text-sm text-gray-600 leading-relaxed mb-6">
                  "{t.quote}"
                </p>
                {/* Author */}
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-700 shrink-0">
                    {t.name.split(' ').map((n) => n[0]).join('')}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{t.name}</p>
                    <p className="text-xs text-gray-400">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FINAL CTA BANNER ───────────────────────────────── */}
      <section className="py-20 md:py-28 bg-white">
        <div className="max-w-4xl mx-auto px-5 lg:px-8 text-center">
          <div className="bg-gray-900 rounded-3xl px-10 py-16 md:py-20">
            <span className="inline-flex items-center gap-2 px-3.5 py-1 bg-purple-700 text-purple-200 text-xs font-semibold uppercase tracking-widest rounded-full mb-7">
              <Zap size={11} className="fill-purple-300 text-purple-300" />
              Start Today
            </span>
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
              Your next interview could be
              <br />
              <span className="text-purple-400">your best one yet.</span>
            </h2>
            <p className="text-gray-400 text-base mb-10 max-w-md mx-auto leading-relaxed">
              Join 10,000+ candidates using PrepAI to walk into interviews confident,
              prepared, and ready to perform.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <PrimaryButton size="xl" onClick={() => navigate('/signup')}>
                Create Free Account
                <ArrowRight size={18} />
              </PrimaryButton>
              <SecondaryButton
                size="xl"
                variant="outline"
                className="border-gray-600 text-gray-300 hover:bg-gray-800"
                onClick={() => navigate('/login')}
              >
                Already have an account?
              </SecondaryButton>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────── */}
      <footer className="bg-gray-50 border-t border-gray-100 py-10">
        <div className="max-w-6xl mx-auto px-5 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-5">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-purple-600 rounded-lg flex items-center justify-center">
                <Zap size={13} className="text-white fill-white" />
              </div>
              <span className="font-bold text-gray-900">
                Prep<span className="text-purple-600">AI</span>
              </span>
            </div>

            {/* Links */}
            <nav className="flex flex-wrap gap-5 text-sm text-gray-400">
              {['Privacy', 'Terms', 'Contact', 'Blog', 'Careers'].map((l) => (
                <button key={l} className="hover:text-gray-700 transition-colors">{l}</button>
              ))}
            </nav>

            {/* Copyright */}
            <p className="text-xs text-gray-400">
              © 2026 PrepAI. Built for ambitious candidates.
            </p>
          </div>
        </div>
      </footer>

    </MainLayout>
  )
}
