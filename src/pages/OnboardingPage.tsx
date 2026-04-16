import { useState, useMemo, useRef, useEffect, type ChangeEvent } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { useGameStore } from '../stores/gameStore'
import { generateQuestions } from '../utils/generateQuestions'
import { getAvailableWorlds, getLockedWorlds } from '../data/worlds'
import PhotoCapture from '../components/ui/PhotoCapture'

// ── Constants ─────────────────────────────────────────────────────────────────

const TOTAL_STEPS = 5

const LOADING_TIP_KEYS = [
  'onboarding_extra.tip_0',
  'onboarding_extra.tip_1',
  'onboarding_extra.tip_2',
  'onboarding_extra.tip_3',
  'onboarding_extra.tip_4',
] as const

/** Predefined topic chips – subject-specific content for 10–18 year olds. */
const PRESET_TOPICS = [
  {
    label: '🧮 Mathe Grundlagen',
    text: 'Mathematik umfasst grundlegende Operationen wie Addition, Subtraktion, Multiplikation und Division. Brüche bestehen aus Zähler und Nenner. Das Dezimalsystem verwendet die Ziffern 0–9. Prozentrechnung zeigt Anteile von 100 an. Geometrische Grundformen sind Quadrat, Rechteck, Dreieck und Kreis. Flächenformeln: Quadrat A = a², Rechteck A = a × b, Dreieck A = (g × h) / 2. Der Satz des Pythagoras lautet: a² + b² = c² für rechtwinklige Dreiecke.',
  },
  {
    label: '📖 Englisch Vokabeln',
    text: 'Grundlegende englische Vokabeln: Hello (Hallo), Goodbye (Auf Wiedersehen), Please (Bitte), Thank you (Danke), Yes (Ja), No (Nein), Family (Familie), House (Haus), School (Schule), Water (Wasser), Food (Essen), Dog (Hund), Cat (Katze), Book (Buch), Teacher (Lehrer), Student (Schüler), Friend (Freund), Happy (glücklich), Sad (traurig), Big (groß), Small (klein), Fast (schnell), Slow (langsam), Beautiful (schön).',
  },
  {
    label: '🏛️ Geschichte: Römer',
    text: 'Das Römische Reich war eine der mächtigsten Zivilisationen der Geschichte. Julius Caesar war ein bedeutender Feldherr und Staatsmann. Das Forum Romanum war der zentrale Platz Roms. Die Römer bauten Straßen, Aquädukte und Kolosseen. Gladiatorenkämpfe fanden im Kolosseum statt. Augustus war der erste Kaiser. Die Pax Romana war eine lange Friedensperiode. Das Lateinische Alphabet beeinflusst unsere Schrift bis heute. Rom wurde angeblich 753 v. Chr. gegründet.',
  },
  {
    label: '🔬 Biologie: Zellen',
    text: 'Zellen sind die kleinsten Einheiten des Lebens. Pflanzenzellen besitzen eine Zellwand und Chloroplasten. Tierzellen haben keine Zellwand. Der Zellkern enthält die DNA als Erbinformation. Mitochondrien erzeugen Energie in Form von ATP. Die Zellatmung wandelt Glucose in Energie um. Mitose ist die Zellteilung für Wachstum und Reparatur. Meiose bildet Geschlechtszellen mit halbem Chromosomensatz. Ribosomen synthetisieren Proteine.',
  },
  {
    label: '🌍 Erdkunde: Europa',
    text: 'Europa ist ein Kontinent mit 44 Ländern. Die Europäische Union hat 27 Mitgliedsstaaten. Deutschland ist das bevölkerungsreichste EU-Land. Der Rhein und die Donau sind wichtige Flüsse. Die Alpen sind das größte Gebirge Europas. Paris ist die Hauptstadt Frankreichs. Der Mittelmeerraum hat ein warmes Klima. Skandinavien umfasst Norwegen, Schweden und Dänemark. Hauptstädte: Berlin (Deutschland), Wien (Österreich), Bern (Schweiz).',
  },
  {
    label: '⚗️ Chemie: Atome',
    text: 'Atome sind die Grundbausteine der Materie. Sie bestehen aus Protonen, Neutronen und Elektronen. Protonen und Neutronen bilden den Atomkern. Elektronen umkreisen den Kern in Schalen. Die Ordnungszahl gibt die Protonenzahl an. Isotope haben gleiche Protonenzahl, aber unterschiedliche Neutronenzahl. Moleküle bestehen aus mehreren Atomen. Chemische Bindungen entstehen durch Elektronenübertragung (Ionenbindung) oder -teilung (kovalente Bindung).',
  },
  {
    label: '🌿 Biologie: Photosynthese',
    text: 'Die Photosynthese ist der Prozess, durch den Pflanzen Lichtenergie in chemische Energie umwandeln. Chlorophyll in den Chloroplasten absorbiert Sonnenlicht. CO₂ und Wasser werden zu Glucose und Sauerstoff umgewandelt. Die Formel lautet: 6CO₂ + 6H₂O + Lichtenergie → C₆H₁₂O₆ + 6O₂. Lichtreaktionen und Dunkelreaktionen (Calvin-Zyklus) sind die zwei Phasen der Photosynthese.',
  },
  {
    label: '⚡ Physik: Mechanik',
    text: 'Physik beschreibt natürliche Phänomene durch Gesetze und Formeln. Geschwindigkeit ist Weg geteilt durch Zeit (v = s/t). Beschleunigung ist Geschwindigkeitsänderung pro Zeit (a = Δv/t). Die Erdanziehungskraft beträgt etwa 9,81 m/s². Newtons erstes Gesetz: Ein Körper bleibt in Ruhe oder gleichförmiger Bewegung, solange keine Kraft wirkt. Kraft gleich Masse mal Beschleunigung (F = m × a). Energie kann weder erzeugt noch vernichtet werden.',
  },
]

