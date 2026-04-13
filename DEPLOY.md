# LearnQuest – Deploy-Anleitung (Schritt für Schritt)

Alles was du brauchst um LearnQuest live zu bringen. Reihenfolge einhalten!

---

## SCHRITT 1 – Supabase einrichten (15 Min.)

### 1.1 Projekt erstellen
1. Gehe auf **supabase.com** → Sign up / Log in
2. "New project" klicken
3. Name: `learnquest`
4. **Region: Frankfurt (eu-central-1)** ← wichtig für DSGVO!
5. Passwort notieren (brauchst du selten, aber sicher aufbewahren)

### 1.2 Datenbank-Tabellen erstellen
1. In deinem Projekt: linke Seite → **SQL Editor**
2. "New query" klicken
3. Den gesamten Inhalt aus `supabase/migrations/001_initial_schema.sql` kopieren
4. Oben rechts auf **"Run"** klicken
5. Unten muss erscheinen: `Success. No rows returned`

### 1.3 Google Auth aktivieren
1. Linke Seite → **Authentication** → **Providers**
2. "Google" aufklappen → aktivieren
3. Du brauchst Google OAuth Credentials (kostenlos):
   - Gehe auf: **console.cloud.google.com**
   - Neues Projekt erstellen → "APIs & Dienste" → "Anmeldedaten"
   - "+ Anmeldedaten erstellen" → "OAuth-Client-ID"
   - Anwendungstyp: "Webanwendung"
   - Authorized redirect URIs:
     `https://DEIN-PROJEKT-ID.supabase.co/auth/v1/callback`
     (die Projekt-ID findest du in Supabase → Settings → General)
   - Client ID + Secret in Supabase eintragen → Speichern

### 1.4 Deine Supabase Keys notieren
Linke Seite → **Settings** → **API**

```
Project URL:    https://XXXXXX.supabase.co
anon public:    eyJhbGciOiJ...  (langer Token)
```

---

## SCHRITT 2 – .env.local ausfüllen (5 Min.)

Öffne die Datei `LearnQuest/.env.local` und trage die echten Werte ein:

```bash
VITE_SUPABASE_URL=https://XXXXXX.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJ...
VITE_ANTHROPIC_API_KEY=sk-ant-api03-...
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

**Wo bekommst du die Keys?**
- Supabase URL + Anon Key → Schritt 1.4
- Anthropic Key → console.anthropic.com → "API Keys" → "+ Create Key"
- Stripe Key → stripe.com → Entwickler → API-Schlüssel → "Publishable key"

⚠️ **WICHTIG:** Diese Datei wird NICHT auf GitHub hochgeladen (.gitignore schützt sie)

---

## SCHRITT 3 – Lokal testen (5 Min.)

```bash
cd LearnQuest
npm install
npm run dev
```

Öffne http://localhost:5173 → App sollte laufen.
Teste: Onboarding → Text eingeben → Fragen werden generiert.

---

## SCHRITT 4 – GitHub (10 Min.)

### 4.1 GitHub Repository erstellen
1. Gehe auf **github.com** → Log in
2. Oben rechts: **"+" → "New repository"**
3. Repository name: `learnquest`
4. Private wählen (empfohlen, da du API-Keys hast)
5. **KEIN** "Initialize with README" anhaken → "Create repository"

### 4.2 Code hochladen
Öffne ein Terminal im LearnQuest-Ordner und führe diese Befehle aus:

```bash
# Wenn du noch nie einen Commit gemacht hast:
git config user.email "mathias.schaedler00@gmail.com"
git config user.name "Mathias Schädler"
git add .
git commit -m "Initial commit: LearnQuest App"

# GitHub als Remote hinzufügen (DEIN-USERNAME ersetzen!):
git remote add origin https://github.com/DEIN-USERNAME/learnquest.git
git branch -M main
git push -u origin main
```

→ GitHub fragt nach Passwort: benutze ein **Personal Access Token**
  (github.com → Settings → Developer settings → Personal access tokens → Classic → Generate)

---

## SCHRITT 5 – Vercel deployen (10 Min.)

### 5.1 Vercel Account + Projekt
1. Gehe auf **vercel.com** → Log in with GitHub
2. "Add New Project" → dein `learnquest` Repository auswählen
3. Framework Preset: **Vite** (wird automatisch erkannt)
4. Noch NICHT deployen! Erst Schritt 5.2.

### 5.2 Environment Variables in Vercel eintragen
Im Vercel Projekt-Setup: **Environment Variables** Abschnitt

| Name | Wert | Achtung |
|------|------|---------|
| `VITE_SUPABASE_URL` | deine Supabase URL | Öffentlich (VITE_) |
| `VITE_SUPABASE_ANON_KEY` | dein Supabase anon key | Öffentlich (VITE_) |
| `ANTHROPIC_API_KEY` | dein Anthropic Key | 🔒 **KEIN** VITE_ davor! Bleibt geheim auf dem Server |
| `VITE_STRIPE_PUBLISHABLE_KEY` | dein Stripe Publishable Key | Öffentlich (VITE_) |

### 5.3 Deploy!
"Deploy" klicken → Warten bis grüner Haken erscheint (ca. 2 Min.)

Deine App ist jetzt live unter: `https://learnquest.vercel.app`

---

## SCHRITT 6 – Supabase Auth URL aktualisieren (2 Min.)

Jetzt wo du deine Vercel-URL kennst:

1. Supabase → **Authentication** → **URL Configuration**
2. **Site URL**: `https://learnquest.vercel.app`
3. **Redirect URLs** hinzufügen:
   - `https://learnquest.vercel.app/**`
   - `http://localhost:5173/**`  (für lokale Entwicklung)
4. Speichern

---

## SCHRITT 7 – Impressum ausfüllen (5 Min.)

Öffne `src/pages/ImpressumPage.tsx` und ersetze:
- `[Vorname Nachname]` → deinen echten Namen
- `[Straße und Hausnummer]` → deine Adresse
- `[PLZ Ort]` → deine PLZ + Stadt
- `[email@example.com]` → deine Kontakt-E-Mail
- `[+49 XXX XXXXXXX]` → optional, Telefon
- `[datenschutz@example.com]` in der Datenschutz-Seite ebenfalls

Danach: `git add . && git commit -m "Impressum + Datenschutz befüllt" && git push`
→ Vercel deployed automatisch innerhalb von 2 Min.

---

## Fertig! Checkliste

- [ ] Supabase Projekt erstellt + SQL ausgeführt
- [ ] Google Auth aktiviert
- [ ] .env.local mit echten Keys befüllt
- [ ] Lokal getestet (npm run dev)
- [ ] GitHub Repository erstellt + Code gepusht
- [ ] Vercel deployed + Environment Variables eingetragen
- [ ] Supabase Auth URL auf Vercel-URL aktualisiert
- [ ] Impressum mit echten Daten befüllt

---

## Bei Problemen

**"API Fehler" beim Fragenerstellen:**
→ Prüfe ob `ANTHROPIC_API_KEY` in Vercel eingetragen ist (ohne VITE_!)
→ Prüfe ob du Guthaben auf console.anthropic.com hast

**Login funktioniert nicht:**
→ Prüfe Supabase → Authentication → URL Configuration

**"Supabase URL fehlt" Fehler:**
→ Prüfe ob `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY` in Vercel eingetragen

**Lokaler Test schlägt fehl:**
→ Prüfe .env.local (keine Leerzeichen, keine Anführungszeichen um die Werte)
