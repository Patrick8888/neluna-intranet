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
  { modul: "chat", titel: "Chat", beschreibung: "Gruppen und Direktnachrichten", phase: 4 },
  { modul: "personal", titel: "Personal", beschreibung: "Dienstplan, Ferien, Abwesenheiten", phase: 5 },
  { modul: "aufgaben", titel: "Aufgaben", beschreibung: "Pendenzen und wiederkehrende Aufgaben", phase: 5 },
  { modul: "dokumente", titel: "Dokumente", beschreibung: "Handbuch, Reglemente, Anleitungen", phase: 5 },
  { modul: "admin", titel: "Benutzer", beschreibung: "Profile, Rollen und Zugänge verwalten", pfad: "/admin/benutzer" },
];
