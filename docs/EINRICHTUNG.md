# Einrichtung: Firebase und intranet.neluna.ch

Diese Schritte sind nur einmal nötig. Danach genügt für jede neue Version `npm run deploy`.

## 1. Firebase-Projekt anlegen

1. <https://console.firebase.google.com> öffnen (mit dem Google-Konto, das NeLuna gehören soll) und **Projekt hinzufügen**.
2. Projektname **NeLunas-Pfoetli-Buch** (Projekt-ID `nelunas-pfoetli-buch`). Google Analytics wird nicht gebraucht.
3. Falls Firebase eine andere Projekt-ID vergibt (z. B. `neluna-intranet-1a2b3`), diese in `.firebaserc` eintragen.

## 2. Login einschalten

**Build → Authentication → Jetzt starten → Anbieter: E-Mail/Passwort** aktivieren (nur die erste Option, nicht «E-Mail-Link»).

Unter **Authentication → Einstellungen → Benutzeraktionen** muss **«Registrierung aktivieren»** eingeschaltet bleiben, denn darüber legt der Admin neue Konten an. Ein selbst angelegtes Konto ohne Eintrag im Team sieht nur «Kein Zugang»; das stellen die Datenbankregeln sicher.

Unter **Authentication → Vorlagen** die Sprache auf **Deutsch** stellen, damit die E-Mail «Passwort festlegen» deutsch ist.

## 3. Datenbank anlegen

**Build → Firestore Database → Datenbank erstellen**

- Edition **Standard**, Standort **europe-west6 (Zürich)**. Der Standort lässt sich später nicht mehr ändern.
- Modus egal (Produktionsmodus); die richtigen Regeln kommen mit dem ersten Deploy.

## 4. Web-App registrieren und `.env` füllen

1. **Projekteinstellungen (Zahnrad) → Allgemein → Deine Apps → Web (`</>`)**, Name «Intranet», Hosting *nicht* ankreuzen.
2. Die angezeigten Werte (`apiKey`, `authDomain`, …) in eine neue Datei `.env` übertragen (Vorlage: `.env.example`).

Diese Werte sind nicht geheim; den Schutz der Daten übernehmen die Sicherheitsregeln.

## 5. Erster Deploy (vom eigenen PC)

Voraussetzung: Node.js 22 oder neuer.

```bash
npm install
npx firebase login        # einmalig, öffnet den Browser
npm run deploy            # baut die App, lädt Regeln und App hoch
```

Danach läuft das Intranet unter `https://nelunas-pfoetli-buch.web.app`.

## 6. Intranet einrichten

`https://nelunas-pfoetli-buch.web.app/einrichtung` öffnen, Name, E-Mail und Passwort eingeben. Wer das als Erstes macht, wird Admin. Danach ist die Seite gesperrt (die Datenbankregeln lassen keine zweite Einrichtung zu).

Anschliessend unter **Verwaltung → Benutzer** das Team anlegen. Jede Person bekommt eine E-Mail, um ihr eigenes Passwort festzulegen.

## 7. Eigene Adresse intranet.neluna.ch

1. Firebase: **Hosting → Benutzerdefinierte Domain hinzufügen** → `intranet.neluna.ch`.
2. Firebase zeigt einen **TXT-Eintrag** (Bestätigung) und einen **A-Eintrag** (IP-Adresse) an.
3. Bei **Hostfactory** im DNS-Editor von neluna.ch für den Namen `intranet` genau diese Einträge anlegen. Die Website und E-Mail von neluna.ch bleiben unverändert; ein Umzug der Nameserver ist nicht nötig.
4. Nach der Bestätigung (Minuten bis wenige Stunden) stellt Firebase das HTTPS-Zertifikat selbst aus.
5. Unter **Authentication → Einstellungen → Autorisierte Domains** `intranet.neluna.ch` hinzufügen (macht Firebase meist automatisch).

## Kosten

Der kostenlose **Spark-Tarif** reicht. Ein Wechsel auf Blaze ist erst für Fotos/Dokumente (Cloud Storage) nötig; dann empfiehlt sich ein Budget-Alarm in der Google-Cloud-Konsole.

## Datenschutz

In der Firebase-Konsole unter **Projekteinstellungen → Datenschutz** die Datenverarbeitungsbedingungen (Data Processing Terms) akzeptieren.
