import { initializeApp, deleteApp, type FirebaseOptions } from "firebase/app";
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signOut } from "firebase/auth";
import { connectFirestoreEmulator, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

const emulator = import.meta.env.VITE_EMULATOR === "true";

export const config: FirebaseOptions = emulator
  ? { apiKey: "demo", authDomain: "demo-neluna.firebaseapp.com", projectId: "demo-neluna", appId: "demo" }
  : {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
    };

export const app = initializeApp(config);
export const auth = getAuth(app);
auth.languageCode = "de";

// Lokaler Zwischenspeicher: die App bleibt bei kurzem Netzunterbruch bedienbar.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

if (emulator) {
  connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
  connectFirestoreEmulator(db, "127.0.0.1", 8080);
}

/**
 * Legt ein Login-Konto für eine andere Person an, ohne die eigene Anmeldung zu verlieren
 * (dafür eine zweite, kurzlebige Firebase-Instanz). Gibt die neue Benutzer-ID zurück.
 */
export async function kontoAnlegen(email: string, passwort: string): Promise<string> {
  const zweit = initializeApp(config, `anlegen-${Date.now()}`);
  try {
    const zweitAuth = getAuth(zweit);
    if (emulator) connectAuthEmulator(zweitAuth, "http://127.0.0.1:9099", { disableWarnings: true });
    const { user } = await createUserWithEmailAndPassword(zweitAuth, email, passwort);
    await signOut(zweitAuth);
    return user.uid;
  } finally {
    await deleteApp(zweit);
  }
}
