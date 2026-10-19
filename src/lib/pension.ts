// Fachlogik der Hundepension (Zimmer, Belegung, Tagesplan, Kassenvorschlag). Unabhängig von Firebase, damit sie testbar bleibt.
import { datum, plusTage, r2, zahl } from "./format";

/** Gewichtsklassen der Hunde; pro Zimmer lässt sich einstellen, wie viele Hunde jeder Klasse Platz haben. */
export const GEWICHTSKLASSEN = [
  ["klein", "bis 25 kg"],
  ["mittel", "25–45 kg"],
  ["gross", "ab 45 kg"],
] as const;
export type Gewichtsklasse = (typeof GEWICHTSKLASSEN)[number][0];
export const klassenName = (k?: string) => GEWICHTSKLASSEN.find(([x]) => x === k)?.[1] ?? "";

/** Gewicht in kg (z. B. «28,5») einer Klasse zuordnen; leer, wenn nichts erkennbar ist. */
export function klasseAusGewicht(gewicht: string): Gewichtsklasse | "" {
  const kg = parseFloat(gewicht.replace(",", "."));
  if (!Number.isFinite(kg) || kg <= 0) return "";
  return kg < 25 ? "klein" : kg <= 45 ? "mittel" : "gross";
}

export type Zimmer = {
  id: string;
  name: string;
  /** Höchstens so viele Hunde, egal wie gross. */
  maxHunde: number;
  /** Plätze je Gewichtsklasse, wenn das Zimmer nur Hunde dieser Klasse hätte (0 = Klasse passt nicht). */
  plaetze?: Record<Gewichtsklasse, number>;
  aktiv: boolean;
  notiz: string;
};

