# LearnQuest – Änderungsprotokoll

Vollständige Liste aller Verbesserungen und Bugfixes über alle Entwicklungsrunden.

---

## Runde 13 – Vollständiger UX-Audit & Polishing

Kompletter App-Flow als User durchgespielt. Alle gefundenen UX-Probleme behoben. Build, 190 Tests und Lint bleiben grün.

### Fix: Flash of White beim Seitenlade (index.html)
- Inline `<style>html,body{background:#1A1A2E;color:#fff}</style>` im `<head>` vor CSS-Bundle
- Verhindert kurzen weißen Aufblitz bei Cold-Load (SPA-Problem vor Tailwind-CSS)

### Feature: Sprachumschalter (DE/EN)
- Neue `LanguageToggle`-Komponente (`src/components/ui/LanguageToggle.tsx`)
- Sichtbar im LandingPage-Navbar (top-right) und im Profil-Settings-Bereich
- Auswahl wird in `localStorage` (Key `lq_lang`) persistiert → bleibt nach Reload erhalten
- `i18n/index.ts` liest `lq_lang` beim Init → Sprache wird sofort beim Laden angewandt
- i18n-Keys: +9 neue Keys (`lang.*`, `dungeon.*`, `auth_extra.*`, `league_extra.*`, `victory_extra.*`)
- Symmetrie: DE + EN je 234 Keys (vorher 225)

### Fix: Session-Timeout Notification (App.tsx)
- Neue `SessionWatcher`-Komponente (nullrendering) erkennt `SIGNED_OUT`-Event via Supabase `onAuthStateChange`
- Zeigt Toast `"Deine Sitzung ist abgelaufen – bitte neu anmelden"` wenn User während des Spielens ausgeloggt wird
- Unterscheidet zwischen bewusstem Logout (war eingeloggt → SIGNED_OUT) und anonymem Besuch

### Fix: Dungeon-Quit-Button (DungeonPage.tsx)
- Kleiner `✕`-Button im Dungeon-Header neben dem Score
- Bestätigungsdialog (`window.confirm`) verhindert versehentliches Beenden
- Ruft `resetGame()` auf und navigiert zu `/onboarding` (replace: true)
- Keyboard-zugänglich (`aria-label={t('dungeon.quit')}`)

### Fix: VictoryPage Polishing
- Streak-Badge (`🔥 X-Tage Streak`) jetzt via `t('victory_extra.streak_badge', {count})` statt hardcoded Deutsch
- Belohnungs-Truhe: `aria-label={t('victory.tap_to_open')}` für Screenreader
- Konfetti-Wrapper mit `aria-hidden="true"` → kein Lärm für Screenreader

### Fix: Liga-Leerstand verbessert (LeaguePage.tsx)
- Leerer Leaderboard zeigt jetzt: Trophy-Emoji + motivierender Hinweis "Sei der Erste und trage dich ein! 🚀"
- Statt nüchternem grauem Text ein einladender Call-to-Action

### Fix: Gesperrte Welten Tastaturnavigation (OnboardingPage.tsx)
- Gesperrte Welt-Cards hatten `tabIndex={0}` + `role="button"` → Keyboard-User konnten Tab dorthin
- Geändert zu `tabIndex={-1}` ohne role → werden beim Tab übersprungen, `aria-disabled="true"` bleibt

---

## Runde 12 – Test-Explosion, Bundle-Analyse & Dokumentation

### Test-Coverage massiv erhöht: 88 → 190 Tests (+102)

Fünf neue Testdateien decken bisher ungetestete Kernbereiche ab:

