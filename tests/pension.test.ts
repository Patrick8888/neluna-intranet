// Regeln für die Hundepension gegen den Firestore-Emulator (npm run test:regeln).
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from "firebase/firestore";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-neluna", firestore: { rules: readFileSync("firestore.rules", "utf8") } });
});
afterAll(() => env.cleanup());

const TEAM: Record<string, string[]> = {
  pädi: ["admin", "geschaeftsfuehrung"],
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

const kunde = (uid: string) => ({ name: "Meier Anna", telefon: "079 000 00 00", email: "", adresse: "Dorfstrasse 1, 8253 Willisdorf", notfallkontakt: "", tierarzt: "", notiz: "", erstellt: "2026-10-18T10:00:00", person: uid, uid });

const hund = (uid: string, w: Record<string, unknown> = {}) => ({
  kundeId: "k1", name: "Rex", rasse: "Labrador", geburtsdatum: "2020-05-01", geschlecht: "Rüde", kastriert: true, futter: "Royal Canin",
  menge: "2 × 150 g", medikamente: "", allergien: "", verhalten: "", vertraeglich: true, notiz: "",
  impfungen: [{ art: "Tollwut", gueltigBis: "2027-05-01" }], erstellt: "2026-10-18T10:00:00", person: uid, uid, ...w,
});

const buchung = (uid: string, w: Record<string, unknown> = {}) => ({
  kundeId: "k1", kundeName: "Meier Anna", hunde: [{ id: "h1", name: "Rex" }], zimmerId: "zimmer-1", von: "2026-10-20", bis: "2026-10-23",
  status: "Bestätigt", leistungen: ["Abholung"], preis: 165, bemerkung: "", bezahlt: false, zahlungsart: "", betrag: 0, bezahltAm: "",
  erstellt: "2026-10-18T10:00:00", person: uid, uid, ...w,
});

const abschluss = (uid: string, w: Record<string, unknown> = {}) => ({
  standort: "pension", datum: "2026-10-18", person: uid, uid, anfang: 150, bar: 165, karte: 0, twint: 90, ausgaben: 0, gezaehlt: 315,
  safebagBetrag: 0, safebagNr: "", notiz: "", total: 255, soll: 315, differenz: 0, wechselgeldNeu: 315, abgeholt: false, abgeholtAm: "", ...w,
});

describe("Zimmer", () => {
  it("die Leitung Pension stellt ein, wie viele Hunde ein Zimmer aufnimmt", async () => {
    const z = { name: "Zimmer 2", maxHunde: 2, aktiv: true, notiz: "Doppelzimmer" };
    await assertSucceeds(setDoc(doc(als("cristina"), "pension_zimmer/zimmer-2"), z));
    await assertFails(setDoc(doc(als("sina"), "pension_zimmer/zimmer-2"), z));
    await assertFails(setDoc(doc(als("cristina"), "pension_zimmer/zimmer-2"), { ...z, maxHunde: 0 }));
    await assertSucceeds(getDoc(doc(als("rahel"), "pension_zimmer/zimmer-2")));
  });
});

describe("Kartei", () => {
  it("Mitarbeit Pension erfasst Kunden und Hunde, der Laden liest nur", async () => {
    await assertSucceeds(setDoc(doc(als("sina"), "pension_kunden/k1"), kunde("sina")));
    await assertSucceeds(setDoc(doc(als("sina"), "pension_hunde/h1"), hund("sina")));
    await assertSucceeds(getDoc(doc(als("rahel"), "pension_hunde/h1")));
    await assertFails(setDoc(doc(als("rahel"), "pension_kunden/k2"), kunde("rahel")));
    await assertFails(setDoc(doc(als("laura"), "pension_hunde/h2"), hund("laura")));
  });

  it("Änderungen behalten, wer den Eintrag erfasst hat", async () => {
    await setDoc(doc(als("sina"), "pension_hunde/h1"), hund("sina"));
    await assertSucceeds(updateDoc(doc(als("cristina"), "pension_hunde/h1"), { vertraeglich: false, medikamente: "Apoquel" }));
    await assertFails(updateDoc(doc(als("cristina"), "pension_hunde/h1"), { person: "cristina" }));
  });

  it("löschen darf nur die Leitung", async () => {
    await setDoc(doc(als("sina"), "pension_kunden/k1"), kunde("sina"));
    await assertFails(deleteDoc(doc(als("sina"), "pension_kunden/k1")));
    await assertSucceeds(deleteDoc(doc(als("cristina"), "pension_kunden/k1")));
  });
});

describe("Buchungen", () => {
  it("Mitarbeit Pension bucht und checkt ein, Fahrdienst und Laden lesen", async () => {
    await assertSucceeds(setDoc(doc(als("sina"), "pension_buchungen/b1"), buchung("sina")));
    await assertSucceeds(updateDoc(doc(als("sina"), "pension_buchungen/b1"), { status: "Eingecheckt", geaendertVon: "sina" }));
    await assertSucceeds(getDocs(collection(als("laura"), "pension_buchungen")));
    await assertFails(setDoc(doc(als("morena"), "pension_buchungen/b2"), buchung("morena")));
  });

  it("Abreise vor Ankunft und unbekannte Status werden abgelehnt", async () => {
    await assertFails(setDoc(doc(als("sina"), "pension_buchungen/b1"), buchung("sina", { bis: "2026-10-19" })));
    await assertFails(setDoc(doc(als("sina"), "pension_buchungen/b1"), buchung("sina", { status: "Vielleicht" })));
    await assertFails(setDoc(doc(als("sina"), "pension_buchungen/b1"), buchung("sina", { hunde: [] })));
  });

  it("jede Änderung trägt die eigene Benutzer-ID", async () => {
    await setDoc(doc(als("sina"), "pension_buchungen/b1"), buchung("sina"));
    await assertFails(updateDoc(doc(als("cristina"), "pension_buchungen/b1"), { status: "Storniert", geaendertVon: "sina" }));
    await assertFails(updateDoc(doc(als("cristina"), "pension_buchungen/b1"), { status: "Storniert" }));
  });
});

describe("Tagesplan und Übergabe", () => {
  it("das Pensionsteam hakt ab, der Laden sieht den Tagesplan nicht", async () => {
    const plan = { erledigt: { "h1:fuettern_morgen": { person: "Sina", zeit: "07:30" } } };
    await assertSucceeds(setDoc(doc(als("sina"), "pension_tagesplan/2026-10-20"), plan, { merge: true }));
    await assertFails(getDoc(doc(als("rahel"), "pension_tagesplan/2026-10-20")));
    await assertFails(setDoc(doc(als("sina"), "pension_tagesplan/morgen"), plan));
  });

  it("Übergabe Pension: schreiben und abhaken", async () => {
    const ref = await assertSucceeds(addDoc(collection(als("sina"), "pension_uebergabe"), {
      datum: "2026-10-18", erstellt: "2026-10-18T18:00:00", person: "sina", uid: "sina", kategorie: "Hund", text: "Rex frisst schlecht",
      pendenz: true, wichtig: true, erledigt: false,
    }));
    await assertSucceeds(updateDoc(doc(als("cristina"), ref.path), { erledigt: true, erledigtVon: "Cristina", erledigtAm: "2026-10-19T08:00:00" }));
    await assertFails(getDocs(collection(als("rahel"), "pension_uebergabe")));
  });
});

describe("Kassenbuch Pension", () => {
  it("Mitarbeit Pension erfasst den Tagesabschluss, der Laden hat keinen Zugriff", async () => {
    await assertSucceeds(setDoc(doc(als("sina"), "kasse/pension_2026-10-18"), abschluss("sina")));
    await assertFails(setDoc(doc(als("rahel"), "kasse/pension_2026-10-18"), abschluss("rahel")));
    await assertFails(getDoc(doc(als("morena"), "kasse/pension_2026-10-18")));
  });

  it("Pension und Laden sehen je nur das eigene Kassenbuch", async () => {
    await assertSucceeds(getDocs(query(collection(als("sina"), "kasse"), where("standort", "==", "pension"))));
    await assertFails(getDocs(query(collection(als("sina"), "kasse"), where("standort", "==", "laden"))));
    await assertFails(setDoc(doc(als("sina"), "kasse/laden_2026-10-18"), abschluss("sina", { standort: "laden" })));
    await assertSucceeds(getDocs(query(collection(als("pädi"), "kasse"), where("standort", "==", "laden"))));
  });

  it("ein noch fehlender Abschluss lässt sich abfragen (für die Erinnerung am Abend)", async () => {
    await assertSucceeds(getDoc(doc(als("sina"), "kasse/pension_2026-10-18")));
  });

  it("der Standort lässt sich nachträglich nicht ändern; löschen nur die Leitung", async () => {
    await setDoc(doc(als("sina"), "kasse/pension_2026-10-18"), abschluss("sina"));
    await assertFails(deleteDoc(doc(als("sina"), "kasse/pension_2026-10-18")));
    await assertSucceeds(deleteDoc(doc(als("cristina"), "kasse/pension_2026-10-18")));
  });
});
