// Fachlogik von Fahrdienst und Fahrzeugen. Unabhängig von Firebase, damit sie testbar bleibt.
import { plusTage } from "./format";
import type { Buchung, Kunde } from "./pension";

export const FAHRT_STATUS = ["Geplant", "Unterwegs", "Erledigt", "Abgesagt"] as const;
export type FahrtStatus = (typeof FAHRT_STATUS)[number];

/** Hinweg: Hund beim Halter abholen und in die Pension bringen. Rückweg: Hund nach Hause bringen. */
export const RICHTUNGEN = ["Hinweg", "Rückweg"] as const;
export type Richtung = (typeof RICHTUNGEN)[number];

export type Fahrt = {
  id: string;
  datum: string;
  zeit: string;
  richtung: Richtung;
  buchungId: string;
  kundeName: string;
  telefon: string;
  adresse: string;
  hunde: { id: string; name: string }[];
  fahrerUid: string;
  fahrerName: string;
  fahrzeugId: string;
  fahrzeugName: string;
  status: FahrtStatus;
  notiz: string;
  erstellt?: string;
  person?: string;
  uid?: string;
};

export type Fahrzeug = { id: string; name: string; kennzeichen: string; kmStand: number; aktiv: boolean; notiz: string };

export const TERMIN_ARTEN = ["Reifenwechsel", "Service", "MFK", "Versicherung", "Vignette", "Reparatur", "Reinigung Hundeboxen", "Anderes"] as const;
export type TerminArt = (typeof TERMIN_ARTEN)[number];

/** Vorschlag, wann ein Termin wiederkommt (Monate); im Formular änderbar. */
export const STANDARD_WIEDERHOLUNG: Record<TerminArt, number> = {
  Reifenwechsel: 6, Service: 12, MFK: 0, Versicherung: 12, Vignette: 12, Reparatur: 0, "Reinigung Hundeboxen": 1, Anderes: 0,
};

export type FahrzeugTermin = {
  id: string;
  fahrzeugId: string;
  art: TerminArt;
  datum: string;
  zeit: string;
  garage: string;
  kosten: number;
  kmStand: number;
  /** Service nach Kilometern: fällig bei diesem Stand (0 = keiner). */
  faelligKm: number;
  /** Fahrzeug ist an diesem Tag in der Garage und nicht für den Fahrdienst verfügbar. */
  blockiert: boolean;
  wiederholungMonate: number;
  wiederholungKm: number;
  notiz: string;
  erledigt: boolean;
  erledigtAm: string;
  erstellt?: string;
  person?: string;
  uid?: string;
};

export const fahrtId = (buchungId: string, richtung: Richtung) => `b_${buchungId}_${richtung === "Hinweg" ? "hin" : "rueck"}`;

const LEISTUNG: Record<Richtung, string> = { Hinweg: "Fahrdienst Hinweg", "Rückweg": "Fahrdienst Rückweg" };

export type Vorschlag = Omit<Fahrt, "fahrerUid" | "fahrerName" | "fahrzeugId" | "fahrzeugName" | "erstellt" | "person" | "uid">;

/**
 * Fahrten, die laut Buchung nötig sind, aber noch nicht eingeplant wurden,
 * und eingeplante Fahrten, die nicht mehr zur Buchung passen (Datum geändert, storniert).
 */
export function fahrtenAusBuchungen(buchungen: Buchung[], fahrten: Fahrt[], kunden: Kunde[], ab: string) {
  const vorhanden = new Map(fahrten.map((f) => [f.id, f]));
  const fehlend: Vorschlag[] = [];
  const abweichend: { fahrt: Fahrt; grund: string; datum?: string }[] = [];
  for (const b of buchungen) {
    for (const richtung of RICHTUNGEN) {
      const id = fahrtId(b.id, richtung);
      const f = vorhanden.get(id);
      const soll = richtung === "Hinweg" ? b.von : b.bis;
      const noetig = b.leistungen.includes(LEISTUNG[richtung]) && b.status !== "Storniert" && b.status !== "Anfrage";
      if (!f) {
        if (!noetig || soll < ab) continue;
        const k = kunden.find((x) => x.id === b.kundeId);
        fehlend.push({
          id, datum: soll, zeit: "", richtung, buchungId: b.id, kundeName: b.kundeName, telefon: k?.telefon ?? "", adresse: k?.adresse ?? "",
          hunde: b.hunde, status: "Geplant", notiz: "",
        });
      } else if (f.status === "Geplant" || f.status === "Unterwegs") {
        if (!noetig) abweichend.push({ fahrt: f, grund: b.status === "Storniert" ? "Buchung storniert" : "Fahrdienst nicht mehr gebucht" });
        else if (f.datum !== soll) abweichend.push({ fahrt: f, grund: `Buchung geändert: ${richtung === "Hinweg" ? "Ankunft" : "Abholung"} neu am`, datum: soll });
      }
    }
  }
  fehlend.sort((a, b) => a.datum.localeCompare(b.datum));
  return { fehlend, abweichend };
}

