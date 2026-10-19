// Server-Funktionen: verschicken Push-Nachrichten, wenn im Chat geschrieben, eine Mitteilung veröffentlicht
// eine Fahrt zugeteilt, verschoben oder abgesagt, Ferien beantragt oder entschieden oder eine Aufgabe zugeteilt wird,
// dazu jeden Abend die Erinnerung für den nächsten Tag. Wer was bekommt, steht in src/lib/push.ts.
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { setGlobalOptions } from "firebase-functions/v2";
import { onDocumentCreated, onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { heute, plusTage } from "../../src/lib/format";
import { abwesenheitPush, aufgabePush, chatEmpfaenger, chatPush, fahrtPush, mitteilungEmpfaenger, pushErlaubt, vortagPush, type PushArt, type PushEinstellungen, type PushNachricht, type PushPerson } from "../../src/lib/push";

// Gleiche Region wie die Datenbank (Zürich); wenige Instanzen reichen für das Team.
setGlobalOptions({ region: "europe-west6", maxInstances: 3 });

initializeApp();
const db = getFirestore();

async function team(): Promise<PushPerson[]> {
  const snap = await db.collection("benutzer").where("aktiv", "==", true).get();
  return snap.docs.map((d) => ({ uid: d.id, rollen: (d.get("rollen") as string[]) ?? [] }));
}

/** Schickt die Nachricht an alle Geräte der Personen, die diese Art nicht abgeschaltet haben. */
async function senden(uids: string[], art: PushArt, n: PushNachricht) {
  if (!uids.length) return;
  const einstellungen = await db.getAll(...uids.map((u) => db.doc(`push_einstellungen/${u}`)));
  const empfaenger = uids.filter((_, i) => pushErlaubt(einstellungen[i].data() as PushEinstellungen | undefined, art));
  const tokens: string[] = [];
  for (let i = 0; i < empfaenger.length; i += 30) {
    const snap = await db.collection("push_geraete").where("uid", "in", empfaenger.slice(i, i + 30)).get();
    tokens.push(...snap.docs.map((d) => d.id));
  }
  if (!tokens.length) return;
  const antwort = await getMessaging().sendEachForMulticast({
    tokens,
    // Nur Daten: das Pfötli Buch zeigt die Nachricht selbst an (public/sw.js).
    webpush: { headers: { Urgency: "high", TTL: "86400" }, data: { ...n } },
  });
  // Abgemeldete oder ungültige Geräte entfernen.
  const weg = antwort.responses
    .map((r, i) => (!r.success && ["messaging/registration-token-not-registered", "messaging/invalid-registration-token", "messaging/invalid-argument"].includes(r.error?.code ?? "") ? tokens[i] : null))
    .filter((t): t is string => !!t);
  await Promise.all(weg.map((t) => db.doc(`push_geraete/${t}`).delete()));
  logger.info("Push", { art, empfaenger: empfaenger.length, geraete: tokens.length, fehler: antwort.failureCount, entfernt: weg.length });
}

export const chatPushSenden = onDocumentCreated("chat/{kanal}/nachrichten/{id}", async (event) => {
  const d = event.data?.data();
  if (!d) return;
  const { art, uids } = chatEmpfaenger(event.params.kanal, String(d.uid), await team());
  await senden(uids, art, chatPush(event.params.kanal, String(d.person), String(d.text ?? ""), !!d.bildId));
});

export const mitteilungPushSenden = onDocumentCreated("mitteilungen/{id}", async (event) => {
  const d = event.data?.data();
  if (!d) return;
  const text = String(d.text ?? "").replace(/\s+/g, " ");
  await senden(mitteilungEmpfaenger(String(d.uid), await team()), "mitteilungen", {
    titel: `${d.wichtig ? "Wichtig: " : ""}${d.titel}`, text: text.length > 160 ? `${text.slice(0, 159)}…` : text, link: "/mitteilungen", tag: `mitteilung_${event.params.id}`,
  });
});

export const fahrtPushSenden = onDocumentWritten("fahrten/{id}", async (event) => {
  const m = fahrtPush(event.params.id, event.data?.before.data(), event.data?.after.data(), heute());
  if (m) await senden([m.uid], "fahrten", m.nachricht);
});

export const abwesenheitPushSenden = onDocumentWritten("abwesenheiten/{id}", async (event) => {
  const m = abwesenheitPush(event.data?.before.data(), event.data?.after.data(), await team());
  if (m) await senden(m.uids, "personal", m.nachricht);
});

export const aufgabePushSenden = onDocumentWritten("aufgaben/{id}", async (event) => {
  const m = aufgabePush(event.params.id, event.data?.before.data(), event.data?.after.data());
  if (m) await senden([m.uid], "aufgaben", m.nachricht);
});

/** Jeden Abend um 18 Uhr: was morgen in der Pension und im Fahrdienst ansteht. */
export const vortagErinnerung = onSchedule({ schedule: "0 18 * * *", timeZone: "Europe/Zurich" }, async () => {
  const morgen = plusTage(heute(), 1);
  const [kommen, gehen, fahrten] = await Promise.all([
    db.collection("pension_buchungen").where("von", "==", morgen).get(),
    db.collection("pension_buchungen").where("bis", "==", morgen).get(),
    db.collection("fahrten").where("datum", "==", morgen).get(),
  ]);
  const buchungen = [...kommen.docs, ...gehen.docs].map((d) => d.data());
  const hundIds = [...new Set(kommen.docs.flatMap((d) => ((d.get("hunde") as { id: string }[]) ?? []).map((h) => h.id)))].filter(Boolean);
  const hunde = hundIds.length ? (await db.getAll(...hundIds.map((id) => db.doc(`pension_hunde/${id}`)))).filter((d) => d.exists).map((d) => ({ id: d.id, name: String(d.get("name")), impfungen: d.get("impfungen") ?? [] })) : [];
  for (const m of vortagPush(morgen, buchungen, hunde, fahrten.docs.map((d) => d.data()), await team())) await senden(m.uids, "erinnerungen", m.nachricht);
});
