import { createContext, use, useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "./firebase";
import { namensTeile } from "./lib/format";
import { istRolle, type Rolle } from "./lib/rollen";

export type Benutzer = {
  uid: string;
  name: string;
  vorname: string;
  nachname: string;
  email: string;
  funktion: string | null;
  pensum: number | null;
  telefon: string | null;
  rollen: Rolle[];
  aktiv: boolean;
};

export function alsBenutzer(uid: string, d: Record<string, unknown>): Benutzer {
  return {
    uid,
    name: String(d.name ?? ""),
    ...(d.vorname != null || d.nachname != null
      ? { vorname: String(d.vorname ?? ""), nachname: String(d.nachname ?? "") }
      : namensTeile(String(d.name ?? ""))),
    email: String(d.email ?? ""),
    funktion: (d.funktion as string) ?? null,
    pensum: (d.pensum as number) ?? null,
    telefon: (d.telefon as string) ?? null,
    rollen: ((d.rollen as string[]) ?? []).filter(istRolle),
    aktiv: d.aktiv === true,
  };
}

type Zustand =
  | { status: "laedt" }
  | { status: "abgemeldet" }
  | { status: "ohne-zugang"; konto: User } // angemeldet, aber kein aktiver Eintrag im Team
  | { status: "angemeldet"; konto: User; ich: Benutzer };

const AuthKontext = createContext<Zustand>({ status: "laedt" });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [zustand, setZustand] = useState<Zustand>({ status: "laedt" });

  useEffect(() => {
    let abmeldenProfil: (() => void) | undefined;
    const abmeldenAuth = onAuthStateChanged(auth, (konto) => {
      abmeldenProfil?.();
      if (!konto) {
        setZustand({ status: "abgemeldet" });
        return;
      }
      setZustand({ status: "laedt" });
      let bestaetigt = false;
      // Live: Rollen- oder Statusänderungen durch den Admin wirken sofort.
      abmeldenProfil = onSnapshot(
        doc(db, "benutzer", konto.uid),
        { includeMetadataChanges: true },
        (snap) => {
          // Einen eigenen, vom Server noch nicht bestätigten Eintrag (Einrichtung) nicht als Zugang werten.
          if (snap.metadata.hasPendingWrites && !bestaetigt) return;
          const d = snap.data();
          bestaetigt = d?.aktiv === true;
          if (!bestaetigt) setZustand({ status: "ohne-zugang", konto });
          else setZustand({ status: "angemeldet", konto, ich: alsBenutzer(konto.uid, d!) });
        },
        () => setZustand({ status: "ohne-zugang", konto }),
      );
    });
    return () => {
      abmeldenProfil?.();
      abmeldenAuth();
    };
  }, []);

  return <AuthKontext value={zustand}>{children}</AuthKontext>;
}

export function useAuth() {
  return use(AuthKontext);
}

/** Nur innerhalb geschützter Seiten verwenden. */
export function useIch(): Benutzer {
  const z = useAuth();
  if (z.status !== "angemeldet") throw new Error("useIch ausserhalb des angemeldeten Bereichs");
  return z.ich;
}
