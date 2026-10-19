// Regeln für Dienstplan, Abwesenheiten, Aufgaben und Dokumente gegen den Firestore-Emulator (npm run test:regeln).
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-neluna", firestore: { rules: readFileSync("firestore.rules", "utf8") } });
});
afterAll(() => env.cleanup());

const TEAM: Record<string, string[]> = {
  patrick: ["admin", "geschaeftsfuehrung"],
  nalan: ["geschaeftsfuehrung"],
  cristina: ["leitung_pension"],
  sina: ["mitarbeit_pension"],
  morena: ["leitung_laden"],
  rahel: ["verkauf"],
  laura: ["fahrdienst"],
};

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, rollen] of Object.entries(TEAM)) {
      await setDoc(doc(db, "benutzer", uid), { name: uid, email: `${uid}@example.ch`, rollen, aktiv: true });
    }
  });
});

const als = (uid: string) => env.authenticatedContext(uid).firestore();
const vorbereiten = (pfad: string, d: Record<string, unknown>) => env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), pfad), d));

const dienst = (uid: string, w: Record<string, unknown> = {}) => ({
  datum: "2026-10-20", bereich: "laden", mitarbeiterUid: "rahel", mitarbeiterName: "Rahel Winet", von: "08:30", bis: "12:00", notiz: "",
  erstellt: "2026-10-19T09:00:00", person: uid, uid, ...w,
});

const abw = (uid: string, w: Record<string, unknown> = {}) => ({
  mitarbeiterUid: uid, mitarbeiterName: uid, bereich: "laden", art: "Ferien", von: "2026-11-02", bis: "2026-11-06", notiz: "", status: "Beantragt",
  entscheidUid: "", entscheidName: "", entscheidAm: "", antwort: "", erstellt: "2026-10-19T09:00:00", person: uid, uid, ...w,
});

const aufgabe = (uid: string, w: Record<string, unknown> = {}) => ({
  titel: "Inventur Futter", beschreibung: "", bereich: "Laden", zustaendigUid: "rahel", zustaendigName: "Rahel Winet", faellig: "2026-10-25", wiederholung: "",
  erledigt: false, erledigtVon: "", erledigtAm: "", erstellt: "2026-10-19T09:00:00", person: uid, uid, ...w,
});

const dokument = (uid: string, w: Record<string, unknown> = {}) => ({
  titel: "Reinigungsplan", kategorie: "Anleitungen", inhalt: "# Morgen", link: "", fuer: "alle", erstellt: "2026-10-19T09:00:00", geaendert: "2026-10-19T09:00:00",
  person: uid, uid, ...w,
});

describe("Dienstplan", () => {
  it("die Leitung plant ihren Bereich, alle lesen", async () => {
    await assertSucceeds(setDoc(doc(als("morena"), "dienste/d1"), dienst("morena")));
    await assertFails(setDoc(doc(als("morena"), "dienste/d2"), dienst("morena", { bereich: "pension", mitarbeiterUid: "sina" })));
    await assertSucceeds(setDoc(doc(als("cristina"), "dienste/d3"), dienst("cristina", { bereich: "fahrdienst", mitarbeiterUid: "laura" })));
    await assertSucceeds(setDoc(doc(als("nalan"), "dienste/d4"), dienst("nalan", { bereich: "pension" })));
    await assertFails(setDoc(doc(als("rahel"), "dienste/d5"), dienst("rahel")));
    await assertSucceeds(getDocs(collection(als("laura"), "dienste")));
  });

  it("Zeiten müssen stimmen; ändern und löschen nur die Leitung des Bereichs", async () => {
    await assertFails(setDoc(doc(als("morena"), "dienste/x"), dienst("morena", { von: "14:00", bis: "12:00" })));
    await assertFails(setDoc(doc(als("morena"), "dienste/y"), dienst("morena", { von: "8 Uhr" })));
    await vorbereiten("dienste/d1", dienst("morena"));
    await assertSucceeds(updateDoc(doc(als("morena"), "dienste/d1"), { bis: "12:30" }));
    await assertFails(updateDoc(doc(als("morena"), "dienste/d1"), { bereich: "pension" }));
    await assertFails(updateDoc(doc(als("cristina"), "dienste/d1"), { bis: "13:00" }));
    await assertFails(deleteDoc(doc(als("rahel"), "dienste/d1")));
    await assertSucceeds(deleteDoc(doc(als("morena"), "dienste/d1")));
  });
});

