// Regeln für Chat und Mitteilungen gegen den Firestore-Emulator (npm run test:regeln).
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc, writeBatch } from "firebase/firestore";

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: "demo-neluna", firestore: { rules: readFileSync("firestore.rules", "utf8") } });
});
afterAll(() => env.cleanup());

const TEAM: Record<string, string[]> = {
  patrick: ["admin", "geschaeftsfuehrung"],
  cristina: ["leitung_pension"],
  sina: ["mitarbeit_pension"],
  rahel: ["verkauf"],
  laura: ["fahrdienst"],
  nuradmin: ["admin"],
};

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const [uid, rollen] of Object.entries(TEAM)) {
      await setDoc(doc(ctx.firestore(), "benutzer", uid), { name: uid, email: `${uid}@example.ch`, rollen, aktiv: true });
    }
  });
});

const als = (uid: string) => env.authenticatedContext(uid).firestore();

async function schreiben(uid: string, kanal: string, text = "Hallo", bild?: string) {
  const db = als(uid);
  const b = writeBatch(db);
  const ref = doc(collection(db, "chat", kanal, "nachrichten"));
  const n: Record<string, unknown> = { text, uid, person: uid, zeit: serverTimestamp() };
  if (bild !== undefined) {
    b.set(doc(db, "chat", kanal, "bilder", ref.id), { daten: bild, uid });
    n.bildId = ref.id;
  }
  b.set(ref, n);
  b.set(doc(db, "chat", kanal), { letzte: serverTimestamp(), letzterText: text, letztePerson: uid, letzteUid: uid });
  await b.commit();
  return ref.id;
}

describe("Chat", () => {
  it("Gruppen nur für die passenden Rollen", async () => {
    await assertSucceeds(schreiben("laura", "alle"));
    await assertSucceeds(schreiben("laura", "pension"));
    await assertFails(schreiben("laura", "laden"));
    await assertFails(getDocs(collection(als("rahel"), "chat/pension/nachrichten")));
    await assertSucceeds(getDocs(collection(als("rahel"), "chat/laden/nachrichten")));
    await assertFails(schreiben("sina", "leitung"));
    await assertSucceeds(schreiben("cristina", "leitung"));
    await assertFails(schreiben("nuradmin", "alle"));
    await assertFails(schreiben("laura", "zufall"));
  });

  it("Direktnachrichten nur für die beiden", async () => {
    await assertSucceeds(schreiben("laura", "dm_laura_sina"));
    await assertSucceeds(getDocs(collection(als("sina"), "chat/dm_laura_sina/nachrichten")));
    await assertSucceeds(getDoc(doc(als("sina"), "chat/dm_laura_sina")));
    await assertFails(getDocs(collection(als("rahel"), "chat/dm_laura_sina/nachrichten")));
    await assertFails(schreiben("rahel", "dm_laura_sina"));
    // Falsch sortierte ID wäre ein zweiter Verlauf für dasselbe Paar.
    await assertFails(schreiben("laura", "dm_sina_laura"));
  });

  it("Absender und Zeit sind echt; leere Nachrichten gehen nicht", async () => {
    await assertFails(setDoc(doc(als("laura"), "chat/alle/nachrichten/x"), { text: "Hallo", uid: "sina", person: "sina", zeit: serverTimestamp() }));
    await assertFails(setDoc(doc(als("laura"), "chat/alle/nachrichten/x"), { text: "Hallo", uid: "laura", person: "laura", zeit: new Date("2020-01-01") }));
    await assertFails(schreiben("laura", "alle", ""));
    await assertFails(setDoc(doc(als("laura"), "chat/alle"), { letzte: serverTimestamp(), letzterText: "x", letztePerson: "sina", letzteUid: "sina" }));
  });

  it("Fotos gehören zur Nachricht", async () => {
    await assertSucceeds(schreiben("laura", "alle", "", "data:image/jpeg;base64,AAAA"));
    await assertFails(schreiben("laura", "alle", "", "javascript:alert(1)"));
    await assertFails(schreiben("laura", "alle", "", "data:image/jpeg;base64," + "A".repeat(900_000)));
    await assertFails(setDoc(doc(als("laura"), "chat/alle/nachrichten/y"), { text: "", uid: "laura", person: "laura", zeit: serverTimestamp(), bildId: "y" }));
  });

  it("eigene Nachrichten löschen; fremde nur die Geschäftsführung", async () => {
    const id = await schreiben("laura", "alle");
    await assertFails(deleteDoc(doc(als("sina"), "chat/alle/nachrichten", id)));
    await assertFails(updateDoc(doc(als("laura"), "chat/alle/nachrichten", id), { text: "anders" }));
    await assertSucceeds(deleteDoc(doc(als("patrick"), "chat/alle/nachrichten", id)));
    const id2 = await schreiben("laura", "alle");
    await assertSucceeds(deleteDoc(doc(als("laura"), "chat/alle/nachrichten", id2)));
  });

  it("Gelesen-Stand nur für sich selbst", async () => {
    await assertSucceeds(setDoc(doc(als("laura"), "chat_gelesen/laura"), { alle: serverTimestamp() }, { merge: true }));
    await assertFails(getDoc(doc(als("sina"), "chat_gelesen/laura")));
    await assertFails(setDoc(doc(als("sina"), "chat_gelesen/laura"), { alle: serverTimestamp() }));
  });
});

