// Fachlogik des Ladenbuchs (Kasse, Wochenbericht, CSV). Unabhängig von Firebase, damit sie testbar bleibt.
import { datum, plusTage, r2, zahl } from "./format";

export type Standort = "laden";

export type Kasse = {
  id: string;
  standort: Standort;
  datum: string;
  person: string;
  uid?: string;
  anfang: number;
  bar: number;
  karte: number;
  twint: number;
  ausgaben: number;
  gezaehlt: number;
  safebagBetrag: number;
  safebagNr: string;
  notiz: string;
  total: number;
  soll: number;
  differenz: number;
  wechselgeldNeu: number;
  abgeholt: boolean;
  abgeholtAm: string;
};

export type Uebergabe = {
  id: string;
  datum: string;
  erstellt: string;
  person: string;
  uid?: string;
  kategorie: string;
  text: string;
  pendenz: boolean;
  wichtig: boolean;
  erledigt: boolean;
  erledigtVon?: string;
  erledigtAm?: string;
};

export type Bestellung = {
  id: string;
  typ: string;
  datum: string;
  erstellt: string;
  person: string;
  uid?: string;
  artikel: string;
  menge: string;
  lieferant: string;
  kunde: string;
  telefon: string;
  notiz: string;
  status: string;
};

export type Reklamation = {
  id: string;
  datum: string;
  erstellt: string;
  person: string;
  uid?: string;
  kunde: string;
  artikel: string;
  grund: string;
  loesung: string;
  betrag: number;
  status: string;
};

export type LoomisVorgang = {
  id: string;
  typ: string;
  datum: string;
  erstellt: string;
  person: string;
  uid?: string;
  betrag: number;
  notiz: string;
};

export type Wochenzahlen = {
  tage: number;
  total: number;
  bar: number;
  karte: number;
  twint: number;
  differenz: number;
  safebagsOffen: number;
  pendenzen: number;
  reklNeu: number;
  kundenOffen: number;
};

export type Wochenbericht = { id: string; woche: string; person: string; uid?: string; gespeichert: string; zahlen?: Wochenzahlen } & Partial<Record<WbFeld, string>>;

export const UEBERGABE_THEMEN = ["Info", "Kunde", "Lieferung", "Ware / Regal", "Technik / Kasse", "Reinigung"];
export const BESTELL_TYPEN = ["Kundenbestellung", "Nachbestellung"];
export const BESTELL_STATUS = ["Offen", "Bestellt", "Eingetroffen", "Abgeholt", "Storniert"];
export const REKLA_STATUS = ["Offen", "Beim Lieferanten", "Erledigt"];
export const REKLA_LOESUNGEN = ["Noch offen", "Umtausch", "Gutschrift", "Rückerstattung", "Reparatur / Lieferant", "Abgelehnt"];
export const LOOMIS_TYPEN = ["Wechselgeld bestellt", "Wechselgeld erhalten", "Sonstiges"];

export const WB_FELDER = [
  ["umsatz", "Umsatz & Verkauf", "Wie lief die Woche? Starke oder schwache Tage, Gründe, Aktionen"],
  ["personal", "Personal", "Absenzen, Überstunden, Einsatzplanung, Stimmung im Team"],
  ["sortiment", "Sortiment & Lieferanten", "Engpässe, Rückstände, Kundenwünsche, neue Artikel"],
  ["reklamationen", "Reklamationen & schwierige Fälle", "Was ist passiert, wie wurde es gelöst, was ist offen?"],
  ["laden", "Laden, Technik & Reinigung", "Defekte, Kasse, TORMAX, Reinigung, Sicherheit"],
  ["anliegen", "Anliegen an Nel und Pädi", "Entscheide oder Hilfe, die du brauchst"],
  ["naechste", "Schwerpunkte nächste Woche", "Was steht an?"],
] as const;
export type WbFeld = (typeof WB_FELDER)[number][0];

export const kasseId = (standort: Standort, tag: string) => `${standort}_${tag}`;

export type KasseEingabe = { anfang: number; bar: number; karte: number; twint: number; ausgaben: number; gezaehlt: number; safebag: number };

