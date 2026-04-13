import { Link } from 'react-router-dom'

export default function AGBPage() {
  return (
    <div className="min-h-screen bg-dark text-white">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <Link
          to="/"
          className="inline-block mb-8 font-body text-primary hover:text-primary/80 text-sm"
        >
          &larr; Zurück zur Startseite
        </Link>

        <h1 className="font-display text-3xl mb-8">Allgemeine Geschäftsbedingungen (AGB)</h1>

        {/* 1. Geltungsbereich */}
        <section className="mb-8">
          <h2 className="font-display text-xl mb-4">§ 1 Geltungsbereich</h2>
          <p className="font-body text-white/70">
            Diese Allgemeinen Geschäftsbedingungen gelten für die Nutzung der Web-App „LearnQuest"
            (nachfolgend „App" oder „Dienst"). Mit der Nutzung der App erklärst du dich mit diesen
            AGB einverstanden.
          </p>
        </section>

        {/* 2. Leistungsbeschreibung */}
        <section className="mb-8">
          <h2 className="font-display text-xl mb-4">§ 2 Leistungsbeschreibung</h2>
          <p className="font-body text-white/70">
            LearnQuest ist ein KI-gestütztes Lernspiel, das aus von Nutzern eingegebenen Lerntexten
            automatisch Quizfragen generiert. Die App bietet verschiedene Spielmodi, einen
            Fortschrittssystem und spielerische Elemente zur Unterstützung des Lernprozesses.
          </p>
        </section>

        {/* 3. Registrierung */}
        <section className="mb-8">
          <h2 className="font-display text-xl mb-4">§ 3 Registrierung und Nutzerkonto</h2>
          <p className="font-body text-white/70 mb-3">
            Für die vollständige Nutzung der App ist eine Registrierung mit einer gültigen
            E-Mail-Adresse erforderlich. Du bist für die Vertraulichkeit deiner Zugangsdaten
            selbst verantwortlich.
          </p>
          <p className="font-body text-white/70">
            Du sicherst zu, dass die bei der Registrierung angegebenen Daten wahrheitsgemäß und
            vollständig sind.
          </p>
        </section>

        {/* 4. Nutzungsrechte */}
        <section className="mb-8">
          <h2 className="font-display text-xl mb-4">§ 4 Nutzungsrechte</h2>
          <p className="font-body text-white/70">
            Wir gewähren dir ein persönliches, nicht übertragbares, nicht-exklusives Recht zur
            Nutzung der App für private, nicht-kommerzielle Zwecke. Jede kommerzielle Nutzung
            bedarf unserer vorherigen schriftlichen Zustimmung.
          </p>
        </section>

        {/* 5. Nutzerinhalt */}
        <section className="mb-8">
          <h2 className="font-display text-xl mb-4">§ 5 Nutzerinhalt</h2>
          <p className="font-body text-white/70 mb-3">
            Die von dir eingegebenen Lerntexte werden ausschließlich zur Generierung von
            Quizfragen verarbeitet. LearnQuest erhebt keinen Eigentumsanspruch an deinen
            eingegebenen Inhalten.
          </p>
          <p className="font-body text-white/70">
            Du stellst sicher, dass du die erforderlichen Rechte an den von dir eingegebenen
            Texten besitzt und keine Rechte Dritter verletzt werden.
          </p>
        </section>

        {/* 6. Verfügbarkeit */}
        <section className="mb-8">
          <h2 className="font-display text-xl mb-4">§ 6 Verfügbarkeit</h2>
          <p className="font-body text-white/70">
            Wir bemühen uns um eine möglichst unterbrechungsfreie Verfügbarkeit der App. Eine
            Garantie für eine durchgehende Verfügbarkeit von 100 % kann jedoch nicht gegeben
            werden. Wartungsarbeiten, technische Störungen oder höhere Gewalt können zu
            vorübergehenden Einschränkungen führen.
          </p>
        </section>

        {/* 7. Haftungsbeschränkung */}
        <section className="mb-8">
          <h2 className="font-display text-xl mb-4">§ 7 Haftungsbeschränkung</h2>
          <p className="font-body text-white/70 mb-3">
            Wir haften unbeschränkt für Schäden aus der Verletzung des Lebens, des Körpers oder
            der Gesundheit sowie für Vorsatz und grobe Fahrlässigkeit.
          </p>
          <p className="font-body text-white/70 mb-3">
            Bei leichter Fahrlässigkeit haften wir nur bei Verletzung wesentlicher
            Vertragspflichten (Kardinalpflichten), deren Erfüllung die ordnungsgemäße Durchführung
            des Vertrags überhaupt erst ermöglicht. In diesem Fall ist die Haftung auf den
            vorhersehbaren, typischerweise eintretenden Schaden begrenzt.
          </p>
          <p className="font-body text-white/70">
            Die generierten Quizfragen dienen ausschließlich Lernzwecken. Für die inhaltliche
            Richtigkeit der KI-generierten Fragen und Antworten übernehmen wir keine Gewähr.
          </p>
        </section>

        {/* 8. Kündigung */}
        <section className="mb-8">
          <h2 className="font-display text-xl mb-4">§ 8 Kündigung</h2>
          <p className="font-body text-white/70 mb-3">
            Du kannst die Nutzung der App jederzeit beenden. Die Löschung deines Nutzerkontos und
            aller damit verbundenen Daten kannst du per E-Mail an uns beantragen.
          </p>
          <p className="font-body text-white/70">
            Wir behalten uns das Recht vor, Nutzerkonten bei Verstoß gegen diese AGB zu sperren
            oder zu löschen.
          </p>
        </section>

        {/* 9. Änderungen */}
        <section className="mb-8">
          <h2 className="font-display text-xl mb-4">§ 9 Änderungen der AGB</h2>
          <p className="font-body text-white/70">
            Wir behalten uns vor, diese AGB jederzeit zu ändern. Bei wesentlichen Änderungen
            werden wir dich vorab per E-Mail oder in der App benachrichtigen. Die fortgesetzte
            Nutzung der App nach Inkrafttreten der Änderungen gilt als Zustimmung zu den
            geänderten AGB.
          </p>
        </section>

        {/* 10. Anwendbares Recht */}
        <section className="mb-8">
          <h2 className="font-display text-xl mb-4">§ 10 Anwendbares Recht</h2>
          <p className="font-body text-white/70">
            Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des
            UN-Kaufrechts. Für Verbraucher gelten zusätzlich die zwingenden
            Verbraucherschutzbestimmungen des Staates, in dem sie ihren gewöhnlichen Aufenthalt
            haben.
          </p>
        </section>

        {/* 11. Schlussbestimmungen */}
        <section className="mb-8">
          <h2 className="font-display text-xl mb-4">§ 11 Schlussbestimmungen</h2>
          <p className="font-body text-white/70">
            Sollten einzelne Bestimmungen dieser AGB unwirksam sein oder werden, so berührt dies
            die Wirksamkeit der übrigen Bestimmungen nicht. An die Stelle der unwirksamen
            Bestimmung tritt eine wirksame Bestimmung, die dem wirtschaftlichen Zweck der
            unwirksamen Bestimmung am nächsten kommt.
          </p>
        </section>

        <p className="font-body text-white/40 text-sm mt-12">Stand: April 2026</p>
      </div>
    </div>
  )
}
