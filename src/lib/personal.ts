// Fachlogik von Dienstplan und Abwesenheiten. Unabhängig von Firebase, damit sie testbar bleibt.
import { plusTage } from "./format";
import type { Rolle } from "./rollen";

// ---------- Dienstplan ----------

export const DIENST_BEREICHE = { laden: "Laden", pension: "Pension", fahrdienst: "Fahrdienst" } as const;
export type DienstBereich = keyof typeof DIENST_BEREICHE;

/** Wer im Wochenplan eines Bereichs als Zeile erscheint (die Geschäftsführung springt überall ein). */
export const DIENST_ROLLEN: Record<DienstBereich, readonly Rolle[]> = {
  laden: ["geschaeftsfuehrung", "leitung_laden", "verkauf"],
  pension: ["geschaeftsfuehrung", "leitung_pension", "mitarbeit_pension"],
  fahrdienst: ["geschaeftsfuehrung", "fahrdienst"],
};

/** Wer den Plan eines Bereichs schreibt (spiegelt «dienstplanBearbeiten» in firestore.rules). */
export function dienstplanBearbeiten(rollen: readonly Rolle[], bereich: DienstBereich): boolean {
  if (rollen.includes("geschaeftsfuehrung")) return true;
  if (bereich === "laden") return rollen.includes("leitung_laden");
  return rollen.includes("leitung_pension");
}

export type Dienst = {
  id: string;
  datum: string;
  bereich: DienstBereich;
  mitarbeiterUid: string;
  mitarbeiterName: string;
  von: string;
  bis: string;
  notiz: string;
  erstellt?: string;
  person?: string;
  uid?: string;
};

/** Dauer eines Dienstes in Stunden («08:00»–«12:30» = 4.5). */
export function stunden(von: string, bis: string): number {
  const min = (z: string) => Number(z.slice(0, 2)) * 60 + Number(z.slice(3, 5));
  if (!/^\d{2}:\d{2}$/.test(von) || !/^\d{2}:\d{2}$/.test(bis)) return 0;
  return Math.max(0, min(bis) - min(von)) / 60;
}

export const stundenText = (h: number) => `${h.toLocaleString("de-CH", { maximumFractionDigits: 2 })} h`;

/** Die Dienste der Vorwoche eine Woche später, ohne Doppelte und ohne Personen, die dann abwesend sind. */
export function vorwocheUebernehmen(dienste: Dienst[], abwesenheiten: Abwesenheit[], bereich: DienstBereich, montag: string): Omit<Dienst, "id">[] {
  const vorher = plusTage(montag, -7);
  const neu: Omit<Dienst, "id">[] = [];
  for (const d of dienste) {
    if (d.bereich !== bereich || d.datum < vorher || d.datum >= montag) continue;
    const tag = plusTage(d.datum, 7);
    if (dienste.some((x) => x.bereich === bereich && x.datum === tag && x.mitarbeiterUid === d.mitarbeiterUid && x.von === d.von)) continue;
    if (abwesendAm(abwesenheiten, d.mitarbeiterUid, tag)) continue;
    neu.push({ datum: tag, bereich, mitarbeiterUid: d.mitarbeiterUid, mitarbeiterName: d.mitarbeiterName, von: d.von, bis: d.bis, notiz: d.notiz });
  }
  return neu;
}

// ---------- Ferien und Abwesenheiten ----------

export const ABWESENHEIT_ARTEN = ["Ferien", "Frei", "Weiterbildung", "Krank", "Unfall", "Militär/Zivilschutz", "Anderes"] as const;
export type AbwesenheitArt = (typeof ABWESENHEIT_ARTEN)[number];

/** Gesundheitsdaten: das übrige Team sieht nur «Abwesend». */
export const VERTRAULICHE_ARTEN: readonly AbwesenheitArt[] = ["Krank", "Unfall"];

export const ABWESENHEIT_STATUS = ["Beantragt", "Bewilligt", "Abgelehnt"] as const;
export type AbwesenheitStatus = (typeof ABWESENHEIT_STATUS)[number];

/** Wer freigibt: Laden die Leitung Laden, Pension (mit Fahrdienst) die Leitung Pension, die Geschäftsführung untereinander. */
export type AbwesenheitBereich = "laden" | "pension" | "firma";

