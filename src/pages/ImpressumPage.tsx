import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'

export default function ImpressumPage() {
  const { t } = useTranslation()

  return (
    <motion.div
      className="min-h-screen bg-dark text-white"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link
          to="/"
          className="inline-block mb-8 font-body text-primary hover:text-primary/80 transition-colors text-sm"
        >
          {t('common.back_home')}
        </Link>

        <h1 className="font-display text-3xl mb-8">Impressum</h1>

        {/* Angaben gemäß § 5 TMG */}
        <section className="mb-8">
          <h2 className="font-display text-xl mb-4">Angaben gemäß § 5 TMG</h2>
          <div className="font-body text-white/70 space-y-1">
            <p>[Vorname Nachname]</p>
            <p>[Straße und Hausnummer]</p>
            <p>[PLZ Ort]</p>
            <p>[Land]</p>
          </div>
        </section>

        {/* Kontakt */}
        <section className="mb-8">
          <h2 className="font-display text-xl mb-4">Kontakt</h2>
          <div className="font-body text-white/70 space-y-1">
            <p>E-Mail: [email@example.com]</p>
            <p>Telefon: [+49 XXX XXXXXXX]</p>
          </div>
        </section>

        {/* Umsatzsteuer-ID */}
        <section className="mb-8">
          <h2 className="font-display text-xl mb-4">Umsatzsteuer-Identifikationsnummer</h2>
          <p className="font-body text-white/70">
            Umsatzsteuer-Identifikationsnummer gemäß § 27a Umsatzsteuergesetz: DE XXX XXX XXX
          </p>
        </section>

        {/* Verantwortlich für den Inhalt */}
        <section className="mb-8">
          <h2 className="font-display text-xl mb-4">
            Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV
          </h2>
          <div className="font-body text-white/70 space-y-1">
            <p>[Vorname Nachname]</p>
            <p>[Straße und Hausnummer]</p>
            <p>[PLZ Ort]</p>
          </div>
        </section>

        {/* Haftungsausschluss */}
        <section className="mb-8">
          <h2 className="font-display text-xl mb-4">Haftungsausschluss</h2>

          <h3 className="font-display text-lg mb-2 mt-6">Haftung für Inhalte</h3>
          <p className="font-body text-white/70 mb-4">
            Die Inhalte unserer Seiten wurden mit größter Sorgfalt erstellt. Für die Richtigkeit,
            Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen.
            Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten
            nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als
            Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde
            Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige
            Tätigkeit hinweisen.
          </p>

          <h3 className="font-display text-lg mb-2">Haftung für Links</h3>
          <p className="font-body text-white/70 mb-4">
            Unser Angebot enthält Links zu externen Webseiten Dritter, auf deren Inhalte wir keinen
            Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr
            übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder
            Betreiber der Seiten verantwortlich.
          </p>
        </section>

        {/* EU-Streitschlichtung */}
        <section className="mb-8">
          <h2 className="font-display text-xl mb-4">EU-Streitschlichtung</h2>
          <p className="font-body text-white/70">
            Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit.
            Unsere E-Mail-Adresse finden Sie oben im Impressum. Wir sind nicht bereit oder
            verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle
            teilzunehmen.
          </p>
        </section>
      </div>
    </motion.div>
  )
}
