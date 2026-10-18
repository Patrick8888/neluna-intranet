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
  { modul: "pension", titel: "Hundepension", beschreibung: "Belegungsplan Zimmer 1–6, Hunde- und Kundenkartei", phase: 2 },
  { modul: "tagesplan", titel: "Tagesplan", beschreibung: "Füttern, Medikamente, Spaziergänge abhaken", phase: 2 },
  { modul: "fahrdienst", titel: "Fahrdienst", beschreibung: "Abhol- und Bringfahrten", phase: 3 },
  { modul: "kalender", titel: "Kalender", beschreibung: "Pension, Laden, Fahrten, Ferien, Sitzungen", phase: 3 },
  { modul: "chat", titel: "Chat", beschreibung: "Gruppen und Direktnachrichten", phase: 4 },
  { modul: "personal", titel: "Personal", beschreibung: "Dienstplan, Ferien, Abwesenheiten", phase: 5 },
  { modul: "aufgaben", titel: "Aufgaben", beschreibung: "Pendenzen und wiederkehrende Aufgaben", phase: 5 },
  { modul: "dokumente", titel: "Dokumente", beschreibung: "Handbuch, Reglemente, Anleitungen", phase: 5 },
  { modul: "admin", titel: "Benutzer", beschreibung: "Profile, Rollen und Zugänge verwalten", pfad: "/admin/benutzer" },
];
