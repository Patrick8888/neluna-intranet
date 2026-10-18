// Regeln für Laden und Sitzungen gegen den Firestore-Emulator (npm run test:regeln).
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-neluna", firestore: { rules: readFileSync("firestore.rules", "utf8") } });
});
afterAll(() => env.cleanup());

const TEAM: Record<string, string[]> = {
  pädi: ["admin", "geschaeftsfuehrung"],
  morena: ["leitung_laden"],
  rahel: ["verkauf"],
  cristina: ["leitung_pension"],
  laura: ["fahrdienst"],
  nurAdmin: ["admin"],
};

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, rollen] of Object.entries(TEAM)) {
      await setDoc(doc(db, "benutzer", uid), { name: uid, email: `${uid}@example.ch`, rollen, aktiv: true });
    }
    await setDoc(doc(db, "benutzer/weg"), { name: "weg", email: "weg@example.ch", rollen: ["leitung_laden"], aktiv: false });
  });
});

const als = (uid: string) => env.authenticatedContext(uid).firestore();

const abschluss = (uid: string, datum = "2026-10-17", w: Record<string, unknown> = {}) => ({
  standort: "laden", datum, person: uid, uid, anfang: 200, bar: 500, karte: 800, twint: 40, ausgaben: 8.5, gezaehlt: 691.5,
  safebagBetrag: 500, safebagNr: "004512", notiz: "", total: 1340, soll: 691.5, differenz: 0, wechselgeldNeu: 191.5,
  abgeholt: false, abgeholtAm: "", ...w,
});

const eintrag = (uid: string) => ({
  datum: "2026-10-17", erstellt: "2026-10-17T10:00:00", person: uid, uid, kategorie: "Info", text: "Frau Meier holt Futter ab",
  pendenz: true, wichtig: false, erledigt: false,
});

describe("Kassenbuch", () => {
  it("Verkauf erfasst einen Tagesabschluss", async () => {
    await assertSucceeds(setDoc(doc(als("rahel"), "kasse/laden_2026-10-17"), abschluss("rahel")));
  });

  it("die Dokument-ID muss zu Standort und Datum passen", async () => {
    await assertFails(setDoc(doc(als("rahel"), "kasse/laden_2026-10-18"), abschluss("rahel")));
  });

  it("niemand erfasst im Namen einer anderen Person", async () => {
    await assertFails(setDoc(doc(als("rahel"), "kasse/laden_2026-10-17"), abschluss("morena")));
  });

  it("Beträge müssen Zahlen sein", async () => {
    await assertFails(setDoc(doc(als("rahel"), "kasse/laden_2026-10-17"), abschluss("rahel", "2026-10-17", { bar: "500" })));
  });

  it("Pension, Fahrdienst und reine Admins sehen die Ladenkasse nicht", async () => {
    for (const uid of ["cristina", "laura", "nurAdmin", "weg"]) {
      await assertFails(getDocs(collection(als(uid), "kasse")));
    }
  });

  it("Loomis-Abholung bestätigen, ohne den Abschluss zu übernehmen", async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "kasse/laden_2026-10-17"), abschluss("morena")));
    await assertSucceeds(updateDoc(doc(als("rahel"), "kasse/laden_2026-10-17"), { abgeholt: true, abgeholtAm: "2026-10-18" }));
    await assertFails(updateDoc(doc(als("rahel"), "kasse/laden_2026-10-17"), { bar: 1 }));
  });

  it("löschen darf nur die Leitung", async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "kasse/laden_2026-10-17"), abschluss("rahel")));
    await assertFails(deleteDoc(doc(als("rahel"), "kasse/laden_2026-10-17")));
    await assertSucceeds(deleteDoc(doc(als("morena"), "kasse/laden_2026-10-17")));
  });
});

