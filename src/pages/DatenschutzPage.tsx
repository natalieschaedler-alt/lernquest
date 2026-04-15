import { Link } from 'react-router-dom'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'

export default function DatenschutzPage() {
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

        <h1 className="font-display text-3xl mb-8">Datenschutzerklärung</h1>

        {/* 1. Verantwortlicher */}
        <section className="mb-8">
          <h2 className="font-display text-xl mb-4">1. Verantwortlicher</h2>
          <div className="font-body text-white/70 space-y-1">
            <p>[Vorname Nachname]</p>
            <p>[Straße und Hausnummer]</p>
            <p>[PLZ Ort]</p>
            <p>E-Mail: [email@example.com]</p>
          </div>
        </section>

        {/* 2. Welche Daten wir erheben */}
        <section className="mb-8">
          <h2 className="font-display text-xl mb-4">2. Welche Daten wir erheben</h2>
          <p className="font-body text-white/70 mb-3">
            Im Rahmen der Nutzung von LearnQuest erheben und verarbeiten wir folgende Daten:
          </p>
          <ul className="font-body text-white/70 list-disc list-inside space-y-2 ml-2">
            <li>
              <strong className="text-white/90">E-Mail-Adresse</strong> — bei der Registrierung
              für dein Nutzerkonto
            </li>
            <li>
              <strong className="text-white/90">Lernstoff-Texte</strong> — Texte, die du eingibst,
              um daraus Quizfragen generieren zu lassen
            </li>
            <li>
              <strong className="text-white/90">Spielfortschritt</strong> — Punkte, Level,
              Achievements und Spielstatistiken
            </li>
            <li>
              <strong className="text-white/90">Technische Daten</strong> — IP-Adresse,
              Browsertyp, Betriebssystem und Geräteinformationen (automatisch beim Zugriff)
            </li>
          </ul>
        </section>

        {/* 3. Zweck der Verarbeitung */}
        <section className="mb-8">
          <h2 className="font-display text-xl mb-4">3. Zweck der Verarbeitung</h2>
          <p className="font-body text-white/70 mb-3">
            Wir verarbeiten deine Daten für folgende Zwecke:
          </p>
          <ul className="font-body text-white/70 list-disc list-inside space-y-2 ml-2">
            <li>Bereitstellung und Betrieb der App</li>
            <li>Personalisierung des Lernerlebnisses</li>
            <li>Generierung von Quizfragen aus eingegebenen Lerntexten</li>
            <li>Speicherung und Anzeige deines Spielfortschritts</li>
            <li>Technische Sicherstellung und Verbesserung der App</li>
          </ul>
          <p className="font-body text-white/70 mt-3">
            Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung) sowie Art. 6
            Abs. 1 lit. f DSGVO (berechtigtes Interesse an der Bereitstellung eines sicheren
            Dienstes).
          </p>
        </section>

        {/* 4. Anthropic API */}
        <section className="mb-8">
          <h2 className="font-display text-xl mb-4">
            4. Datenübermittlung an Anthropic (KI-Fragengenerierung)
          </h2>
          <p className="font-body text-white/70 mb-3">
            Eingegebene Lerntexte werden zur Fragengenerierung an die Anthropic API (Claude)
            übermittelt. Anthropic verarbeitet diese Daten gemäß ihrer eigenen
            Datenschutzrichtlinie. Die übermittelten Texte werden ausschließlich zur Generierung
            der Quizfragen verwendet und nicht dauerhaft bei Anthropic gespeichert.
          </p>
          <p className="font-body text-white/70">
            Rechtsgrundlage für diese Übermittlung ist Art. 6 Abs. 1 lit. b DSGVO
            (Vertragserfüllung — die Fragengenerierung ist Kernfunktion des Dienstes).
          </p>
        </section>

        {/* 5. Supabase */}
        <section className="mb-8">
          <h2 className="font-display text-xl mb-4">5. Supabase als Auftragsverarbeiter</h2>
          <p className="font-body text-white/70 mb-3">
            Für die Speicherung von Nutzerdaten und Spielfortschritt nutzen wir Supabase Inc. als
            Auftragsverarbeiter. Mit Supabase besteht ein Auftragsverarbeitungsvertrag gemäß Art.
            28 DSGVO. Supabase speichert Daten auf Servern in der EU/dem EWR, soweit verfügbar.
          </p>
          <p className="font-body text-white/70">
            Weitere Informationen findest du in der Datenschutzerklärung von Supabase.
          </p>
        </section>

        {/* 6. Rechte der Nutzer */}
        <section className="mb-8">
          <h2 className="font-display text-xl mb-4">6. Deine Rechte</h2>
          <p className="font-body text-white/70 mb-3">
            Nach der DSGVO stehen dir folgende Rechte zu:
          </p>
          <ul className="font-body text-white/70 list-disc list-inside space-y-2 ml-2">
            <li>
              <strong className="text-white/90">Auskunftsrecht (Art. 15 DSGVO)</strong> — Du
              kannst Auskunft über deine gespeicherten Daten verlangen.
            </li>
            <li>
              <strong className="text-white/90">Berichtigungsrecht (Art. 16 DSGVO)</strong> — Du
              kannst die Berichtigung unrichtiger Daten verlangen.
            </li>
            <li>
              <strong className="text-white/90">Löschungsrecht (Art. 17 DSGVO)</strong> — Du
              kannst die Löschung deiner Daten verlangen.
            </li>
            <li>
              <strong className="text-white/90">
                Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO)
              </strong>{' '}
              — Du kannst die Einschränkung der Verarbeitung verlangen.
            </li>
            <li>
              <strong className="text-white/90">
                Recht auf Datenübertragbarkeit (Art. 20 DSGVO)
              </strong>{' '}
              — Du kannst deine Daten in einem strukturierten Format erhalten.
            </li>
            <li>
              <strong className="text-white/90">Widerspruchsrecht (Art. 21 DSGVO)</strong> — Du
              kannst der Verarbeitung deiner Daten widersprechen.
            </li>
            <li>
              <strong className="text-white/90">Beschwerderecht</strong> — Du hast das Recht, dich
              bei einer Datenschutz-Aufsichtsbehörde zu beschweren.
            </li>
          </ul>
        </section>

        {/* 7. Minderjährige */}
        <section className="mb-8">
          <h2 className="font-display text-xl mb-4">7. Minderjährige</h2>
          <p className="font-body text-white/70">
            Nutzer unter 16 Jahren benötigen die Einwilligung ihrer Erziehungsberechtigten zur
            Nutzung von LearnQuest. Wir empfehlen Eltern und Erziehungsberechtigten, die
            Online-Aktivitäten ihrer Kinder aktiv zu begleiten.
          </p>
        </section>

        {/* 8. Kontakt */}
        <section className="mb-8">
          <h2 className="font-display text-xl mb-4">8. Kontakt für Datenschutzanfragen</h2>
          <p className="font-body text-white/70 mb-3">
            Für Fragen zum Datenschutz oder zur Ausübung deiner Rechte erreichst du uns unter:
          </p>
          <p className="font-body text-white/70 mb-3">E-Mail: [datenschutz@example.com]</p>
          <p className="font-body text-white/70">
            Wir werden deine Anfrage innerhalb von 30 Tagen beantworten.
          </p>
        </section>

        <p className="font-body text-white/40 text-sm mt-12">Stand: April 2026</p>
      </div>
    </motion.div>
  )
}
