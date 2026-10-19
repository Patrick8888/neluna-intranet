// Aufgaben und Pendenzen mit Zuständigkeit, Fälligkeit und Wiederholung.
import { plusTage } from "./format";
import { plusMonate } from "./fahrdienst";

export const AUFGABEN_BEREICHE = ["Laden", "Pension", "Fahrdienst", "Firma"] as const;
export type AufgabenBereich = (typeof AUFGABEN_BEREICHE)[number];

export const WIEDERHOLUNGEN = {
  "": "Einmalig",
  t1: "Täglich",
  w1: "Wöchentlich",
  w2: "Alle 2 Wochen",
  m1: "Monatlich",
  m3: "Vierteljährlich",
  m6: "Halbjährlich",
  m12: "Jährlich",
} as const;
export type Wiederholung = keyof typeof WIEDERHOLUNGEN;

export type Aufgabe = {
  id: string;
  titel: string;
  beschreibung: string;
  bereich: AufgabenBereich;
  /** Leer heisst: wer im Bereich gerade Zeit hat. */
  zustaendigUid: string;
  zustaendigName: string;
  /** «JJJJ-MM-TT» oder leer. */
  faellig: string;
  wiederholung: Wiederholung;
  erledigt: boolean;
  erledigtVon: string;
  erledigtAm: string;
  erstellt?: string;
  person?: string;
  uid?: string;
};

function schritt(d: string, w: Exclude<Wiederholung, "">): string {
  const n = Number(w.slice(1));
  if (w[0] === "t") return plusTage(d, n);
  if (w[0] === "w") return plusTage(d, 7 * n);
  return plusMonate(d, n);
}

/** Nächste Fälligkeit einer wiederkehrenden Aufgabe: im Takt ab der letzten Fälligkeit, aber nach heute. */
export function naechsteFaelligkeit(faellig: string, w: Wiederholung, heute: string): string {
  if (!w) return "";
  let d = schritt(faellig || heute, w);
  while (d <= heute) d = schritt(d, w);
  return d;
}

export type Gruppe = { titel: string; aufgaben: Aufgabe[]; warn?: boolean };

/** Offene Aufgaben nach Dringlichkeit gruppiert. */
export function nachFaelligkeit(liste: Aufgabe[], heute: string): Gruppe[] {
  const woche = plusTage(heute, 7);
  const g: Gruppe[] = [
    { titel: "Überfällig", aufgaben: [], warn: true },
    { titel: "Heute", aufgaben: [] },
    { titel: "Nächste 7 Tage", aufgaben: [] },
    { titel: "Später", aufgaben: [] },
    { titel: "Ohne Datum", aufgaben: [] },
  ];
  const sortiert = [...liste].sort((a, b) => a.faellig.localeCompare(b.faellig) || a.titel.localeCompare(b.titel, "de"));
  for (const a of sortiert) {
    if (!a.faellig) g[4].aufgaben.push(a);
    else if (a.faellig < heute) g[0].aufgaben.push(a);
    else if (a.faellig === heute) g[1].aufgaben.push(a);
    else if (a.faellig <= woche) g[2].aufgaben.push(a);
    else g[3].aufgaben.push(a);
  }
  return g.filter((x) => x.aufgaben.length);
}

/** Was eine Person heute angeht: ihr zugeteilt, offen, fällig bis heute. */
export const meineFaelligen = (liste: Aufgabe[], uid: string, heute: string) =>
  liste.filter((a) => !a.erledigt && a.zustaendigUid === uid && !!a.faellig && a.faellig <= heute);