/** The single pre-defined quiz question for Step 1. Options are always shuffled into this order. */
const MINI_OPTIONS = ['Berlin', 'München', 'Hamburg', 'Frankfurt']
const MINI_CORRECT = 'Berlin'

const CONFETTI_COLORS = ['#6C3CE1', '#FF6B35', '#00C896', '#F59E0B', '#06B6D4', '#F87171', '#EC4899', '#A855F7']

/** Maps world IDs to their i18n teaser key shown on locked world cards. */
const WORLD_TEASER_KEYS: Record<string, string> = {
  water:  'onboarding.world_teaser_water',
  cyber:  'onboarding.world_teaser_cyber',
  forest: 'onboarding.world_teaser_forest',
  cosmos: 'onboarding.world_teaser_cosmos',
}

const slideVariants = {
  enter:  { x: 80, opacity: 0 },
  center: { x: 0,  opacity: 1 },
  exit:   { x: -80, opacity: 0 },
}

// ── PDF helper ────────────────────────────────────────────────────────────────

/** Extract clean, structured text from a PDF file using pdfjs-dist (npm) */
async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

  const buffer = await file.arrayBuffer()

  let pdf: import('pdfjs-dist').PDFDocumentProxy
  try {
    pdf = await pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
      disableFontFace: true,
      useSystemFonts: false,
      isEvalSupported: false,
    }).promise
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown'
    throw Object.assign(new Error(detail), { code: 'pdf_error_open' })
  }

  const pageCount = pdf.numPages
  const paragraphs: string[] = []

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdf.getPage(pageNum)
    const content = await page.getTextContent()

    interface TextLine { y: number; texts: string[] }
    const lineMap = new Map<number, TextLine>()

    for (const item of content.items) {
      if (!('str' in item)) continue
      const textItem = item as { str: string; transform: number[] }
      if (!textItem.str.trim()) continue
      const y = Math.round(textItem.transform[5] / 2) * 2
      if (!lineMap.has(y)) lineMap.set(y, { y, texts: [] })
      lineMap.get(y)!.texts.push(textItem.str)
    }

    const sortedLines = Array.from(lineMap.values())
      .sort((a, b) => b.y - a.y)
      .map((line) => line.texts.join(' ').trim())
      .filter((l) => l.length > 0)

    if (sortedLines.length > 0) paragraphs.push(sortedLines.join('\n'))
  }

  const fullText = paragraphs.join('\n\n').trim()
  if (fullText.length < 50) throw Object.assign(new Error('extract'), { code: 'pdf_error_extract' })
  return fullText
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { setPlayerName, setQuestions, setSelectedWorldId } = useGameStore()
  const totalSessions = useGameStore((s) => s.totalSessions)

  // ?new=1 bypass: skip the returning-user redirect when navigated from the dashboard
  const isNewIntent = new URLSearchParams(location.search).get('new') === '1'

  // Redirect returning users who've completed onboarding before
  useEffect(() => {
    if (!isNewIntent && localStorage.getItem('onboarding_done') === 'true') {
      navigate('/dashboard', { replace: true })
    }
  }, [navigate, isNewIntent])

  const nameInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef  = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState(1)

  // Auto-focus name input on step 2
  useEffect(() => {
    if (step === 2) {
      const timer = setTimeout(() => nameInputRef.current?.focus({ preventScroll: true }), 300)
      return () => clearTimeout(timer)
    }
  }, [step])

  // ── Step 1 state ──
  const [step1Selected, setStep1Selected] = useState<string | null>(null)
  const [showConfetti,  setShowConfetti]  = useState(false)
  const [showXpFloat,   setShowXpFloat]  = useState(false)

  // Auto-hide confetti after animation
  useEffect(() => {
    if (!showConfetti) return
    const timer = setTimeout(() => setShowConfetti(false), 1200)
    return () => clearTimeout(timer)
  }, [showConfetti])

  // ── Step 2 state ──
  const [name, setName] = useState('')

  // ── Step 3 state ──
  const [intention, setIntention] = useState<string | null>(null)

  // ── Step 4 state ──
  const [showPhotoCapture, setShowPhotoCapture] = useState(false)
  const [learningText, setLearningText] = useState('')
  const [isLoading,    setIsLoading]    = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [pdfLoading,   setPdfLoading]   = useState(false)
  const [pdfStatus,    setPdfStatus]    = useState<{ ok: boolean; message: string } | null>(null)
  const [tipIndex,     setTipIndex]     = useState(0)

  // ── Step 5 state ──
  const [selectedWorldId, setLocalWorldId] = useState('fire')

  // Rotate loading tip every 2s during question generation
  useEffect(() => {
    if (!isLoading) { setTipIndex(0); return }
    const timer = setInterval(() => setTipIndex((i) => (i + 1) % LOADING_TIP_KEYS.length), 2000)
    return () => clearInterval(timer)
  }, [isLoading])

  // ── Derived ──
  const canContinueStep2 = name.trim().length >= 2 && name.trim().length <= 20
  const canContinueStep4 = learningText.length >= 80

  const allWorlds = useMemo(
    () => [...getAvailableWorlds(totalSessions), ...getLockedWorlds(totalSessions)],
    [totalSessions],
  )

  // ── Memos ──

  const stars = useMemo(
    () => Array.from({ length: 60 }, (_, i) => ({
      id: i,
      top:      `${Math.random() * 100}%`,
      left:     `${Math.random() * 100}%`,
      size:     Math.random() * 2 + 1,
      duration: Math.random() * 4 + 2,
      delay:    Math.random() * 4,
    })),
    [],
  )

  const confettiParticles = useMemo(
    () => Array.from({ length: 28 }, (_, i) => ({
      id:       i,
      color:    CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      x:        (Math.random() - 0.5) * 380,
      y:        -(Math.random() * 220 + 80),
      rotation: Math.random() * 720 - 360,
      size:     Math.random() * 10 + 4,
      delay:    Math.random() * 0.15,
    })),
    [],
  )

  // ── Handlers ──

  const handleNext = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS))
  const handleBack = () => setStep((s) => Math.max(s - 1, 1))

  const handleStep1Answer = (option: string) => {
    if (step1Selected !== null) return
    setStep1Selected(option)
    if (option === MINI_CORRECT) {
      setShowConfetti(true)
      setShowXpFloat(true)
    }
  }

  const handlePdfUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 10 * 1024 * 1024) {
      setPdfStatus({ ok: false, message: t('onboarding.pdf_error_size') })
      return
    }

    setPdfLoading(true)
    setPdfStatus(null)
    setError(null)

    try {
      const text = await extractTextFromPdf(file)
      setLearningText(text)
      setPdfStatus({ ok: true, message: t('onboarding.pdf_loaded', { name: file.name, chars: text.length }) })
    } catch (err) {
      const code = (err as { code?: string }).code
      const msg = code ? t(`onboarding.${code}`) : (err instanceof Error ? err.message : t('onboarding.pdf_error_open'))
      setPdfStatus({ ok: false, message: msg })
      toast.error(msg, { duration: 5000 })
    } finally {
      setPdfLoading(false)
      if (pdfInputRef.current) pdfInputRef.current.value = ''
    }
  }

  const handleSubmit = async () => {
    if (!canContinueStep4) return
    setIsLoading(true)
    setError(null)
    try {
      const { questions, worldId } = await generateQuestions(learningText)
      setPlayerName(name.trim())
      setQuestions(questions, worldId)
      setSelectedWorldId(selectedWorldId)
      if (intention && intention !== 'skip') localStorage.setItem('lq_intention', intention)
      localStorage.setItem('onboarding_done', 'true')
      navigate('/dungeon')
    } catch (err) {
      const message = err instanceof Error ? err.message : t('errors.api_error')
      setError(message)
      toast.error(message, { duration: 5000 })
    } finally {
      setIsLoading(false)
    }
  }

  // ── Render ──

  return (
    <motion.div
      className="relative min-h-screen bg-dark overflow-hidden flex flex-col items-center justify-center px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* ── Stars ── */}
      {stars.map((star) => (
        <motion.div
          key={star.id}
          className="absolute rounded-full bg-white pointer-events-none"
          style={{ top: star.top, left: star.left, width: star.size, height: star.size }}
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: star.duration, delay: star.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}

      {/* ── Nebula blobs ── */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute rounded-full"
          style={{ top: '10%', left: '15%', width: 500, height: 500, background: 'radial-gradient(circle, rgba(108,60,225,0.15) 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute rounded-full"
          style={{ top: '40%', right: '10%', width: 400, height: 400, background: 'radial-gradient(circle, rgba(30,100,255,0.12) 0%, transparent 70%)' }}
          animate={{ scale: [1.1, 1, 1.1], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute rounded-full"
          style={{ bottom: '15%', left: '30%', width: 350, height: 350, background: 'radial-gradient(circle, rgba(0,200,150,0.10) 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* ── Confetti burst (step 1 correct answer) ── */}
      <AnimatePresence>
        {showConfetti && confettiParticles.map((p) => (
          <motion.div
            key={p.id}
            className="fixed rounded-sm pointer-events-none"
            style={{
              top: '50%', left: '50%',
              width: p.size, height: p.size,
              backgroundColor: p.color,
              zIndex: 200,
            }}
            initial={{ x: 0, y: 0, opacity: 1, rotate: 0 }}
            animate={{ x: p.x, y: p.y, opacity: 0, rotate: p.rotation }}
            transition={{ duration: 0.9, delay: p.delay, ease: 'easeOut' }}
          />
        ))}
      </AnimatePresence>

      {/* ── +25 XP float ── */}
      <AnimatePresence>
        {showXpFloat && (
          <motion.div
            key="xp-float"
            className="fixed font-display font-bold pointer-events-none select-none"
            style={{
              top: '38%', left: 0, right: 0,
              textAlign: 'center',
              fontSize: '32px',
              color: '#F59E0B',
              zIndex: 201,
              textShadow: '0 0 24px rgba(245,158,11,0.7)',
            }}
            initial={{ opacity: 0, y: 0, scale: 0.7 }}
            animate={{ opacity: [0, 1, 1, 0], y: -90, scale: [0.7, 1.2, 1.1, 0.9] }}
            transition={{ duration: 1.5, times: [0, 0.12, 0.65, 1] }}
            onAnimationComplete={() => setShowXpFloat(false)}
          >
            +25 XP ✨
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Progress dots (5) ── */}
      <div className="absolute top-8 flex gap-3 z-20">
        {[1, 2, 3, 4, 5].map((dot) => (
          <motion.div
            key={dot}
            className="w-3 h-3 rounded-full"
            animate={{
              backgroundColor: dot === step ? '#6C3CE1' : dot < step ? '#9B5DE5' : '#0F3460',
              boxShadow: dot === step ? '0 0 10px rgba(108,60,225,0.6)' : '0 0 0px transparent',
              scale: dot === step ? 1.25 : 1,
            }}
            transition={{ duration: 0.3 }}
          />
        ))}
      </div>

      {/* ── Step content ── */}
      <div className="relative z-10 w-full mx-auto" style={{ maxWidth: '500px' }}>
        <AnimatePresence mode="wait">

          {/* ────────────────────────────────────────────────────
              STEP 1 — Mini-Erfolg: ein schneller Dopamin-Kick
          ──────────────────────────────────────────────────── */}
          {step === 1 && (
            <motion.div
              key="step1"
              variants={slideVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="flex flex-col items-center gap-5"
            >
              <h1 className="font-display text-white text-center" style={{ fontSize: '26px' }}>
                {t('onboarding.mini_q_title')}
              </h1>

              {/* Question card */}
              <div
                className="w-full rounded-2xl p-5 text-center"
                style={{ background: 'rgba(108,60,225,0.12)', border: '1px solid rgba(108,60,225,0.3)' }}
              >
                <p className="font-body text-white font-semibold" style={{ fontSize: '18px' }}>
                  {t('onboarding.mini_q_question')}
                </p>
              </div>

              {/* Answer grid */}
              <div className="grid grid-cols-2 gap-3 w-full">
                {MINI_OPTIONS.map((opt) => {
                  const isSelected  = step1Selected === opt
                  const isCorrect   = opt === MINI_CORRECT
                  const revealed    = step1Selected !== null

                  let bg          = 'rgba(15,26,48,0.8)'
                  let borderColor = '#0F3460'
                  if (revealed && isCorrect)               { bg = 'rgba(0,200,150,0.18)'; borderColor = '#00C896' }
                  if (revealed && isSelected && !isCorrect) { bg = 'rgba(248,113,113,0.18)'; borderColor = '#F87171' }

                  return (
                    <motion.button
                      key={opt}
                      type="button"
                      onClick={() => handleStep1Answer(opt)}
                      disabled={revealed}
                      className="rounded-xl p-4 font-body font-semibold text-white cursor-pointer border disabled:cursor-default"
                      style={{ background: bg, borderColor, fontSize: '15px', transition: 'background 0.25s, border-color 0.25s' }}
                      whileHover={!revealed ? { scale: 1.04, y: -2 } : {}}
                      whileTap={!revealed ? { scale: 0.96 } : {}}
                    >
                      {revealed && isCorrect                && <span className="mr-1">✅</span>}
                      {revealed && isSelected && !isCorrect && <span className="mr-1">❌</span>}
                      {opt}
                    </motion.button>
                  )
                })}
              </div>

              {/* Feedback + continue */}
              <AnimatePresence>
                {step1Selected && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center gap-4"
                  >
                    <p
                      className="font-body text-center text-sm px-2"
                      style={{ color: step1Selected === MINI_CORRECT ? '#00C896' : '#F87171' }}
                    >
                      {step1Selected === MINI_CORRECT
                        ? t('onboarding.mini_q_correct')
                        : t('onboarding.mini_q_wrong', { answer: MINI_CORRECT })}
                    </p>

                    <motion.button
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      type="button"
                      onClick={handleNext}
                      className="font-body font-bold text-white cursor-pointer border-none"
                      style={{ fontSize: '16px', background: '#6C3CE1', padding: '13px 38px', borderRadius: '50px' }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {t('onboarding.continue')}
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ────────────────────────────────────────────────────
              STEP 2 — Name
          ──────────────────────────────────────────────────── */}
          {step === 2 && (
            <motion.div
              key="step2"
              variants={slideVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="flex flex-col items-center gap-6"
            >
              <h1 className="font-display text-white text-center" style={{ fontSize: '26px' }}>
                {t('onboarding.name_title')}
              </h1>

              <input
                ref={nameInputRef}
                type="text"
                maxLength={20}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && canContinueStep2) handleNext() }}
                placeholder={t('onboarding.step1_placeholder')}
                className="bg-dark-card border border-dark-border text-white rounded-xl p-4 text-lg w-full outline-none focus:border-primary transition-colors"
                aria-label={t('onboarding.step1_placeholder')}
              />

              <motion.button
                type="button"
                onClick={handleNext}
                disabled={!canContinueStep2}
                className="font-body font-bold text-white cursor-pointer border-none disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ fontSize: '16px', background: '#6C3CE1', padding: '14px 40px', borderRadius: '50px' }}
                whileHover={canContinueStep2 ? { scale: 1.05 } : {}}
                whileTap={canContinueStep2 ? { scale: 0.95 } : {}}
              >
                {t('onboarding.continue')}
              </motion.button>
            </motion.div>
          )}

          {/* ────────────────────────────────────────────────────
              STEP 3 — Lern-Intention
          ──────────────────────────────────────────────────── */}
          {step === 3 && (
            <motion.div
              key="step3"
              variants={slideVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="flex flex-col items-center gap-5"
            >
              <h1 className="font-display text-white text-center" style={{ fontSize: '26px' }}>
                {t('onboarding.intention_title')}
              </h1>

              <div className="flex flex-col gap-3 w-full">
                {[
                  { id: 'exam',    icon: '🎓', label: t('onboarding.intention_exam') },
                  { id: 'grades',  icon: '📚', label: t('onboarding.intention_grades') },
                  { id: 'smarter', icon: '🧠', label: t('onboarding.intention_smarter') },
                ].map((intent) => (
                  <motion.div
                    key={intent.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setIntention(intent.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setIntention(intent.id) }}
                    className="bg-dark-card rounded-2xl p-4 cursor-pointer flex items-center gap-4 border transition-colors focus:outline-none focus-visible:ring-2"
                    style={{
                      borderColor: intention === intent.id ? '#6C3CE1' : '#0F3460',
                      boxShadow:   intention === intent.id ? '0 0 16px rgba(108,60,225,0.28)' : 'none',
                    }}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span style={{ fontSize: '28px', lineHeight: 1 }}>{intent.icon}</span>
                    <span className="font-display text-white flex-1" style={{ fontSize: '17px' }}>
                      {intent.label}
                    </span>
                    <AnimatePresence>
                      {intention === intent.id && (
                        <motion.span
                          initial={{ scale: 0, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0, opacity: 0 }}
                          className="font-bold"
                          style={{ color: '#6C3CE1', fontSize: '18px' }}
                        >
                          ✓
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => { setIntention('skip'); handleNext() }}
                className="font-body text-sm cursor-pointer bg-transparent border-none transition-colors"
                style={{ color: '#6b7280' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#9CA3AF')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#6b7280')}
              >
                {t('onboarding.intention_skip')}
              </button>

              <div className="flex gap-3 mt-1">
                <motion.button
                  type="button"
                  onClick={handleBack}
                  className="font-body font-bold text-white cursor-pointer border-none"
                  style={{ fontSize: '16px', background: 'transparent', padding: '14px 24px', borderRadius: '50px' }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  ←
                </motion.button>
                <motion.button
                  type="button"
                  onClick={handleNext}
                  disabled={intention === null}
                  className="font-body font-bold text-white cursor-pointer border-none disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ fontSize: '16px', background: '#6C3CE1', padding: '14px 40px', borderRadius: '50px' }}
                  whileHover={intention !== null ? { scale: 1.05 } : {}}
                  whileTap={intention !== null ? { scale: 0.95 } : {}}
                >
                  {t('onboarding.continue')}
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ────────────────────────────────────────────────────
              STEP 4 — Lernstoff eingeben
          ──────────────────────────────────────────────────── */}
          {step === 4 && (
            <motion.div
              key="step4"
              variants={slideVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="flex flex-col items-center gap-4"
            >
              {/* Photo-Capture overlay (replaces form content while active) */}
              <AnimatePresence mode="wait">
                {showPhotoCapture ? (
                  <motion.div
                    key="photo-capture-view"
                    className="w-full"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -16 }}
                    transition={{ duration: 0.22 }}
                  >
                    <PhotoCapture
                      onTextExtracted={(text) => {
                        setLearningText(text)
                        setPdfStatus(null)
                        setShowPhotoCapture(false)
                      }}
                      onCancel={() => setShowPhotoCapture(false)}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="step4-form"
                    className="flex flex-col items-center gap-4 w-full"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -16 }}
                    transition={{ duration: 0.22 }}
                  >
                    <h1 className="font-display text-white text-center" style={{ fontSize: '26px' }}>
                      {t('onboarding.step3_title')}
                    </h1>

                    {/* Photo button — now live */}
                    <motion.button
                      type="button"
                      onClick={() => setShowPhotoCapture(true)}
                      className="w-full flex items-center justify-center gap-3 rounded-2xl p-4 font-body font-bold text-white cursor-pointer border-none"
                      style={{
                        background: 'linear-gradient(135deg, #6C3CE1, #9B5DE5)',
                        fontSize: '15px',
                        boxShadow: '0 0 20px rgba(108,60,225,0.35)',
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      {t('onboarding.photo_btn')}
                    </motion.button>

                    {/* PDF Upload */}
                    <div className="w-full flex flex-col items-start gap-2">
                      <button
                        type="button"
                        onClick={() => pdfInputRef.current?.click()}
                        disabled={pdfLoading}
                        className="flex items-center gap-2 bg-dark-card border border-dark-border text-white rounded-full px-4 py-2 cursor-pointer whitespace-nowrap text-sm hover:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        aria-label={t('onboarding.pdf_aria')}
                      >
                        {pdfLoading ? (
                          <>
                            <motion.span
                              className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full"
                              animate={{ rotate: 360 }}
                              transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                            />
                            {t('onboarding.pdf_loading')}
                          </>
                        ) : (
                          <>{t('onboarding.pdf_upload')}</>
                        )}
                      </button>
                      <input
                        ref={pdfInputRef}
                        type="file"
                        accept=".pdf"
                        onChange={(e) => void handlePdfUpload(e)}
                        style={{ display: 'none' }}
                        aria-hidden="true"
                      />
                      <AnimatePresence>
                        {pdfStatus && (
                          <motion.span
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="text-xs"
                            style={{ color: pdfStatus.ok ? '#00C896' : '#F87171' }}
                          >
                            {pdfStatus.message}
                          </motion.span>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Textarea */}
                    <div className="w-full relative">
                      <textarea
                        value={learningText}
                        onChange={(e) => setLearningText(e.target.value)}
                        placeholder={t('onboarding.step3_placeholder')}
                        className="bg-dark-card border border-dark-border text-white rounded-xl p-4 text-base w-full outline-none focus:border-primary transition-colors"
                        style={{ minHeight: '130px', resize: 'none' }}
                        aria-label={t('onboarding.step3_placeholder')}
                      />
                      <motion.span
                        className="absolute bottom-3 right-3 text-xs transition-colors"
                        animate={{ color: learningText.length >= 80 ? '#00C896' : '#6b7280' }}
                      >
                        {learningText.length >= 80
                          ? `${learningText.length} ✓`
                          : `${learningText.length}/80`}
                      </motion.span>
                    </div>

                    <p className="text-xs text-gray-500 w-full -mt-2">{t('onboarding.step3_hint')}</p>

                    {/* Preset topic chips */}
                    <p className="w-full font-body text-xs font-semibold" style={{ color: '#9CA3AF' }}>
                      {t('onboarding.no_topic_label')}
                    </p>
                    <div className="w-full overflow-x-auto scrollbar-hide -mt-2">
                      <div className="flex gap-2 pb-1" style={{ width: 'max-content' }}>
                        {PRESET_TOPICS.map((chip) => (
                          <button
                            key={chip.label}
                            type="button"
                            onClick={() => { setLearningText(chip.text); setPdfStatus(null) }}
                            className="bg-dark-card border border-dark-border text-white rounded-full px-4 py-2 cursor-pointer whitespace-nowrap text-sm hover:border-primary transition-colors"
                          >
                            {chip.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error + nav buttons — hidden while PhotoCapture is open */}
              {!showPhotoCapture && (
                <>
                  <AnimatePresence>
                    {error && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-red-400 text-sm text-center"
                      >
                        {error}
                      </motion.p>
                    )}
                  </AnimatePresence>

                  <div className="flex gap-3">
                    <motion.button
                      type="button"
                      onClick={handleBack}
                      className="font-body font-bold text-white cursor-pointer border-none"
                      style={{ fontSize: '16px', background: 'transparent', padding: '14px 24px', borderRadius: '50px' }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      ←
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={handleNext}
                      disabled={!canContinueStep4}
                      className="font-body font-bold text-white cursor-pointer border-none disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ fontSize: '16px', background: '#6C3CE1', padding: '14px 40px', borderRadius: '50px' }}
                      whileHover={canContinueStep4 ? { scale: 1.05 } : {}}
                      whileTap={canContinueStep4 ? { scale: 0.95 } : {}}
                    >
                      {t('onboarding.continue')}
                    </motion.button>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* ────────────────────────────────────────────────────
              STEP 5 — Welt wählen + Dungeon starten
          ──────────────────────────────────────────────────── */}
          {step === 5 && (
            <motion.div
              key="step5"
              variants={slideVariants}
              initial="enter" animate="center" exit="exit"
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="flex flex-col items-center gap-6"
            >
              <h1 className="font-display text-white text-center" style={{ fontSize: '26px' }}>
                {t('onboarding.choose_world')}
              </h1>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 w-full">
                {allWorlds.map((world) => {
                  const isUnlocked       = world.unlockedAtSessions <= totalSessions
                  const isSelected       = selectedWorldId === world.id
                  const sessionsLeft     = world.unlockedAtSessions - totalSessions

                  if (isUnlocked) {
                    return (
                      <motion.div
                        key={world.id}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isSelected}
                        onClick={() => setLocalWorldId(world.id)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setLocalWorldId(world.id) }}
                        className="rounded-2xl p-4 cursor-pointer flex flex-col items-center text-center focus:outline-none focus-visible:ring-2"
                        style={{
                          backgroundColor: `${world.primaryColor}22`,
                          border: isSelected
                            ? `2px solid ${world.primaryColor}`
                            : '1px solid #0F3460',
                        }}
                        animate={{
                          boxShadow: isSelected
                            ? `0 0 24px ${world.primaryColor}55`
                            : '0 0 0px transparent',
                        }}
                        whileHover={{ y: -4, scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                      >
                        <span style={{ fontSize: '40px', lineHeight: 1 }}>{world.emoji}</span>
                        <span className="font-display text-white mt-2" style={{ fontSize: '15px' }}>
                          {world.name}
                        </span>
                        <AnimatePresence>
                          {isSelected && (
                            <motion.span
                              initial={{ opacity: 0, scale: 0.6 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.6 }}
                              className="mt-1 font-body text-xs font-bold"
                              style={{ color: world.primaryColor }}
                            >
                              ✓ {t('onboarding.world_selected')}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    )
                  }

                  return (
                    <div
                      key={world.id}
                      aria-disabled="true"
                      tabIndex={-1}
                      className="rounded-2xl p-4 flex flex-col items-center text-center"
                      style={{
                        backgroundColor: '#0A1020',
                        border: '1px solid #0F3460',
                        opacity: 0.5,
                        cursor: 'not-allowed',
                      }}
                    >
                      <span style={{ fontSize: '40px', lineHeight: 1 }}>🔒</span>
                      <span className="font-display text-white mt-2" style={{ fontSize: '15px' }}>
                        {world.name}
                      </span>
                      <span className="font-body text-gray-500 mt-1" style={{ fontSize: '11px' }}>
                        {t('onboarding.world_sessions_left', { count: sessionsLeft })}
                      </span>
                      {WORLD_TEASER_KEYS[world.id] && (
                        <span
                          className="font-body mt-1 text-center leading-snug"
                          style={{ fontSize: '10px', color: '#7C3AED', opacity: 0.9 }}
                        >
                          {t(WORLD_TEASER_KEYS[world.id])}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>

              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-red-400 text-sm text-center"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <div className="flex gap-3">
                <motion.button
                  type="button"
                  onClick={handleBack}
                  disabled={isLoading}
                  className="font-body font-bold text-white cursor-pointer border-none disabled:opacity-40"
                  style={{ fontSize: '16px', background: 'transparent', padding: '14px 24px', borderRadius: '50px' }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  ←
                </motion.button>

                <motion.button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={isLoading}
                  className="font-body font-bold text-white cursor-pointer border-none disabled:opacity-40 disabled:cursor-not-allowed relative overflow-hidden"
                  style={{
                    fontSize: '16px',
                    background: '#6C3CE1',
                    padding: '14px 40px',
                    borderRadius: '50px',
                    minWidth: '180px',
                  }}
                  whileHover={!isLoading ? { scale: 1.05 } : {}}
                  whileTap={!isLoading ? { scale: 0.95 } : {}}
                >
                  {/* Shimmer while loading */}
                  {isLoading && (
                    <motion.div
                      className="absolute inset-0 pointer-events-none"
                      style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)' }}
                      animate={{ x: ['-100%', '100%'] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  )}
                  <span className="relative flex items-center justify-center gap-2">
                    {isLoading && (
                      <motion.span
                        className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                      />
                    )}
                    {isLoading ? t('onboarding.creating') : t('onboarding.world_cta')}
                  </span>
                </motion.button>
              </div>

              {/* Rotating loading tips */}
              {isLoading && (
                <AnimatePresence mode="wait">
                  <motion.p
                    key={tipIndex}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.35 }}
                    className="text-center text-sm text-gray-400 font-body"
                  >
                    {t(LOADING_TIP_KEYS[tipIndex])}
                  </motion.p>
                </AnimatePresence>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </motion.div>
  )
}
