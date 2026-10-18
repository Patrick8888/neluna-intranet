# NeLuna Intranet – Konzept

Stand: 17. Oktober 2026 · Version 1 (Entwurf zur Freigabe)

## 1. Ziel

Ein gemeinsames Intranet für die **Hundepension** und den **Pfötli Shop** (Hunde- und Katzenbedarf, Kaltenbacherstrasse 41, Stein am Rhein). Alle Mitarbeitenden melden sich mit einem eigenen Profil an und sehen genau das, was ihre Rolle braucht. Das Intranet läuft im Browser auf PC, Tablet und Handy (installierbar wie eine App, «PWA»).

Das bestehende **Ladenbuch** (Kassenbuch, Übergabe, Bestellungen, Reklamationen, Loomis, Wochenbericht, Sitzungen) wird als Modul «Laden» vollständig übernommen, inklusive der bisher erfassten Daten.

## 2. Personen und Rollen

| Person | Funktion | Rolle im Intranet |
|---|---|---|
| Patrick Schaub (Pädi) | Inhaber, Geschäftsführer (Finanzen, IT) | **Admin** + Geschäftsführung |
| Nalan Schaub (Nel) | Inhaberin, Geschäftsführerin (Sortiment, Personal, Marketing) | Geschäftsführung |
| Cristina de Oliveira | Leitung Hundepension | Leitung Pension |
| Morena Riccardi | Leitung Verkaufsladen (Filialleiterin) | Leitung Laden |
| Rahel Winet | Verkäuferin 100 % | Verkauf |
| Claudia Binder | Verkäuferin 60 % (ab Jan. 2027 80 %) | Verkauf |
| Laura Essinger | Fahrerin | Fahrdienst |
| Nic Richter | Fahrer | Fahrdienst |
| (später) | Betreuung Pension, Aushilfe | Mitarbeit Pension |

Eine Person kann mehrere Rollen haben (z. B. Verkäuferin, die auch Fahrdienst macht). Rollen und Rechte verwaltet der Admin selbst im Intranet.

### Berechtigungen (Vorschlag)

L = lesen, B = bearbeiten, V = verwalten/freigeben, – = kein Zugriff

| Modul | Geschäftsführung | Leitung Pension | Leitung Laden | Verkauf | Mitarbeit Pension / Fahrdienst |
|---|---|---|---|---|---|
| Startseite, Mitteilungen, Chat, Kalender | V | B | B | B | B |
| Belegungsplan Hundezimmer | V | V | L | L | B |
| Hunde- und Kundenkartei | V | V | L | L | L (nur Betreuungsinfos) |
| Tagesplan Pension (Füttern, Medikamente, Gassi) | V | V | – | – | B |
| Fahrdienstplan | V | V | L | L (eigene Fahrten B) | B (eigene Fahrten) |
| Fahrzeuge und Unterhalt | V | V | – | – | B (Fahrdienst: Termine und km erfassen) |
| Ladenbuch: Kasse, Übergabe, Bestellungen, Reklamationen, Loomis | V | – | V | B | – |
| Kassenbuch Pension | V | V | – | – | B (Mitarbeit Pension: Tagesabschluss erfassen) |
| Ladenbuch: Wochenbericht | V | – | B | L | – |
| Sitzungsprotokolle Team | V | B | B | L | L |
| Sitzungsprotokolle Kader | V | B | B | – | – |
| Dienstplan und Ferien | V | V (Pension) | V (Laden) | L + Antrag | L + Antrag |
| Aufgaben / Pendenzen | V | B | B | B | B |
| Dokumente (Handbuch, Reglemente, Anleitungen) | V | L | L | L | L |
| Benutzer, Rollen, Einstellungen | V (nur Admin) | – | – | – | – |

Bestehende Regeln aus dem Organisationshandbuch werden im System abgebildet, z. B. Reklamations-Gutschrift: Verkauf bis CHF 200, darüber Leitung Laden, Nel wird immer informiert.

## 3. Module

### 3.1 Startseite («Heute»)
Persönliche Übersicht: heutige Ankünfte und Abreisen in der Pension, heutige Fahrten, offene Übergabe-Pendenzen, eigene Aufgaben, Termine, neue Mitteilungen, ungelesene Chats. Für die Geschäftsführung zusätzlich Kennzahlen (Belegung, Umsatz Laden der Woche, Kassendifferenzen).

### 3.2 Kalender
Ein gemeinsamer Kalender mit Ebenen, die sich ein- und ausblenden lassen: Pension (Ankünfte/Abreisen), Fahrdienst, Laden (Lieferungen, Loomis, Aktionen), Personal (Ferien, Abwesenheiten), Sitzungen, Firmentermine. Tages-, Wochen- und Monatsansicht. Optional später: Abo-Link für Handy-Kalender (iCal).