describe("Ferien und Abwesenheiten", () => {
  it("für sich selbst beantragen, im passenden Bereich", async () => {
    await assertSucceeds(setDoc(doc(als("rahel"), "abwesenheiten/a1"), abw("rahel")));
    await assertFails(setDoc(doc(als("rahel"), "abwesenheiten/a2"), abw("rahel", { status: "Bewilligt" })));
    await assertFails(setDoc(doc(als("rahel"), "abwesenheiten/a3"), abw("rahel", { bereich: "pension" })));
    await assertFails(setDoc(doc(als("rahel"), "abwesenheiten/a4"), abw("rahel", { mitarbeiterUid: "sina", mitarbeiterName: "sina", bereich: "pension" })));
    await assertSucceeds(setDoc(doc(als("laura"), "abwesenheiten/a5"), abw("laura", { bereich: "pension" })));
    await assertSucceeds(setDoc(doc(als("nalan"), "abwesenheiten/a6"), abw("nalan", { bereich: "firma", status: "Bewilligt" })));
  });

  it("die Leitung trägt direkt ein, aber nicht für den anderen Bereich", async () => {
    await assertSucceeds(setDoc(doc(als("cristina"), "abwesenheiten/k1"), abw("cristina", { mitarbeiterUid: "sina", bereich: "pension", art: "Krank", status: "Bewilligt" })));
    await assertFails(setDoc(doc(als("cristina"), "abwesenheiten/k2"), abw("cristina", { mitarbeiterUid: "rahel", bereich: "laden", status: "Bewilligt" })));
    await assertFails(setDoc(doc(als("morena"), "abwesenheiten/k3"), abw("morena", { status: "Bewilligt" })));
  });

  it("bewilligen: Leitung des Bereichs oder Geschäftsführung, nie die eigenen", async () => {
    await vorbereiten("abwesenheiten/a1", abw("rahel"));
    await vorbereiten("abwesenheiten/m1", abw("morena"));
    const entscheid = (uid: string) => ({ status: "Bewilligt", entscheidUid: uid, entscheidName: uid, entscheidAm: "2026-10-19T10:00:00" });
    await assertFails(updateDoc(doc(als("cristina"), "abwesenheiten/a1"), entscheid("cristina")));
    await assertFails(updateDoc(doc(als("rahel"), "abwesenheiten/a1"), entscheid("rahel")));
    await assertSucceeds(updateDoc(doc(als("morena"), "abwesenheiten/a1"), entscheid("morena")));
    await assertFails(updateDoc(doc(als("morena"), "abwesenheiten/m1"), entscheid("morena")));
    await assertSucceeds(updateDoc(doc(als("nalan"), "abwesenheiten/m1"), entscheid("nalan")));
  });

  it("eigene offene Anträge ändern oder zurückziehen, entschiedene nicht", async () => {
    await vorbereiten("abwesenheiten/a1", abw("rahel"));
    await vorbereiten("abwesenheiten/a2", abw("rahel", { status: "Bewilligt" }));
    await assertSucceeds(updateDoc(doc(als("rahel"), "abwesenheiten/a1"), { bis: "2026-11-09" }));
    await assertFails(updateDoc(doc(als("rahel"), "abwesenheiten/a1"), { mitarbeiterUid: "claudia" }));
    await assertFails(updateDoc(doc(als("rahel"), "abwesenheiten/a2"), { bis: "2026-11-20" }));
    await assertFails(deleteDoc(doc(als("rahel"), "abwesenheiten/a2")));
    await assertSucceeds(deleteDoc(doc(als("rahel"), "abwesenheiten/a1")));
    await assertSucceeds(getDocs(query(collection(als("laura"), "abwesenheiten"), where("status", "==", "Beantragt"))));
  });
});

