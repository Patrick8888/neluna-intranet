// Dokumentablage: Text, Link und optional eine Datei, die in Teilen in Firestore liegt (ohne Cloud Storage).

export const KATEGORIEN = ["Organisationshandbuch", "Reglemente", "Anleitungen", "Formulare", "Anderes"] as const;
export type Kategorie = (typeof KATEGORIEN)[number];

/** «alle» = ganzes Team, «leitung» = Geschäftsführung und Leitungen. */
export const SICHTBAR = { alle: "Ganzes Team", leitung: "Nur Geschäftsführung und Leitungen" } as const;
export type Sichtbar = keyof typeof SICHTBAR;

export type DateiInfo = { schluessel: string; name: string; typ: string; groesse: number; teile: number };

export type Dokument = {
  id: string;
  titel: string;
  kategorie: Kategorie;
  inhalt: string;
  link: string;
  fuer: Sichtbar;
  datei?: DateiInfo;
  erstellt: string;
  geaendert: string;
  person: string;
  uid: string;
};

/** Grösste Datei; grössere bitte als Link (z. B. Google Drive) ablegen. */
export const MAX_DATEI = 5 * 1024 * 1024;
/** Zeichen pro Teil; ein Firestore-Dokument fasst höchstens 1 MB. */
export const TEIL = 700_000;

export function inTeile(daten: string, groesse = TEIL): string[] {
  const teile: string[] = [];
  for (let i = 0; i < daten.length; i += groesse) teile.push(daten.slice(i, i + groesse));
  return teile.length ? teile : [""];
}

export function dateiGroesse(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString("de-CH", { maximumFractionDigits: 1 })} MB`;
}

/** Nur Web-Links zulassen (kein «javascript:» o. ä.). */
export const linkOk = (url: string) => url === "" || /^https?:\/\/\S+$/i.test(url);

export function suchen(liste: Dokument[], text: string): Dokument[] {
  const w = text.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!w.length) return liste;
  return liste.filter((d) => {
    const s = `${d.titel} ${d.kategorie} ${d.inhalt} ${d.datei?.name ?? ""}`.toLowerCase();
    return w.every((x) => s.includes(x));
  });
}

export type Block = { art: "titel" | "absatz" | "liste"; zeilen: string[] };

/** Einfache Formatierung: «# Titel», «- Punkt», Leerzeile trennt Absätze. */
export function bloecke(text: string): Block[] {
  const out: Block[] = [];
  for (const zeile of text.replace(/\r/g, "").split("\n")) {
    const z = zeile.trimEnd();
    const letzter = out.at(-1);
    if (!z.trim()) {
      if (letzter && letzter.art !== "titel") out.push({ art: "absatz", zeilen: [] });
      continue;
    }
    if (/^#{1,3}\s/.test(z)) out.push({ art: "titel", zeilen: [z.replace(/^#+\s*/, "")] });
    else if (/^\s*[-*•]\s/.test(z)) {
      if (letzter?.art === "liste") letzter.zeilen.push(z.replace(/^\s*[-*•]\s*/, ""));
      else out.push({ art: "liste", zeilen: [z.replace(/^\s*[-*•]\s*/, "")] });
    } else if (letzter?.art === "absatz") letzter.zeilen.push(z);
    else out.push({ art: "absatz", zeilen: [z] });
  }
  return out.filter((b) => b.zeilen.length);
}
