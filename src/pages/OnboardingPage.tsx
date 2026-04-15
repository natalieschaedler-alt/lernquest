import { useState, useMemo, useRef, useEffect, type ChangeEvent } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { useGameStore } from '../stores/gameStore'
import { generateQuestions } from '../utils/generateQuestions'
import { getAvailableWorlds, getLockedWorlds } from '../data/worlds'

const LOADING_TIP_KEYS = [
  'onboarding_extra.tip_0',
  'onboarding_extra.tip_1',
  'onboarding_extra.tip_2',
  'onboarding_extra.tip_3',
  'onboarding_extra.tip_4',
] as const

const EXAMPLE_CHIPS = [
  {
    label: '🌿 Photosynthese',
    text: 'Die Photosynthese ist der Prozess, durch den Pflanzen Lichtenergie in chemische Energie umwandeln. Chlorophyll in den Chloroplasten absorbiert Sonnenlicht. CO2 und Wasser werden zu Glucose und Sauerstoff umgewandelt. Die Formel lautet: 6CO2 + 6H2O + Lichtenergie → C6H12O6 + 6O2. Licht- und Dunkelreaktionen sind die zwei Phasen.',
  },
  {
    label: '⚔️ Französische Revolution',
    text: 'Die Französische Revolution begann 1789 mit dem Sturm auf die Bastille. Ursachen waren soziale Ungleichheit, hohe Steuern und Hungersnöte. Die Erklärung der Menschen- und Bürgerrechte wurde verabschiedet. König Ludwig XVI. wurde hingerichtet. Die Revolution endete mit dem Aufstieg Napoleons und veränderte die politische Landschaft Europas grundlegend.',
  },
  {
    label: '📐 Pythagoras',
    text: 'Der Satz des Pythagoras besagt: In einem rechtwinkligen Dreieck ist die Summe der Quadrate der beiden Katheten gleich dem Quadrat der Hypotenuse (a² + b² = c²). Er wird verwendet, um Seitenlängen zu berechnen. Der Satz gilt nur für rechtwinklige Dreiecke. Pythagoras von Samos war ein griechischer Mathematiker und Philosoph.',
  },
  {
    label: '🌍 Klimawandel',
    text: 'Der Klimawandel beschreibt die langfristige Veränderung der Temperaturen und Wettermuster auf der Erde. Hauptursache ist der Treibhauseffekt durch CO2, Methan und andere Gase. Die globale Erwärmung führt zu schmelzenden Gletschern, steigendem Meeresspiegel und extremen Wetterereignissen. Gegenmaßnahmen umfassen erneuerbare Energien und Emissionsreduktion.',
  },
  {
    label: '⚗️ Chemische Reaktionen',
    text: 'Chemische Reaktionen sind Prozesse, bei denen Stoffe in neue Stoffe umgewandelt werden. Dabei werden chemische Bindungen gebrochen und neue gebildet. Wichtige Reaktionstypen sind Synthese, Analyse, Austausch und Verbrennung. Das Gesetz der Erhaltung der Masse besagt, dass die Gesamtmasse der Reaktanten gleich der Gesamtmasse der Produkte ist.',
  },
]

const slideVariants = {
  enter: { x: 100, opacity: 0 },
  center: { x: 0, opacity: 1 },
  exit: { x: -100, opacity: 0 },
}

/** Extract clean, structured text from a PDF file using pdfjs-dist (npm) */
async function extractTextFromPdf(file: File): Promise<string> {
  // Dynamic import to keep initial bundle small
  const pdfjsLib = await import('pdfjs-dist')
  // ?url suffix makes Vite emit the worker as a hashed static asset and
  // return the final URL — works in dev and prod, on all browsers.
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

    // Group text items into lines by their Y-position
    interface TextLine { y: number; texts: string[] }
    const lineMap = new Map<number, TextLine>()

    for (const item of content.items) {
      if (!('str' in item)) continue
      const textItem = item as { str: string; transform: number[] }
      if (!textItem.str.trim()) continue

      // Round Y to nearest 2px to group items on the same visual line
      const y = Math.round(textItem.transform[5] / 2) * 2

      if (!lineMap.has(y)) {
        lineMap.set(y, { y, texts: [] })
      }
      lineMap.get(y)!.texts.push(textItem.str)
    }

    // Sort lines by Y descending (top to bottom), join texts per line
    const sortedLines = Array.from(lineMap.values())
      .sort((a, b) => b.y - a.y)
      .map((line) => line.texts.join(' ').trim())
      .filter((l) => l.length > 0)

    if (sortedLines.length > 0) {
      paragraphs.push(sortedLines.join('\n'))
    }
  }

  const fullText = paragraphs.join('\n\n').trim()

  if (fullText.length < 50) {
    throw Object.assign(new Error('extract'), { code: 'pdf_error_extract' })
  }

  return fullText
}

