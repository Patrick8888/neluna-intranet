// Stammblatt per Link: die Kundschaft füllt ihre Angaben und die der Hunde selbst aus,
// das Team prüft sie und übernimmt sie in die Kartei. Reine Logik, ohne Firebase.
import { klasseAusGewicht, kundenName, type Hund, type Impfung, type Kunde } from "./pension";

/** Felder der Halter/in im Formular, mit Höchstlänge (gleich wie in firestore.rules). */
export const KUNDE_FELDER = [
  ["nachname", "Name", 80],
  ["vorname", "Vorname", 80],
  ["adresse", "Adresse (Strasse und Nummer)", 300],
  ["plzOrt", "PLZ/Ort", 100],
  ["geburtsdatum", "Geburtsdatum", 10],
  ["telefon", "Telefonnummer", 40],
  ["email", "E-Mail", 200],
  ["telefon2", "Telefon 2", 40],
  ["notfallkontakt", "Notfallkontakt 1 (Name und Telefon)", 200],
  ["notfallkontakt2", "Notfallkontakt 2 (Name und Telefon)", 200],
  ["versicherung", "Haftpflicht / Tierversicherung", 200],
  ["notiz", "Bemerkungen", 2000],
] as const;

export type KundeFeld = (typeof KUNDE_FELDER)[number][0];
export type KundeAngaben = Record<KundeFeld, string>;

/** Textfelder pro Hund, mit Höchstlänge (gleich wie in firestore.rules). */
export const HUND_TEXTE = {
  name: 80, rasse: 100, geburtsdatum: 10, geschlecht: 20, chipnummer: 40, farbe: 100, gewicht: 20, laeufigkeit: 200,
  tierarzt: 200, tierarztTelefon: 40, allergien: 500, gesundheit: 2000, medikamente: 1000,
  futter: 500, menge: 200, fuetterungszeiten: 500, leckerli: 500,
  verhalten: 2000, sozialverhalten: 2000, freilauf: 500, schlafplatz: 500, kommandos: 1000, aengste: 1000, spielverhalten: 1000, notiz: 4000,
} as const;

export type HundText = keyof typeof HUND_TEXTE;
export type HundAngaben = Record<HundText, string> & { id: string; kastriert: boolean; vertraeglich: boolean; impfungen: Impfung[] };

export const MAX_HUNDE = 6;
export const MAX_IMPFUNGEN = 10;
/** So lange ist ein Link gültig. */
export const GUELTIG_TAGE = 14;

export type Antwort = { kunde: KundeAngaben; hunde: HundAngaben[] };

const leer = <K extends string>(keys: readonly K[]) => Object.fromEntries(keys.map((k) => [k, ""])) as Record<K, string>;

export const leereKundeAngaben = (): KundeAngaben => leer(KUNDE_FELDER.map(([k]) => k));

export const leererHundAngaben = (): HundAngaben => ({
  ...leer(Object.keys(HUND_TEXTE) as HundText[]), id: "", kastriert: false, vertraeglich: true, impfungen: [],
});

/**
 * Vorlage aus der Kartei, damit bestehende Kundschaft nur noch ergänzt und korrigiert.
 * Die Notizen bleiben weg: sie sind fürs Team und gehören nicht in den Link.
 */
export function vorlageAus(k: Kunde, hunde: Hund[]): Antwort {
  const kunde = leereKundeAngaben();
  for (const [f] of KUNDE_FELDER) if (f !== "notiz") kunde[f] = String(k[f] ?? "");
  if (!k.nachname && !k.vorname) kunde.nachname = k.name;
  return {
    kunde,
    hunde: hunde.slice(0, MAX_HUNDE).map((h) => {
      const x = leererHundAngaben();
      for (const f of Object.keys(HUND_TEXTE) as HundText[]) if (f !== "notiz") x[f] = String(h[f] ?? "");
      return { ...x, id: h.id, kastriert: h.kastriert, vertraeglich: h.vertraeglich, impfungen: h.impfungen.slice(0, MAX_IMPFUNGEN) };
    }),
  };
}

const kurz = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const datumOk = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");