describe("Übergabe, Bestellungen, Reklamationen", () => {
  it("Verkauf schreibt und hakt ab, ändert aber den Text nicht nachträglich", async () => {
    const ref = await assertSucceeds(addDoc(collection(als("rahel"), "laden_uebergabe"), eintrag("rahel")));
    await assertSucceeds(updateDoc(doc(als("morena"), ref.path), { erledigt: true, erledigtVon: "Morena Riccardi", erledigtAm: "2026-10-17T11:00:00" }));
    await assertFails(updateDoc(doc(als("rahel"), ref.path), { text: "anders" }));
  });

  it("eigene Einträge löschen, fremde nur als Leitung", async () => {
    const ref = await addDoc(collection(als("morena"), "laden_uebergabe"), eintrag("morena"));
    await assertFails(deleteDoc(doc(als("rahel"), ref.path)));
    const eigen = await addDoc(collection(als("rahel"), "laden_uebergabe"), eintrag("rahel"));
    await assertSucceeds(deleteDoc(doc(als("rahel"), eigen.path)));
    await assertSucceeds(deleteDoc(doc(als("morena"), ref.path)));
  });

  it("Bestellstatus nur aus der festen Liste", async () => {
    const ref = await addDoc(collection(als("rahel"), "laden_bestellungen"), {
      typ: "Kundenbestellung", datum: "2026-10-17", erstellt: "2026-10-17T10:00:00", person: "rahel", uid: "rahel",
      artikel: "Futter 15 kg", menge: "1", lieferant: "", kunde: "Meier", telefon: "079", notiz: "", status: "Offen",
    });
    await assertSucceeds(updateDoc(doc(als("rahel"), ref.path), { status: "Eingetroffen" }));
    await assertFails(updateDoc(doc(als("rahel"), ref.path), { status: "Verloren" }));
  });

  it("Reklamation mit Betrag", async () => {
    await assertSucceeds(addDoc(collection(als("rahel"), "laden_reklamationen"), {
      datum: "2026-10-17", erstellt: "2026-10-17T10:00:00", person: "rahel", uid: "rahel", kunde: "", artikel: "Kratzbaum",
      grund: "wackelt", loesung: "Gutschrift", betrag: 120, status: "Erledigt",
    }));
  });
});

describe("Wochenbericht", () => {
  const bericht = (uid: string) => ({ woche: "2026-10-12", person: uid, uid, gespeichert: "2026-10-17", umsatz: "gut" });

  it("Leitung Laden schreibt, Verkauf liest nur", async () => {
    await assertSucceeds(setDoc(doc(als("morena"), "laden_wochenberichte/2026-10-12"), bericht("morena")));
    await assertSucceeds(getDoc(doc(als("rahel"), "laden_wochenberichte/2026-10-12")));
    await assertFails(setDoc(doc(als("rahel"), "laden_wochenberichte/2026-10-12"), bericht("rahel")));
  });
});

describe("Sitzungen", () => {
  const prot = (uid: string) => ({
    datum: "2026-10-17", zeit: "", ort: "Laden", leitung: "Morena Riccardi", protokoll: "", anwesend: [], abwesend: "",
    t: ["a"], pendenzen: [{ was: "Regal", wer: "Rahel Winet", bis: "", erledigt: false }], naechste: "", gespeichert: "2026-10-17", uid, person: uid,
  });

  it("Team: Leitung schreibt, alle lesen und haken Pendenzen ab", async () => {
    await assertSucceeds(setDoc(doc(als("morena"), "sitzungen_team/s1"), prot("morena")));
    await assertSucceeds(getDoc(doc(als("laura"), "sitzungen_team/s1")));
    await assertFails(setDoc(doc(als("rahel"), "sitzungen_team/s2"), prot("rahel")));
    await assertSucceeds(updateDoc(doc(als("rahel"), "sitzungen_team/s1"), { pendenzen: [{ was: "Regal", wer: "Rahel Winet", bis: "", erledigt: true }] }));
    await assertFails(updateDoc(doc(als("rahel"), "sitzungen_team/s1"), { pendenzen: [] }));
  });

  it("Kader: Verkauf und Fahrdienst haben keinen Zugang", async () => {
    await assertSucceeds(setDoc(doc(als("pädi"), "sitzungen_kader/k1"), prot("pädi")));
    await assertSucceeds(getDoc(doc(als("morena"), "sitzungen_kader/k1")));
    await assertFails(getDoc(doc(als("rahel"), "sitzungen_kader/k1")));
    await assertFails(getDoc(doc(als("laura"), "sitzungen_kader/k1")));
  });

  it("löschen nur Geschäftsführung", async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "sitzungen_team/s1"), prot("morena")));
    await assertFails(deleteDoc(doc(als("morena"), "sitzungen_team/s1")));
    await assertSucceeds(deleteDoc(doc(als("pädi"), "sitzungen_team/s1")));
  });
});
