// Live-Daten des Ladens: alle Bereiche teilen sich dieselben Abos (wie im Ladenbuch).
import { createContext, use, useEffect, useState, type ReactNode } from "react";
import { collection, limit, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { meldung } from "../lib/fehler";
import type { Bestellung, Kasse, LoomisVorgang, Reklamation, Uebergabe, Wochenbericht } from "../lib/laden";

export type LadenDaten = {
  kasse: Kasse[];
  uebergabe: Uebergabe[];
  bestellungen: Bestellung[];
  reklamationen: Reklamation[];
  loomis: LoomisVorgang[];
  wochenberichte: Wochenbericht[];
  bereit: boolean;
  fehler: string;
};

const LEER: LadenDaten = { kasse: [], uebergabe: [], bestellungen: [], reklamationen: [], loomis: [], wochenberichte: [], bereit: false, fehler: "" };

const Kontext = createContext<LadenDaten>(LEER);

type Abo = { feld: keyof Omit<LadenDaten, "bereit" | "fehler">; sammlung: string; sortierung: string; max: number; nurLaden?: boolean };

const ABOS: Abo[] = [
  { feld: "kasse", sammlung: "kasse", sortierung: "datum", max: 800, nurLaden: true },
  { feld: "uebergabe", sammlung: "laden_uebergabe", sortierung: "erstellt", max: 400 },
  { feld: "bestellungen", sammlung: "laden_bestellungen", sortierung: "erstellt", max: 400 },
  { feld: "reklamationen", sammlung: "laden_reklamationen", sortierung: "erstellt", max: 300 },
  { feld: "loomis", sammlung: "laden_loomis", sortierung: "erstellt", max: 300 },
];

export function LadenProvider({ mitWochenbericht, children }: { mitWochenbericht: boolean; children: ReactNode }) {
  const [daten, setDaten] = useState<LadenDaten>(LEER);

  useEffect(() => {
    const abos = mitWochenbericht ? [...ABOS, { feld: "wochenberichte", sammlung: "laden_wochenberichte", sortierung: "woche", max: 60 } as Abo] : ABOS;
    const offen = new Set(abos.map((a) => a.feld));
    const stopp = abos.map((a) => {
      const q = a.nurLaden
        ? query(collection(db, a.sammlung), where("standort", "==", "laden"), orderBy(a.sortierung, "desc"), limit(a.max))
        : query(collection(db, a.sammlung), orderBy(a.sortierung, "desc"), limit(a.max));
      return onSnapshot(
        q,
        (snap) => {
          offen.delete(a.feld);
          setDaten((d) => ({ ...d, [a.feld]: snap.docs.map((x) => ({ id: x.id, ...x.data() })), bereit: offen.size === 0 }));
        },
        (err) => setDaten((d) => ({ ...d, fehler: meldung(err) })),
      );
    });
    return () => stopp.forEach((s) => s());
  }, [mitWochenbericht]);

  return <Kontext value={daten}>{children}</Kontext>;
}

export function useLaden() {
  return use(Kontext);
}
