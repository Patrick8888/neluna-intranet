// Live-Daten der Pension: alle Bereiche teilen sich dieselben Abos.
import { createContext, use, useEffect, useState, type ReactNode } from "react";
import { collection, doc, limit, onSnapshot, orderBy, query, where, type Query } from "firebase/firestore";
import { db } from "../firebase";
import { meldung } from "../lib/fehler";
import type { Kasse, Uebergabe } from "../lib/laden";
import { preiseAus, STANDARD_PREISE, zimmerListe, type Buchung, type Hund, type Kunde, type Preise, type Zimmer } from "../lib/pension";

export type PensionDaten = {
  zimmer: Zimmer[];
  kunden: Kunde[];
  hunde: Hund[];
  buchungen: Buchung[];
  uebergabe: Uebergabe[];
  kasse: Kasse[];
  preise: Preise;
  bereit: boolean;
  fehler: string;
};

type Feld = keyof Omit<PensionDaten, "bereit" | "fehler" | "preise">;

const LEER: PensionDaten = { zimmer: zimmerListe([]), kunden: [], hunde: [], buchungen: [], uebergabe: [], kasse: [], preise: STANDARD_PREISE, bereit: false, fehler: "" };

const Kontext = createContext<PensionDaten>(LEER);

// Ältere Einträge ohne Liste sollen die Oberfläche nicht stören.
const aufbereiten: Partial<Record<Feld, (x: Record<string, unknown>) => unknown>> = {
  hunde: (x) => ({ ...x, impfungen: Array.isArray(x.impfungen) ? x.impfungen : [] }),
  buchungen: (x) => ({ ...x, hunde: Array.isArray(x.hunde) ? x.hunde : [], leistungen: Array.isArray(x.leistungen) ? x.leistungen : [] }),
};

export function PensionProvider({ mitTeam, mitKasse, children }: { mitTeam: boolean; mitKasse: boolean; children: ReactNode }) {
  const [daten, setDaten] = useState<PensionDaten>(LEER);

  useEffect(() => {
    const abos: [Feld, Query][] = [
      ["zimmer", query(collection(db, "pension_zimmer"))],
      ["kunden", query(collection(db, "pension_kunden"), orderBy("name"), limit(3000))],
      ["hunde", query(collection(db, "pension_hunde"), orderBy("name"), limit(4000))],
      ["buchungen", query(collection(db, "pension_buchungen"), orderBy("von", "desc"), limit(2000))],
    ];
    if (mitTeam) abos.push(["uebergabe", query(collection(db, "pension_uebergabe"), orderBy("erstellt", "desc"), limit(400))]);
    if (mitKasse) abos.push(["kasse", query(collection(db, "kasse"), where("standort", "==", "pension"), orderBy("datum", "desc"), limit(800))]);
    const offen = new Set(abos.map(([f]) => f));
    const stopp = abos.map(([feld, q]) =>
      onSnapshot(
        q,
        (snap) => {
          offen.delete(feld);
          const roh = snap.docs.map((x) => ({ id: x.id, ...x.data() }));
          const liste = aufbereiten[feld] ? roh.map(aufbereiten[feld]) : roh;
          setDaten((d) => ({ ...d, [feld]: feld === "zimmer" ? zimmerListe(liste as Zimmer[]) : liste, bereit: offen.size === 0 }));
        },
        (err) => setDaten((d) => ({ ...d, fehler: meldung(err) })),
      ),
    );
    // Preise: ohne Eintrag gelten die Standardpreise.
    stopp.push(onSnapshot(doc(db, "pension_einstellungen", "preise"), (snap) => setDaten((d) => ({ ...d, preise: preiseAus(snap.data()) })), () => {}));
    return () => stopp.forEach((s) => s());
  }, [mitTeam, mitKasse]);

  return <Kontext value={daten}>{children}</Kontext>;
}

export function usePension() {
  return use(Kontext);
}
