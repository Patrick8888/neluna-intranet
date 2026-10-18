// Gemeinsamer Kalender: eigene Termine plus Einträge aus Pension, Fahrdienst, Fahrzeugen und Sitzungen.
import { plusTage } from "./format";
import type { Fahrt, Fahrzeug, FahrzeugTermin } from "./fahrdienst";
import type { Buchung } from "./pension";

export const EBENEN = ["Pension", "Fahrdienst", "Fahrzeuge", "Laden", "Sitzungen", "Personal", "Firma"] as const;
export type Ebene = (typeof EBENEN)[number];

/** Ebenen, für die man selbst Termine eintragen kann; die übrigen kommen aus den Modulen. */
export const EIGENE_EBENEN: Ebene[] = ["Laden", "Pension", "Personal", "Sitzungen", "Firma"];

export type Termin = {
  id: string;
  titel: string;
  datum: string;
  /** Letzter Tag bei mehrtägigen Terminen (z. B. Ferien, Messe); sonst gleich wie datum. */
  bis: string;
  zeit: string;
  zeitBis: string;
  ebene: Ebene;
  ort: string;
  beschreibung: string;
  erstellt?: string;
  person?: string;
  uid?: string;
};

export type Sitzung = { id: string; art: string; datum: string; zeit: string; ort: string };

export type Eintrag = {
  schluessel: string;
  datum: string;
  zeit: string;
  titel: string;
  info: string;
  ebene: Ebene;
  link?: string;
  termin?: Termin;
};

export type Quellen = {
  termine: Termin[];
  buchungen: Buchung[];
  fahrten: Fahrt[];
  fahrzeugTermine: FahrzeugTermin[];
  fahrzeuge: Fahrzeug[];
  sitzungen: Sitzung[];
};

const imZeitraum = (d: string, von: string, bis: string) => von <= d && d <= bis;
const namen = (h: { name: string }[]) => h.map((x) => x.name).join(", ");

/** Alle Einträge zwischen von und bis (je inklusive), sortiert nach Tag und Zeit. */
export function kalenderEintraege(q: Quellen, von: string, bis: string): Eintrag[] {
  const liste: Eintrag[] = [];

  for (const t of q.termine) {
    const ende = t.bis && t.bis >= t.datum ? t.bis : t.datum;
    const mehrtaegig = ende > t.datum;
    for (let tag = t.datum < von ? von : t.datum; tag <= ende && tag <= bis; tag = plusTage(tag, 1)) {
      liste.push({
        schluessel: `t-${t.id}-${tag}`, datum: tag, zeit: tag === t.datum ? t.zeit : "", titel: t.titel, ebene: t.ebene, termin: t,
        info: [t.zeitBis && tag === t.datum ? `bis ${t.zeitBis}` : "", t.ort, mehrtaegig ? `bis ${ende.slice(8)}.${ende.slice(5, 7)}.` : ""].filter(Boolean).join(" · "),
      });
    }
  }

  for (const b of q.buchungen) {
    if (b.status === "Storniert" || b.status === "Anfrage") continue;
    const link = `/pension/belegung?buchung=${b.id}`;
    if (imZeitraum(b.von, von, bis)) liste.push({ schluessel: `a-${b.id}`, datum: b.von, zeit: "", titel: `Ankunft ${namen(b.hunde)}`, info: b.kundeName, ebene: "Pension", link });
    if (b.bis !== b.von && imZeitraum(b.bis, von, bis)) liste.push({ schluessel: `h-${b.id}`, datum: b.bis, zeit: "", titel: `Abholung ${namen(b.hunde)}`, info: b.kundeName, ebene: "Pension", link });
  }

  for (const f of q.fahrten) {
    if (f.status === "Abgesagt" || !imZeitraum(f.datum, von, bis)) continue;
    liste.push({
      schluessel: `f-${f.id}`, datum: f.datum, zeit: f.zeit, titel: `Fahrt ${f.richtung}: ${namen(f.hunde) || f.kundeName}`,
      info: [f.fahrerName || "ohne Fahrer/in", f.fahrzeugName, f.status === "Erledigt" ? "erledigt" : ""].filter(Boolean).join(" · "),
      ebene: "Fahrdienst", link: `/fahrdienst/plan?fahrt=${f.id}`,
    });
  }

  for (const t of q.fahrzeugTermine) {
    if (!imZeitraum(t.datum, von, bis) || (t.faelligKm > 0 && !t.wiederholungMonate && !t.erledigt)) continue;
    const fz = q.fahrzeuge.find((x) => x.id === t.fahrzeugId);
    liste.push({
      schluessel: `g-${t.id}`, datum: t.datum, zeit: t.zeit, titel: `${t.art} ${fz?.name ?? ""}`.trim(),
      info: [t.garage, t.erledigt ? "erledigt" : t.blockiert ? "Fahrzeug nicht verfügbar" : ""].filter(Boolean).join(" · "),
      ebene: "Fahrzeuge", link: `/fahrdienst/fahrzeuge?fahrzeug=${t.fahrzeugId}`,
    });
  }

  for (const s of q.sitzungen) {
    if (!imZeitraum(s.datum, von, bis)) continue;
    liste.push({ schluessel: `s-${s.id}`, datum: s.datum, zeit: s.zeit, titel: s.art, info: s.ort, ebene: "Sitzungen", link: "/sitzungen" });
  }

  return liste.sort((a, b) => a.datum.localeCompare(b.datum) || a.zeit.localeCompare(b.zeit) || a.titel.localeCompare(b.titel, "de"));
}

/** Die Tage, die eine Monatsansicht zeigt: von Montag vor dem 1. bis Sonntag nach dem Monatsende. */
export function monatsRaster(monat: string): string[] {
  const erster = `${monat}-01`;
  const wt = (new Date(erster + "T12:00:00Z").getUTCDay() + 6) % 7;
  const start = plusTage(erster, -wt);
  const [j, m] = monat.split("-").map(Number);
  const letzter = new Date(Date.UTC(j, m, 0, 12)).toISOString().slice(0, 10);
  const tage: string[] = [];
  for (let t = start; t <= letzter || tage.length % 7; t = plusTage(t, 1)) tage.push(t);
  return tage;
}

export function monatPlus(monat: string, n: number): string {
  const [j, m] = monat.split("-").map(Number);
  return new Date(Date.UTC(j, m - 1 + n, 15)).toISOString().slice(0, 7);
}
