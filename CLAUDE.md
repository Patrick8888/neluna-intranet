# Hinweise für Claude Code

- Sprache: Oberfläche, Kommentare und Bezeichner auf Deutsch (z. B. `benutzer`, `rollen`, `speichern`). Schweizer Schreibweise (ss statt ß).
- Stack: Vite + React 19 + TypeScript, react-router, Firebase JS SDK (Auth, Firestore). Kein eigener Server.
- Rechte werden in `firestore.rules` durchgesetzt; die Oberfläche (`src/lib/rollen.ts`, `darf()`) blendet nur aus. Jede neue Sammlung braucht Regeln **und** Tests in `tests/` (laufen mit `npm run test:regeln` gegen den Emulator). Standard ist «verboten» (Catch-all am Ende der Regeln).
- Rollenmatrix: `src/lib/rollen.ts` ist die Quelle; die Regeln spiegeln sie. Beide zusammen ändern.
- Neue Bereiche: Eintrag in `src/lib/navigation.ts` (mit `pfad`), Route in `src/App.tsx` mit `<Berechtigt modul=…>`.
- Aussehen: Klassen aus `src/index.css` (`panel`, `grid`, `btn`, `pill`, `notice`, `kacheln`); Schwarz/Gold wie das Ladenbuch. Mobile zuerst (Handy im Laden und in der Pension).
- Fehlermeldungen über `meldung()` aus `src/lib/fehler.ts`.
- Vor einem PR: `npm run lint && npm test && npm run test:regeln && npm run build`.
