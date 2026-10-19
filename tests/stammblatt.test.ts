// Regeln für das Stammblatt per Link gegen den Firestore-Emulator (npm run test:regeln).
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch } from "firebase/firestore";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-neluna", firestore: { rules: readFileSync("firestore.rules", "utf8") } });
});
afterAll(() => env.cleanup());

const TEAM: Record<string, string[]> = { cristina: ["leitung_pension"], sina: ["mitarbeit_pension"], rahel: ["verkauf"] };
const TOKEN = "abcdefghijkmnopqrstuvwxyz";

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, rollen] of Object.entries(TEAM)) await setDoc(doc(db, "benutzer", uid), { name: uid, email: `${uid}@example.ch`, rollen, aktiv: true });
  });
});

const als = (uid: string) => env.authenticatedContext(uid).firestore();
const fremd = () => env.unauthenticatedContext().firestore();
const inTagen = (n: number) => Timestamp.fromMillis(Date.now() + n * 864e5);

const link = (uid: string, w: Record<string, unknown> = {}) => ({
  kundeId: "", kundeName: "", vorlage: null, ablauf: inTagen(14), status: "offen", erstellt: "2026-10-19T10:00:00", person: uid, uid, ...w,
});

const hund = (w: Record<string, unknown> = {}) => ({
  id: "", name: "Rex", rasse: "Labrador", geburtsdatum: "2020-05-01", geschlecht: "Rüde", chipnummer: "756", farbe: "", gewicht: "30", laeufigkeit: "",
  tierarzt: "Dr. Huber", tierarztTelefon: "052 000 00 00", allergien: "", gesundheit: "", medikamente: "", futter: "Royal Canin", menge: "2 × 150 g",
  fuetterungszeiten: "", leckerli: "", verhalten: "", sozialverhalten: "", freilauf: "", schlafplatz: "", kommandos: "", aengste: "", spielverhalten: "", notiz: "",
  kastriert: true, vertraeglich: true, impfungen: [{ art: "Tollwut", gueltigBis: "2027-05-01" }], ...w,
});

const antwort = (w: Record<string, unknown> = {}) => ({
  kunde: { nachname: "Meier", vorname: "Anna", adresse: "Dorfstrasse 1", plzOrt: "8253 Willisdorf", geburtsdatum: "", telefon: "079 000 00 00", email: "",
    telefon2: "", notfallkontakt: "", notfallkontakt2: "", versicherung: "", notiz: "" },
  hunde: [hund()], eingegangen: serverTimestamp(), ...w,
});

async function linkAnlegen(w: Record<string, unknown> = {}) {
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "stammblatt_links", TOKEN), link("sina", w)));
}

async function absenden(db: ReturnType<typeof fremd>, a = antwort()) {
  const b = writeBatch(db);
  b.set(doc(db, "stammblatt_antworten", TOKEN), a);
  b.update(doc(db, "stammblatt_links", TOKEN), { status: "ausgefuellt" });
  return b.commit();
}

describe("Stammblatt per Link", () => {
  it("das Pensionsteam erstellt Links, der Laden nicht; der Schlüssel muss lang sein", async () => {
    await assertSucceeds(setDoc(doc(als("sina"), "stammblatt_links", TOKEN), link("sina")));
    await assertFails(setDoc(doc(als("rahel"), "stammblatt_links", "zyxwvutsrqponmkjihgfedcba"), link("rahel")));
    await assertFails(setDoc(doc(als("sina"), "stammblatt_links", "kurz"), link("sina")));
    await assertFails(setDoc(doc(als("sina"), "stammblatt_links", "zyxwvutsrqponmkjihgfedcba"), link("sina", { ablauf: inTagen(60) })));
    await assertSucceeds(getDocs(collection(als("rahel"), "stammblatt_links")));
  });

  it("ohne Anmeldung: offenen Link lesen, aber nicht auflisten und keine abgelaufenen", async () => {
    await linkAnlegen();
    await assertSucceeds(getDoc(doc(fremd(), "stammblatt_links", TOKEN)));
    await assertFails(getDocs(collection(fremd(), "stammblatt_links")));
    await assertFails(getDoc(doc(fremd(), "stammblatt_links", "gibtesnichtgibtesnicht")));
    await linkAnlegen({ ablauf: inTagen(-1) });
    await assertFails(getDoc(doc(fremd(), "stammblatt_links", TOKEN)));
  });

  it("die Kundschaft sendet einmal ab, danach ist der Link zu", async () => {
    await linkAnlegen();
    await assertSucceeds(absenden(fremd()));
    await assertFails(getDoc(doc(fremd(), "stammblatt_links", TOKEN)));
    await assertFails(absenden(fremd()));
    await assertFails(getDoc(doc(fremd(), "stammblatt_antworten", TOKEN)));
    await assertSucceeds(getDoc(doc(als("sina"), "stammblatt_antworten", TOKEN)));
    await assertFails(getDoc(doc(als("rahel"), "stammblatt_antworten", TOKEN)));
    await assertSucceeds(deleteDoc(doc(als("sina"), "stammblatt_antworten", TOKEN)));
  });

  it("abgelaufene Links und ungültige Angaben werden abgewiesen", async () => {
    await linkAnlegen({ ablauf: inTagen(-1) });
    await assertFails(absenden(fremd()));
    await linkAnlegen();
    const a = antwort();
    await assertFails(absenden(fremd(), { ...a, kunde: { ...a.kunde, vorname: "" } }));
    await assertFails(absenden(fremd(), { ...a, kunde: { ...a.kunde, rolle: "admin" } }));
    await assertFails(absenden(fremd(), { ...a, hunde: [] }));
    await assertFails(absenden(fremd(), { ...a, hunde: [hund({ name: "" })] }));
    await assertFails(absenden(fremd(), { ...a, hunde: [hund(), hund({ kastriert: "ja" })] }));
    await assertFails(absenden(fremd(), { ...a, hunde: [hund({ kundeId: "fremd" })] }));
    await assertFails(absenden(fremd(), { ...a, eingegangen: "2026-01-01" }));
    await assertFails(absenden(fremd(), { ...a, extra: 1 }));
    // Ohne das Schliessen des Links geht es nicht, und umgekehrt auch nicht.
    await assertFails(setDoc(doc(fremd(), "stammblatt_antworten", TOKEN), a));
    await assertFails(updateDoc(doc(fremd(), "stammblatt_links", TOKEN), { status: "ausgefuellt" }));
    await assertSucceeds(absenden(fremd(), { ...a, hunde: Array.from({ length: 6 }, (_, i) => hund({ name: `Hund ${i}`, gesundheit: "x".repeat(2000) })) }));
  });

  it("das Team öffnet einen Link wieder oder löscht ihn", async () => {
    await linkAnlegen({ status: "ausgefuellt" });
    await assertSucceeds(updateDoc(doc(als("sina"), "stammblatt_links", TOKEN), { status: "offen", ablauf: inTagen(14) }));
    await assertFails(updateDoc(doc(als("rahel"), "stammblatt_links", TOKEN), { status: "offen" }));
    await assertFails(updateDoc(doc(fremd(), "stammblatt_links", TOKEN), { ablauf: inTagen(30) }));
    await assertFails(deleteDoc(doc(fremd(), "stammblatt_links", TOKEN)));
    await assertSucceeds(deleteDoc(doc(als("sina"), "stammblatt_links", TOKEN)));
  });
});
