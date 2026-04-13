import { useMemo } from 'react'
import { motion } from 'motion/react'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

// ── Constants ──
const SUBJECTS = [
  'Biologie', 'Geschichte', 'Mathe', 'Physik', 'Chemie',
  'Sprachen', 'Geographie', 'Informatik', 'Kunst', 'Musik',
  'Politik', 'Wirtschaft',
]

const HOW_STEPS = [
  { emoji: '📝', titleKey: 'landing.how_step1_title', descKey: 'landing.how_step1_desc' },
  { emoji: '✨', titleKey: 'landing.how_step2_title', descKey: 'landing.how_step2_desc' },
  { emoji: '🎮', titleKey: 'landing.how_step3_title', descKey: 'landing.how_step3_desc' },
]

const FEATURES = [
  { emoji: '🧠', titleKey: 'landing.feature1_title', descKey: 'landing.feature1_desc' },
  { emoji: '🎮', titleKey: 'landing.feature2_title', descKey: 'landing.feature2_desc' },
  { emoji: '👥', titleKey: 'landing.feature3_title', descKey: 'landing.feature3_desc' },
]

const TESTIMONIALS = [
  { textKey: 'landing.testimonial1_text', authorKey: 'landing.testimonial1_author' },
  { textKey: 'landing.testimonial2_text', authorKey: 'landing.testimonial2_author' },
  { textKey: 'landing.testimonial3_text', authorKey: 'landing.testimonial3_author' },
]

interface StarData {
  id: number
  top: string
  left: string
  size: number
  duration: number
  delay: number
}

// ── Section wrapper ──
function Section({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.section
      className={`py-20 px-6 ${className}`}
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-100px' }}
      transition={{ duration: 0.6 }}
    >
      {children}
    </motion.section>
  )
}