describe("Mitteilungen", () => {
  const mitteilung = (uid: string, w: Record<string, unknown> = {}) => ({ titel: "Betriebsferien", text: "Vom 24.12. bis 2.1. geschlossen.", wichtig: true, erstellt: "2026-10-18T10:00:00", person: uid, uid, gelesen: {}, ...w });

  it("nur die Geschäftsführung veröffentlicht, alle lesen", async () => {
    await assertFails(addDoc(collection(als("cristina"), "mitteilungen"), mitteilung("cristina")));
    const ref = await assertSucceeds(addDoc(collection(als("patrick"), "mitteilungen"), mitteilung("patrick")));
    await assertSucceeds(getDoc(doc(als("laura"), ref.path)));
    await assertFails(getDoc(doc(als("nuradmin"), ref.path)));
  });

  it("jede Person bestätigt nur für sich und ändert sonst nichts", async () => {
    const ref = await addDoc(collection(als("patrick"), "mitteilungen"), mitteilung("patrick"));
    await assertSucceeds(updateDoc(doc(als("laura"), ref.path), { "gelesen.laura": "2026-10-18T11:00:00" }));
    await assertFails(updateDoc(doc(als("laura"), ref.path), { "gelesen.sina": "2026-10-18T11:00:00" }));
    await assertFails(updateDoc(doc(als("laura"), ref.path), { titel: "anders" }));
    await assertFails(deleteDoc(doc(als("laura"), ref.path)));
    await assertSucceeds(deleteDoc(doc(als("patrick"), ref.path)));
  });
});

describe("Push", () => {
  it("Geräte: nur eigene anmelden und abmelden, niemand liest fremde", async () => {
    const token = "abc:DEF-123_x";
    await assertSucceeds(setDoc(doc(als("laura"), "push_geraete", token), { uid: "laura", geraet: "Android, Chrome", erstellt: "2026-10-18T10:00:00" }));
    await assertFails(setDoc(doc(als("laura"), "push_geraete/anderes"), { uid: "sina", geraet: "x", erstellt: "" }));
    await assertFails(getDoc(doc(als("sina"), "push_geraete", token)));
    await assertFails(getDocs(collection(als("laura"), "push_geraete")));
    await assertFails(deleteDoc(doc(als("sina"), "push_geraete", token)));
    await assertSucceeds(deleteDoc(doc(als("laura"), "push_geraete", token)));
  });

  it("Einstellungen nur für sich, nur Ja/Nein", async () => {
    await assertSucceeds(setDoc(doc(als("laura"), "push_einstellungen/laura"), { gruppen: false }, { merge: true }));
    await assertFails(setDoc(doc(als("laura"), "push_einstellungen/laura"), { gruppen: "aus" }));
    await assertFails(setDoc(doc(als("laura"), "push_einstellungen/laura"), { spam: true }));
    await assertFails(getDoc(doc(als("sina"), "push_einstellungen/laura")));
  });
});
