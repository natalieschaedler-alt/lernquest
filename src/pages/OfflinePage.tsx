import { motion } from 'motion/react'

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-dark flex items-center justify-center px-6">
      <motion.div
        className="text-center max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="text-6xl mb-6">📡</div>
        <h1 className="font-display text-white text-3xl mb-4">Du bist offline</h1>
        <p className="font-body text-white/60 text-lg mb-8">
          Bereits gespielte Welten stehen dir offline zur Verfügung.
        </p>
        <motion.button
          onClick={() => window.location.reload()}
          className="font-body font-bold text-white cursor-pointer border-none bg-primary px-8 py-3 rounded-full text-lg"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          Erneut versuchen
        </motion.button>
      </motion.div>
    </div>
  )
}
