// Datum und Beträge wie im Ladenbuch: Datum als «JJJJ-MM-TT» (Zeitzone Zürich), Beträge in CHF auf Rappen gerundet.

const ZONE = "Europe/Zurich";

/** Heutiges Datum in Zürich als «JJJJ-MM-TT». */
export function heute(jetzt = new Date()): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: ZONE }).format(jetzt);
}

/** Lokaler Zeitstempel «JJJJ-MM-TTThh:mm:ss» (Zürich), sortierbar wie im Ladenbuch. */
export function zeitstempel(jetzt = new Date()): string {
  const t = new Intl.DateTimeFormat("sv-SE", { timeZone: ZONE, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(jetzt);
  return `${heute(jetzt)}T${t}`;
}

/** Stunde (0–23) in Zürich. */
export function stunde(jetzt = new Date()): number {
  return Number(new Intl.DateTimeFormat("de-CH", { hour: "numeric", hourCycle: "h23", timeZone: ZONE }).formatToParts(jetzt).find((t) => t.type === "hour")?.value);
}

/** Wochentag 0 = Sonntag … 6 = Samstag für ein Datum «JJJJ-MM-TT». */
function wochentag(d: string): number {
  return new Date(d + "T12:00:00Z").getUTCDay();
}

export function plusTage(d: string, n: number): string {
  const x = new Date(d + "T12:00:00Z");
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
}

export function montagVon(d: string): string {
  return plusTage(d, -((wochentag(d) + 6) % 7));
}

export function kalenderwoche(d: string): number {
  const x = new Date(d + "T12:00:00Z");
  x.setUTCDate(x.getUTCDate() + 3 - ((x.getUTCDay() + 6) % 7));
  const w1 = new Date(Date.UTC(x.getUTCFullYear(), 0, 4, 12));
  return 1 + Math.round(((x.getTime() - w1.getTime()) / 864e5 - 3 + ((w1.getUTCDay() + 6) % 7)) / 7);
}

export function datum(d?: string | null): string {
  if (!d) return "";
  const [j, m, t] = d.slice(0, 10).split("-");
  return `${t}.${m}.${j}`;
}

export function wochentagKurz(d: string): string {
  return new Date(d + "T12:00:00Z").toLocaleDateString("de-CH", { weekday: "short", timeZone: "UTC" });
}

export function wochenLabel(montag: string): string {
  return `KW ${kalenderwoche(montag)} · ${datum(montag).slice(0, 6)}–${datum(plusTage(montag, 5))}`;
}

export function monatLabel(monat: string): string {
  return new Date(monat + "-15T12:00:00Z").toLocaleDateString("de-CH", { month: "long", year: "numeric", timeZone: "UTC" });
}

export const r2 = (x: number) => Math.round(x * 100) / 100;

/** Eingabe wie «1'234,50» oder «12.5» in eine Zahl umwandeln; leer oder ungültig ergibt 0. */
export function zahl(v: unknown): number {
  if (v === "" || v == null) return 0;
  const x = parseFloat(String(v).replace(/'/g, "").replace(",", "."));
  return Number.isFinite(x) ? r2(x) : 0;
}

export function chf(n: unknown): string {
  return new Intl.NumberFormat("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(n) || 0);
}

export const vorname = (name?: string | null) => (name ?? "").split(" ")[0];

/** «Vorname Nachname» aus den beiden Feldern. */
export const vollerName = (vorname: string, nachname: string) => [vorname.trim(), nachname.trim()].filter(Boolean).join(" ");

/** Ältere Einträge haben nur «Vorname Nachname» in einem Feld: erstes Wort ist der Vorname. */
export function namensTeile(name: string): { vorname: string; nachname: string } {
  const [v = "", ...rest] = name.trim().split(/\s+/);
  return { vorname: v, nachname: rest.join(" ") };
}