/** Garagentermin, der das Fahrzeug an diesem Tag blockiert. */
export function fahrzeugBlockiert(termine: FahrzeugTermin[], fahrzeugId: string, tag: string): FahrzeugTermin | undefined {
  return termine.find((t) => t.fahrzeugId === fahrzeugId && t.blockiert && t.datum === tag);
}

/** Prüft eine Fahrt; gibt eine verständliche Meldung zurück oder null. */
export function fahrtPruefen(f: Pick<Fahrt, "datum" | "fahrzeugId" | "adresse" | "status">, fahrzeuge: Fahrzeug[], termine: FahrzeugTermin[]): string | null {
  if (!f.datum) return "Bitte ein Datum angeben.";
  if (!f.adresse.trim()) return "Bitte eine Adresse angeben.";
  if (!f.fahrzeugId || f.status === "Abgesagt") return null;
  const fz = fahrzeuge.find((x) => x.id === f.fahrzeugId);
  if (!fz || !fz.aktiv) return "Dieses Fahrzeug ist nicht in Betrieb.";
  const t = fahrzeugBlockiert(termine, f.fahrzeugId, f.datum);
  if (t) return `${fz.name} ist an diesem Tag in der Garage (${t.art}${t.garage ? `, ${t.garage}` : ""}).`;
  return null;
}

/** Datum plus Monate; der Tag wird auf das Monatsende begrenzt (31.1. + 1 Monat = 28./29.2.). */
export function plusMonate(d: string, n: number): string {
  const [j, m, t] = d.split("-").map(Number);
  const ziel = new Date(Date.UTC(j, m - 1 + n, 1, 12));
  const letzter = new Date(Date.UTC(ziel.getUTCFullYear(), ziel.getUTCMonth() + 1, 0, 12)).getUTCDate();
  ziel.setUTCDate(Math.min(t, letzter));
  return ziel.toISOString().slice(0, 10);
}

/** Der nächste Termin einer wiederkehrenden Art, oder null, wenn er nicht wiederkommt. */
export function naechsterTermin(t: FahrzeugTermin, kmJetzt: number): Omit<FahrzeugTermin, "id"> | null {
  if (!t.wiederholungMonate && !t.wiederholungKm) return null;
  const { id: _id, ...rest } = t;
  return {
    ...rest,
    datum: t.wiederholungMonate ? plusMonate(t.datum, t.wiederholungMonate) : t.datum,
    zeit: "",
    faelligKm: t.wiederholungKm ? Math.max(t.kmStand, kmJetzt) + t.wiederholungKm : 0,
    kosten: 0,
    kmStand: 0,
    notiz: "",
    erledigt: false,
    erledigtAm: "",
  };
}

export type Faellig = { termin: FahrzeugTermin; fahrzeug?: Fahrzeug; ueberfaellig: boolean; grund: string };

/** Offene Termine, die bald fällig sind: nach Datum (innert «tage») oder nach Kilometern (innert 1000 km). */
export function faelligeTermine(termine: FahrzeugTermin[], fahrzeuge: Fahrzeug[], heute: string, tage = 30): Faellig[] {
  const grenze = plusTage(heute, tage);
  const liste: Faellig[] = [];
  for (const t of termine) {
    if (t.erledigt) continue;
    const fz = fahrzeuge.find((x) => x.id === t.fahrzeugId);
    if (fz && !fz.aktiv) continue;
    const km = fz?.kmStand ?? 0;
    const perKm = t.faelligKm > 0 && km >= t.faelligKm - 1000;
    const perDatum = !!t.datum && t.datum <= grenze && !(t.faelligKm > 0 && !t.wiederholungMonate);
    if (!perKm && !perDatum) continue;
    const ueberfaellig = (perDatum && t.datum < heute) || (perKm && km >= t.faelligKm);
    liste.push({
      termin: t, fahrzeug: fz, ueberfaellig,
      grund: perKm && (!perDatum || km >= t.faelligKm) ? `fällig bei ${t.faelligKm.toLocaleString("de-CH")} km (jetzt ${km.toLocaleString("de-CH")} km)` : "",
    });
  }
  return liste.sort((a, b) => Number(b.ueberfaellig) - Number(a.ueberfaellig) || a.termin.datum.localeCompare(b.termin.datum));
}

/** Link, der die Adresse in der Karten-App öffnet. */
export const kartenLink = (adresse: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}`;

/** Fahrten eines Tages in Fahrreihenfolge: mit Zeit zuerst, dann ohne. */
export function tagesRoute(fahrten: Fahrt[], tag: string, fahrerUid?: string): Fahrt[] {
  return fahrten
    .filter((f) => f.datum === tag && f.status !== "Abgesagt" && (!fahrerUid || f.fahrerUid === fahrerUid))
    .sort((a, b) => (a.zeit || "99").localeCompare(b.zeit || "99") || a.kundeName.localeCompare(b.kundeName, "de"));
}