### 3.3 Hundepension (Standort Willisdorf)
- **Kunden- und Hundekartei:** Halter/in (Kontakt, Notfallkontakt, Tierarzt), Hund (Rasse, Alter, Geschlecht, kastriert, Foto), Impfungen mit Ablaufdatum und Warnung, Futter und Futtermenge, Medikamente, Allergien, Verträglichkeit mit anderen Hunden, Verhalten, Besonderheiten.
- **Belegungsplan Hundezimmer:** Zeitleiste (Zimmer × Tage) mit Buchungen als Balken, Farben nach Status (Anfrage, bestätigt, eingecheckt, abgereist). Doppelbelegung wird verhindert bzw. nur erlaubt, wenn das Zimmer mehrere Hunde aufnehmen darf und die Hunde als verträglich markiert sind. Freie Zimmer für einen Zeitraum suchen.
- **Buchungen:** Anfrage → bestätigt → Check-in → Check-out, mit Zimmer, Leistungen (z. B. Abholung, Baden), Preis, Bemerkungen.
- **Tagesplan Pension:** pro Tag eine Abhakliste je Hund (Fütterung morgens/abends, Medikamente, Spaziergang, Auffälligkeiten). Wer hat es wann erledigt.
- **Tagesbericht / Übergabe Pension:** wie beim Laden, Pendenzen für die nächste Schicht.
- **Kassenbuch Pension:** eigenes Kassenbuch für die Pension in Willisdorf, getrennt vom Laden, aber gleich aufgebaut wie das Ladenbuch: Tagesabschluss mit Bar, Karte und TWINT, Bar-Ausgaben, gezähltes Bargeld, Differenz, Wechselgeld, Safebag/Einzahlung und CSV-Export. Zahlungen beim Check-out können direkt aus der Buchung übernommen werden (Hund, Halter/in, Betrag, Zahlungsart); bezahlte Rechnungen (Überweisung) werden separat erfasst und laufen nicht durch die Kasse. Auswertungen für die Geschäftsführung zeigen Laden und Pension getrennt und zusammen.

### 3.4 Fahrdienstplan
Abhol- und Bringfahrten, automatisch aus Buchungen mit Leistung «Abholung/Rückbringung» erzeugt oder von Hand erfasst. Pro Fahrt: Datum, Zeitfenster, Adresse, Hund(e), Fahrer/in, Fahrzeug, Status. Tagesansicht als Route für den/die Fahrer/in mit Adresse zum Antippen (Karten-App) und Telefonnummer der Halter/in.

**Fahrzeuge und Unterhalt:** Pro Fahrzeug Kennzeichen, Kilometerstand und eine Liste von Garagen- und Unterhaltsterminen: Reifenwechsel (Winter-/Sommerreifen, Einlagerung bei der Garage), Service, MFK, Versicherung und Vignette, Reparaturen, Reinigung/Desinfektion der Hundeboxen. Jeder Termin mit Datum, Garage, Kosten, Beleg (Foto) und Notiz. Wiederkehrende Termine erzeugen den nächsten automatisch (z. B. Reifenwechsel jeden Oktober und April, Service nach Kilometern oder Datum). Fällige Termine erscheinen auf der Startseite und im Kalender; ein Garagentermin blockiert das Fahrzeug im Fahrdienstplan.

### 3.5 Chat
Gruppenkanäle (Alle, Pension, Laden, Geschäftsführung) und Direktnachrichten. Fotos anhängen (z. B. Foto vom Hund für die Halter-Info oder Lieferschaden). Ungelesen-Anzeige; Push-Benachrichtigung auf dem Handy in einer späteren Phase.

### 3.6 Laden (heutiges Ladenbuch)
Die sieben Bereiche des Ladenbuchs werden 1:1 übernommen: Kassenbuch (Tagesabschluss mit Bar/Karte/TWINT, Soll-Bargeld, Differenz, Safebag, Wechselgeld-Übernahme, CSV-Export), Übergabe, Bestellungen, Reklamationen, Loomis, Wochenbericht, Sitzungen (Team und Kader). Die bisherigen Einträge werden aus dem Ladenbuch exportiert und importiert. Bis zur Umstellung läuft das Ladenbuch unverändert weiter.

### 3.7 Personal
- **Profile:** Foto, Funktion, Pensum, Kontakt, Rollen.
- **Dienstplan:** Wochenplan je Bereich (Laden, Pension, Fahrdienst).
- **Ferien und Abwesenheiten:** Antrag → Freigabe (Laden: Morena mit Rücksprache Nel; Pension: Cristina), erscheint im Kalender.