/** Was von aussen kommt, wird vor der Übernahme auf bekannte Felder und Längen gekürzt. */
export function bereinigen(roh: unknown): Antwort {
  const r = (roh ?? {}) as { kunde?: Record<string, unknown>; hunde?: unknown };
  const kunde = leereKundeAngaben();
  for (const [f, , max] of KUNDE_FELDER) kunde[f] = kurz(r.kunde?.[f], max);
  kunde.geburtsdatum = datumOk(kunde.geburtsdatum);
  const hunde = (Array.isArray(r.hunde) ? r.hunde : []).slice(0, MAX_HUNDE).map((x: Record<string, unknown>) => {
    const h = leererHundAngaben();
    for (const [f, max] of Object.entries(HUND_TEXTE) as [HundText, number][]) h[f] = kurz(x?.[f], max);
    h.geburtsdatum = datumOk(h.geburtsdatum);
    h.geschlecht = ["Rüde", "Hündin"].includes(h.geschlecht) ? h.geschlecht : "";
    h.id = kurz(x?.id, 40);
    h.kastriert = x?.kastriert === true;
    h.vertraeglich = x?.vertraeglich !== false;
    h.impfungen = (Array.isArray(x?.impfungen) ? x.impfungen : [])
      .slice(0, MAX_IMPFUNGEN)
      .map((i: Record<string, unknown>) => ({ art: kurz(i?.art, 60), gueltigBis: datumOk(kurz(i?.gueltigBis, 10)) }))
      .filter((i: Impfung) => i.art);
    return h;
  }).filter((h) => h.name);
  return { kunde, hunde };
}

/** Fehlende Pflichtangaben im Formular; leer, wenn alles da ist. */
export function fehlt(a: Antwort): string {
  if (!a.kunde.nachname.trim() || !a.kunde.vorname.trim()) return "Bitte Name und Vorname angeben.";
  if (!a.kunde.telefon.trim()) return "Bitte eine Telefonnummer angeben.";
  if (!a.hunde.length || a.hunde.some((h) => !h.name.trim())) return "Bitte bei jedem Hund den Namen angeben.";
  return "";
}

/** Notiz der Kundschaft an die bestehende Notiz des Teams anhängen, nie überschreiben. */
const anhaengen = (alt: string | undefined, neu: string) => [alt?.trim(), neu && `Vom Stammblatt: ${neu}`].filter(Boolean).join("\n");

export type Uebernahme = {
  kunde: { id: string | null; felder: Record<string, string> };
  hunde: { id: string | null; felder: Record<string, unknown> }[];
};

/**
 * Was beim Übernehmen in die Kartei geschrieben wird: bestehende Halter/in und Hunde (gleiche ID) werden
 * aktualisiert, neue angelegt. Notizen werden angehängt, die Grösse fürs Zimmer folgt aus dem Gewicht.
 */
export function uebernahme(a: Antwort, kunde: Kunde | undefined, hunde: Hund[]): Uebernahme {
  const { notiz, ...k } = a.kunde;
  return {
    kunde: { id: kunde?.id ?? null, felder: { ...k, name: kundenName(k.nachname, k.vorname), notiz: anhaengen(kunde?.notiz, notiz) } },
    hunde: a.hunde.map((h) => {
      const alt = kunde ? hunde.find((x) => x.id === h.id && x.kundeId === kunde.id) : undefined;
      const { id: _id, notiz: hNotiz, ...rest } = h;
      return {
        id: alt?.id ?? null,
        felder: { ...rest, notiz: anhaengen(alt?.notiz, hNotiz), gewichtsklasse: klasseAusGewicht(h.gewicht) || alt?.gewichtsklasse || "" },
      };
    }),
  };
}

/** Telefonnummer für wa.me: nur Ziffern, Schweizer Nummern mit 41 statt 0. */
export function waNummer(tel: string): string {
  const z = tel.replace(/[^\d+]/g, "");
  if (z.startsWith("+")) return z.slice(1);
  if (z.startsWith("00")) return z.slice(2);
  if (z.startsWith("0")) return `41${z.slice(1)}`;
  return z;
}

/** Zufälliger, nicht erratbarer Schlüssel für den Link (Dokument-ID). */
export function neuerToken(zufall: (n: number) => Uint8Array = (n) => crypto.getRandomValues(new Uint8Array(n))): string {
  const z = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(zufall(24), (b) => z[b % z.length]).join("");
}

/** Text zum Teilen per WhatsApp, SMS oder E-Mail. */
export const einladung = (url: string, name?: string) =>
  `Grüezi${name ? ` ${name}` : ""}, bitte füllen Sie vor dem Aufenthalt das Stammblatt für die Hundepension NeLuna aus: ${url} Herzlichen Dank!`;
