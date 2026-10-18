// Rollen und Berechtigungen des Intranets.
// Quelle: Konzept, Abschnitt 2 «Berechtigungen». Änderungen an Rechten nur hier.

export const ROLLEN = {
  admin: "Admin",
  geschaeftsfuehrung: "Geschäftsführung",
  leitung_pension: "Leitung Pension",
  leitung_laden: "Leitung Laden",
  verkauf: "Verkauf",
  mitarbeit_pension: "Mitarbeit Pension",
  fahrdienst: "Fahrdienst",
} as const;

export type Rolle = keyof typeof ROLLEN;

export const ALLE_ROLLEN = Object.keys(ROLLEN) as Rolle[];

export function istRolle(wert: string): wert is Rolle {
  return wert in ROLLEN;
}

export const MODULE = {
  start: "Startseite",
  kalender: "Kalender",
  chat: "Chat",
  laden: "Laden",
  laden_wochenbericht: "Wochenbericht",
  sitzungen_team: "Sitzungen Team",
  sitzungen_kader: "Sitzungen Kader",
  pension: "Hundepension",
  tagesplan: "Tagesplan Pension",
  fahrdienst: "Fahrdienst",
  personal: "Personal",
  aufgaben: "Aufgaben",
  dokumente: "Dokumente",
  admin: "Verwaltung",
} as const;

export type Modul = keyof typeof MODULE;

// 0 = kein Zugriff, 1 = lesen, 2 = bearbeiten, 3 = verwalten/freigeben
export const STUFE = { keine: 0, lesen: 1, bearbeiten: 2, verwalten: 3 } as const;
export type Stufe = (typeof STUFE)[keyof typeof STUFE];

const { keine: K, lesen: L, bearbeiten: B, verwalten: V } = STUFE;

const MATRIX: Record<Exclude<Rolle, "admin">, Record<Modul, Stufe>> = {
  geschaeftsfuehrung: {
    start: V, kalender: V, chat: V, laden: V, laden_wochenbericht: V,
    sitzungen_team: V, sitzungen_kader: V, pension: V, tagesplan: V,
    fahrdienst: V, personal: V, aufgaben: V, dokumente: V, admin: K,
  },
  leitung_pension: {
    start: B, kalender: B, chat: B, laden: K, laden_wochenbericht: K,
    sitzungen_team: B, sitzungen_kader: B, pension: V, tagesplan: V,
    fahrdienst: V, personal: V, aufgaben: B, dokumente: L, admin: K,
  },
  leitung_laden: {
    start: B, kalender: B, chat: B, laden: V, laden_wochenbericht: B,
    sitzungen_team: B, sitzungen_kader: B, pension: L, tagesplan: K,
    fahrdienst: L, personal: V, aufgaben: B, dokumente: L, admin: K,
  },
  verkauf: {
    start: B, kalender: B, chat: B, laden: B, laden_wochenbericht: L,
    sitzungen_team: L, sitzungen_kader: K, pension: L, tagesplan: K,
    fahrdienst: L, personal: L, aufgaben: B, dokumente: L, admin: K,
  },
  mitarbeit_pension: {
    start: B, kalender: B, chat: B, laden: K, laden_wochenbericht: K,
    sitzungen_team: L, sitzungen_kader: K, pension: L, tagesplan: B,
    fahrdienst: B, personal: L, aufgaben: B, dokumente: L, admin: K,
  },
  fahrdienst: {
    start: B, kalender: B, chat: B, laden: K, laden_wochenbericht: K,
    sitzungen_team: L, sitzungen_kader: K, pension: L, tagesplan: K,
    fahrdienst: B, personal: L, aufgaben: B, dokumente: L, admin: K,
  },
};

/** Höchste Stufe, die eine Person mit diesen Rollen für ein Modul hat. */
export function stufe(rollen: readonly Rolle[], modul: Modul): Stufe {
  let max: Stufe = K;
  for (const rolle of rollen) {
    const s = rolle === "admin" ? (modul === "admin" ? V : K) : MATRIX[rolle][modul];
    if (s > max) max = s;
  }
  return max;
}

export function darf(rollen: readonly Rolle[], modul: Modul, mindestens: Stufe = L): boolean {
  return stufe(rollen, modul) >= mindestens;
}
