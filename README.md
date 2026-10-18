# NeLuna's Pfötli Buch

Das Intranet für die Hundepension NeLuna (Willisdorf) und NeLuna's Pfötli Shop (Stein am Rhein): Login, Rollen, Benutzerverwaltung, später Ladenbuch, Belegungsplan, Fahrdienst, Kalender und Chat.

Web-App (React, Vite) auf Firebase: Authentication, Firestore (Zürich) und Hosting. Konzept: [docs/KONZEPT.md](docs/KONZEPT.md). Einrichtung des Firebase-Projekts und der Domain: [docs/EINRICHTUNG.md](docs/EINRICHTUNG.md).

## Lokal entwickeln

```bash
npm install
npm run emulator                     # Firebase-Emulatoren (Auth + Firestore), Java 21 nötig
VITE_EMULATOR=true npm run dev       # zweites Terminal, http://localhost:5173/einrichtung
```

## Prüfen

```bash
npm run lint
npm test               # Unit-Tests (Rollen, Passwortregeln)
npm run test:regeln    # Sicherheitsregeln gegen den Firestore-Emulator
npm run build
```

## Veröffentlichen

```bash
npm run deploy         # baut und lädt App + firestore.rules hoch
```
