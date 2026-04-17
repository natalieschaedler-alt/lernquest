# Was ist neu? (Session-Zusammenfassung)

> Alle 8 Roadmap-Phasen durchgezogen. **3 git commits**, Build + Tests + Lint grün.

## Nach dem Deploy musst du tun

1. **Supabase-Migration 010 ausführen** (einmalig, siehe `ADMIN_SETUP.md`)
2. **Dich zum Admin machen** (einmalig, siehe `ADMIN_SETUP.md`)

Ohne die zwei Schritte funktioniert `/admin` nicht.

## Was testen?

### Admin (`/admin`) — **Phase 1**
- [ ] Stats-Grid zeigt korrekte Zahlen (User gesamt, Schüler, Lehrer)
- [ ] Filter/Search in User-Liste funktioniert
- [ ] "Rolle manuell setzen" via Email promotet User
- [ ] Wenn sich jemand als Lehrer registriert → taucht in "Wartende Lehrer-Anträge" auf → "✓ Freischalten" wechselt Rolle zu `teacher`

### Dashboard (`/dashboard`) — **Phase 3**
- [ ] Daily-Goal-Ring oben sichtbar
- [ ] Nach einem Dungeon: Ring füllt sich auf 100%, wird golden, pulsiert
- [ ] Wenn du bei streak 14/100/etc. bist: Achievement-Unlock-Toast (von vorhandenem Code)

### Dungeon — **Phase 2+4+5+6**
Die 4 neuen Minigames können zufällig als Room-Type auftauchen, wenn genug MC-Fragen vorhanden sind:
- [ ] **Wissens-Wächter** (Tower Defense, 6 MC-Fragen): Gegner laufen rechts→links, Türme bauen bei richtiger Antwort
- [ ] **Wissens-Turm** (Platform Climber, 8 MC): 4 Plattformen, richtige antippen → Sprung hoch
- [ ] **Wissens-Kessel** (Alchemie, 5 MC): Zutaten in den Kessel, Farbe wechselt
- [ ] **Wissens-Labyrinth** (Maze, 5 MC): Top-Down mit 90s-Timer, Kreuzungen = Fragen

Du kannst ein Dungeon mit ≥10 MC-Fragen laden → höhere Chance dass eines davon kommt.

### Lehrer-Bereich (`/lehrer/dashboard`) — **Phase 7**
- [ ] Bei einer Klasse: neuer "📋 Massen-Import" Button neben Invite-Code
- [ ] CSV-Datei hochladen (Format: Name,Email mit/ohne Header) oder Namen paste'n
- [ ] "Drucken" erzeugt saubere Klassenliste mit Invite-Code für Schüler

### Auth (`/auth`, `/auth/reset`) — **Phase 1.4**
- [ ] "Passwort vergessen?" Link im Email-Flow
- [ ] Sendet Reset-Link, User kann neues Passwort setzen

## Was NICHT geändert wurde (bewusst)

- **Keine** bestehenden Dungeon-Rooms angefasst (alle 11 bleiben)
- **Keine** Änderung an XP-Formel / Streak-Logik / Spaced-Repetition
- **Keine** Breaking Changes in der DB (Migration 010 ist additive)
- **Keine** neuen Abhängigkeiten hinzugefügt

## Bekannte Einschränkungen

- **Minigames integrieren sich in den random-queue**, d.h. sie tauchen nicht garantiert auf. Für gezieltes Testen: triff nacheinander genug Fragen aus MC-Pool.
- **Tower-Defense Balance:** aktuell 3 HP, 11s Walk, 1.6s Tower-Cooldown — evtl. zu einfach/schwer für deinen Content. Kannst du in `TowerDefense.tsx` Konstanten am Anfang anpassen (`MAX_HP`, `WALK_MS`, `TOWER_COOLDOWN_MS`).
- **Achievement-Toasts** werden durch vorhandenen `checkNewAchievements`-Hook getriggert — prüfe dass er nach Level-Up / Streak-Change in deinen Flows aufgerufen wird.
- **CSV-Bulk-Invite** erstellt keine Accounts — Schüler treten via Invite-Code selbst bei. Die Liste ist ein Hilfsmittel zum Verteilen.

## Architektur-Entscheidungen die ich getroffen habe

- **Minigames-Struktur:** geteilte `_MinigameIntro.tsx` + `_MinigameResult.tsx` damit alle 4 dieselbe UX haben
- **Daily-Goal:** nutzt `activityDays` aus gameStore (bereits vorhanden) — keine neue DB-Tabelle
- **Admin:** reine Client-Gating via `useTeacher().isAdmin` + Server-Gating via RLS + SECURITY DEFINER RPCs — Defense in Depth
- **CSV-Parse:** reine Client-Side (kein Backend-Call), damit kein Extra-API-Endpoint

## Commits dieser Session

1. `fix(api): move fallbackQuestions into api/_lib to fix FUNCTION_INVOCATION_FAILED` + PDF precache fix
2. `fix(api): add .js extension to _lib import for Node ESM runtime`
3. `feat(phase-1+2): admin dashboard, password reset, Tower-Defense minigame`
4. `docs: add ADMIN_SETUP.md with step-by-step admin bootstrap`
5. `feat(phase-3-to-8): engagement polish, 3 new minigames, teacher bulk-invite`