**`src/utils/__tests__/generateQuestions.test.ts`** (16 Tests)
- Content-Filter-Prüfung: blockiert Kurztext und ungeeignete Inhalte
- Cache-Hit-Pfad: gibt gecachte Fragen zurück, ruft kein fetch auf
- API-Aufruf: HTTP-Fehler, Body-Fehler, leere MC-Liste → korrekte Exceptions
- Happy Path: konvertiert MC, True/False, Memory-Pairs und Lückentexte korrekt
- Auth-Header: wird nur angehängt wenn User eingeloggt ist
- Save-Fallback: lokale ID bei Supabase-Speicherfehler

**`src/lib/__tests__/database.test.ts`** (20 Tests)
- `saveMistake`: Einfügen inkl. stille Fehlerbehandlung
- `markMistakeReviewed`: SM-2-Intervall korrekt (review_count 0→1 = 3 Tage), Reset bei falsch, Early Return bei fehlendem Eintrag
- `saveSession`: Erfolg und Fehler-Throw
- `getWorldByHash`: Treffer, kein Treffer, Fehler → null
- `testConnection`: true/false/Exception-Handling
- `getWeeklyLeaderboard`: Daten-Rückgabe und leeres Array bei Fehler
- `updateXP`: RPC-Aufruf-Verifikation und stille Fehlerbehandlung

**`src/utils/__tests__/soundManager.test.ts`** (13 Tests)
- Zustand: Standard aktiviert, liest `true`/`false` aus localStorage
- `toggle()`: flippt Zustand, persistiert in localStorage, gibt neuen State zurück
- Alle 8 Play-Funktionen (`playCorrect`, `playWrong`, `playLevelUp`, `playVictory`, `playBossBattle`, `playAchievement`, `playStreak`, `playCombo`) crashen nicht wenn AudioContext fehlt
- Play-Funktionen schweigen korrekt wenn Sound deaktiviert

**`src/stores/__tests__/gameStore.advanced.test.ts`** (28 Tests)
- `setQuestions`: setzt Fragen, Welt-ID, resettet Index/HP/Score
- `nextQuestion`: inkrementiert Index korrekt
- `checkNewAchievements`: gibt neue IDs zurück, ignoriert bereits freigeschaltete, multi-Achievement-Support
- `initDailyChallenge`: erstellt Challenge, bleibt stabil am selben Tag, refresht für neuen Tag, deterministisch
- `completeDailyChallenge`: markiert als erledigt, idempotent, no-op ohne Challenge
- `ACHIEVEMENT_DEFS`: alle 8 Achievement-Unlock-Bedingungen verifiziert

**`src/lib/__tests__/gameConfig.test.ts`** + **`src/data/__tests__/worlds.test.ts`** (23 Tests)
- `pointsForDifficulty`: 10/20/30 für Schwierigkeiten 1/2/3
- TIMER/COMBO/BOSS-Konstanten auf Konsistenz (z.B. BOSS_FAST < BOSS, THRESHOLD_LOW < THRESHOLD_HIGH)
- `WORLDS`: 5 Welten, alle Pflichtfelder, aufsteigende Sessions-Schwellen
- `getWorldById`: korrekte Welt, Fallback auf Feuer bei null/unbekannt
- `getAvailableWorlds` / `getLockedWorlds`: korrekte Zählungen für alle Session-Levels, available + locked = 5 (keine Lücken)

### Bundle-Analyse Script

- **`npm run analyze`** hinzugefügt: baut das Projekt und zeigt alle JS/CSS-Chunks sortiert nach Größe – mit Balken-Visualisierung und Warnung (⚠️) für Chunks > 200 KB
- Script in `scripts/analyze.cjs` (cross-platform, kein zusätzliches npm-Paket nötig)

### README komplett überarbeitet

- Feature-Liste mit allen 12 Kernfunktionen
- Vollständige Tech-Stack-Tabelle (React 19, Vite 8, Supabase, Anthropic, Vitest)
- Detailliertes Setup mit `.env`-Variablen-Übersicht
- Scripts-Übersicht mit allen 6 verfügbaren Befehlen
- Projektstruktur-Baum
- Architektur-Highlights (Caching, Sound-Synthese, Code-Splitting, Sicherheit)