/** Tagesabschluss: Soll-Bargeld, Differenz, Wechselgeld für morgen und Tagesumsatz. */
export function kasseRechnen(v: KasseEingabe) {
  const soll = r2(v.anfang + v.bar - v.ausgaben);
  return {
    soll,
    differenz: r2(v.gezaehlt - soll),
    wechselgeldNeu: r2(v.gezaehlt - v.safebag),
    total: r2(v.bar + v.karte + v.twint),
  };
}

/** Wechselgeld vom letzten Abschluss vor diesem Tag. */
export function letztesWechselgeld(kasse: Kasse[], tag: string): number | null {
  const vorher = kasse.filter((k) => k.datum < tag).sort((a, b) => b.datum.localeCompare(a.datum))[0];
  return vorher ? vorher.wechselgeldNeu : null;
}

export function summe<T>(zeilen: T[], feld: keyof T): number {
  return r2(zeilen.reduce((s, z) => s + zahl(z[feld]), 0));
}

export function wochenzahlen(
  montag: string,
  d: { kasse: Kasse[]; uebergabe: Uebergabe[]; reklamationen: Reklamation[]; bestellungen: Bestellung[] },
): Wochenzahlen {
  const ende = plusTage(montag, 6);
  const k = d.kasse.filter((r) => r.datum >= montag && r.datum <= ende);
  return {
    tage: k.length,
    total: summe(k, "total"),
    bar: summe(k, "bar"),
    karte: summe(k, "karte"),
    twint: summe(k, "twint"),
    differenz: summe(k, "differenz"),
    safebagsOffen: k.filter((r) => zahl(r.safebagBetrag) > 0 && !r.abgeholt).length,
    pendenzen: d.uebergabe.filter((x) => x.pendenz && !x.erledigt).length,
    reklNeu: d.reklamationen.filter((x) => x.datum >= montag && x.datum <= ende).length,
    kundenOffen: d.bestellungen.filter((x) => x.typ === "Kundenbestellung" && !["Abgeholt", "Storniert"].includes(x.status)).length,
  };
}

/** Monats-CSV für die Treuhand (Semikolon, Excel-tauglich mit BOM). */
export function kasseCsv(zeilen: Kasse[]): string {
  const kopf = ["Datum", "Erfasst von", "Wechselgeld Anfang", "Bar", "Karte", "TWINT", "Total", "Bar-Ausgaben", "Soll-Bargeld", "Gezählt", "Differenz", "Safebag CHF", "Safebag-Nr", "Abgeholt Loomis", "Bemerkung"];
  const q = (x: unknown) => {
    const s = String(x ?? "");
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const n = (x: unknown) => (Number(x) || 0).toFixed(2);
  const sortiert = [...zeilen].sort((a, b) => a.datum.localeCompare(b.datum));
  const zeilenText = sortiert.map((r) =>
    [datum(r.datum), r.person, n(r.anfang), n(r.bar), n(r.karte), n(r.twint), n(r.total), n(r.ausgaben), n(r.soll), n(r.gezaehlt), n(r.differenz), n(r.safebagBetrag), r.safebagNr, r.abgeholt ? datum(r.abgeholtAm) : "", r.notiz]
      .map(q)
      .join(";"),
  );
  return "﻿" + [kopf.join(";"), ...zeilenText].join("\r\n");
}

/** Wochenbericht als Text zum Weiterleiten (WhatsApp, E-Mail). */
export function wochenberichtText(label: string, person: string, z: Wochenzahlen, felder: Partial<Record<WbFeld, string>>, chf: (n: number) => string): string {
  const zeilen = [
    `Wochenbericht ${label} – NeLuna's Pfötli Shop`,
    `Erstellt von: ${person || "–"}`,
    "",
    `Umsatz total CHF ${chf(z.total)} (Bar ${chf(z.bar)}, Karte ${chf(z.karte)}, TWINT ${chf(z.twint)})`,
    `Kassendifferenz CHF ${chf(z.differenz)} · ${z.tage} Tagesabschlüsse erfasst`,
    `Offene Pendenzen ${z.pendenzen} · neue Reklamationen ${z.reklNeu} · offene Kundenbestellungen ${z.kundenOffen}`,
  ];
  for (const [k, l] of WB_FELDER) {
    const v = felder[k]?.trim();
    if (v) zeilen.push("", l + ":", v);
  }
  return zeilen.join("\n");
}