### 3.8 Aufgaben und Pendenzen
Einfache Aufgabenliste mit Verantwortlicher Person, Fälligkeit und Bereich; wiederkehrende Aufgaben (z. B. Reinigungsplan, Inventur, Impfausweise prüfen).

### 3.9 Dokumente und Mitteilungen
Ablage für Organisationshandbuch, Personalreglement, Anleitungen, Formulare. Mitteilungen der Geschäftsführung mit «Gelesen»-Bestätigung.

## 4. Datenmodell (Skizze)

In Firestore wird jede Tabelle zu einer Sammlung (z. B. `benutzer`, `buchungen`); die Rollen stehen direkt im Benutzer-Dokument (`rollen: [...]`).

```
benutzer        id, name, email, foto, pensum, aktiv
rolle           id, name                         (admin, geschaeftsfuehrung, leitung_pension, …)
benutzer_rolle  benutzer_id, rolle_id

kunde           id, name, adresse, telefon, email, notfallkontakt, tierarzt, notizen
hund            id, kunde_id, name, rasse, geburtsdatum, geschlecht, kastriert, foto,
                futter, menge, medikamente, allergien, verhalten, vertraeglich (bool), notizen
impfung         id, hund_id, art, datum, gueltig_bis
zimmer          id, name, groesse, max_hunde, aktiv
buchung         id, kunde_id, von, bis, status, preis, leistungen, bemerkung
buchung_hund    buchung_id, hund_id, zimmer_id
tagesplan       id, datum, hund_id, art (fuettern/medikament/gassi), erledigt_von, erledigt_um, notiz

fahrt           id, datum, zeit_von, zeit_bis, typ (abholen/bringen), buchung_id, adresse,
                fahrer_id, fahrzeug_id, status, notiz
fahrzeug        id, name, kennzeichen, km_stand, aktiv
fahrzeug_termin id, fahrzeug_id, art (reifen/service/mfk/versicherung/reparatur/reinigung), datum,
                garage, km_stand, kosten, beleg, notiz, erledigt, wiederholung (monate/km)

termin          id, titel, start, ende, ganztags, ebene, ort, beschreibung, erstellt_von
kanal           id, name, typ (gruppe/direkt);  kanal_mitglied   kanal_id, benutzer_id, gelesen_bis
nachricht       id, kanal_id, absender_id, text, anhang, zeit

dienst          id, benutzer_id, datum, von, bis, bereich
abwesenheit     id, benutzer_id, von, bis, art, status, freigegeben_von
aufgabe         id, titel, bereich, verantwortlich_id, faellig, wiederholung, erledigt
dokument        id, titel, datei, kategorie;   mitteilung   id, titel, text, gelesen_von[]

-- Laden (aus dem Ladenbuch übernommen)
kasse           standort (laden/pension) + datum (PK), erfasst_von, wechselgeld_anfang, bar, karte, twint, bar_ausgaben,
                gezaehlt, safebag_betrag, safebag_nr, abgeholt, abgeholt_am, notiz
uebergabe       id, datum, person, kategorie, text, erledigt
bestellung      id, typ, datum, person, artikel, menge, kunde, status
reklamation     id, datum, person, kunde, artikel, grund, loesung, betrag, status
loomis          id, typ, datum, person, betrag, notiz
wochenbericht   montag (PK), zahlen, texte
protokoll       id, art (team/kader), datum, inhalt
```

Jede Tabelle erhält zusätzlich `erstellt_am`, `erstellt_von`, `geaendert_am`. Wichtige Änderungen (Kasse, Buchungen) werden protokolliert, damit nachvollziehbar bleibt, wer was geändert hat.

## 5. Technik (Entscheid: Firebase)

Patrick hat am 18.10.2026 entschieden: Das Intranet wird wie das Salonbuch (haartist-salonbuch.web.app) als **Web-App auf Firebase** gebaut. Der eigene Server-PC (Entscheid vom 17.10.) entfällt damit.