export type Kunde = {
  id: string;
  name: string;
  telefon: string;
  email: string;
  adresse: string;
  notfallkontakt: string;
  tierarzt: string;
  notiz: string;
  telefon2?: string;
  versicherung?: string;
  /** Hunde des Teams (z. B. von Cristina oder Patrick und Nalan): nicht in der Abrechnung. */
  team?: boolean;
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
  gewicht?: string;
  gewichtsklasse?: Gewichtsklasse | "";
  chipnummer?: string;
  farbe?: string;
  fuetterungszeiten?: string;
  leckerli?: string;
  schlafplatz?: string;
  kommandos?: string;
  aengste?: string;
  spielverhalten?: string;
  freilauf?: string;
  laeufigkeit?: string;
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

const ZIMMER_NAMEN = [
  "Zimmer 1", "Zimmer 2", "Zimmer 3", "Zimmer 4", "Zimmer 5", "Zimmer 6",
  "Hundezimmer Hunde Mitarbeiter", "Zimmer Erika", "Zimmer Escobar", "Hinter Schiebetüre",
];

/** Die Zimmer der Pension; was im Intranet gespeichert ist, geht vor. */
export const STANDARD_ZIMMER: Zimmer[] = ZIMMER_NAMEN.map((name, i) => ({ id: `zimmer-${i + 1}`, name, maxHunde: 1, aktiv: true, notiz: "" }));

const zimmerNr = (id: string) => Number(id.replace(/\D/g, "")) || 0;

/** Zimmer in fester Reihenfolge (nach Nummer), damit umbenannte Zimmer nicht springen. */
export function zimmerListe(gespeichert: Zimmer[]): Zimmer[] {
  const alle = new Map(STANDARD_ZIMMER.map((z) => [z.id, z]));
  for (const z of gespeichert) alle.set(z.id, { ...alle.get(z.id), ...z });
  return [...alle.values()].sort((a, b) => zimmerNr(a.id) - zimmerNr(b.id));
}

/** Plätze für einen Hund dieser Klasse; ohne Klasse oder ohne Einstellung gilt die Gesamtzahl. */
export function platzFuer(z: Zimmer, klasse?: string): number {
  const k = GEWICHTSKLASSEN.find(([x]) => x === klasse)?.[0];
  return k && z.plaetze ? Math.min(z.plaetze[k], z.maxHunde) : z.maxHunde;
}

/** Wie voll ein Zimmer mit diesen Hunden ist (1 = voll). Ein Hund ab 45 kg in einem Zimmer «1 gross» füllt es ganz. */
export function auslastung(z: Zimmer, klassen: (string | undefined)[]): number {
  return klassen.reduce((s, k) => s + 1 / platzFuer(z, k), 0);
}

export function platzText(z: Zimmer): string {
  if (!z.plaetze) return `${z.maxHunde} ${z.maxHunde === 1 ? "Hund" : "Hunde"}`;
  return GEWICHTSKLASSEN.map(([k, name]) => `${platzFuer(z, k)} ${name}`).join(" · ");
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
  const klasse = (id: string) => d.hunde.find((h) => h.id === id)?.gewichtsklasse;
  const zuGross = neu.hundIds.find((id) => platzFuer(zimmer, klasse(id)) < 1);
  if (zuGross) return `«${d.hunde.find((h) => h.id === zuGross)?.name ?? "Ein Hund"}» (${klassenName(klasse(zuGross))}) passt nicht in ${zimmer.name}.`;
  // Kleine Toleranz, weil 1/3 + 1/3 + 1/3 in Gleitkomma nicht ganz 1 ergibt.
  const voll = (ids: string[]) => auslastung(zimmer, ids.map(klasse)) > 1.000001;
  if (voll(neu.hundIds)) return `${zimmer.name} ist für diese Hunde zu klein (${platzText(zimmer)}).`;

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
    const da = imZimmer.filter((b) => {
      const [s, e] = belegteTage(b);
      return s <= tag && tag <= e;
    }).flatMap((b) => b.hunde.map((h) => h.id));
    if (da.length + neu.hundIds.length > zimmer.maxHunde) {
      return `${zimmer.name} ist am ${datum(tag)} voll (${da.length} von ${zimmer.maxHunde} Plätzen belegt).`;
    }
    if (voll([...da, ...neu.hundIds])) {
      return `${zimmer.name} ist am ${datum(tag)} voll: zu wenig Platz für diese Grösse (${platzText(zimmer)}).`;
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

// Spaziergänge stehen bewusst nicht auf der Liste (Entscheid 19.10.2026).
export const TAGES_AUFGABEN = [
  ["fuettern_morgen", "Füttern morgens"],
  ["fuettern_abend", "Füttern abends"],
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

export type AbrechnungZeile = {
  kunde: string;
  hund: string;
  /** Übernachtungen im Monat (Ferienbetreuung). */
  naechte: number;
  /** Anwesende Tage im Monat, Ankunfts- und Abholtag mitgezählt (Ferienbetreuung). */
  tage: number;
  /** Tagesgäste: gebracht und am selben Tag wieder abgeholt. */
  tagesbetreuung: number;
  aufenthalte: number;
};

/** Tage pro Hund in einem Monat («JJJJ-MM») für die Rechnung. Ohne Anfragen, Stornos und Teamhunde. */
export function abrechnungTage(buchungen: Buchung[], kunden: Kunde[], monat: string): AbrechnungZeile[] {
  const team = new Set(kunden.filter((k) => k.team).map((k) => k.id));
  const zeilen = new Map<string, AbrechnungZeile>();
  for (const b of buchungen) {
    if (b.status === "Storniert" || b.status === "Anfrage" || team.has(b.kundeId)) continue;
    if (b.bis.slice(0, 7) < monat || b.von.slice(0, 7) > monat) continue;
    for (const h of b.hunde) {
      const z = zeilen.get(h.id) ?? { kunde: b.kundeName, hund: h.name, naechte: 0, tage: 0, tagesbetreuung: 0, aufenthalte: 0 };
      if (b.von === b.bis) {
        if (b.von.startsWith(monat)) z.tagesbetreuung++;
        else continue;
      } else {
        for (let t = b.von; t <= b.bis; t = plusTage(t, 1)) {
          if (!t.startsWith(monat)) continue;
          z.tage++;
          if (t < b.bis) z.naechte++;
        }
      }
      z.aufenthalte++;
      zeilen.set(h.id, z);
    }
  }
  return [...zeilen.values()].sort((a, b) => a.kunde.localeCompare(b.kunde, "de") || a.hund.localeCompare(b.hund, "de"));
}

/** CSV der Abrechnung (Semikolon, Excel-tauglich mit BOM). */
export function abrechnungCsv(zeilen: AbrechnungZeile[], p: Preise): string {
  const q = (x: unknown) => {
    const s = String(x ?? "");
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const kopf = ["Kundin / Kunde", "Hund", "Ferien: Nächte", "Ferien: Tage", "Tagesbetreuung: Tage", "Aufenthalte", "Betrag CHF", `davon MWST ${MWST.normal} %`];
  const zeile = (z: AbrechnungZeile) => {
    const betrag = abrechnungBetrag(z, p);
    return [z.kunde, z.hund, z.naechte, z.tage, z.tagesbetreuung, z.aufenthalte, betrag.toFixed(2), mwstAnteil(betrag, MWST.normal).toFixed(2)];
  };
  return "\uFEFF" + [kopf.join(";"), ...zeilen.map((z) => zeile(z).map(q).join(";"))].join("\r\n");
}

/** Die Hunde des Teams, die im Intranet als eigene Kartei-Einträge geführt werden. */
export const TEAMHUNDE: { kunde: string; hunde: string[] }[] = [
  { kunde: "Cristina de Oliveira (Team)", hunde: ["Buffy", "Yasha", "Lou"] },
  { kunde: "Patrick und Nalan Schaub (Team)", hunde: ["Escobar", "Benji", "Peppy", "Mäxi", "Lina"] },
];

/** MWST-Sätze in Prozent: Pension, Zubehör und Spielzeug zum Normalsatz, Futtermittel zum reduzierten Satz. */
export const MWST = { normal: 8.1, reduziert: 2.6 } as const;

/** MWST-Anteil eines Betrags inklusive MWST. */
export const mwstAnteil = (inkl: number, satz: number) => r2((inkl * satz) / (100 + satz));

/**
 * Tagesumsatz nach MWST-Satz: Hofladen-Futter zum reduzierten Satz, Hofladen-Zubehör und der Rest (Pension) zum Normalsatz.
 * Alle Beträge inklusive MWST.
 */
export function mwstAufteilen(total: number, hofFutter: number, hofZubehoer: number) {
  const pension = r2(total - hofFutter - hofZubehoer);
  const umsatz81 = r2(pension + hofZubehoer);
  const umsatz26 = r2(hofFutter);
  return { pension, umsatz81, umsatz26, mwst81: mwstAnteil(umsatz81, MWST.normal), mwst26: mwstAnteil(umsatz26, MWST.reduziert) };
}

export type Preise = { tagesbetreuung: number; uebernachtung: number };

/** Preise pro Hund (CHF inkl. MWST, Entscheid 18.10.2026); die Leitung kann sie im Intranet ändern. */
export const STANDARD_PREISE: Preise = { tagesbetreuung: 65, uebernachtung: 20 };

/** Gespeicherte Preise lesen; fehlende oder ungültige Werte durch die Standardpreise ersetzen. */
export function preiseAus(x: Partial<Record<keyof Preise, unknown>> | undefined): Preise {
  const n = (v: unknown, std: number) => (typeof v === "number" && v >= 0 ? v : std);
  return { tagesbetreuung: n(x?.tagesbetreuung, STANDARD_PREISE.tagesbetreuung), uebernachtung: n(x?.uebernachtung, STANDARD_PREISE.uebernachtung) };
}

/**
 * Preis eines Aufenthalts pro Hund: jeder anwesende Tag (Ankunfts- und Abholtag mitgezählt) als Tagesbetreuung,
 * dazu jede Nacht als Übernachtung. Tagesgast: ein Tag.
 */
export function preisProHund(b: { von: string; bis: string }, p: Preise): number {
  const n = naechte(b);
  return r2((n + 1) * p.tagesbetreuung + n * p.uebernachtung);
}

/** Betrag einer Abrechnungszeile im Monat. */
export const abrechnungBetrag = (z: Pick<AbrechnungZeile, "tage" | "naechte" | "tagesbetreuung">, p: Preise) =>
  r2((z.tage + z.tagesbetreuung) * p.tagesbetreuung + z.naechte * p.uebernachtung);

export type Gast = { buchung: Buchung; hund: Hund };

/** Wer an einem Tag in welchem Zimmer ist (Ankunfts- und Abholtag zählen mit). */
export function zimmerAm(d: { zimmer: Zimmer[]; buchungen: Buchung[]; hunde: Hund[] }, tag: string): { zimmer: Zimmer; gaeste: Gast[] }[] {
  const gaeste = d.buchungen.filter((b) => istDa(b, tag)).flatMap((b) =>
    b.hunde.map((x) => ({ buchung: b, hund: d.hunde.find((h) => h.id === x.id) ?? ({ ...leererHundFuer(x.name), id: x.id, kundeId: b.kundeId } as Hund) })),
  );
  const belegt = new Set(gaeste.map((g) => g.buchung.zimmerId));
  return d.zimmer
    .filter((z) => z.aktiv || belegt.has(z.id))
    .map((z) => ({ zimmer: z, gaeste: gaeste.filter((g) => g.buchung.zimmerId === z.id).sort((a, b) => a.hund.name.localeCompare(b.hund.name, "de")) }));
}

function leererHundFuer(name: string): Omit<Hund, "id" | "kundeId"> {
  return { name, rasse: "", geburtsdatum: "", geschlecht: "", kastriert: false, futter: "", menge: "", medikamente: "", allergien: "", verhalten: "", vertraeglich: true, notiz: "", impfungen: [] };
}

/** Aktueller oder nächster Aufenthalt eines Hundes. */
export function aufenthaltVon(buchungen: Buchung[], hundId: string, tag: string): Buchung | undefined {
  return buchungen
    .filter((b) => b.hunde.some((h) => h.id === hundId) && b.bis >= tag && b.status !== "Storniert" && b.status !== "Abgeholt")
    .sort((a, b) => a.von.localeCompare(b.von))[0];
}
