// Wer bekommt welche Push-Nachricht? Reine Logik, die App und Server-Funktion teilen.
import { dmPartner, GRUPPEN } from "./chat";
import { datum } from "./format";

/** Arten von Push-Nachrichten; jede Person kann jede Art auf ihren Geräten abschalten. */
export const PUSH_ARTEN = {
  gruppen: "Gruppen-Chats",
  direkt: "Direktnachrichten",
  mitteilungen: "Mitteilungen der Geschäftsführung",
  fahrten: "Eigene Fahrten (neu, geändert, abgesagt)",
} as const;

export type PushArt = keyof typeof PUSH_ARTEN;
export type PushEinstellungen = Partial<Record<PushArt, boolean>>;

/** Ohne Einstellung ist alles eingeschaltet. */
export const pushErlaubt = (e: PushEinstellungen | undefined, art: PushArt) => e?.[art] !== false;

export type PushPerson = { uid: string; rollen: string[] };

export type PushNachricht = { titel: string; text: string; link: string; tag: string };

/** Teamrollen (ohne reine Admins), wie in firestore.rules «teamLesen». */
const TEAM = GRUPPEN[0].rollen as readonly string[];

/** Empfänger einer Chat-Nachricht: die Gruppe nach Rollen oder die andere Person der Direktnachricht. */
export function chatEmpfaenger(kanal: string, absender: string, team: PushPerson[]): { art: PushArt; uids: string[] } {
  const partner = dmPartner(kanal, absender);
  if (partner) return { art: "direkt", uids: team.some((p) => p.uid === partner && p.rollen.some((r) => TEAM.includes(r))) ? [partner] : [] };
  const g = GRUPPEN.find((x) => x.id === kanal);
  const rollen = (g?.rollen ?? []) as readonly string[];
  return { art: "gruppen", uids: team.filter((p) => p.uid !== absender && p.rollen.some((r) => rollen.includes(r))).map((p) => p.uid) };
}

export function chatPush(kanal: string, person: string, text: string, bild: boolean): PushNachricht {
  const g = GRUPPEN.find((x) => x.id === kanal);
  const inhalt = text.replace(/\s+/g, " ").trim() || (bild ? "Foto" : "");
  return { titel: g ? `${person} in ${g.titel}` : person, text: inhalt.length > 160 ? `${inhalt.slice(0, 159)}…` : inhalt, link: `/chat?k=${kanal}`, tag: kanal };
}

export function mitteilungEmpfaenger(absender: string, team: PushPerson[]): string[] {
  return team.filter((p) => p.uid !== absender && p.rollen.some((r) => TEAM.includes(r))).map((p) => p.uid);
}

type FahrtDaten = { fahrerUid?: string; datum?: string; zeit?: string; status?: string; richtung?: string; kundeName?: string; hunde?: { name: string }[]; geaendertVon?: string; uid?: string };

/**
 * Meldung an die Fahrerin oder den Fahrer, wenn eine Fahrt neu zugeteilt, verschoben oder abgesagt wird.
 * Nichts, wenn die Person die Änderung selbst gemacht hat oder die Fahrt schon vorbei ist.
 */
export function fahrtPush(id: string, vorher: FahrtDaten | undefined, nachher: FahrtDaten | undefined, heute: string): { uid: string; nachricht: PushNachricht } | null {
  if (!nachher?.fahrerUid || (nachher.datum ?? "") < heute) return null;
  const wer = nachher.geaendertVon ?? nachher.uid;
  if (wer === nachher.fahrerUid) return null;
  const was = `${nachher.richtung === "Rückweg" ? "Nach Hause bringen" : "Abholen"}: ${(nachher.hunde ?? []).map((h) => h.name).join(", ") || nachher.kundeName || ""}`;
  const wann = `${datum(nachher.datum)}${nachher.zeit ? ` um ${nachher.zeit}` : ""}`;
  const nachricht = (titel: string, text: string) => ({ uid: nachher.fahrerUid!, nachricht: { titel, text, link: "/fahrdienst/heute", tag: `fahrt_${id}` } });
  if (vorher?.fahrerUid !== nachher.fahrerUid) return nachher.status === "Abgesagt" ? null : nachricht("Neue Fahrt für dich", `${wann} · ${was}`);
  if (nachher.status === "Abgesagt" && vorher?.status !== "Abgesagt") return nachricht("Fahrt abgesagt", `${wann} · ${was}`);
  if (nachher.status !== "Abgesagt" && (vorher?.datum !== nachher.datum || (vorher?.zeit ?? "") !== (nachher.zeit ?? ""))) return nachricht("Fahrt verschoben", `Neu ${wann} · ${was}`);
  return null;
}
