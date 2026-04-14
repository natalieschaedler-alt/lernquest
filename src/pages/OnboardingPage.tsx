import { useState, useMemo, useRef, useEffect, type ChangeEvent } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { useGameStore } from '../stores/gameStore'
import { generateQuestions } from '../utils/generateQuestions'
import { getAvailableWorlds, getLockedWorlds } from '../data/worlds'

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

type PdfPage = { getTextContent: () => Promise<{ items: Array<{ str: string }> }> }
type PdfDoc = { numPages: number; getPage: (n: number) => Promise<PdfPage> }
type PdfJsLib = {
  GlobalWorkerOptions: { workerSrc: string }
  getDocument: (opts: { data: ArrayBuffer }) => { promise: Promise<PdfDoc> }
}

function loadPdfJs(): Promise<PdfJsLib> {
  const w = window as unknown as { pdfjsLib?: PdfJsLib }
  if (w.pdfjsLib) return Promise.resolve(w.pdfjsLib)
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'
    script.onload = () => {
      const lib = (window as unknown as { pdfjsLib?: PdfJsLib }).pdfjsLib
      if (!lib) {
        reject(new Error('pdfjsLib nicht verfügbar'))
        return
      }
      lib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'
      resolve(lib)
    }
    script.onerror = () => reject(new Error('pdf.js konnte nicht geladen werden'))
    document.head.appendChild(script)
  })
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

  const canContinueStep1 = name.trim().length >= 2
  const canSubmitStep2 = learningText.length >= 80 && !isLoading

  const handleNext = () => {
    if (step < 3) setStep(step + 1)
  }

  const handleBack = () => {
    if (step > 1) setStep(step - 1)
  }

  const handlePdfUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPdfLoading(true)
    setPdfStatus(null)
    try {
      const pdfjsLib = await loadPdfJs()
      const buffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
      let text = ''
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        text += content.items.map((item) => item.str).join(' ') + '\n'
      }
      setLearningText(text.trim())
      setPdfStatus({ ok: true, message: `✓ ${file.name} geladen (${pdf.numPages} Seiten)` })
    } catch {
      setPdfStatus({ ok: false, message: 'PDF konnte nicht gelesen werden' })
    } finally {
      setPdfLoading(false)
      if (pdfInputRef.current) pdfInputRef.current.value = ''
    }
  }

  const handleSubmit = async () => {
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
      toast.error(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen bg-dark overflow-hidden flex flex-col items-center justify-center px-6">
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
            top: '10%',
            left: '15%',
            width: 500,
            height: 500,
            background: 'radial-gradient(circle, rgba(108,60,225,0.15) 0%, transparent 70%)',
          }}
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute rounded-full"
          style={{
            top: '40%',
            right: '10%',
            width: 400,
            height: 400,
            background: 'radial-gradient(circle, rgba(30,100,255,0.12) 0%, transparent 70%)',
          }}
          animate={{ scale: [1.1, 1, 1.1], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute rounded-full"
          style={{
            bottom: '15%',
            left: '30%',
            width: 350,
            height: 350,
            background: 'radial-gradient(circle, rgba(0,200,150,0.10) 0%, transparent 70%)',
          }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Progress Dots */}
      <div className="absolute top-8 flex gap-3 z-20">
        {[1, 2, 3].map((dot) => (
          <div
            key={dot}
            className="w-3 h-3 rounded-full transition-all duration-300"
            style={{
              backgroundColor: dot === step ? '#6C3CE1' : '#0F3460',
              boxShadow: dot === step ? '0 0 10px rgba(108,60,225,0.6)' : 'none',
            }}
          />
        ))}
      </div>

      {/* Step Content */}
      <div className="relative z-10 w-full mx-auto" style={{ maxWidth: '500px' }}>
        <AnimatePresence mode="wait">
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
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canContinueStep1) handleNext()
                }}
                placeholder={t('onboarding.step1_placeholder')}
                className="bg-dark-card border border-dark-border text-white rounded-xl p-4 text-lg w-full outline-none focus:border-primary transition-colors"
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

          {step === 2 && (
            <motion.div
              key="step2"
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="flex flex-col items-center gap-6"
            >
              <h1 className="font-display text-white text-center" style={{ fontSize: '28px' }}>
                {t('onboarding.step3_title')}
              </h1>

              <div className="w-full flex flex-col items-start gap-2">
                <button
                  onClick={() => pdfInputRef.current?.click()}
                  disabled={pdfLoading}
                  className="bg-dark-card border border-dark-border text-white rounded-full px-4 py-2 cursor-pointer whitespace-nowrap text-sm hover:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {pdfLoading ? '⏳ Wird gelesen...' : '📄 PDF hochladen'}
                </button>
                <input
                  ref={pdfInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={(e) => void handlePdfUpload(e)}
                  style={{ display: 'none' }}
                />
                {pdfStatus && (
                  <span className="text-xs" style={{ color: pdfStatus.ok ? '#00C896' : '#F87171' }}>
                    {pdfStatus.message}
                  </span>
                )}
              </div>

              <div className="w-full relative">
                <textarea
                  value={learningText}
                  onChange={(e) => setLearningText(e.target.value)}
                  placeholder={t('onboarding.step3_placeholder')}
                  className="bg-dark-card border border-dark-border text-white rounded-xl p-4 text-base w-full outline-none focus:border-primary transition-colors"
                  style={{ minHeight: '120px', resize: 'none' }}
                />
                <span
                  className="absolute bottom-3 right-3 text-xs transition-colors"
                  style={{ color: learningText.length >= 80 ? '#00C896' : '#6b7280' }}
                >
                  {learningText.length}/80
                </span>
              </div>

              {/* Example Chips */}
              <div className="w-full overflow-x-auto scrollbar-hide">
                <div className="flex gap-2 pb-1" style={{ width: 'max-content' }}>
                  {EXAMPLE_CHIPS.map((chip) => (
                    <button
                      key={chip.label}
                      onClick={() => setLearningText(chip.text)}
                      className="bg-dark-card border border-dark-border text-white rounded-full px-4 py-2 cursor-pointer whitespace-nowrap text-sm hover:border-primary transition-colors"
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <p className="text-red-400 text-sm text-center">{error}</p>
              )}

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
                Wähle deine Welt
              </h1>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 w-full">
                {[...getAvailableWorlds(totalSessions), ...getLockedWorlds(totalSessions)].map((world) => {
                  const isUnlocked = world.unlockedAtSessions <= totalSessions
                  const isSelected = selectedWorldId === world.id
                  const sessionsRemaining = world.unlockedAtSessions - totalSessions

                  if (isUnlocked) {
                    return (
                      <motion.div
                        key={world.id}
                        onClick={() => setLocalWorldId(world.id)}
                        className="rounded-2xl p-4 cursor-pointer flex flex-col items-center text-center"
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
                            Freischalten ab {world.unlockedAtSessions} Sessions
                          </span>
                        )}
                      </motion.div>
                    )
                  }

                  return (
                    <div
                      key={world.id}
                      onClick={() =>
                        toast.error(`Noch ${sessionsRemaining} Sessions bis ${world.name}`)
                      }
                      className="rounded-2xl p-4 flex flex-col items-center text-center"
                      style={{
                        backgroundColor: '#0F1A30',
                        border: '1px solid #0F3460',
                        opacity: 0.4,
                        cursor: 'not-allowed',
                      }}
                    >
                      <span style={{ fontSize: '40px', lineHeight: 1 }}>🔒</span>
                      <span className="font-display text-white mt-2" style={{ fontSize: '16px' }}>
                        {world.name}
                      </span>
                      <span className="text-gray-500 mt-1" style={{ fontSize: '11px' }}>
                        Noch {sessionsRemaining} Sessions
                      </span>
                    </div>
                  )
                })}
              </div>

              {error && <p className="text-red-400 text-sm text-center">{error}</p>}

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
                  style={{ fontSize: '16px', background: '#6C3CE1', padding: '14px 40px', borderRadius: '50px' }}
                  whileHover={!isLoading ? { scale: 1.05 } : {}}
                  whileTap={!isLoading ? { scale: 0.95 } : {}}
                >
                  {isLoading && (
                    <motion.div
                      className="absolute inset-0"
                      style={{
                        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)',
                      }}
                      animate={{ x: ['-100%', '100%'] }}
                      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    />
                  )}
                  <span className="relative flex items-center gap-2">
                    {isLoading && (
                      <motion.span
                        className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                      />
                    )}
                    {isLoading ? t('onboarding.creating') : 'Abenteuer starten! ✨'}
                  </span>
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
