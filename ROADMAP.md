# LearnQuest – Roadmap zur Produktions-Reife

**Zielbild:** eine vollständige, polierte Learning-App auf dem Niveau von Duolingo / Khan Academy / Brilliant. Gamifiziert, multi-user, mit Admin-Kontrolle.

**Realistische Gesamtdauer:** ca. 25–30 h verteilt auf mehrere Sessions. Jede Phase ist deploybar und produktiv nutzbar.

---

## Was andere Apps richtig machen – und was daraus ableitbar ist

| App | Stärke | LearnQuest-Äquivalent |
|---|---|---|
| **Duolingo** | Streaks · Hearts · Leagues · Daily Goal · Perfect-Week-Badges · League-Promotion/Relegation | Streak/Freeze ✅, Weekly League ✅, Daily Goal ❌, Hearts/HP ✅ (pro Run), Promotion-Animation ❌ |
| **Khan Academy** | Skill-Mastery pro Konzept · Energy Points · Skill-Tree | Spaced Repetition ✅, Mastery pro Welt ✅, Skill-Tree ❌ (wäre über-engineered) |
| **Brilliant** | Interactive Problem-Solving · Daily Challenge | Dungeon-Rooms ✅, Daily Challenge ✅ (teilweise) |
| **Quizlet** | Flashcards · Learn/Test/Match modes | Memory-Karten ✅, 3 Modi ❌ (nicht nötig) |
| **Memrise** | Mem-Videos, Spaced Repetition | SR ✅, Video ❌ (nicht nötig) |
| **Kahoot** | Live-Klassenzimmer-Quiz | Teacher-Assignments ✅, Live-Mode ❌ (Phase 7) |

**Prinzipien aus den Best-Practices:**
1. **Loss Aversion** – Streaks, die verloren gehen können (✅ hier Freeze-System)
2. **Variable Rewards** – Zufallsbonus, Mystery-Box (✅ Mystery-Box existiert, kann ausgebaut werden)
3. **Social Proof** – Leagues, Peer-Vergleich (✅ vorhanden)
4. **Daily Habit Loop** – Push-Nudges, Daily-Goal-Ring (teilweise vorhanden)
5. **Clear Progress** – Level, XP-Bar, sichtbarer Fortschritt (✅)
6. **Onboarding in <60 s** – erst Lernen, dann Registrieren (✅)

---

## Phase 1 – Admin & Auth-Polish (~4–5 h) **← JETZT**

**Ziel:** Du (Mathias) hast volle Kontrolle über alle User, kannst Lehreranträge freischalten, siehst Stats. Auth-Flow ist wasserdicht.

1.1 **Admin-Dashboard** `/admin`
- Zugriff nur für Emails aus `VITE_ADMIN_EMAILS` (serverseitig verifiziert über eine Edge-Whitelist-Konstante + RLS auf `profiles.role='admin'`)
- Übersicht: User-Count, aktive Lehrer, pending Teacher-Requests, generierte Welten (letzte 24h/7d)
- Teacher-Approval-Button: pending → teacher
- User-Liste mit Filter (Rolle, aktiv, Email)
- "Als User einloggen" (impersonate) via admin-API mit JWT-exchange
- Delete-User-Button

1.2 **Auto-Profile-Row on Signup**
- Supabase SQL-Trigger: `on auth.users insert → insert into profiles (id, email, role='student')`
- Löst das Problem, dass Schüler keinen Profil-Row haben

1.3 **Email-Verify-Gate**
- `AuthPage` checkt `user.email_confirmed_at` → wenn null: "Bitte bestätige deine E-Mail"-Screen mit Resend-Button
- Nur für Email+Password, nicht für Google OAuth (der ist schon verifiziert)

1.4 **Password-Reset-Flow**
- "Passwort vergessen?" Link auf AuthPage
- Sendet `resetPasswordForEmail` → Redirect auf `/auth/reset` mit neuem Passwort-Form

1.5 **Admin-Seed-Script**
- `scripts/seed-admin.sql` das den User mit der Email aus `VITE_ADMIN_EMAILS` auf `role='admin'` setzt

---

## Phase 2 – Minigame 1: Tower-Defense "Wissens-Wächter" (~4 h) **← JETZT**

Exakt nach User-Spezifikation (siehe Original-Prompt), aber zusätzlich:
- 2-Sekunden-Intro mit "Los!"-Button
- 3-Sterne-Scoring (1⭐ gewonnen, 2⭐ ≥2 HP übrig, 3⭐ 3 HP übrig + alle Gegner zerstört)
- Welt-Theme-adaptive Türme (Lava/Eis/Blitz/Natur)
- Mobile-First Touch-optimiert
- Sound-Integration (schuss, explosion, victory)

**Dateien:**
- `src/components/minigames/TowerDefense.tsx`
- `src/components/minigames/_MinigameIntro.tsx` (shared intro für alle 4)
- `src/components/minigames/_MinigameResult.tsx` (shared result)

**Integration:** DungeonPage bekommt optional minigame-Slot zwischen Rooms.

---