| Baustein | Lösung | Warum |
|---|---|---|
| Oberfläche | **React + TypeScript (Vite)** als PWA | Läuft im Browser und auf dem Handy, installierbar wie eine App |
| Login | **Firebase Authentication** (E-Mail und Passwort) | Passwort-vergessen per E-Mail inklusive, kein eigener Server |
| Datenbank | **Cloud Firestore**, Standort `europe-west6` (Zürich) | Live-Aktualisierung (Belegungsplan, Chat) eingebaut, funktioniert kurz auch offline |
| Rechte | **Firestore-Sicherheitsregeln** (`firestore.rules`), mit automatischen Tests | Die Rollen werden auf dem Server geprüft, nicht nur in der Oberfläche |
| Hosting | **Firebase Hosting** unter `intranet.neluna.ch` | HTTPS gratis, Domain bleibt bei Hostfactory (nur DNS-Einträge) |
| Dateien (später) | Cloud Storage for Firebase | Fotos von Hunden, Dokumente |
| Push (später) | Firebase Cloud Messaging | Benachrichtigungen für Chat und Fahrten |
| Code | **GitHub-Repository** (privat) | Claude-Code-Threads arbeiten mit Pull Requests, Patrick gibt frei |

**Kosten:** Der kostenlose Spark-Tarif reicht für ein Team dieser Grösse. Erst für Cloud Storage (Fotos) oder serverseitige Funktionen braucht es den Blaze-Tarif (Abrechnung nach Verbrauch, bei dieser Nutzung voraussichtlich wenige Franken oder gratis).

**Was das für Patrick bedeutet:** Kein Server-PC, keine Updates, keine Datensicherung von Hand. Aktualisieren geht mit `npm run deploy`. Die Einrichtung steht in `docs/EINRICHTUNG.md`.

**Datenschutz (revDSG):** Die Daten liegen bei Google in Zürich (`europe-west6`). Für den Geschäftsbetrieb sollte der Auftragsverarbeitungsvertrag von Google Cloud in der Firebase-Konsole akzeptiert werden.

## 6. Fahrplan

| Phase | Inhalt | Ergebnis |
|---|---|---|
| **0 – Grundgerüst** | Repository, Projekt aufsetzen, Login, Benutzer und Rollen, Profile, Startseite, Layout im NeLuna-Look (Schwarz/Gold wie Ladenbuch) | Alle können sich anmelden |
| **1 – Laden** | Ladenbuch nachbauen, Daten übernehmen, Ladenbuch-Artefakt danach nur noch lesend | Kassenbuch im Intranet, Laden arbeitet nur noch dort |
| **2 – Pension** | Kunden- und Hundekartei, Zimmer, Buchungen, Belegungsplan, Tagesplan, Kassenbuch Pension | Cristina plant die Pension im Intranet |
| **3 – Fahrdienst und Kalender** | Fahrten aus Buchungen, Fahreransicht, Fahrzeuge mit Garagen- und Unterhaltsterminen, gemeinsamer Kalender | Ein Kalender für alles |
| **4 – Kommunikation** | Chat, Mitteilungen, Push-Benachrichtigungen | WhatsApp-Gruppen werden überflüssig |
| **5 – Personal und Organisation** | Dienstplan, Ferien, Aufgaben, Dokumente | Vollständiges Intranet |
| **später (Ideen)** | Online-Buchungsanfrage für Kundschaft, Rechnungen Pension, Impf-Erinnerungen per E-Mail, Auswertungen | – |

Jede Phase wird in einem eigenen Thread mit Claude Code umgesetzt, als Pull Request im Repository, und erst nach Patricks Freigabe live geschaltet.

## 7. Entscheidungen

Geklärt (17.10.2026):
- **Domain:** neluna.ch ist vorhanden, das Intranet läuft unter `intranet.neluna.ch`.
- **Zimmer:** 6 Zimmer, benannt «Zimmer 1» bis «Zimmer 6».
- **Hosting:** ~~eigener Server-PC~~ ersetzt am 18.10.2026 durch **Firebase** (siehe Abschnitt 5), wie das Salonbuch.
- **Domain-Anbieter:** neluna.ch wird bei Hostfactory verwaltet und bleibt dort. Für `intranet.neluna.ch` werden nur die DNS-Einträge eingetragen, die Firebase Hosting anzeigt.
- **Repository:** neues privates Repository `neluna-intranet`.
- **Reihenfolge:** egal, daher Laden zuerst (Ladenbuch ist bereits im Einsatz), danach Pension.

Geklärt (18.10.2026):
- **Firebase-Projekt:** Patrick legt ein neues Google-Konto für NeLuna an und darin das Projekt `neluna-intranet`.
- **Hunde pro Zimmer:** entscheidet das Team selbst. Im Intranet ist die Anzahl pro Zimmer einstellbar (Standard 1, Hunde derselben Familie dürfen zusammen).
- **Fahrdienst:** Laura Essinger und Nic Richter fahren, Patrick Schaub ist Backup.

Noch offen:
1. **Bestehende Daten der Pension:** Buchungsdaten (Software, Excel) liefert Patrick nach; blockiert den Start nicht.
