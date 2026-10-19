// Prüft firestore.rules gegen den Firestore-Emulator.
// Start: npm run test:regeln (startet den Emulator selbst).
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc, writeBatch, addDoc, collection, getDocs } from "firebase/firestore";

let env: RulesTestEnvironment;

const person = (name: string, email: string, rollen: string[], aktiv = true) => ({ name, email, rollen, aktiv });

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-neluna",
    firestore: { rules: readFileSync("firestore.rules", "utf8") },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

const als = (uid: string, email = `${uid}@example.ch`) => env.authenticatedContext(uid, { email }).firestore();

async function team() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "system/einrichtung"), { von: "patrick" });
    await setDoc(doc(db, "benutzer/patrick"), person("Patrick Schaub", "patrick@example.ch", ["admin", "geschaeftsfuehrung"]));
    await setDoc(doc(db, "benutzer/rahel"), person("Rahel Winet", "rahel@example.ch", ["verkauf"]));
    await setDoc(doc(db, "benutzer/alt"), person("Ehemalig", "alt@example.ch", ["verkauf"], false));
  });
}

describe("Ersteinrichtung", () => {
  it("die erste Person kann sich selbst als Admin einrichten", async () => {
    const db = als("patrick", "patrick@example.ch");
    const b = writeBatch(db);
    b.set(doc(db, "benutzer/patrick"), person("Patrick Schaub", "patrick@example.ch", ["admin", "geschaeftsfuehrung"]));
    b.set(doc(db, "system/einrichtung"), { von: "patrick" });
    await assertSucceeds(b.commit());
  });

  it("nach der Einrichtung kann sich niemand mehr selbst zum Admin machen", async () => {
    await team();
    const db = als("fremd", "fremd@example.ch");
    await assertFails(setDoc(doc(db, "benutzer/fremd"), person("Fremd", "fremd@example.ch", ["admin", "geschaeftsfuehrung"])));
  });

  it("Einrichtung nur mit der eigenen E-Mail-Adresse", async () => {
    const db = als("patrick", "patrick@example.ch");
    const b = writeBatch(db);
    b.set(doc(db, "benutzer/patrick"), person("Patrick", "jemand@example.ch", ["admin", "geschaeftsfuehrung"]));
    b.set(doc(db, "system/einrichtung"), { von: "patrick" });
    await assertFails(b.commit());
  });
});

describe("Benutzer", () => {
  beforeEach(team);

  it("ohne Anmeldung ist nichts lesbar", async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "benutzer/rahel")));
  });

  it("ein Konto ohne Benutzer-Eintrag sieht das Team nicht", async () => {
    await assertFails(getDocs(collection(als("fremd"), "benutzer")));
  });

  it("aktive Personen sehen das Team", async () => {
    await assertSucceeds(getDocs(collection(als("rahel"), "benutzer")));
  });

  it("deaktivierte Personen sehen nur sich selbst", async () => {
    await assertSucceeds(getDoc(doc(als("alt"), "benutzer/alt")));
    await assertFails(getDoc(doc(als("alt"), "benutzer/rahel")));
  });

  it("Admin legt Personen an", async () => {
    await assertSucceeds(setDoc(doc(als("patrick"), "benutzer/claudia"), person("Claudia Binder", "claudia@example.ch", ["verkauf"])));
  });

  it("Verkauf kann keine Personen anlegen", async () => {
    await assertFails(setDoc(doc(als("rahel"), "benutzer/claudia"), person("Claudia Binder", "claudia@example.ch", ["verkauf"])));
  });

  it("unbekannte Rollen werden abgelehnt", async () => {
    await assertFails(setDoc(doc(als("patrick"), "benutzer/x"), person("X", "x@example.ch", ["chef"])));
  });

  it("man ändert bei sich Name und Telefon, aber nicht die eigenen Rollen", async () => {
    const db = als("rahel");
    await assertSucceeds(updateDoc(doc(db, "benutzer/rahel"), { name: "Rahel W.", telefon: "079 000 00 00" }));
    await assertSucceeds(updateDoc(doc(db, "benutzer/rahel"), { name: "Rahel Winet", vorname: "Rahel", nachname: "Winet" }));
    await assertFails(updateDoc(doc(db, "benutzer/rahel"), { vorname: "x".repeat(61) }));
    await assertFails(updateDoc(doc(db, "benutzer/rahel"), { rollen: ["verkauf", "admin"] }));
    await assertFails(updateDoc(doc(db, "benutzer/rahel"), { aktiv: true, pensum: 100 }));
  });

  it("man ändert keine anderen Personen", async () => {
    await assertFails(updateDoc(doc(als("rahel"), "benutzer/patrick"), { name: "Hallo" }));
  });

  it("deaktivierte Personen können ihr Profil nicht mehr ändern", async () => {
    await assertFails(updateDoc(doc(als("alt"), "benutzer/alt"), { name: "Wieder da" }));
  });

  it("Admin vergibt Rollen und deaktiviert", async () => {
    const db = als("patrick");
    await assertSucceeds(updateDoc(doc(db, "benutzer/rahel"), { rollen: ["verkauf", "fahrdienst"] }));
    await assertSucceeds(updateDoc(doc(db, "benutzer/rahel"), { aktiv: false }));
  });

  it("Admin kann sich nicht selbst aussperren", async () => {
    const db = als("patrick");
    await assertFails(updateDoc(doc(db, "benutzer/patrick"), { aktiv: false }));
    await assertFails(updateDoc(doc(db, "benutzer/patrick"), { rollen: ["geschaeftsfuehrung"] }));
  });

  it("die E-Mail-Adresse bleibt fest", async () => {
    await assertFails(updateDoc(doc(als("patrick"), "benutzer/rahel"), { email: "neu@example.ch" }));
  });

  it("niemand löscht Personen", async () => {
    await assertFails(deleteDoc(doc(als("patrick"), "benutzer/rahel")));
  });
});

describe("Protokoll", () => {
  beforeEach(team);

  it("man schreibt Einträge nur unter eigenem Namen", async () => {
    const db = als("rahel");
    await assertSucceeds(addDoc(collection(db, "protokoll"), { uid: "rahel", aktion: "login", zeit: 1 }));
    await assertFails(addDoc(collection(db, "protokoll"), { uid: "patrick", aktion: "login", zeit: 1 }));
  });

  it("nur Admin liest das Protokoll", async () => {
    await assertFails(getDocs(collection(als("rahel"), "protokoll")));
    await assertSucceeds(getDocs(collection(als("patrick"), "protokoll")));
  });
});

describe("Nicht freigegebene Bereiche", () => {
  beforeEach(team);
  it("sind gesperrt", async () => {
    await assertFails(setDoc(doc(als("patrick"), "kasse/2026-10-18"), { bar: 1 }));
  });
});
