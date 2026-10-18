// Kleine, überall gebrauchte Bausteine: Rückmeldung, Löschen mit Bestätigung, Team-Auswahl.
import { useCallback, useEffect, useRef, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "./firebase";
import { meldung } from "./lib/fehler";

/** Kurze Bestätigung unten am Bildschirm, wie im Ladenbuch. */
export function useToast() {
  const [text, setText] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const zeigen = useCallback((t: string) => {
    setText(t);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setText(""), 2200);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const element = text ? <div className="toast" role="status">{text}</div> : null;
  return { zeigen, element };
}

/** Speichern mit Rückmeldung; Fehler werden verständlich angezeigt. */
export async function speichern(zeigen: (t: string) => void, aktion: () => Promise<unknown>, ok: string): Promise<boolean> {
  try {
    await aktion();
    zeigen(ok);
    return true;
  } catch (err) {
    zeigen(meldung(err));
    return false;
  }
}

/** Erster Klick macht scharf, zweiter löscht. */
export function LoeschKnopf({ onLoeschen, disabled }: { onLoeschen: () => void; disabled?: boolean }) {
  const [scharf, setScharf] = useState(false);
  useEffect(() => {
    if (!scharf) return;
    const t = setTimeout(() => setScharf(false), 4000);
    return () => clearTimeout(t);
  }, [scharf]);
  if (disabled) return null;
  return (
    <button
      type="button"
      className={`btn danger small${scharf ? " armed" : ""}`}
      onClick={() => (scharf ? (setScharf(false), onLoeschen()) : setScharf(true))}
    >
      {scharf ? "Wirklich löschen?" : "Löschen"}
    </button>
  );
}

/** Namen aller aktiven Personen, alphabetisch. */
export function useTeamNamen(): string[] {
  const [namen, setNamen] = useState<string[]>([]);
  useEffect(
    () =>
      onSnapshot(query(collection(db, "benutzer"), where("aktiv", "==", true)), (snap) =>
        setNamen(snap.docs.map((d) => String(d.data().name)).sort((a, b) => a.localeCompare(b, "de"))),
      ),
    [],
  );
  return namen;
}

export type TeamPerson = { uid: string; name: string; rollen: string[] };

/** Alle aktiven Personen mit Rollen, alphabetisch (z. B. für die Auswahl der Fahrer/innen). */
export function useTeam(): TeamPerson[] {
  const [team, setTeam] = useState<TeamPerson[]>([]);
  useEffect(
    () =>
      onSnapshot(query(collection(db, "benutzer"), where("aktiv", "==", true)), (snap) =>
        setTeam(
          snap.docs
            .map((d) => ({ uid: d.id, name: String(d.data().name), rollen: (d.data().rollen as string[]) ?? [] }))
            .sort((a, b) => a.name.localeCompare(b.name, "de")),
        ),
      ),
    [],
  );
  return team;
}
