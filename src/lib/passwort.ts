export const MIN_LAENGE = 10;

/** Gibt eine Fehlermeldung zurück oder null, wenn das Passwort genügt. */
export function passwortFehler(passwort: string): string | null {
  if (passwort.length < MIN_LAENGE) return `Das Passwort muss mindestens ${MIN_LAENGE} Zeichen lang sein.`;
  if (!/[a-zA-ZäöüÄÖÜ]/.test(passwort) || !/[0-9]/.test(passwort)) {
    return "Das Passwort muss Buchstaben und Zahlen enthalten.";
  }
  return null;
}

/** Zufälliges Wegwerf-Passwort für neue Konten; die Person setzt danach per E-Mail ein eigenes. */
export function zufallsPasswort(): string {
  const b = new Uint8Array(24);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)) + "1a";
}
