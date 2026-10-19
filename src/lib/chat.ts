// Fachlogik von Chat und Mitteilungen. Unabhängig von Firebase, damit sie testbar bleibt.
import type { Rolle } from "./rollen";

/** Gruppen des Chats; wer drin ist, ergibt sich aus den Rollen (spiegelt firestore.rules). */
export const GRUPPEN = [
  { id: "alle", titel: "Alle", rollen: ["geschaeftsfuehrung", "leitung_pension", "leitung_laden", "verkauf", "mitarbeit_pension", "fahrdienst"] },
  { id: "pension", titel: "Pension", rollen: ["geschaeftsfuehrung", "leitung_pension", "mitarbeit_pension", "fahrdienst"] },
  { id: "laden", titel: "Laden", rollen: ["geschaeftsfuehrung", "leitung_laden", "verkauf"] },
  { id: "leitung", titel: "Geschäftsführung und Leitungen", rollen: ["geschaeftsfuehrung", "leitung_pension", "leitung_laden"] },
] as const satisfies readonly { id: string; titel: string; rollen: readonly Rolle[] }[];

export type GruppenId = (typeof GRUPPEN)[number]["id"];

export const gruppenFuer = (rollen: readonly Rolle[]) => GRUPPEN.filter((g) => g.rollen.some((r) => rollen.includes(r as Rolle)));

/** Direktnachrichten: eine feste ID pro Paar, unabhängig davon, wer zuerst schreibt. */
export const dmId = (a: string, b: string) => `dm_${[a, b].sort().join("_")}`;

/** Die andere Person einer Direktnachricht, oder null bei einer Gruppe. */
export function dmPartner(kanal: string, ich: string): string | null {
  const t = kanal.split("_");
  if (t[0] !== "dm" || t.length !== 3) return null;
  return t[1] === ich ? t[2] : t[2] === ich ? t[1] : null;
}

/** Stand eines Kanals: die letzte Nachricht (Zeit in Millisekunden). */
export type KanalStand = { id: string; letzte: number; letzterText: string; letztePerson: string; letzteUid: string };

export type Nachricht = { id: string; text: string; uid: string; person: string; zeit: number; bildId?: string };

/** Ungelesen ist ein Kanal, wenn jemand anderes seit dem letzten Lesen geschrieben hat. */
export const ungelesen = (k: KanalStand | undefined, gelesen: Record<string, number>, ich: string) =>
  !!k && k.letzte > 0 && k.letzteUid !== ich && k.letzte > (gelesen[k.id] ?? 0);

/** Kurzvorschau für Liste und Benachrichtigung. */
export function vorschau(text: string, bild: boolean, max = 80): string {
  const t = text.replace(/\s+/g, " ").trim();
  const s = t || (bild ? "Foto" : "");
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** Nachrichten nach Tagen gruppieren (für die Datumszeilen im Verlauf). */
export function nachTagen<T extends { zeit: number }>(liste: T[], tag: (ms: number) => string): { tag: string; nachrichten: T[] }[] {
  const out: { tag: string; nachrichten: T[] }[] = [];
  for (const n of liste) {
    const t = tag(n.zeit);
    if (out.at(-1)?.tag !== t) out.push({ tag: t, nachrichten: [] });
    out.at(-1)!.nachrichten.push(n);
  }
  return out;
}

export type Mitteilung = {
  id: string;
  titel: string;
  text: string;
  wichtig: boolean;
  erstellt: string;
  person: string;
  uid: string;
  /** uid → Zeitpunkt der Bestätigung «Gelesen». */
  gelesen: Record<string, string>;
};

/** Mitteilungen, die diese Person noch nicht bestätigt hat (die eigenen zählen als gelesen). */
export const offeneMitteilungen = (liste: Mitteilung[], ich: string) => liste.filter((m) => m.uid !== ich && !m.gelesen?.[ich]);

/** Wer im Team eine Mitteilung noch nicht bestätigt hat. */
export const nochNichtGelesen = <P extends { uid: string }>(m: Mitteilung, team: P[]) => team.filter((p) => p.uid !== m.uid && !m.gelesen?.[p.uid]);
