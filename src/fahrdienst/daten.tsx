// Live-Daten von Fahrdienst und Fahrzeugen: alle Bereiche teilen sich dieselben Abos.
import { createContext, use, useEffect, useState, type ReactNode } from "react";
import { collection, limit, onSnapshot, orderBy, query, type Query } from "firebase/firestore";
import { db } from "../firebase";
import { meldung } from "../lib/fehler";
import type { Fahrt, Fahrzeug, FahrzeugTermin } from "../lib/fahrdienst";

export type FahrdienstDaten = {
  fahrten: Fahrt[];
  fahrzeuge: Fahrzeug[];
  termine: FahrzeugTermin[];
  bereit: boolean;
  fehler: string;
};

type Feld = keyof Omit<FahrdienstDaten, "bereit" | "fehler">;

const LEER: FahrdienstDaten = { fahrten: [], fahrzeuge: [], termine: [], bereit: false, fehler: "" };

const Kontext = createContext<FahrdienstDaten>(LEER);

/** Abos für Fahrten (alle) und Fahrzeuge mit Terminen (nur wer sie bearbeitet). */
export function fahrdienstAbos(mitFahrzeugen: boolean): [Feld, Query][] {
  const abos: [Feld, Query][] = [["fahrten", query(collection(db, "fahrten"), orderBy("datum", "desc"), limit(2000))]];
  if (mitFahrzeugen) {
    abos.push(["fahrzeuge", query(collection(db, "fahrzeuge"), orderBy("name"))]);
    abos.push(["termine", query(collection(db, "fahrzeug_termine"), orderBy("datum", "desc"), limit(1000))]);
  }
  return abos;
}

const aufbereiten: Partial<Record<Feld, (x: Record<string, unknown>) => unknown>> = {
  fahrten: (x) => ({ ...x, hunde: Array.isArray(x.hunde) ? x.hunde : [] }),
};

export function FahrdienstProvider({ mitFahrzeugen, children }: { mitFahrzeugen: boolean; children: ReactNode }) {
  const [daten, setDaten] = useState<FahrdienstDaten>(LEER);

  useEffect(() => {
    const abos = fahrdienstAbos(mitFahrzeugen);
    const offen = new Set(abos.map(([f]) => f));
    const stopp = abos.map(([feld, q]) =>
      onSnapshot(
        q,
        (snap) => {
          offen.delete(feld);
          const roh = snap.docs.map((x) => ({ id: x.id, ...x.data() }));
          setDaten((d) => ({ ...d, [feld]: aufbereiten[feld] ? roh.map(aufbereiten[feld]) : roh, bereit: offen.size === 0 }));
        },
        (err) => setDaten((d) => ({ ...d, fehler: meldung(err) })),
      ),
    );
    return () => stopp.forEach((s) => s());
  }, [mitFahrzeugen]);

  return <Kontext value={daten}>{children}</Kontext>;
}

export function useFahrdienst() {
  return use(Kontext);
}