describe("Aufgaben", () => {
  it("alle erfassen und haken ab; ändern nur Ersteller, Zuständige und Geschäftsführung", async () => {
    await assertSucceeds(setDoc(doc(als("morena"), "aufgaben/a1"), aufgabe("morena")));
    await assertFails(setDoc(doc(als("morena"), "aufgaben/a2"), aufgabe("morena", { wiederholung: "w1", faellig: "" })));
    await assertSucceeds(updateDoc(doc(als("laura"), "aufgaben/a1"), { erledigt: true, erledigtVon: "laura", erledigtAm: "2026-10-19T10:00:00" }));
    await assertFails(updateDoc(doc(als("laura"), "aufgaben/a1"), { titel: "Anders" }));
    await assertSucceeds(updateDoc(doc(als("rahel"), "aufgaben/a1"), { titel: "Inventur Futter und Snacks" }));
    await assertSucceeds(updateDoc(doc(als("nalan"), "aufgaben/a1"), { zustaendigUid: "", zustaendigName: "" }));
    await assertFails(updateDoc(doc(als("nalan"), "aufgaben/a1"), { uid: "nalan" }));
    await assertFails(deleteDoc(doc(als("rahel"), "aufgaben/a1")));
    await assertSucceeds(deleteDoc(doc(als("morena"), "aufgaben/a1")));
  });

  it("wiederkehrende rücken beim Abhaken nur vorwärts", async () => {
    await vorbereiten("aufgaben/w", aufgabe("morena", { wiederholung: "w1", zustaendigUid: "" }));
    await assertSucceeds(updateDoc(doc(als("laura"), "aufgaben/w"), { faellig: "2026-11-01", erledigtVon: "laura", erledigtAm: "2026-10-25T10:00:00" }));
    await assertFails(updateDoc(doc(als("laura"), "aufgaben/w"), { faellig: "2026-10-01", erledigtVon: "laura", erledigtAm: "2026-10-25T10:00:00" }));
  });
});

describe("Dokumente", () => {
  it("Geschäftsführung legt ab; alle lesen, Leitungsdokumente nur die Leitungen", async () => {
    await assertSucceeds(setDoc(doc(als("nalan"), "dokumente/d1"), dokument("nalan")));
    await assertFails(setDoc(doc(als("morena"), "dokumente/d2"), dokument("morena")));
    await assertFails(setDoc(doc(als("nalan"), "dokumente/d3"), dokument("nalan", { link: "javascript:alert(1)" })));
    await vorbereiten("dokumente/l1", dokument("nalan", { fuer: "leitung" }));
    await assertSucceeds(getDoc(doc(als("rahel"), "dokumente/d1")));
    await assertFails(getDoc(doc(als("rahel"), "dokumente/l1")));
    await assertSucceeds(getDoc(doc(als("cristina"), "dokumente/l1")));
    await assertSucceeds(getDocs(query(collection(als("rahel"), "dokumente"), where("fuer", "==", "alle"))));
    await assertFails(getDocs(collection(als("rahel"), "dokumente")));
    await assertSucceeds(getDocs(collection(als("morena"), "dokumente")));
  });

  it("Dateiteile: lesen wie das Dokument, schreiben nur die Geschäftsführung", async () => {
    const datei = { schluessel: "abc123", name: "Plan.pdf", typ: "application/pdf", groesse: 1000, teile: 1 };
    await assertSucceeds(setDoc(doc(als("nalan"), "dokumente/l1/teile/abc123_0"), { daten: "data:application/pdf;base64,AAAA" }));
    await assertSucceeds(setDoc(doc(als("nalan"), "dokumente/l1"), dokument("nalan", { fuer: "leitung", datei })));
    await assertFails(setDoc(doc(als("morena"), "dokumente/l1/teile/abc123_1"), { daten: "x" }));
    await assertFails(setDoc(doc(als("nalan"), "dokumente/l1/teile/falsch"), { daten: "x" }));
    await assertSucceeds(getDoc(doc(als("morena"), "dokumente/l1/teile/abc123_0")));
    await assertFails(getDoc(doc(als("rahel"), "dokumente/l1/teile/abc123_0")));
    await assertFails(setDoc(doc(als("nalan"), "dokumente/x"), dokument("nalan", { datei: { ...datei, teile: 20 } })));
  });
});

