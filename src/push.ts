// Push-Nachrichten auf diesem Gerät ein- und ausschalten (Firebase Cloud Messaging).
import { deleteToken, getMessaging, getToken, isSupported } from "firebase/messaging";
import { deleteDoc, doc, setDoc } from "firebase/firestore";
import { app, db } from "./firebase";
import { zeitstempel } from "./lib/format";

const VAPID = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;
const SPEICHER = "pfoetli-push-token";

/** Ist Push eingerichtet (Schlüssel vorhanden) und kann dieser Browser es? */
export async function pushMoeglich(): Promise<boolean> {
  if (!VAPID || import.meta.env.VITE_EMULATOR === "true") return false;
  if (!("serviceWorker" in navigator) || typeof Notification === "undefined") return false;
  return isSupported().catch(() => false);
}

export const pushAktiv = () => typeof Notification !== "undefined" && Notification.permission === "granted" && !!localStorage.getItem(SPEICHER);

/** iPhone und iPad: Push gibt es nur, wenn das Pfötli Buch auf dem Home-Bildschirm liegt. */
export const iosOhneHomeBildschirm = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone);

function geraetName(): string {
  const ua = navigator.userAgent;
  const system = /iphone/i.test(ua) ? "iPhone" : /ipad/i.test(ua) ? "iPad" : /android/i.test(ua) ? "Android" : /windows/i.test(ua) ? "Windows" : /mac os/i.test(ua) ? "Mac" : "Gerät";
  const browser = /edg\//i.test(ua) ? "Edge" : /firefox/i.test(ua) ? "Firefox" : /chrome|crios/i.test(ua) ? "Chrome" : /safari/i.test(ua) ? "Safari" : "Browser";
  return `${system}, ${browser}`;
}

export async function pushEinschalten(uid: string): Promise<void> {
  if ((await Notification.requestPermission()) !== "granted") throw new Error("Benachrichtigungen sind für das Pfötli Buch blockiert. Bitte in den Einstellungen des Browsers erlauben.");
  const sw = await navigator.serviceWorker.register("/sw.js");
  const token = await getToken(getMessaging(app), { vapidKey: VAPID, serviceWorkerRegistration: sw });
  await setDoc(doc(db, "push_geraete", token), { uid, geraet: geraetName(), erstellt: zeitstempel() });
  localStorage.setItem(SPEICHER, token);
}

/** Beim Ausschalten und beim Abmelden: dieses Gerät bekommt nichts mehr. */
export async function pushAusschalten(): Promise<void> {
  const token = localStorage.getItem(SPEICHER);
  localStorage.removeItem(SPEICHER);
  if (!token) return;
  await Promise.allSettled([deleteDoc(doc(db, "push_geraete", token)), deleteToken(getMessaging(app))]);
}

/** Beim Start: ein gespeichertes Gerät mit dem aktuellen Token abgleichen (Tokens erneuern sich gelegentlich). */
export async function pushAuffrischen(uid: string): Promise<void> {
  if (!pushAktiv() || !(await pushMoeglich())) return;
  const sw = await navigator.serviceWorker.register("/sw.js");
  const token = await getToken(getMessaging(app), { vapidKey: VAPID, serviceWorkerRegistration: sw });
  const alt = localStorage.getItem(SPEICHER);
  if (alt && alt !== token) await deleteDoc(doc(db, "push_geraete", alt)).catch(() => {});
  await setDoc(doc(db, "push_geraete", token), { uid, geraet: geraetName(), erstellt: zeitstempel() });
  localStorage.setItem(SPEICHER, token);
}
