import type { Modul } from "./rollen";

export type Bereich = {
  modul: Modul;
  titel: string;
  beschreibung: string;
  /** Pfad, sobald der Bereich gebaut ist; sonst die geplante Phase. */
  pfad?: string;
  phase?: number;
};

// Reihenfolge = Reihenfolge in der Navigation und auf der Startseite.
export const BEREICHE: Bereich[] = [
  { modul: "laden", titel: "Laden", beschreibung: "Kassenbuch, Übergabe, Bestellungen, Reklamationen, Loomis, Wochenbericht", pfad: "/laden" },
  { modul: "sitzungen_team", titel: "Sitzungen", beschreibung: "Protokolle und Pendenzen der Team- und Kadersitzungen", pfad: "/sitzungen" },
  { modul: "pension", titel: "Hundepension", beschreibung: "Belegungsplan, Buchungen, Hunde- und Kundenkartei, Kassenbuch Willisdorf", pfad: "/pension" },
  { modul: "tagesplan", titel: "Tagesplan", beschreibung: "Füttern, Medikamente, Spaziergänge abhaken", pfad: "/pension/tagesplan" },
  { modul: "fahrdienst", titel: "Fahrdienst", beschreibung: "Abhol- und Bringfahrten, Fahrzeuge und Garagentermine", pfad: "/fahrdienst" },
  { modul: "kalender", titel: "Kalender", beschreibung: "Pension, Laden, Fahrten, Ferien, Sitzungen", pfad: "/kalender" },
  { modul: "chat", titel: "Chat", beschreibung: "Gruppen und Direktnachrichten, mit Fotos", pfad: "/chat" },
  { modul: "start", titel: "Mitteilungen", beschreibung: "Infos der Geschäftsführung mit Gelesen-Bestätigung", pfad: "/mitteilungen" },
  { modul: "personal", titel: "Personal", beschreibung: "Dienstplan, Zeiterfassung, Ferien, Abwesenheiten", pfad: "/personal" },
  { modul: "aufgaben", titel: "Aufgaben", beschreibung: "Pendenzen und wiederkehrende Aufgaben", pfad: "/aufgaben" },
  { modul: "dokumente", titel: "Dokumente", beschreibung: "Handbuch, Reglemente, Anleitungen", pfad: "/dokumente" },
  { modul: "admin", titel: "Benutzer", beschreibung: "Profile, Rollen und Zugänge verwalten", pfad: "/admin/benutzer" },
];
