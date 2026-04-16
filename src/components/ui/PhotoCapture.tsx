/**
 * PhotoCapture – camera / gallery image capture with live OCR.
 *
 * Phases:
 *   idle       → show camera + gallery buttons
 *   preview    → show captured image, "Nochmal" / "Verwenden"
 *   processing → loading animation while OCR runs
 *   error      → show error message + retry
 *
 * Usage:
 *   <PhotoCapture onTextExtracted={(text) => ...} onCancel={() => ...} />
 */
import { useRef, useState, type ChangeEvent } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { extractTextFromImage } from '../../utils/processImage'

type Phase = 'idle' | 'preview' | 'processing' | 'error'

interface PhotoCaptureProps {
  onTextExtracted: (text: string) => void
  onCancel: () => void
}

export default function PhotoCapture({ onTextExtracted, onCancel }: PhotoCaptureProps) {
  const { t } = useTranslation()

  const cameraInputRef  = useRef<HTMLInputElement>(null)
  const galleryInputRef = useRef<HTMLInputElement>(null)

  const [phase,      setPhase]      = useState<Phase>('idle')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [errorMsg,   setErrorMsg]   = useState('')

  // ── Helpers ──────────────────────────────────────────────────────────────

  function freePreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }

  function handleFileChosen(file: File) {
    freePreview()
    setPendingFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    setPhase('preview')
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFileChosen(file)
    // Reset input so the same file can be re-selected after "Nochmal"
    e.target.value = ''
  }

  async function handleUsePhoto() {
    if (!pendingFile) return
    setPhase('processing')
    try {
      const text = await extractTextFromImage(pendingFile)
      freePreview()
      onTextExtracted(text)
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('onboarding.photo_error_unreadable')
      setErrorMsg(msg)
      setPhase('error')
    }
  }

  function handleRetake() {
    freePreview()
    setPreviewUrl(null)
    setPendingFile(null)
    setErrorMsg('')
    setPhase('idle')
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center gap-5 w-full py-2">
      {/* Hidden file inputs */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleInputChange}
        style={{ display: 'none' }}
        aria-hidden="true"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handleInputChange}
        style={{ display: 'none' }}
        aria-hidden="true"
      />

      <AnimatePresence mode="wait">

        {/* ── Idle ── */}
        {phase === 'idle' && (
          <motion.div
            key="idle"
            className="flex flex-col items-center gap-4 w-full"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22 }}
          >
            <p className="font-display text-white text-center" style={{ fontSize: '22px' }}>
              {t('onboarding.photo_capture_title')}
            </p>

            {/* Camera – primary action */}
            <motion.button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-3 rounded-2xl p-5 font-body font-bold text-white cursor-pointer border-none"
              style={{
                background: 'linear-gradient(135deg, #6C3CE1, #9B5DE5)',
                fontSize: '17px',
                boxShadow: '0 0 24px rgba(108,60,225,0.4)',
              }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              📸  {t('onboarding.photo_camera')}
            </motion.button>

            {/* Gallery – secondary action */}
            <motion.button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="w-full flex items-center justify-center gap-3 rounded-2xl p-4 font-body font-semibold text-white cursor-pointer"
              style={{
                background: 'rgba(108,60,225,0.12)',
                border: '1.5px solid rgba(108,60,225,0.4)',
                fontSize: '15px',
              }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              🖼️  {t('onboarding.photo_gallery')}
            </motion.button>

            {/* Hint text */}
            <div className="flex flex-col items-center gap-1 mt-1">
              <p className="font-body text-xs text-gray-400 text-center">
                {t('onboarding.photo_hint')}
              </p>
              <p className="font-body text-xs text-center" style={{ color: '#7C3AED' }}>
                {t('onboarding.photo_handwriting_hint')}
              </p>
            </div>

            <button
              type="button"
              onClick={onCancel}
              className="font-body text-sm cursor-pointer bg-transparent border-none transition-colors"
              style={{ color: '#6b7280' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#9CA3AF')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#6b7280')}
            >
              {t('onboarding.photo_cancel')}
            </button>
          </motion.div>
        )}

        {/* ── Preview ── */}
        {phase === 'preview' && previewUrl && (
          <motion.div
            key="preview"
            className="flex flex-col items-center gap-4 w-full"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.22 }}
          >
            <p className="font-body text-sm text-gray-400">
              {t('onboarding.photo_preview_label')}
            </p>

            <div className="w-full rounded-2xl overflow-hidden border border-dark-border"
              style={{ maxHeight: '260px' }}
            >
              <img
                src={previewUrl}
                alt="preview"
                className="w-full object-contain"
                style={{ maxHeight: '260px', imageOrientation: 'from-image' } as React.CSSProperties}
              />
            </div>

            <div className="flex gap-3 w-full">
              <motion.button
                type="button"
                onClick={handleRetake}
                className="flex-1 rounded-2xl p-4 font-body font-semibold text-white cursor-pointer"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1.5px solid #0F3460',
                  fontSize: '14px',
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
              >
                {t('onboarding.photo_retake')}
              </motion.button>

              <motion.button
                type="button"
                onClick={() => void handleUsePhoto()}
                className="flex-1 rounded-2xl p-4 font-body font-bold text-white cursor-pointer border-none"
                style={{
                  background: 'linear-gradient(135deg, #6C3CE1, #9B5DE5)',
                  fontSize: '14px',
                }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                {t('onboarding.photo_use')}
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* ── Processing ── */}
        {phase === 'processing' && (
          <motion.div
            key="processing"
            className="flex flex-col items-center gap-5 py-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* Cosmic spinner */}
            <div className="relative w-16 h-16">
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{ border: '3px solid rgba(108,60,225,0.2)' }}
              />
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  border: '3px solid transparent',
                  borderTopColor: '#6C3CE1',
                  borderRightColor: '#9B5DE5',
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
              />
              <div
                className="absolute inset-0 flex items-center justify-center text-2xl"
                style={{ lineHeight: 1 }}
              >
                📖
              </div>
            </div>

            <div className="text-center">
              <p className="font-display text-white" style={{ fontSize: '17px' }}>
                {t('onboarding.photo_processing')}
              </p>
              <p className="font-body text-xs text-gray-400 mt-1">
                {t('onboarding.photo_processing_hint')}
              </p>
            </div>
          </motion.div>
        )}

        {/* ── Error ── */}
        {phase === 'error' && (
          <motion.div
            key="error"
            className="flex flex-col items-center gap-4 w-full"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
          >
            <div
              className="w-full rounded-2xl p-5 flex flex-col items-center gap-3 text-center"
              style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)' }}
            >
              <span style={{ fontSize: '36px' }}>📷</span>
              <p className="font-body text-sm" style={{ color: '#FCA5A5' }}>
                {errorMsg || t('onboarding.photo_error_unreadable')}
              </p>
            </div>

            <div className="flex gap-3 w-full">
              <motion.button
                type="button"
                onClick={handleRetake}
                className="flex-1 rounded-2xl p-4 font-body font-bold text-white cursor-pointer border-none"
                style={{ background: '#6C3CE1', fontSize: '14px' }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
              >
                {t('onboarding.photo_retake')}
              </motion.button>
              <motion.button
                type="button"
                onClick={onCancel}
                className="flex-1 rounded-2xl p-4 font-body font-semibold text-white cursor-pointer"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  border: '1.5px solid #0F3460',
                  fontSize: '14px',
                }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
              >
                {t('onboarding.photo_cancel')}
              </motion.button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  )
}
