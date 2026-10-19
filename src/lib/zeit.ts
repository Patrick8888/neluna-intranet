// Zeiterfassung: Arbeitszeit pro Tag mit Pause, Monatssummen und Export für die Lohnabrechnung.
import { datum } from "./format";
import type { AbwesenheitBereich } from "./personal";

export type Zeiteintrag = {
  id: string;
  mitarbeiterUid: string;
  mitarbeiterName: string;
  bereich: AbwesenheitBereich;
  datum: string;
  von: string;
  /** Leer, solange die Person eingestempelt ist. */
  bis: string;
  /** Pause in Minuten. */
  pause: number;
  notiz: string;
  geaendertVon?: string;
  geaendertName?: string;
  erstellt?: string;
  person?: string;
  uid?: string;
};

const minuten = (z: string) => Number(z.slice(0, 2)) * 60 + Number(z.slice(3, 5));
const zeitOk = (z: string) => /^\d{2}:\d{2}$/.test(z);

/** Gearbeitete Minuten ohne Pause; offene Einträge zählen noch nicht. */
export function arbeitsMinuten(e: Pick<Zeiteintrag, "von" | "bis" | "pause">): number {
  if (!zeitOk(e.von) || !zeitOk(e.bis)) return 0;
  return Math.max(0, minuten(e.bis) - minuten(e.von) - (e.pause || 0));
}

/**
 * Mindestpause nach Arbeitsgesetz (Art. 15 ArG) für eine Präsenzzeit in Minuten.
 * Massgebend ist die Arbeitszeit ohne Pause: 9:30 Präsenz mit 30 Minuten Pause sind 9:00 Arbeit und genügen.
 */
export function mindestPause(praesenzMinuten: number): number {
  const soll = (arbeit: number) => (arbeit > 9 * 60 ? 60 : arbeit > 7 * 60 ? 30 : arbeit > 5.5 * 60 ? 15 : 0);
  return [0, 15, 30, 60].find((p) => p >= soll(praesenzMinuten - p)) ?? 60;
}

/** Hinweis, wenn die erfasste Pause kürzer ist als vorgeschrieben. */
export function pausenHinweis(e: Pick<Zeiteintrag, "von" | "bis" | "pause">): string {
  if (!zeitOk(e.von) || !zeitOk(e.bis)) return "";
  const soll = mindestPause(minuten(e.bis) - minuten(e.von));
  return (e.pause || 0) < soll ? `Mindestens ${soll} Minuten Pause vorgeschrieben` : "";
}

export const stdMin = (min: number) => {
  const v = min < 0 ? "−" : "";
  const m = Math.abs(Math.round(min));
  return `${v}${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`;
};

export const monatVon = (tag: string) => tag.slice(0, 7);

/** Erster und letzter Tag eines Monats «JJJJ-MM». */
export function monatsGrenzen(monat: string): [string, string] {
  const [j, m] = monat.split("-").map(Number);
  return [`${monat}-01`, new Date(Date.UTC(j, m, 0, 12)).toISOString().slice(0, 10)];
}

/** Summe der Minuten je Person. */
export function summeJePerson(liste: Zeiteintrag[]): Map<string, number> {
  const s = new Map<string, number>();
  for (const e of liste) s.set(e.mitarbeiterUid, (s.get(e.mitarbeiterUid) ?? 0) + arbeitsMinuten(e));
  return s;
}

const csvFeld = (x: string | number) => {
  const t = String(x);
  return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

/** CSV (Semikolon, für Excel Schweiz) mit einer Zeile pro Eintrag und Total je Person. */
export function zeitCsv(liste: Zeiteintrag[]): string {
  const zeilen = [["Person", "Datum", "Beginn", "Ende", "Pause (Min.)", "Stunden", "Notiz"]];
  const sortiert = [...liste].sort((a, b) => a.mitarbeiterName.localeCompare(b.mitarbeiterName, "de") || a.datum.localeCompare(b.datum) || a.von.localeCompare(b.von));
  for (const e of sortiert) {
    zeilen.push([e.mitarbeiterName, datum(e.datum), e.von, e.bis || "offen", String(e.pause || 0), (arbeitsMinuten(e) / 60).toFixed(2), e.notiz]);
  }
  for (const [uid, min] of summeJePerson(sortiert)) {
    const name = sortiert.find((e) => e.mitarbeiterUid === uid)?.mitarbeiterName ?? "";
    zeilen.push([`Total ${name}`, "", "", "", "", (min / 60).toFixed(2), ""]);
  }
  return "\uFEFF" + zeilen.map((z) => z.map(csvFeld).join(";")).join("\r\n");
}
