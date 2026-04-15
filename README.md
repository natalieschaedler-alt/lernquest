# LearnQuest 🎮

KI-Lernspiel für Schüler. Eigenen Lernstoff eingeben → KI erschafft daraus ein gamifiziertes Abenteuer mit Fragen, Bosskämpfen und Levelsystem.

## Features

- **KI-Fragengeneration** – Anthropic Claude wandelt beliebigen Text in Multiple Choice, Wahr/Falsch, Memory und Lückentexte um
- **5 thematische Welten** – Feuer, Wasser, Cyber, Zauberwald, Kosmos (freischaltbar)
- **4 Mini-Spiele** – Wortwirbel, Orakel-Kristall, Memory-Karten, Lückentext
- **Bosskämpfe** – Spezialangriffe: Zeitdruck, Nebelfluch, Chaos-Shuffle
- **Levelsystem & XP** – 10 Level, XP-Schwellen, Errungenschaften
- **Spaced Repetition** – Falsch beantwortete Fragen werden nach SM-2-Intervallen wiederholt
- **Liga & Rangliste** – wöchentliche XP-Liga mit 5 Ligen (Bronze–Diamant)
- **Streak-System** – tägliches Spielen baut Streak auf
- **PDF-Import** – PDFs direkt als Lernquelle hochladen (max. 10 MB)
- **Daily Challenges** – täglich wechselnde Herausforderungen mit Bonus-XP
- **PWA** – installierbar, offline-fähig, Update-Prompt
- **i18n** – Deutsch & Englisch (225 Schlüssel, vollständig synchron)

## Tech Stack

| Bereich | Technologie |
|---------|-------------|
| Frontend | React 19, TypeScript, Vite 8 |
| Styling | Tailwind CSS, Motion (Framer) |
| State | Zustand (persist) |
| Backend/DB | Supabase (PostgreSQL + Auth) |
| KI | Anthropic Claude API |
| Routing | React Router 7 |
| i18n | i18next + react-i18next |
| PDF | pdfjs-dist |
| PWA | vite-plugin-pwa + Workbox |
| Tests | Vitest (190 Tests) |

## Setup

### 1. Abhängigkeiten installieren

```bash
npm install
```

### 2. Umgebungsvariablen konfigurieren

Kopiere `.env.example` nach `.env.local` und trage deine Keys ein:

```bash
cp .env.example .env.local
```

Benötigte Variablen:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

### 3. Supabase-Schema einrichten

Führe das SQL-Schema in deinem Supabase-Projekt aus:

```bash
# In der Supabase-Konsole: SQL Editor → New query → Inhalt einfügen
supabase/schema.sql
```

### 4. Entwicklungsserver starten

```bash
npm run dev
```

Öffne [http://localhost:5173](http://localhost:5173).

## Verfügbare Scripts

| Script | Beschreibung |
|--------|-------------|
| `npm run dev` | Entwicklungsserver mit HMR |
| `npm run build` | TypeScript-Check + Produktions-Build |
| `npm run preview` | Produktions-Build lokal vorschauen |
| `npm run test` | Alle 190 Tests ausführen (Vitest) |
| `npm run lint` | ESLint-Analyse |
| `npm run analyze` | Build + Bundle-Größenanalyse nach Chunk |

## Projektstruktur

```
src/
├── components/
│   ├── games/          # Wortwirbel, OrakelKristall, MemoryKarten, LueckentextSpiel
│   └── ui/             # InstallButton, WorldBackground, …
├── data/
│   └── worlds.ts       # 5 Weltdefinitionen (Themen, Farben, Boss, Loot)
├── hooks/              # useAuth, useLeague, useMistakesReview, useStreak
├── i18n/locales/       # de.json, en.json (225 Schlüssel)
├── lib/
│   ├── database.ts     # Supabase-Abstraktionsschicht
│   ├── gameConfig.ts   # Spielkonstanten (Timer, Combo, Boss)
│   └── supabase.ts     # Supabase-Client
├── pages/              # 15 Seiten (Start, Onboarding, Dungeon, Victory, …)
├── stores/
│   └── gameStore.ts    # Zustand-Store (persist)
├── types/index.ts      # Shared TypeScript-Typen
└── utils/
    ├── contentFilter.ts  # Schüler-Inhaltsfilter
    ├── generateQuestions.ts  # KI-Fragengeneration + Supabase-Cache
    ├── shuffleArray.ts
    └── soundManager.ts   # Web-Audio-Synthese (8 Sounds, kein Asset)
api/
└── generate.ts         # Vercel Serverless Function (Anthropic API)
supabase/
└── schema.sql          # PostgreSQL-Schema mit RLS-Policies
```

## Architektur-Highlights

- **Fragen-Caching**: MD5-Hash des Lerntexts → Supabase-Lookup → kein redundanter API-Call
- **Sound-Synthese**: Alle 8 Sounds sind prozedural via Web Audio API generiert (kein Asset-Overhead)
- **Spaced Repetition**: SM-2-inspirierte Intervalle: 1d → 3d → 7d → 14d → 30d
- **Code-Splitting**: Vendor-Chunks (React, Supabase, Motion, i18n) + Lazy-Routes
- **Sicherheit**: CSP-Header, Body-Size-Limit (200 KB), SQL-Privilege-Escalation-Patch, TypeScript strict

## Deployment (Vercel)

```bash
vercel deploy --prod
```

Umgebungsvariablen im Vercel-Dashboard unter **Settings → Environment Variables** eintragen.
