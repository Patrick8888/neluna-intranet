// Fachlogik der Hundepension (Zimmer, Belegung, Tagesplan, Kassenvorschlag). Unabhängig von Firebase, damit sie testbar bleibt.
import { datum, plusTage, r2, zahl } from "./format";

export type Zimmer = { id: string; name: string; maxHunde: number; aktiv: boolean; notiz: string };

export type Kunde = {
  id: string;
  name: string;
  telefon: string;
  email: string;
  adresse: string;
  notfallkontakt: string;
  tierarzt: string;
  notiz: string;
  erstellt?: string;
  person?: string;
  uid?: string;
};

export type Impfung = { art: string; gueltigBis: string };

export type Hund = {
  id: string;
  kundeId: string;
  name: string;
  rasse: string;
  geburtsdatum: string;
  geschlecht: string;
  kastriert: boolean;
  futter: string;
  menge: string;
  medikamente: string;
  allergien: string;
  verhalten: string;
  vertraeglich: boolean;
  notiz: string;
  impfungen: Impfung[];
  erstellt?: string;
  person?: string;
  uid?: string;
};

export const BUCHUNG_STATUS = ["Anfrage", "Bestätigt", "Eingecheckt", "Abgeholt", "Storniert"] as const;
export type BuchungStatus = (typeof BUCHUNG_STATUS)[number];

export const LEISTUNGEN = ["Fahrdienst Hinweg", "Fahrdienst Rückweg", "Baden", "Medikamente geben", "Eigenes Futter"];
export const ZAHLUNGSARTEN = ["Bar", "Karte", "TWINT", "Rechnung"] as const;
export type Zahlungsart = (typeof ZAHLUNGSARTEN)[number];
export const GESCHLECHTER = ["Rüde", "Hündin"];
export const IMPF_ARTEN = ["Kombi (DHPPi)", "Tollwut", "Zwingerhusten", "Leptospirose"];

export type Buchung = {
  id: string;
  kundeId: string;
  kundeName: string;
  hunde: { id: string; name: string }[];
  zimmerId: string;
  von: string;
  bis: string;
  status: BuchungStatus;
  leistungen: string[];
  preis: number;
  bemerkung: string;
  bezahlt: boolean;
  zahlungsart: Zahlungsart | "";
  betrag: number;
  bezahltAm: string;
  erstellt?: string;
  person?: string;
  uid?: string;
};

/** Die sechs Zimmer der Pension; was im Intranet gespeichert ist, geht vor. */
export const STANDARD_ZIMMER: Zimmer[] = Array.from({ length: 6 }, (_, i) => ({
  id: `zimmer-${i + 1}`,
  name: `Zimmer ${i + 1}`,
  maxHunde: 1,
  aktiv: true,
  notiz: "",
}));

export function zimmerListe(gespeichert: Zimmer[]): Zimmer[] {
  const alle = new Map(STANDARD_ZIMMER.map((z) => [z.id, z]));
  for (const z of gespeichert) alle.set(z.id, { ...alle.get(z.id), ...z });
  return [...alle.values()].sort((a, b) => a.name.localeCompare(b.name, "de", { numeric: true }));
}

/** Erster und letzter belegter Tag. Am Abholtag ist das Zimmer wieder frei; Tagesgäste belegen einen Tag. */
export function belegteTage(b: { von: string; bis: string }): [string, string] {
  return [b.von, b.bis > b.von ? plusTage(b.bis, -1) : b.von];
}

/** Ist der Hund an diesem Tag in der Pension (inkl. Ankunfts- und Abholtag)? */
export const istDa = (b: Buchung, tag: string) => b.von <= tag && tag <= b.bis && b.status !== "Storniert" && b.status !== "Anfrage";

const zaehlt = (b: Buchung) => b.status !== "Storniert";

export type Anfrage = { id?: string; zimmerId: string; von: string; bis: string; hundIds: string[] };