**Build**: ✓ clean | **Tests**: 190/190 ✓ | **Lint**: 0 Fehler, 0 Warnings

---

## Runde 11 – Polish, Accessibility & Code Quality

- **useCallback-Fix in DungeonPage**: `handleNext` als `useCallback` gewrappt (Hooks-Reihenfolge korrekt vor Early Returns); 3 ESLint-Warnungen `react-hooks/exhaustive-deps` behoben – Lint nun wieder 0 Probleme
- **i18n Key-Symmetrie verifiziert**: Automatisches Skript bestätigt exakte Übereinstimmung zwischen `de.json` und `en.json` – 225 Keys, kein einziger fehlt auf einer Seite
- **Semantic HTML**: Alle Seiten-Komponenten nutzen `<main>` statt `<div>` als Root-Element: `ProfilePage`, `LeaguePage`, `AuthPage`, `OfflinePage`, `StartPage`, `VictoryPage`, `GameOverPage` – verbessert Screenreader-Erfahrung und SEO
- **Touch-Targets**: Back-Buttons in `ProfilePage` und `LeaguePage` sowie „Liga-Details"-Button von `py-2` auf `py-3 min-h-[44px]` vergrößert – erfüllen jetzt WCAG 2.1 AA (44×44 px Mindestgröße)
- **Error Messages**: Catch-Blöcke geprüft – `OnboardingPage` zeigt bei PDF-Fehlern und API-Fehlern stets toast + `setError` mit nutzerverständlichem Text; `database.ts` logged intern und gibt sicher null zurück
- **Service Worker Update**: Bereits korrekt implementiert – `registerType: 'prompt'` in vite.config + `onNeedRefresh`-Toast mit Aktualisieren-Button in `main.tsx`
- **Build**: ✓ clean | **Tests**: 88/88 ✓ | **Lint**: 0 Fehler, 0 Warnings

---

## Runde 10 – Deep Security & Code Hygiene Audit

### Kritische Sicherheitslücke geschlossen: SQL Privilege Escalation
- **`increment_xp`, `update_streak`, `add_weekly_xp` gepatcht** (`supabase/migrations/003_security_fixes.sql`): Alle drei `SECURITY DEFINER`-Funktionen fehlten bisher jegliche Caller-Prüfung – jeder authentifizierte User konnte mittels direktem RPC-Aufruf die XP, den Streak oder weekly_xp eines beliebigen anderen Users beliebig manipulieren. Jetzt prüfen alle drei Funktionen `auth.uid() IS DISTINCT FROM p_user_id` und werfen eine Exception bei unberechtigtem Zugriff.

### RLS Audit (kein Handlungsbedarf)
- **`sessions`, `characters`, `profiles`, `mistakes`**: Alle vier Tabellen haben symmetrische `USING`- und `WITH CHECK`-Bedingungen (`auth.uid() = user_id` bzw. `auth.uid() = id`) – wasserdicht.
- **`worlds`**: Absichtlich öffentlich lesbar und schreibbar (Content-Hash-Cache für Gäste) – korrekt dokumentiert und akzeptiert.
- **`league_groups` / `league_members`**: RLS korrekt gesetzt; Members-Schreibzugriff nur für eigene Zeilen.

### API Hardening (`api/generate.ts`)
- **Max Body Size 200 KB**: Body-Reader prüft jetzt kumulierte Byte-Größe während des Streamens. Bei Überschreitung wird der Socket sofort getrennt und HTTP 413 zurückgegeben – verhindert Memory-Exhaustion durch riesige Payloads.