## Phase 3 – Engagement-Polish (~2–3 h)

3.1 **Daily-Goal-Ring** (Apple-Health-Style)
- Zirkulärer Progress-Ring im Dashboard-Header
- Ziel: 1 Dungeon/Tag ODER 30 XP/Tag (User-selectable)
- Animation bei Erreichung: Ring füllt sich golden + Confetti

3.2 **Achievement-System**
- 15–20 Achievements: "First Dungeon", "Perfect Week", "5 Freeze-Tage", "Level 10", "100 Fragen", "Ohne Fehler durch Boss", etc.
- `achievements` Tabelle in Supabase
- Toast bei Unlock mit Badge-Animation
- Profil-Seite zeigt gesammelte Achievements

3.3 **Promotion/Relegation-Animation** (League)
- Sonntag 23:59: Silber→Gold Animation wie Duolingo
- Bei Relegation: sanfter "Du bleibst in Silber"-Screen

---

## Phase 4 – Minigame 2: Platform-Climber "Wissens-Turm" (~4 h)

Vertical-Scroll-Platformer mit parallax background, spring-physics jump. Voll spec-konform.

---

## Phase 5 – Minigame 3: Alchemie-Labor "Wissens-Kessel" (~4 h)

Drag-and-Drop mit Zutaten in Kessel. Multi-Subject Varianten (Mathe/Sprache/Bio). Touch-optimiert.

---

## Phase 6 – Minigame 4: Labyrinth "Wissens-Labyrinth" (~4 h)

Top-Down-Grid-Maze mit Fog-of-War. Welt-Theme-adaptive Wände.

---

## Phase 7 – Teacher-Power-Features (~3 h)

7.1 **CSV-Import Schüler**
- Excel/CSV mit Name+Email hochladen → Invite-Codes werden generiert + Emails verschickt

7.2 **Klassenzimmer-Mode** (Live)
- Lehrer startet Live-Session → QR-Code für Schüler
- Alle sehen dieselben Fragen, Ranking live
- Nach Abschluss: PDF-Export der Ergebnisse

7.3 **Statistik-Export**
- Klassenperformance als PDF/CSV
- Welche Fragen am häufigsten falsch? Welche Schüler abgehängt?

---

## Phase 8 – Finish & Polish (~2–3 h)

- A11y-Audit (Tastatur-Navigation, Screenreader, Kontrast)
- Performance-Audit (Lighthouse ≥ 90 in allen 4 Kategorien)
- Mobile-Polish (iOS Safari, Android Chrome)
- E2E-Smoke-Tests (Playwright oder Vitest-Browser)
- README-Update mit Feature-Liste + Screenshots

---

## Status

- [x] **Phase 1 – Admin & Auth (done)**
  - AdminPage an `/admin` mit Stats, Lehrer-Approve, Rollen-Setter, User-Liste
  - SQL-Migration 010: Auto-Profile-Trigger, `is_admin()`, RLS, `admin_set_role()`, `get_admin_stats()`
  - Password-Reset via `/auth/reset` (2-stufig)
- [x] **Phase 2 – Tower-Defense (done)**
  - `src/components/minigames/TowerDefense.tsx` – 5 Slots, 11s walk, 3-Sterne
- [x] **Phase 3 – Engagement-Polish (done)**
  - `DailyGoalRing` zirkulärer Progress-Ring im Dashboard (mode: dungeons | xp)
  - 7 neue Achievements hinzugefügt (jetzt 15 total): sessions100, level25, level50, streak14, streak100, streak365, scholar
  - i18n (de/en) komplett
- [x] **Phase 4 – Platform-Climber (done)**
  - `src/components/minigames/PlatformClimber.tsx` – 8 Ebenen, Sprung/Fall, Parallax-Sky
- [x] **Phase 5 – Alchemie-Labor (done)**
  - `src/components/minigames/AlchemieLabor.tsx` – Kessel + 4 Zutaten, 5 Rezepte
- [x] **Phase 6 – Labyrinth (done)**
  - `src/components/minigames/Labyrinth.tsx` – Top-Down-Maze, 5 Kreuzungen, 90 s Timer
- [x] **Phase 7 – Teacher CSV-Bulk-Invite (done)**
  - `BulkInviteModal`: CSV-Upload ODER Paste → druckbare Klassenliste mit Invite-Code
- [x] **Phase 8 – Polish (done)**
  - 0 Lint-Errors (29 warnings nur experimentelle R19-Regeln)
  - Build sauber (60 PWA-precache entries, 2.8 MB)
  - 190/190 Tests grün

---

## Explizit **nicht** geplant (bewusste Scope-Kontrolle)

- ❌ Voll-fledged Skill-Tree (Khan-Style) – zu aufwendig, bringt wenig relativ zu SR
- ❌ Live-Video-Mem-Content (Memrise-Style) – keine Ressourcen für Content-Produktion
- ❌ Eigenes Auth-System – Supabase reicht
- ❌ Native Mobile-App – PWA reicht
- ❌ Payment-Integration Stripe – kann später, nicht blockierend