/** Prüft eine Buchung gegen die Belegung. Gibt eine verständliche Meldung zurück oder null, wenn alles passt. */
export function belegungPruefen(
  d: { buchungen: Buchung[]; zimmer: Zimmer[]; hunde: Hund[] },
  neu: Anfrage,
): string | null {
  if (!neu.von || !neu.bis) return "Bitte Ankunft und Abholung angeben.";
  if (neu.bis < neu.von) return "Die Abholung liegt vor der Ankunft.";
  if (!neu.hundIds.length) return "Bitte mindestens einen Hund wählen.";
  const zimmer = d.zimmer.find((z) => z.id === neu.zimmerId);
  if (!zimmer || !zimmer.aktiv) return "Dieses Zimmer ist nicht verfügbar.";
  if (neu.hundIds.length > zimmer.maxHunde) return `${zimmer.name} hat Platz für ${zimmer.maxHunde} ${zimmer.maxHunde === 1 ? "Hund" : "Hunde"}.`;

  const [start, ende] = belegteTage(neu);
  const ueberlappt = (b: Buchung) => {
    const [s, e] = belegteTage(b);
    return s <= ende && start <= e;
  };
  const andere = d.buchungen.filter((b) => b.id !== neu.id && zaehlt(b) && ueberlappt(b));
  const name = (id: string) => d.hunde.find((h) => h.id === id)?.name ?? "Ein Hund";

  for (const b of andere) {
    const doppelt = b.hunde.find((h) => neu.hundIds.includes(h.id));
    if (doppelt) {
      const z = d.zimmer.find((x) => x.id === b.zimmerId);
      return `«${doppelt.name}» ist in dieser Zeit schon gebucht (${z?.name ?? "anderes Zimmer"}, ${datum(b.von)}–${datum(b.bis)}).`;
    }
  }

  const imZimmer = andere.filter((b) => b.zimmerId === neu.zimmerId);
  for (let tag = start; tag <= ende; tag = plusTage(tag, 1)) {
    const belegt = imZimmer.filter((b) => {
      const [s, e] = belegteTage(b);
      return s <= tag && tag <= e;
    }).reduce((n, b) => n + b.hunde.length, 0);
    if (belegt + neu.hundIds.length > zimmer.maxHunde) {
      return `${zimmer.name} ist am ${datum(tag)} voll (${belegt} von ${zimmer.maxHunde} Plätzen belegt).`;
    }
  }

  // Hunde derselben Buchung (gleiche Familie) dürfen immer zusammen; mit fremden Hunden nur, wenn alle verträglich sind.
  if (imZimmer.length) {
    const alle = [...neu.hundIds, ...imZimmer.flatMap((b) => b.hunde.map((h) => h.id))];
    const unvertraeglich = alle.find((id) => d.hunde.find((h) => h.id === id)?.vertraeglich !== true);
    if (unvertraeglich) return `«${name(unvertraeglich)}» ist nicht als verträglich markiert und kann das Zimmer nicht teilen.`;
  }
  return null;
}

/** Impfungen, die vor dem Ende des Aufenthalts ablaufen oder fehlen. */
export function impfWarnungen(hund: Hund, bis: string, heute: string): string[] {
  if (!hund.impfungen?.length) return [`${hund.name}: keine Impfung erfasst`];
  return hund.impfungen
    .filter((i) => i.gueltigBis && i.gueltigBis < bis)
    .map((i) => `${hund.name}: ${i.art} ${i.gueltigBis < heute ? "abgelaufen am" : "läuft ab am"} ${datum(i.gueltigBis)}`);
}

export const TAGES_AUFGABEN = [
  ["fuettern_morgen", "Füttern morgens"],
  ["gassi_morgen", "Spaziergang morgens"],
  ["gassi_mittag", "Spaziergang mittags"],
  ["fuettern_abend", "Füttern abends"],
  ["gassi_abend", "Spaziergang abends"],
] as const;

/** Abhakliste eines Hundes für einen Tag; Medikamente nur, wenn welche erfasst sind. */
export function aufgabenFuer(hund: Pick<Hund, "medikamente">): [string, string][] {
  const liste: [string, string][] = TAGES_AUFGABEN.map(([k, l]) => [k, l]);
  if (hund.medikamente?.trim()) liste.push(["medikament", "Medikamente"]);
  return liste;
}

/** Bezahlte Check-outs eines Tages nach Zahlungsart, als Vorschlag für den Kassenabschluss. */
export function kassenVorschlag(buchungen: Buchung[], tag: string) {
  const bezahlt = buchungen.filter((b) => b.bezahlt && b.bezahltAm === tag && b.status !== "Storniert");
  const art = (a: Zahlungsart) => r2(bezahlt.filter((b) => b.zahlungsart === a).reduce((s, b) => s + zahl(b.betrag), 0));
  return { bar: art("Bar"), karte: art("Karte"), twint: art("TWINT"), rechnung: art("Rechnung"), anzahl: bezahlt.length };
}

/** Noten und Münzen in CHF zum Zählen der Kasse. */
export const STUECKELUNG = [200, 100, 50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05];

export function bargeldSumme(anzahl: Record<string, string | number>): number {
  return r2(STUECKELUNG.reduce((s, w) => s + w * Math.max(0, Math.floor(zahl(anzahl[String(w)]))), 0));
}

/** Anzahl Nächte (Tagesgast = 0). */
export function naechte(b: { von: string; bis: string }): number {
  return Math.max(0, Math.round((Date.parse(b.bis) - Date.parse(b.von)) / 864e5));
}