### Vercel Security Headers (`vercel.json`)
- **`Content-Security-Policy` ergänzt**: `default-src 'self'`, Supabase und Anthropic als erlaubte `connect-src`, Google Fonts für Style/Font, `frame-ancestors 'none'`.
- **`X-XSS-Protection: 0`**: Veraltetes Header-Feld von `1; mode=block` auf `0` geändert – moderner Browsers ignorieren es ohnehin, und `mode=block` kann in einigen alten Browsern XSS-Angriffe sogar erleichtern. CSP ist der korrekte Schutz.
- **`Permissions-Policy` ergänzt**: `camera=(), microphone=(), geolocation=()` – verhindert, dass eingebettete Skripte unerlaubt auf Gerätehardware zugreifen.
- **`Access-Control-Allow-Headers` vervollständigt**: `Authorization`-Header im CORS-Eintrag ergänzt (der Handler erwartete diesen Header bereits, vercel.json fehlte der Eintrag).

### TypeScript Strict Mode
- **`"strict": true` in `tsconfig.app.json`** aktiviert: Schaltet `strictNullChecks`, `noImplicitAny`, `strictFunctionTypes` u.a. ein. Alle bestehenden Files kompilieren sauber ohne eine einzige neue Fehler-Meldung – der Codebase war bereits de-facto strict-kompatibel.

### Tote Assets bereinigt
- **`src/App.css` gelöscht**: Vite-Boilerplate (`.counter`, `.hero`, `#next-steps` etc.) – wurde nirgendwo importiert und hatte keinerlei Bezug zur App.
- **`src/assets/react.svg` + `src/assets/vite.svg` gelöscht**: Vite-Starter-Template-Grafiken, nie verwendet.
- **`src/assets/hero.png` gelöscht**: 44 KB PNG-Asset, nirgendwo importiert.

### Audit-Ergebnisse (kein Handlungsbedarf)
- **Zustand-Store Race Conditions**: Keine. JS ist single-threaded; `get()` in `addXP` liest immer synchron den aktuellen State. `checkNewAchievements` ist korrekt und atomisch.
- **Ungenutzte CSS-Klassen in `index.css`**: Keine. Alle definierten Klassen (`.transition-width`, `.animate-fade-in-up`, `.animate-score-pop`, `:focus-visible`) sind tatsächlich im Einsatz.
- **Zirkuläre Importe**: Keine gefunden. Import-Graph ist azyklisch.
- **Env-Validation**: Supabase-Client wirft bei fehlendem `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` eine klare Exception beim ersten Zugriff – fail-fast Verhalten vorhanden.
- **Bild-Optimierung**: PWA-Icons (`icon-192.png`, `icon-512.png`) sind PNG per PWA-Spec-Anforderung; alle SVGs sind bereits optimal. Keine WebP-Konvertierung nötig.

### Tests: 88/88 · Lint: 0 Fehler · Build: sauber

---

## Runde 9 – Polish, Completeness & Production-Readiness

### Edge Cases
- **OrakelKristall Guard**: Leere Fragen-Liste wird jetzt sicher abgefangen – zeigt Fehlermeldung statt leerem Crystal (`game.no_tf_questions` i18n-Key ergänzt)
- **Alle anderen Spiele verifiziert**: Wortwirbel (Timer-Ablauf, Fake-Bubbles), MemoryKarten (Min-Pairs-Check), LueckentextSpiel (Empty-Guard), HueterBoss (0-Fragen-Guard, Modulo-Loop) – alle Edge Cases korrekt behandelt

### Landing Page
- **Navigationsleiste**: Sticky Nav mit Logo und CTA-Button oben auf der Landing Page – klare Orientierung für neue Besucher
- **Testimonials-Überschrift**: Abschnitt "Was Lernende sagen" ergänzt (war bisher ohne Titel)
- **Fächer-Liste i18n**: Subjects-Array aus hardkodierten deutschen Strings in i18n-Keys überführt (`landing.subject_*`) – korrekte Übersetzung in beiden Sprachen
- **Footer-E-Mail**: `kontakt@example.com` durch `hallo@learnquest.app` ersetzt

