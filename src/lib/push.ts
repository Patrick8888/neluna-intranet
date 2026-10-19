// Wer bekommt welche Push-Nachricht? Reine Logik, die App und Server-Funktion teilen.
import { dmPartner, GRUPPEN } from "./chat";
import { datum, wochentagKurz } from "./format";
import { impfWarnungen, type Hund } from "./pension";
import { darfFreigeben, werktage, type Abwesenheit } from "./personal";
import type { Rolle } from "./rollen";

/** Arten von Push-Nachrichten; jede Person kann jede Art auf ihren Geräten abschalten. */
export const PUSH_ARTEN = {
  gruppen: "Gruppen-Chats",
  direkt: "Direktnachrichten",
  mitteilungen: "Mitteilungen der Geschäftsführung",
  fahrten: "Eigene Fahrten (neu, geändert, abgesagt)",
  personal: "Ferienanträge und Entscheide",
  aufgaben: "Neue Aufgaben für dich",
  erinnerungen: "Erinnerung am Vortag (Ankünfte, Abholungen, Fahrten)",
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

type AbwesenheitDaten = Partial<Omit<Abwesenheit, "id">>;

const zeitraum = (a: AbwesenheitDaten) =>
  a.von === a.bis ? datum(a.von) : `${datum(a.von).slice(0, 6)}–${datum(a.bis)} (${werktage(a.von ?? "", a.bis ?? "")} Arbeitstage)`;

/**
 * Neuer Antrag: an alle, die ihn bewilligen dürfen. Entscheid: an die Person, die beantragt hat.
 * Krankheit und Unfall erscheinen in der Nachricht nur als «Abwesenheit».
 */
export function abwesenheitPush(vorher: AbwesenheitDaten | undefined, nachher: AbwesenheitDaten | undefined, team: PushPerson[]): { uids: string[]; nachricht: PushNachricht } | null {
  if (!nachher?.mitarbeiterUid || !nachher.bereich) return null;
  const art = nachher.art === "Krank" || nachher.art === "Unfall" ? "Abwesenheit" : nachher.art ?? "Abwesenheit";
  const link = "/personal/abwesenheiten";
  if (!vorher && nachher.status === "Beantragt") {
    const a = { bereich: nachher.bereich, mitarbeiterUid: nachher.mitarbeiterUid };
    const uids = team.filter((p) => p.uid !== nachher.mitarbeiterUid && darfFreigeben(p.rollen as Rolle[], p.uid, a)).map((p) => p.uid);
    return { uids, nachricht: { titel: `Antrag ${art}: ${nachher.mitarbeiterName ?? ""}`.trim(), text: zeitraum(nachher), link, tag: "abwesenheit-antrag" } };
  }
  if (vorher?.status === "Beantragt" && (nachher.status === "Bewilligt" || nachher.status === "Abgelehnt") && nachher.entscheidUid !== nachher.mitarbeiterUid) {
    const text = [zeitraum(nachher), nachher.antwort].filter(Boolean).join(" · ");
    return { uids: [nachher.mitarbeiterUid], nachricht: { titel: `${art} ${nachher.status === "Bewilligt" ? "bewilligt" : "abgelehnt"}`, text, link, tag: "abwesenheit-entscheid" } };
  }
  return null;
}

type AufgabeDaten = { titel?: string; zustaendigUid?: string; faellig?: string; person?: string; uid?: string; erledigt?: boolean };

/** Meldung an die zuständige Person, wenn ihr jemand anderes eine Aufgabe neu zuteilt. */
export function aufgabePush(id: string, vorher: AufgabeDaten | undefined, nachher: AufgabeDaten | undefined): { uid: string; nachricht: PushNachricht } | null {
  if (!nachher?.zustaendigUid || nachher.erledigt || vorher?.zustaendigUid === nachher.zustaendigUid || nachher.zustaendigUid === nachher.uid) return null;
  const text = [nachher.faellig ? `fällig ${datum(nachher.faellig)}` : "", nachher.person ? `von ${nachher.person}` : ""].filter(Boolean).join(" · ");
  return { uid: nachher.zustaendigUid, nachricht: { titel: `Aufgabe: ${nachher.titel ?? ""}`, text, link: "/aufgaben", tag: `aufgabe_${id}` } };
}

type BuchungDaten = { hunde?: { id: string; name: string }[]; von?: string; bis?: string; status?: string };
type FahrtTermin = { datum?: string; zeit?: string; status?: string; richtung?: string; fahrerUid?: string; kundeName?: string; hunde?: { name: string }[] };

/** Wer in der Pension die Erinnerung am Vortag bekommt. */
const PENSION = ["geschaeftsfuehrung", "leitung_pension", "mitarbeit_pension"];

const namen = (b: BuchungDaten[]) => b.flatMap((x) => (x.hunde ?? []).map((h) => h.name)).join(", ");
const kurzText = (teile: string[]) => {
  const t = teile.filter(Boolean).join(" · ");
  return t.length > 300 ? `${t.slice(0, 299)}…` : t;
};
const fahrtText = (f: FahrtTermin) =>
  `${f.zeit ? `${f.zeit} ` : ""}${f.richtung === "Rückweg" ? "Nach Hause" : "Abholen"} ${(f.hunde ?? []).map((h) => h.name).join(", ") || f.kundeName || ""}`.trim();

/**
 * Erinnerung am Vorabend: das Pensionsteam erfährt, wer morgen kommt und geht, welche Impfungen
 * zu prüfen und welche Fahrten noch ohne Fahrer/in sind; jede Fahrerin und jeder Fahrer die eigenen Fahrten.
 * Nichts, wenn morgen nichts ansteht.
 */
export function vortagPush(morgen: string, buchungen: BuchungDaten[], hunde: Pick<Hund, "id" | "name" | "impfungen">[], fahrten: FahrtTermin[], team: PushPerson[]): { uids: string[]; nachricht: PushNachricht }[] {
  const fest = (b: BuchungDaten) => b.status === "Bestätigt" || b.status === "Eingecheckt";
  const kommen = buchungen.filter((b) => b.von === morgen && fest(b));
  const anfragen = buchungen.filter((b) => b.von === morgen && b.status === "Anfrage");
  const gehen = buchungen.filter((b) => b.bis === morgen && fest(b));
  const impfen = kommen.flatMap((b) => (b.hunde ?? []).flatMap((x) => {
    const h = hunde.find((y) => y.id === x.id);
    return h ? impfWarnungen({ ...h, impfungen: h.impfungen ?? [] } as Hund, b.bis ?? morgen, morgen) : [];
  }));
  const geplant = fahrten.filter((f) => f.datum === morgen && f.status !== "Abgesagt" && f.status !== "Erledigt").sort((a, b) => (a.zeit ?? "").localeCompare(b.zeit ?? ""));
  const ohneFahrer = geplant.filter((f) => !f.fahrerUid);
  const wann = `${wochentagKurz(morgen)} ${datum(morgen)}`;
  const aus: { uids: string[]; nachricht: PushNachricht }[] = [];

  const text = kurzText([
    kommen.length ? `Ankunft: ${namen(kommen)}` : "",
    gehen.length ? `Abholung: ${namen(gehen)}` : "",
    anfragen.length ? `Noch nicht bestätigt: ${namen(anfragen)}` : "",
    impfen.length ? `Impfung prüfen: ${impfen.join(", ")}` : "",
    ohneFahrer.length ? `Ohne Fahrer/in: ${ohneFahrer.map(fahrtText).join(", ")}` : "",
  ]);
  const pension = team.filter((p) => p.rollen.some((r) => PENSION.includes(r))).map((p) => p.uid);
  if (text && pension.length) aus.push({ uids: pension, nachricht: { titel: `Morgen in der Pension (${wann})`, text, link: "/pension/belegung", tag: `vortag_pension_${morgen}` } });

  for (const uid of [...new Set(geplant.map((f) => f.fahrerUid).filter((u): u is string => !!u))]) {
    if (!team.some((p) => p.uid === uid)) continue;
    const eigene = geplant.filter((f) => f.fahrerUid === uid);
    aus.push({ uids: [uid], nachricht: { titel: `Morgen ${eigene.length === 1 ? "1 Fahrt" : `${eigene.length} Fahrten`} (${wann})`, text: kurzText(eigene.map(fahrtText)), link: "/fahrdienst/heute", tag: `vortag_fahrten_${morgen}` } });
  }
  return aus;
}
