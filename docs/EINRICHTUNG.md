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

## 8. Push-Nachrichten (Blaze-Tarif)

Push-Nachrichten aufs Handy (Chat, Mitteilungen, eigene Fahrten) verschickt eine kleine Server-Funktion. Diese gibt es bei Firebase nur im **Blaze-Tarif** (Abrechnung nach Verbrauch; für das Team voraussichtlich gratis, sonst wenige Franken im Monat). Entscheid 18.10.2026: umstellen.

1. **Tarif umstellen:** Firebase-Konsole → unten links **Spark** (oder Zahnrad → **Nutzung und Abrechnung**) → **Tarif ändern** → **Blaze**. Ein Rechnungskonto mit Kreditkarte anlegen.
2. **Budget-Alarm:** Beim Umstellen fragt Firebase nach einem Budget, sonst in der Google-Cloud-Konsole unter **Abrechnung → Budgets und Benachrichtigungen → Budget erstellen**: Betrag **CHF 5**, Benachrichtigungen bei 50 %, 90 % und 100 % an die NeLuna-Adresse. Der Alarm schickt eine E-Mail, er stoppt nichts.
3. **Schlüssel für Web-Push:** Projekteinstellungen (Zahnrad) → **Cloud Messaging** → **Web-Konfiguration** → **Web-Push-Zertifikate** → **Schlüsselpaar generieren**. Den angezeigten Schlüssel in `.env` bei `VITE_FIREBASE_VAPID_KEY=` eintragen.
4. **Deploy** wie immer mit `npm run deploy`. Beim ersten Mal schaltet die Firebase-CLI die nötigen Google-Dienste ein (Cloud Functions, Cloud Build, Artifact Registry, Eventarc); das dauert einige Minuten. Fragt sie nach einer **Bereinigungsrichtlinie für Container-Images** (cleanup policy), mit **Ja** und 1 Tag antworten, damit keine alten Versionen Speicherkosten verursachen. Meldet der allererste Deploy einen Fehler zu Eventarc-Berechtigungen, ein paar Minuten warten und nochmals `npm run deploy`.
5. **Auf jedem Handy einschalten:** im Pfötli Buch **Profil → Push-Nachrichten auf diesem Gerät einschalten** und die Frage des Browsers mit «Erlauben» beantworten. Auf dem **iPhone** zuerst in Safari **Teilen → Zum Home-Bildschirm** und das Pfötli Buch von dort öffnen (iOS 16.4 oder neuer), sonst bietet Apple keine Push-Nachrichten an.

Im Profil wählt jede Person, wofür sie Push-Nachrichten will (Gruppen-Chats, Direktnachrichten, Mitteilungen, eigene Fahrten). Beim Abmelden bekommt das Gerät keine mehr.

## Kosten

Bis auf die Push-Nachrichten reicht der kostenlose **Spark-Tarif**. Mit Blaze bleiben die Gratis-Kontingente bestehen; bezahlt wird nur, was darüber hinausgeht. Fotos im Chat liegen verkleinert in der Datenbank, Cloud Storage wird nicht gebraucht.

## Datenschutz

In der Firebase-Konsole unter **Projekteinstellungen → Datenschutz** die Datenverarbeitungsbedingungen (Data Processing Terms) akzeptieren.