export type Abwesenheit = {
  id: string;
  mitarbeiterUid: string;
  mitarbeiterName: string;
  bereich: AbwesenheitBereich;
  art: AbwesenheitArt;
  von: string;
  bis: string;
  notiz: string;
  status: AbwesenheitStatus;
  entscheidUid: string;
  entscheidName: string;
  entscheidAm: string;
  antwort: string;
  erstellt?: string;
  person?: string;
  uid?: string;
};

/** Bereich für die Freigabe aus den Rollen der Person (spiegelt «abwesenheitBereichOk» in firestore.rules). */
export function abwesenheitBereich(rollen: readonly string[]): AbwesenheitBereich {
  if (rollen.includes("geschaeftsfuehrung")) return "firma";
  if (rollen.some((r) => r === "leitung_laden" || r === "verkauf")) return "laden";
  return "pension";
}

/** Darf diese Person den Antrag bewilligen oder ablehnen? Leitungen nicht ihre eigenen. */
export function darfFreigeben(rollen: readonly Rolle[], uid: string, a: Pick<Abwesenheit, "bereich" | "mitarbeiterUid">): boolean {
  if (rollen.includes("geschaeftsfuehrung")) return true;
  if (a.mitarbeiterUid === uid) return false;
  return (a.bereich === "laden" && rollen.includes("leitung_laden")) || (a.bereich === "pension" && rollen.includes("leitung_pension"));
}

/** Grund und Notiz sieht nur die Person selbst und wer ihre Anträge freigibt. */
export const siehtDetails = (rollen: readonly Rolle[], ich: string, a: Pick<Abwesenheit, "bereich" | "mitarbeiterUid">) =>
  a.mitarbeiterUid === ich || darfFreigeben(rollen, ich, a);

/** Bezeichnung für die Anzeige: Krankheit und Unfall sehen die übrigen nur als «Abwesend». */
export const artFuer = (a: Pick<Abwesenheit, "art" | "bereich" | "mitarbeiterUid">, rollen: readonly Rolle[], ich: string) =>
  !VERTRAULICHE_ARTEN.includes(a.art) || siehtDetails(rollen, ich, a) ? a.art : "Abwesend";

/** Bewilligte Abwesenheit einer Person an einem Tag. */
export function abwesendAm(liste: Abwesenheit[], uid: string, tag: string): Abwesenheit | undefined {
  return liste.find((a) => a.status === "Bewilligt" && a.mitarbeiterUid === uid && a.von <= tag && tag <= a.bis);
}

/** Arbeitstage Montag bis Freitag zwischen von und bis (je inklusive). */
export function werktage(von: string, bis: string): number {
  let n = 0;
  for (let t = von; t <= bis; t = plusTage(t, 1)) {
    const wt = new Date(t + "T12:00:00Z").getUTCDay();
    if (wt !== 0 && wt !== 6) n++;
  }
  return n;
}

/** Bewilligte Ferientage (Mo–Fr) einer Person in einem Jahr; Ferien über den Jahreswechsel zählen anteilig. */
export function ferientage(liste: Abwesenheit[], uid: string, jahr: string): number {
  return liste
    .filter((a) => a.mitarbeiterUid === uid && a.art === "Ferien" && a.status === "Bewilligt")
    .reduce((s, a) => {
      const von = a.von < `${jahr}-01-01` ? `${jahr}-01-01` : a.von;
      const bis = a.bis > `${jahr}-12-31` ? `${jahr}-12-31` : a.bis;
      return von <= bis ? s + werktage(von, bis) : s;
    }, 0);
}

/** Überschneidet sich der Antrag mit bewilligten oder beantragten Abwesenheiten anderer aus demselben Bereich? */
export function ueberschneidungen(liste: Abwesenheit[], a: Pick<Abwesenheit, "id" | "bereich" | "mitarbeiterUid" | "von" | "bis">): Abwesenheit[] {
  return liste.filter((x) => x.id !== a.id && x.mitarbeiterUid !== a.mitarbeiterUid && x.bereich === a.bereich && x.status !== "Abgelehnt" && x.von <= a.bis && a.von <= x.bis);
}
