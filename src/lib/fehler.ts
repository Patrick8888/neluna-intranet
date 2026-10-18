// Firebase-Fehlercodes in verständliche Meldungen übersetzen.
const MELDUNGEN: Record<string, string> = {
  "auth/invalid-credential": "E-Mail oder Passwort ist falsch.",
  "auth/wrong-password": "Das Passwort ist falsch.",
  "auth/user-not-found": "E-Mail oder Passwort ist falsch.",
  "auth/invalid-email": "Diese E-Mail-Adresse ist ungültig.",
  "auth/user-disabled": "Dieser Zugang ist gesperrt.",
  "auth/too-many-requests": "Zu viele Versuche. Bitte in einigen Minuten nochmals versuchen.",
  "auth/email-already-in-use": "Für diese E-Mail gibt es bereits ein Konto.",
  "auth/weak-password": "Das Passwort ist zu schwach.",
  "auth/requires-recent-login": "Bitte melde dich kurz ab und wieder an, dann nochmals versuchen.",
  "auth/network-request-failed": "Keine Verbindung. Bitte Internet prüfen.",
  "permission-denied": "Dafür fehlt die Berechtigung.",
  unavailable: "Keine Verbindung. Bitte Internet prüfen.",
};

export function meldung(e: unknown): string {
  const code = (e as { code?: string })?.code ?? "";
  return MELDUNGEN[code] ?? "Das hat nicht geklappt. Bitte nochmals versuchen.";
}
