// Regeln für Fahrdienst, Fahrzeuge und Kalender gegen den Firestore-Emulator (npm run test:regeln).
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, getDocs, collection, setDoc, updateDoc } from "firebase/firestore";

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
  nic: ["fahrdienst"],
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

const fahrt = (uid: string, w: Record<string, unknown> = {}) => ({
  datum: "2026-10-20", zeit: "08:30", richtung: "Hinweg", buchungId: "b1", kundeName: "Meier Anna", telefon: "079 000 00 00",
  adresse: "Dorfstrasse 1, 8253 Willisdorf", hunde: [{ id: "h1", name: "Rex" }], fahrerUid: "laura", fahrerName: "Laura Essinger",
  fahrzeugId: "caddy", fahrzeugName: "VW Caddy", status: "Geplant", notiz: "", erstellt: "2026-10-18T10:00:00", person: uid, uid, geaendertVon: uid, ...w,
});

const fahrzeug = { name: "VW Caddy", kennzeichen: "SH 12345", kmStand: 48500, aktiv: true, notiz: "" };

const garage = (uid: string, w: Record<string, unknown> = {}) => ({
  fahrzeugId: "caddy", art: "Reifenwechsel", datum: "2026-10-25", zeit: "", garage: "Garage Huber", kosten: 0, kmStand: 0, faelligKm: 0,
  blockiert: true, wiederholungMonate: 6, wiederholungKm: 0, notiz: "", erledigt: false, erledigtAm: "", erstellt: "2026-10-18T10:00:00", person: uid, uid, ...w,
});

const termin = (uid: string, w: Record<string, unknown> = {}) => ({
  titel: "Inventur", datum: "2026-10-20", bis: "2026-10-20", zeit: "", zeitBis: "", ebene: "Laden", ort: "Stein am Rhein", beschreibung: "",
  erstellt: "2026-10-18T10:00:00", person: uid, uid, ...w,
});

describe("Fahrten", () => {
  it("Fahrdienst und Pensionsteam planen, der Laden liest nur", async () => {
    await assertSucceeds(setDoc(doc(als("sina"), "fahrten/b_b1_hin"), fahrt("sina")));
    await assertSucceeds(setDoc(doc(als("laura"), "fahrten/f2"), fahrt("laura")));
    await assertSucceeds(getDocs(collection(als("rahel"), "fahrten")));
    await assertFails(setDoc(doc(als("morena"), "fahrten/f3"), fahrt("morena")));
  });

  it("ohne Adresse oder mit unbekanntem Status wird abgelehnt", async () => {
    await assertFails(setDoc(doc(als("sina"), "fahrten/f1"), fahrt("sina", { adresse: "" })));
    await assertFails(setDoc(doc(als("sina"), "fahrten/f1"), fahrt("sina", { status: "Irgendwann" })));
  });

  it("wer eingeteilt ist, setzt den Status der eigenen Fahrt, auch aus dem Verkauf", async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "fahrten/f1"), fahrt("sina", { fahrerUid: "rahel", fahrerName: "Rahel" })));
    await assertSucceeds(updateDoc(doc(als("rahel"), "fahrten/f1"), { status: "Erledigt", geaendertVon: "rahel" }));
    await assertFails(updateDoc(doc(als("rahel"), "fahrten/f1"), { datum: "2026-10-21", geaendertVon: "rahel" }));
    await assertFails(updateDoc(doc(als("morena"), "fahrten/f1"), { status: "Abgesagt", geaendertVon: "morena" }));
  });

  it("löschen: eigene Fahrten oder die Leitung", async () => {
    await setDoc(doc(als("sina"), "fahrten/f1"), fahrt("sina"));
    await assertFails(deleteDoc(doc(als("laura"), "fahrten/f1")));
    await assertSucceeds(deleteDoc(doc(als("cristina"), "fahrten/f1")));
  });
});

describe("Fahrzeuge", () => {
  it("die Leitung erfasst Fahrzeuge, der Fahrdienst trägt nur steigende Kilometer nach", async () => {
    await assertFails(setDoc(doc(als("laura"), "fahrzeuge/caddy"), fahrzeug));
    await assertSucceeds(setDoc(doc(als("cristina"), "fahrzeuge/caddy"), fahrzeug));
    await assertSucceeds(updateDoc(doc(als("laura"), "fahrzeuge/caddy"), { kmStand: 48620 }));
    await assertFails(updateDoc(doc(als("laura"), "fahrzeuge/caddy"), { kmStand: 40000 }));
    await assertFails(updateDoc(doc(als("laura"), "fahrzeuge/caddy"), { kennzeichen: "ZH 1" }));
    await assertFails(getDoc(doc(als("rahel"), "fahrzeuge/caddy")));
  });

  it("Garagentermine: Fahrdienst erfasst und hakt ab, der Laden sieht sie nicht", async () => {
    await assertSucceeds(setDoc(doc(als("nic"), "fahrzeug_termine/t1"), garage("nic")));
    await assertSucceeds(updateDoc(doc(als("laura"), "fahrzeug_termine/t1"), { erledigt: true, erledigtAm: "2026-10-25", kosten: 85.5 }));
    await assertFails(updateDoc(doc(als("laura"), "fahrzeug_termine/t1"), { person: "laura" }));
    await assertFails(setDoc(doc(als("nic"), "fahrzeug_termine/t2"), garage("nic", { art: "Ölwechsel" })));
    await assertFails(getDocs(collection(als("morena"), "fahrzeug_termine")));
  });
});

describe("Kalender", () => {
  it("alle tragen Termine ein und sehen alle", async () => {
    await assertSucceeds(setDoc(doc(als("rahel"), "termine/t1"), termin("rahel")));
    await assertSucceeds(getDocs(collection(als("laura"), "termine")));
    await assertFails(setDoc(doc(als("rahel"), "termine/t2"), termin("rahel", { ebene: "Fahrdienst" })));
    await assertFails(setDoc(doc(als("rahel"), "termine/t3"), termin("rahel", { bis: "2026-10-19" })));
  });

  it("fremde Termine ändern nur Geschäftsführung und Leitungen", async () => {
    await setDoc(doc(als("rahel"), "termine/t1"), termin("rahel"));
    await assertFails(updateDoc(doc(als("laura"), "termine/t1"), { titel: "Anders" }));
    await assertFails(deleteDoc(doc(als("laura"), "termine/t1")));
    await assertSucceeds(updateDoc(doc(als("morena"), "termine/t1"), { titel: "Inventur Laden" }));
    await assertSucceeds(deleteDoc(doc(als("rahel"), "termine/t1")));
  });
});