export default function OnboardingPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { setPlayerName, setQuestions, setSelectedWorldId } = useGameStore()
  const totalSessions = useGameStore((s) => s.totalSessions)

  const nameInputRef = useRef<HTMLInputElement>(null)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState(1)

  useEffect(() => {
    if (step === 1) {
      const timer = setTimeout(() => nameInputRef.current?.focus({ preventScroll: true }), 300)
      return () => clearTimeout(timer)
    }
  }, [step])

  const [name, setName] = useState('')
  const [learningText, setLearningText] = useState('')
  const [selectedWorldId, setLocalWorldId] = useState('fire')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfStatus, setPdfStatus] = useState<{ ok: boolean; message: string } | null>(null)
  const [tipIndex, setTipIndex] = useState(0)

  // Rotate loading tip every 2 seconds while question generation is running
  useEffect(() => {
    if (!isLoading) { setTipIndex(0); return }
    const timer = setInterval(() => {
      setTipIndex((i) => (i + 1) % LOADING_TIP_KEYS.length)
    }, 2000)
    return () => clearInterval(timer)
  }, [isLoading])

  const stars = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        id: i,
        top: `${Math.random() * 100}%`,
        left: `${Math.random() * 100}%`,
        size: Math.random() * 2 + 1,
        duration: Math.random() * 4 + 2,
        delay: Math.random() * 4,
      })),
    []
  )

  const canContinueStep1 = name.trim().length >= 2 && name.trim().length <= 20
  const canSubmitStep2 = learningText.length >= 80 && !isLoading

  const allWorlds = useMemo(
    () => [...getAvailableWorlds(totalSessions), ...getLockedWorlds(totalSessions)],
    [totalSessions]
  )

  const handleNext = () => {
    if (step < 3) setStep(step + 1)
  }

  const handleBack = () => {
    if (step > 1) setStep(step - 1)
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
      setPdfStatus({
        ok: true,
        message: t('onboarding.pdf_loaded', { name: file.name, chars: text.length }),
      })
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
    if (!canSubmitStep2) return
    setIsLoading(true)
    setError(null)
    try {
      const { questions, worldId } = await generateQuestions(learningText)
      setPlayerName(name.trim())
      setQuestions(questions, worldId)
      setSelectedWorldId(selectedWorldId)
      navigate('/dungeon')
    } catch (err) {
      const message = err instanceof Error ? err.message : t('errors.api_error')
      setError(message)
      toast.error(message, { duration: 5000 })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <motion.div
      className="relative min-h-screen bg-dark overflow-hidden flex flex-col items-center justify-center px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Stars */}
      {stars.map((star) => (
        <motion.div
          key={star.id}
          className="absolute rounded-full bg-white pointer-events-none"
          style={{ top: star.top, left: star.left, width: star.size, height: star.size }}
          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.2, 0.8] }}
          transition={{ duration: star.duration, delay: star.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}

      {/* Nebula */}
      <div className="absolute inset-0 pointer-events-none">
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

      {/* Progress Dots */}
      <div className="absolute top-8 flex gap-3 z-20">
        {[1, 2, 3].map((dot) => (
          <motion.div
            key={dot}
            className="w-3 h-3 rounded-full"
            animate={{
              backgroundColor: dot === step ? '#6C3CE1' : '#0F3460',
              boxShadow: dot === step ? '0 0 10px rgba(108,60,225,0.6)' : '0 0 0px transparent',
            }}
            transition={{ duration: 0.3 }}
          />
        ))}
      </div>

      {/* Step Content */}
      <div className="relative z-10 w-full mx-auto" style={{ maxWidth: '500px' }}>
        <AnimatePresence mode="wait">

          {/* ── Step 1: Name ── */}
          {step === 1 && (
            <motion.div
              key="step1"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="flex flex-col items-center gap-6"
            >
              <h1 className="font-display text-white text-center" style={{ fontSize: '28px' }}>
                {t('onboarding.step1_title')}
              </h1>

              <input
                ref={nameInputRef}
                type="text"
                maxLength={20}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && canContinueStep1) handleNext() }}
                placeholder={t('onboarding.step1_placeholder')}
                className="bg-dark-card border border-dark-border text-white rounded-xl p-4 text-lg w-full outline-none focus:border-primary transition-colors"
                aria-label={t('onboarding.step1_placeholder')}
              />

              <motion.button
                onClick={handleNext}
                disabled={!canContinueStep1}
                className="font-body font-bold text-white cursor-pointer border-none disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ fontSize: '16px', background: '#6C3CE1', padding: '14px 40px', borderRadius: '50px' }}
                whileHover={canContinueStep1 ? { scale: 1.05 } : {}}
                whileTap={canContinueStep1 ? { scale: 0.95 } : {}}
              >
                {t('onboarding.continue')}
              </motion.button>
            </motion.div>
          )}

          {/* ── Step 2: Learning Text ── */}
          {step === 2 && (
            <motion.div
              key="step2"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="flex flex-col items-center gap-4"
            >
              <h1 className="font-display text-white text-center" style={{ fontSize: '28px' }}>
                {t('onboarding.step3_title')}
              </h1>

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
                  style={{ minHeight: '140px', resize: 'none' }}
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

              {/* Hint */}
              <p className="text-xs text-gray-500 w-full -mt-2">
                {t('onboarding.step3_hint')}
              </p>

              {/* Example Chips */}
              <div className="w-full overflow-x-auto scrollbar-hide">
                <div className="flex gap-2 pb-1" style={{ width: 'max-content' }}>
                  {EXAMPLE_CHIPS.map((chip) => (
                    <button
                      key={chip.label}
                      onClick={() => {
                        setLearningText(chip.text)
                        setPdfStatus(null)
                      }}
                      className="bg-dark-card border border-dark-border text-white rounded-full px-4 py-2 cursor-pointer whitespace-nowrap text-sm hover:border-primary transition-colors"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
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
                  onClick={handleNext}
                  disabled={!canSubmitStep2}
                  className="font-body font-bold text-white cursor-pointer border-none disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ fontSize: '16px', background: '#6C3CE1', padding: '14px 40px', borderRadius: '50px' }}
                  whileHover={canSubmitStep2 ? { scale: 1.05 } : {}}
                  whileTap={canSubmitStep2 ? { scale: 0.95 } : {}}
                >
                  {t('onboarding.continue')}
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── Step 3: World selection ── */}
          {step === 3 && (
            <motion.div
              key="step3"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="flex flex-col items-center gap-6"
            >
              <h1 className="font-display text-white text-center" style={{ fontSize: '28px' }}>
                {t('onboarding.choose_world')}
              </h1>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 w-full">
                {allWorlds.map((world) => {
                  const isUnlocked = world.unlockedAtSessions <= totalSessions
                  const isSelected = selectedWorldId === world.id
                  const sessionsRemaining = world.unlockedAtSessions - totalSessions

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
                          backgroundColor: `${world.primaryColor}26`,
                          border: isSelected ? `2px solid ${world.primaryColor}` : '1px solid #0F3460',
                          boxShadow: isSelected ? `0 0 20px ${world.primaryColor}40` : 'none',
                        }}
                        whileHover={{ y: -4, scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                      >
                        <span style={{ fontSize: '40px', lineHeight: 1 }}>{world.emoji}</span>
                        <span className="font-display text-white mt-2" style={{ fontSize: '16px' }}>
                          {world.name}
                        </span>
                        {world.unlockedAtSessions > 0 && (
                          <span className="text-gray-500 mt-1" style={{ fontSize: '11px' }}>
                            {t('league.unlocked_at', { sessions: world.unlockedAtSessions })}
                          </span>
                        )}
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
                        backgroundColor: '#0F1A30',
                        border: '1px solid #0F3460',
                        opacity: 0.45,
                        cursor: 'not-allowed',
                      }}
                    >
                      <span style={{ fontSize: '40px', lineHeight: 1 }}>🔒</span>
                      <span className="font-display text-white mt-2" style={{ fontSize: '16px' }}>
                        {world.name}
                      </span>
                      <span className="text-gray-500 mt-1" style={{ fontSize: '11px' }}>
                        {t('league.sessions_remaining', { sessions: sessionsRemaining })}
                      </span>
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
                  onClick={() => void handleSubmit()}
                  disabled={isLoading}
                  className="font-body font-bold text-white cursor-pointer border-none disabled:opacity-40 disabled:cursor-not-allowed relative overflow-hidden"
                  style={{ fontSize: '16px', background: '#6C3CE1', padding: '14px 40px', borderRadius: '50px', minWidth: '180px' }}
                  whileHover={!isLoading ? { scale: 1.05 } : {}}
                  whileTap={!isLoading ? { scale: 0.95 } : {}}
                >
                  {/* Shimmer */}
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
                    {isLoading ? t('onboarding.creating') : t('onboarding.start_adventure')}
                  </span>
                </motion.button>
              </div>

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