// ── Mock Screenshot ──
function MockScreenshot() {
  return (
    <motion.div
      className="bg-dark-card border border-dark-border rounded-2xl p-4 w-[300px] h-[380px] lg:w-[340px] lg:h-[420px] flex flex-col gap-3 overflow-hidden"
      animate={{ y: [0, -10, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* Top bar */}
      <div className="flex justify-between items-center">
        <span className="text-white/60 text-xs font-body">Raum 3 von 10</span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-body text-secondary">120 Punkte</span>
          <span className="text-xs font-body text-accent">❤️ 3</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-dark rounded-full overflow-hidden">
        <div className="h-full bg-primary rounded-full" style={{ width: '30%' }} />
      </div>

      {/* Question */}
      <p className="text-white font-body font-bold text-sm text-center mt-2 leading-relaxed">
        Was ist Photosynthese?
      </p>

      {/* Answer bubbles */}
      <div className="flex-1 flex flex-col gap-2 mt-2">
        {[
          { text: 'Umwandlung von Licht in Energie', correct: true },
          { text: 'Zellteilung bei Tieren', correct: false },
          { text: 'Verdauung von Nahrung', correct: false },
          { text: 'Wasserkreislauf', correct: false },
        ].map((a, i) => (
          <div
            key={i}
            className={`rounded-xl px-3 py-2.5 text-xs font-body text-white text-center ${
              a.correct
                ? 'bg-secondary/20 border border-secondary/40'
                : 'bg-dark border border-dark-border'
            }`}
          >
            {a.text}
          </div>
        ))}
      </div>
    </motion.div>
  )
}

// ── Main Component ──
export default function LandingPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const stars = useMemo<StarData[]>(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        id: i,
        top: `${Math.random() * 100}%`,
        left: `${Math.random() * 100}%`,
        size: Math.random() * 2 + 1,
        duration: Math.random() * 4 + 2,
        delay: Math.random() * 4,
      })),
    [],
  )

  const ctaButton = (
    <motion.button
      onClick={() => void navigate('/onboarding')}
      className="font-body font-bold text-white cursor-pointer border-none"
      style={{ fontSize: '18px', background: '#6C3CE1', padding: '16px 40px', borderRadius: '50px' }}
      animate={{
        boxShadow: [
          '0 0 30px rgba(108,60,225,0.5)',
          '0 0 50px rgba(108,60,225,0.8)',
          '0 0 30px rgba(108,60,225,0.5)',
        ],
      }}
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      whileHover={{ scale: 1.05, transition: { duration: 0.15 } }}
      whileTap={{ scale: 0.95, transition: { duration: 0.1 } }}
    >
      {t('landing.hero_cta')}
    </motion.button>
  )

  return (
    <div className="relative min-h-screen bg-dark overflow-hidden">
      {/* Fixed star background */}
      <div className="fixed inset-0 pointer-events-none z-0">
        {stars.map((star) => (
          <motion.div
            key={star.id}
            className="absolute rounded-full bg-white"
            style={{ top: star.top, left: star.left, width: star.size, height: star.size }}
            animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
            transition={{ duration: star.duration, delay: star.delay, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}

        {/* Nebula */}
        <motion.div
          className="absolute rounded-full"
          style={{
            top: '10%', left: '15%', width: 500, height: 500,
            background: 'radial-gradient(circle, rgba(108,60,225,0.15) 0%, transparent 70%)',
          }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute rounded-full"
          style={{
            top: '40%', right: '10%', width: 400, height: 400,
            background: 'radial-gradient(circle, rgba(30,100,255,0.12) 0%, transparent 70%)',
          }}
          animate={{ scale: [1.1, 1, 1.1], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute rounded-full"
          style={{
            bottom: '15%', left: '30%', width: 350, height: 350,
            background: 'radial-gradient(circle, rgba(0,200,150,0.10) 0%, transparent 70%)',
          }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10">

        {/* ═══ HERO ═══ */}
        <section className="min-h-screen flex items-center justify-center px-6">
          <div className="flex flex-col lg:flex-row items-center justify-center gap-12 max-w-6xl mx-auto">
            {/* Left */}
            <motion.div
              className="text-center lg:text-left max-w-xl"
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7 }}
            >
              <h1 className="font-display text-white text-3xl sm:text-4xl lg:text-6xl leading-tight">
                {t('landing.hero_headline')}
              </h1>
              <p className="font-body text-white/70 text-lg lg:text-xl mt-4">
                {t('landing.hero_sub')}
              </p>
              <div className="mt-8">
                {ctaButton}
              </div>
              <p className="text-white/50 text-sm font-body mt-4">
                ⭐⭐⭐⭐⭐ {t('landing.hero_social_proof')}
              </p>
            </motion.div>

            {/* Right - mock screenshot */}
            <motion.div
              className="hidden sm:block"
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
            >
              <MockScreenshot />
            </motion.div>
          </div>
        </section>

        {/* ═══ HOW IT WORKS ═══ */}
        <Section>
          <div className="max-w-4xl mx-auto">
            <h2 className="font-display text-white text-2xl lg:text-4xl text-center mb-12">
              {t('landing.how_title')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {HOW_STEPS.map((step, i) => (
                <motion.div
                  key={step.titleKey}
                  className="bg-dark-card border border-dark-border rounded-2xl p-6 text-center"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.15 }}
                >
                  <span style={{ fontSize: '48px' }}>{step.emoji}</span>
                  <h3 className="font-display text-white text-xl mt-4">{t(step.titleKey)}</h3>
                  <p className="font-body text-white/60 text-sm mt-2">{t(step.descKey)}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </Section>

        {/* ═══ FEATURES ═══ */}
        <Section>
          <div className="max-w-4xl mx-auto">
            <h2 className="font-display text-white text-2xl lg:text-4xl text-center mb-12">
              {t('landing.features_title')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {FEATURES.map((feat, i) => (
                <motion.div
                  key={feat.titleKey}
                  className="bg-dark-card border border-dark-border rounded-2xl p-6 text-center"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.15 }}
                  whileHover={{ y: -4 }}
                >
                  <span style={{ fontSize: '48px' }}>{feat.emoji}</span>
                  <h3 className="font-display text-white text-xl mt-4">{t(feat.titleKey)}</h3>
                  <p className="font-body text-white/60 text-sm mt-2">{t(feat.descKey)}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </Section>

        {/* ═══ SUBJECTS ═══ */}
        <Section>
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-display text-white text-2xl lg:text-4xl mb-8">
              {t('landing.subjects_title')}
            </h2>
            <div className="flex flex-wrap justify-center gap-3">
              {SUBJECTS.map((subject) => (
                <motion.span
                  key={subject}
                  className="bg-dark-card border border-dark-border rounded-full px-4 py-2 text-white/80 text-sm font-body"
                  whileHover={{ scale: 1.05, borderColor: '#6C3CE1' }}
                >
                  {subject}
                </motion.span>
              ))}
            </div>
          </div>
        </Section>

        {/* ═══ TESTIMONIALS ═══ */}
        <Section>
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {TESTIMONIALS.map((item, i) => (
                <motion.div
                  key={item.textKey}
                  className="bg-dark-card border border-dark-border rounded-2xl p-6"
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.15 }}
                >
                  <p className="font-body text-white/80 italic">"{t(item.textKey)}"</p>
                  <p className="font-body text-white/50 text-sm mt-4">— {t(item.authorKey)}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </Section>

        {/* ═══ PRICING ═══ */}
        <Section>
          <div className="max-w-4xl mx-auto">
            <h2 className="font-display text-white text-2xl lg:text-4xl text-center mb-12">
              {t('landing.pricing_title')}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Free */}
              <div className="bg-dark-card border border-dark-border rounded-2xl p-8 text-center flex flex-col">
                <h3 className="font-display text-white text-xl">{t('landing.plan_free_name')}</h3>
                <p className="font-display text-white text-3xl mt-2">{t('landing.plan_free_price')}</p>
                <ul className="font-body text-white/60 text-sm mt-4 space-y-2 flex-1">
                  {t('landing.plan_free_features').split('\n').map((f) => (
                    <li key={f}>✓ {f}</li>
                  ))}
                </ul>
                <motion.button
                  onClick={() => void navigate('/onboarding')}
                  className="mt-6 font-body font-bold text-white cursor-pointer border border-dark-border bg-transparent"
                  style={{ padding: '12px 24px', borderRadius: '50px', fontSize: '14px' }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {t('landing.plan_free_cta')}
                </motion.button>
              </div>

              {/* Pro (highlighted) */}
              <div className="bg-dark-card border-2 border-primary rounded-2xl p-8 text-center flex flex-col ring-2 ring-primary/30 relative">
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs font-body font-bold px-3 py-1 rounded-full">
                  {t('landing.plan_pro_badge')}
                </span>
                <h3 className="font-display text-white text-xl">{t('landing.plan_pro_name')}</h3>
                <p className="font-display text-white text-3xl mt-2">{t('landing.plan_pro_price')}</p>
                <ul className="font-body text-white/60 text-sm mt-4 space-y-2 flex-1">
                  {t('landing.plan_pro_features').split('\n').map((f) => (
                    <li key={f}>✓ {f}</li>
                  ))}
                </ul>
                <motion.button
                  onClick={() => void navigate('/onboarding')}
                  className="mt-6 font-body font-bold text-white cursor-pointer border-none"
                  style={{ padding: '12px 24px', borderRadius: '50px', fontSize: '14px', background: '#6C3CE1' }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {t('landing.plan_pro_cta')}
                </motion.button>
              </div>

              {/* School */}
              <div className="bg-dark-card border border-dark-border rounded-2xl p-8 text-center flex flex-col">
                <h3 className="font-display text-white text-xl">{t('landing.plan_school_name')}</h3>
                <p className="font-display text-white text-3xl mt-2">{t('landing.plan_school_price')}</p>
                <ul className="font-body text-white/60 text-sm mt-4 space-y-2 flex-1">
                  {t('landing.plan_school_features').split('\n').map((f) => (
                    <li key={f}>✓ {f}</li>
                  ))}
                </ul>
                <motion.button
                  className="mt-6 font-body font-bold text-white cursor-pointer border border-dark-border bg-transparent"
                  style={{ padding: '12px 24px', borderRadius: '50px', fontSize: '14px' }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {t('landing.plan_school_cta')}
                </motion.button>
              </div>
            </div>
          </div>
        </Section>

        {/* ═══ FINAL CTA ═══ */}
        <Section className="text-center">
          <h2 className="font-display text-white text-2xl lg:text-4xl mb-8">
            {t('landing.cta_title')}
          </h2>
          <motion.button
            onClick={() => void navigate('/onboarding')}
            className="font-body font-bold text-white cursor-pointer border-none"
            style={{ fontSize: '20px', background: '#6C3CE1', padding: '18px 48px', borderRadius: '50px' }}
            animate={{
              boxShadow: [
                '0 0 30px rgba(108,60,225,0.5)',
                '0 0 50px rgba(108,60,225,0.8)',
                '0 0 30px rgba(108,60,225,0.5)',
              ],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            whileHover={{ scale: 1.05, transition: { duration: 0.15 } }}
            whileTap={{ scale: 0.95, transition: { duration: 0.1 } }}
          >
            {t('landing.cta_button')}
          </motion.button>
        </Section>

        {/* ═══ FOOTER ═══ */}
        <footer className="border-t border-dark-border py-8 px-6 text-center">
          <div className="flex justify-center gap-6 font-body text-white/40 text-sm">
            <Link to="/datenschutz" className="hover:text-white/60">{t('landing.footer_privacy')}</Link>
            <Link to="/impressum" className="hover:text-white/60">{t('landing.footer_imprint')}</Link>
            <Link to="/agb" className="hover:text-white/60">{t('landing.footer_terms')}</Link>
            <a href="mailto:kontakt@example.com" className="hover:text-white/60">{t('landing.footer_contact')}</a>
          </div>
        </footer>
      </div>
    </div>
  )
}
