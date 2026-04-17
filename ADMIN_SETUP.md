# Admin-Setup – Einmalig, dann bist du Admin

Nach dem Deploy musst du dich **einmalig** selbst zum Admin machen. Danach kannst du über `/admin` alles verwalten (neue Admins ernennen, Lehrer approven, etc.).

## Schritt 1 – SQL-Migration 010 ausführen

1. Gehe zu **supabase.com** → dein Projekt → **SQL Editor**
2. Klicke **"New query"**
3. Öffne die Datei `supabase/migrations/010_admin_and_auto_profile.sql` im Editor deiner Wahl und kopiere den **kompletten Inhalt**
4. In den Supabase SQL Editor einfügen → **Run**
5. Erwartet: `Success. No rows returned`

Damit sind aktiviert:
- Auto-Profil-Erstellung bei jeder neuen Anmeldung
- `is_admin()` und `admin_set_role()` Funktionen
- RLS-Policies für Admin-Zugriff

## Schritt 2 – Dich selbst zum Admin machen

Im **gleichen** SQL-Editor (neue Query):

```sql
update public.profiles
  set role = 'admin'
  where id = (
    select id from auth.users
    where email = 'mathias.schaedler00@gmail.com'
  );
```

Bei Erfolg: **1 row affected**.

> ⚠️ Wenn 0 rows affected: Du hast dich noch nie bei LearnQuest eingeloggt.
> → Logge dich einmal über `/auth` ein (Google oder Magic Link) → dann nochmal obiges Statement ausführen.

## Schritt 3 – Admin-Dashboard testen

1. In der App auf `/admin` gehen (z.B. `https://learn-quest-cyan.vercel.app/admin`)
2. Du siehst: Stats-Grid, Lehrer-Anträge, Rollen-Setter, User-Liste
3. Falls du stattdessen zurück zum Dashboard geschickt wirst → Schritt 2 nochmal, Cookies leeren, neu einloggen

## Wie ernennst du jetzt Lehrer?

- Über den **Admin-Dashboard** einfach Email+Rolle "teacher" eingeben → "Setzen"
- ODER ein Lehrer registriert sich selbst über `/lehrer/registrieren` → landet als `teacher_pending` im Admin-Dashboard → "✓ Freischalten"-Button

## Was macht der Auto-Profile-Trigger?

Früher hatten Schüler nach dem Signup keinen Profil-Row → verschiedene Features gingen kaputt. Jetzt:
- Jeder neue Auth-User bekommt **automatisch** eine Zeile in `profiles` + `characters`
- Default-Rolle: `student`
- Die Migration hat auch alle **existing** User nachgepflegt (siehe Abschnitt 6 der SQL-Datei)