### i18n-Texte
- **DE `game.wrong`**: `"Fast! Versuch's nochmal"` → `"Knapp! Nochmal probieren"` (Apostroph in „Versuch's" ist kein korrektes Deutsch)
- **DE `feature2_desc`**: `"Nicht langweilig – echte Mini-Spiele und Bosskämpfe"` → `"4 Mini-Spiele, Bosskämpfe und tägliche Herausforderungen"` (konkreter und vollständiger)
- **EN `ach_sessions10_label`**: `"Regular"` → `"Dedicated Learner"` (mehrdeutiges Wort ersetzt)
- **EN `feature2_desc`**: Entsprechende Verbesserung auf Englisch
- **Beide**: `auth.sending` ergänzt für Lade-Zustand im Auth-Formular
- **Beide**: `landing.testimonials_title` ergänzt

### Auth-Flow
- **Lade-Zustand**: `loading ? '...' : t('auth.send_magic_link')` → `t('auth.sending')` – klar lokalisierter Lade-Text statt rohem Placeholder

### Tests: 88/88 · Lint: 0 Fehler · Build: sauber

---

## Runde 8 – User Delight & Spieltiefe

### Sound-System (`src/utils/soundManager.ts`)
- `playBossBattle()`, `playAchievement()`, `playStreak()`, `playCombo()` ergänzt; vollständige JSDoc-Dokumentation aller Methoden

### Keyboard Shortcuts
- **Wortwirbel**: Tasten 1–4 wählen Antwort-Blasen direkt; `[N]`-Hinweis auf Blasen sichtbar
- **OrakelKristall**: Y/J/→ = Wahr; N/← = Falsch; Hinweise auf Buttons
- **LueckentextSpiel**: 1–4 im Auswahl-Modus; `[N]`-Hinweise auf Buttons

### Erklärungen nach der Antwort
- Wortwirbel + OrakelKristall zeigen nach Beantwortung ein Slide-up-Panel mit `question.explanation`

### Achievements
- `ACHIEVEMENT_DEFS` exportiert (Single Source of Truth für ProfilePage + VictoryPage)
- `sessions10` + `sessions50` Achievements ergänzt
- `unlockedAchievements: string[]` in Store persistiert
- Achievement-Notifications in VictoryPage via Toast + `playAchievement()` Sound
- Streak-Meilensteine (3/7/30) lösen `playStreak()` aus; Level-Up löst `playLevelUp()` aus

### Daily Challenges
- `DailyChallenge`-Typ + `dailyChallenge`-State (persistiert) im Store
- 3 Challenge-Typen: `win_session` / `no_gameover` / `combo_3`
- Anzeige als Strip im DungeonPage-Header + Karte auf der ProfilePage
- Abschluss = +50 Bonus-XP via Toast

### Tests: 88/88 · Lint: 0 Fehler · Build: sauber

---

## Runde 7 – Letzter Feinschliff (Visuell & Konsistenz)

### Farb-Konsistenz
- **Tailwind-Farbsystem vervollständigt**: `streak` (`#FFB400`), `error` (`#FF5050`), `error-light` (`#FF9090`) zu `tailwind.config.js` ergänzt (`dark-deep`/`dark-elevated` waren bereits vorhanden)
- **Arbitrary-Value-Klassen ersetzt**: Alle 11 Vorkommen von `bg-[#0D0A1A]` in `HueterBoss.tsx`, `Wortwirbel.tsx`, `MemoryKarten.tsx`, `OrakelKristall.tsx`, `LueckentextSpiel.tsx` durch semantisches `bg-dark-deep` ersetzt
- **Inline-Styles auf Tailwind migriert**: `ProfilePage` – XP-Bar-Hintergrund (`bg-dark`), Streak-Badge-Border (`border-streak`), Achievement-Checkmark (`bg-secondary/10 text-secondary`), Streak-Zahl (`text-streak`). `LueckentextSpiel` – Mode-Toggle (`bg-dark-elevated`), Antwort-Buttons (`bg-secondary/30`, `bg-error/15`, `bg-dark`). `MemoryKarten` – Ergebnis-Karte (`bg-dark`)

### Seiten-Animationen
- **OnboardingPage Einstiegsanimation**: Einzige Seite ohne Page-Level-Fade-In; äußeres `div` zu `motion.div` mit `opacity 0→1, duration: 0.4` umgebaut – alle 14 Seiten haben nun konsistente Eintrittsanimationen

### PWA-Manifest
- **Icon-Zweck getrennt**: `vite.config.ts` – `"purpose": "any maskable"` (Anti-Pattern; ein Entry kann nicht sinnvoll beide Zwecke erfüllen) in zwei separate Icon-Einträge aufgeteilt: `"any"` und `"maskable"`

### Audit-Ergebnisse (kein Handlungsbedarf)
- **404-Seite**: `NotFoundPage` + Wildcard-Route `path="*"` waren bereits korrekt vorhanden und geprüft
- **Meta-Tags**: `index.html` vollständig mit `description`, Open Graph und Twitter Card – keine Änderungen nötig
- **Suspense**: Alle Lazy-Routen im App-Level-`<Suspense>`; `react-confetti` in `VictoryPage` in eigenem `<Suspense fallback={null}>` – korrekt
- **Zustand-Persistenz**: `gameStore` persistiert korrekt `playerName`, `level`, `xp`, `streak`, `lastPlayedDate`, `selectedWorldId`, `totalSessions`; transiente Spielzustände bleiben bewusst nicht persistiert
- **Console-Warnungen**: 0 React-Warnings, 0 Deprecation-Hinweise – sauber
- **Tests**: 88/88 bestanden · Lint: 0 Fehler · Build: sauber

---

## Runde 6 – Stabilität & i18n-Vollständigkeit

- **ErrorBoundary**: Klassen-Komponente als oberstes Sicherheitsnetz in `App.tsx` eingebaut; fängt unbehandelte Render-Fehler und zeigt benutzerfreundliche Fehlermeldung
- **DungeonPage i18n**: Alle hartkodierten deutschen Strings durch `t()`-Keys ersetzt; fehlende Keys in `de.json` und `en.json` ergänzt
- **Tippfehler behoben**: Diverse Rechtschreibfehler in UI-Texten und Kommentaren korrigiert
- **Tote i18n-Keys entfernt**: Nicht mehr verwendete Übersetzungsschlüssel aus beiden Locale-Dateien bereinigt
- **Unicode-Normalisierung**: Texteingaben werden nun mit `String.prototype.normalize('NFC')` normalisiert, bevor sie verarbeitet werden (verhindert Vergleichsfehler bei Umlauten aus verschiedenen Quellen)
- **shuffleArray-Tests**: Unit-Tests für die `shuffleArray`-Hilfsfunktion hinzugefügt (Verteilung, Länge, keine Duplikate)

---

## Runde 5 – Qualität & PWA

- **Schema-Validierung**: Zod-Schema für KI-Antworten; ungültige Strukturen werden sicher abgewiesen statt zu Laufzeitfehlern zu führen
- **Retry-Logik**: Exponentielles Backoff (3 Versuche) bei fehlgeschlagenen KI-API-Aufrufen
- **Word-Count-Validation**: Eingabetext wird vor dem API-Aufruf auf Mindest- und Maximalwortanzahl geprüft; klare Fehlermeldungen für den Nutzer
- **Accessibility (aria)**: ARIA-Labels und -Rollen für interaktive Elemente ergänzt (Spielbuttons, Statusanzeigen, Ladezustände)
- **PWA-Manifest**: `manifest.json` mit Icons, Farben und `display: standalone` vervollständigt; `ServiceWorker`-Registrierung geprüft

---

## Runde 4 – Mobile & Performance

- **Mobile Buttons**: Touch-Targets auf mindestens 44×44 px vergrößert; Schaltflächen auf kleinen Bildschirmen korrekt dargestellt
- **Cache-Lookup-Fix**: `getWorldByHash` gibt nun korrekt gecachte Welten zurück statt immer neu zu generieren (verhindert doppelte API-Aufrufe)
- **JSON Error Handling**: Fehlerhafte oder leere KI-Antworten werden sauber abgefangen; Nutzer sieht Toast-Fehlermeldung statt weißem Screen
- **Bundle Vendor-Splitting**: Vite-Konfiguration um manuelle Chunks erweitert (`react`, `motion`, `i18next` in eigenen Vendor-Chunks); First Load deutlich schneller
- **Letzter Lint-Warning**: Verbleibender ESLint-Warnhinweis in `gameConfig.ts` behoben; `0 warnings` erreicht

---

## Runde 3 – SEO, Animationen & Tests

- **SEO-Tags**: `index.html` mit vollständigen Open-Graph- und Twitter-Card-Meta-Tags versehen; `lang="de"` gesetzt; Titel und Description optimiert
- **Animationen**: Eintritts- und Übergangsanimationen mit `motion/react` für alle Hauptseiten verfeinert; konsistente `initial`/`animate`/`exit`-Props
- **Tab-Visibility-Pause**: Spiele pausieren automatisch, wenn der Browser-Tab in den Hintergrund wechselt (`visibilitychange`-Event)
- **19 neue Tests**: Testsuite von 63 auf 82 Tests ausgebaut; neue Tests für Stores, Hooks und Hilfsfunktionen
- **ESLint react-hooks v7 Fixes**: Alle Verstöße gegen `react-hooks/exhaustive-deps` und `react-hooks/rules-of-hooks` behoben; ESLint-Plugin auf v7 aktualisiert

---

## Runde 2 – Bugfixes

- **Level-Reset-Bug**: Level wurde nach einem Neustart fälschlicherweise auf 1 zurückgesetzt statt den gespeicherten Wert zu laden; `gameStore`-Hydration korrigiert
- **Hooks-Reihenfolge**: Verletzungen der React-Hooks-Regel (bedingte Hook-Aufrufe) in mehreren Komponenten beseitigt
- **Welten-Entfesselung**: Logik zum Freischalten neuer Welten war invertiert; Welten werden nun korrekt nach Erreichen der Bedingungen freigeschaltet
- **OrakelKristall-Pause**: Timer läuft im OrakelKristall-Spiel nicht mehr weiter, wenn das Spiel pausiert ist
- **GameOver-Fragen**: Falsch beantwortete Fragen werden auf der GameOver-Seite korrekt angezeigt
- **Prompt verbessert**: KI-Prompt für Fragengeneration überarbeitet; bessere Antwortqualität und konsistenteres JSON-Format
- **Boss-Erklärungen**: Boss-Charakter gibt nach jeder Frage eine kurze Erklärung; KI-Antwort enthält nun `explanation`-Feld

---

## Runde 1 – Fundament

- **Env-Fix**: `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` korrekt aus `.env` geladen; fehlende Env-Vars lösen klare Fehlermeldung aus
- **react-query entfernt**: `@tanstack/react-query` durch einfache `useState`/`useEffect`-Hooks ersetzt; reduziert Bundle-Größe und Komplexität
- **gameConfig**: Zentrale Spielkonfigurationsdatei (`src/data/gameConfig.ts`) eingeführt; Magic Numbers aus dem Code in benannte Konstanten ausgelagert
- **Guest-Toast**: Gastspieler sehen beim Versuch gesperrter Features einen informativen Toast statt einer leeren Aktion
- **LeaguePage i18n**: Alle hartkodierten Strings in `LeaguePage.tsx` durch `t()`-Keys ersetzt; beide Locale-Dateien ergänzt