const zeit = (uid: string, w: Record<string, unknown> = {}) => ({
  mitarbeiterUid: uid, mitarbeiterName: uid, bereich: "laden", datum: "2026-10-19", von: "08:00", bis: "", pause: 0, notiz: "",
  geaendertVon: "", geaendertName: "", erstellt: "2026-10-19T08:00:00", person: uid, uid, ...w,
});

describe("Zeiterfassung", () => {
  it("eigene Zeit stempeln, nicht für andere", async () => {
    await assertSucceeds(setDoc(doc(als("rahel"), "zeiten/z1"), zeit("rahel")));
    await assertFails(setDoc(doc(als("rahel"), "zeiten/z2"), zeit("rahel", { mitarbeiterUid: "sina", bereich: "pension" })));
    await assertFails(setDoc(doc(als("rahel"), "zeiten/z3"), zeit("rahel", { bereich: "pension" })));
    await assertFails(setDoc(doc(als("rahel"), "zeiten/z4"), zeit("rahel", { bis: "07:00" })));
    await assertSucceeds(updateDoc(doc(als("rahel"), "zeiten/z1"), { bis: "12:00", geaendertVon: "rahel", geaendertName: "rahel" }));
    await assertFails(updateDoc(doc(als("rahel"), "zeiten/z1"), { bis: "12:30", geaendertVon: "morena" }));
  });

  it("die Leitung sieht und korrigiert ihren Bereich, sonst niemand", async () => {
    await vorbereiten("zeiten/r", zeit("rahel", { bis: "12:00" }));
    await vorbereiten("zeiten/s", zeit("sina", { bereich: "pension", bis: "12:00" }));
    await assertSucceeds(getDocs(query(collection(als("morena"), "zeiten"), where("bereich", "==", "laden"))));
    await assertFails(getDocs(query(collection(als("morena"), "zeiten"), where("bereich", "==", "pension"))));
    await assertSucceeds(getDocs(query(collection(als("rahel"), "zeiten"), where("mitarbeiterUid", "==", "rahel"))));
    await assertFails(getDoc(doc(als("rahel"), "zeiten/s")));
    await assertSucceeds(getDocs(collection(als("nalan"), "zeiten")));
    await assertSucceeds(updateDoc(doc(als("morena"), "zeiten/r"), { bis: "12:15", geaendertVon: "morena", geaendertName: "morena" }));
    await assertFails(updateDoc(doc(als("cristina"), "zeiten/r"), { bis: "12:30", geaendertVon: "cristina" }));
    await assertSucceeds(setDoc(doc(als("cristina"), "zeiten/n"), zeit("cristina", { mitarbeiterUid: "sina", bereich: "pension", bis: "17:00", pause: 30 })));
    await assertFails(deleteDoc(doc(als("laura"), "zeiten/s")));
    await assertSucceeds(deleteDoc(doc(als("cristina"), "zeiten/s")));
  });
});

describe("Push-Einstellungen", () => {
  it("auch Personal und Aufgaben abschaltbar", async () => {
    await assertSucceeds(setDoc(doc(als("rahel"), "push_einstellungen/rahel"), { personal: false, aufgaben: true }));
    await assertFails(setDoc(doc(als("rahel"), "push_einstellungen/rahel"), { personal: "nein" }));
  });
});
