// Was heute ansteht: eigene Aufgaben, eigene Dienste und Anträge zum Freigeben (für Startseite und Navigation).
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useIch } from "../auth";
import { heute } from "../lib/format";
import { meineFaelligen, type Aufgabe } from "../lib/aufgaben";
import { darfFreigeben, type Abwesenheit, type Dienst } from "../lib/personal";
import { darf, STUFE } from "../lib/rollen";

/** Offene Aufgaben dieser Person, die bis heute fällig sind. */
export function useMeineAufgaben(): Aufgabe[] {
  const ich = useIch();
  const aktiv = darf(ich.rollen, "aufgaben");
  const [liste, setListe] = useState<Aufgabe[]>([]);
  useEffect(() => {
    if (!aktiv) return;
    return onSnapshot(
      query(collection(db, "aufgaben"), where("zustaendigUid", "==", ich.uid), where("erledigt", "==", false)),
      (snap) => setListe(snap.docs.map((x) => ({ id: x.id, ...x.data() }) as Aufgabe)),
      () => setListe([]),
    );
  }, [ich.uid, aktiv]);
  return meineFaelligen(liste, ich.uid, heute()).sort((a, b) => a.faellig.localeCompare(b.faellig));
}

/** Anträge, die diese Person bewilligen oder ablehnen darf (nur für Geschäftsführung und Leitungen). */
export function useOffeneAntraege(): Abwesenheit[] {
  const ich = useIch();
  const aktiv = darf(ich.rollen, "personal", STUFE.verwalten);
  const [liste, setListe] = useState<Abwesenheit[]>([]);
  useEffect(() => {
    if (!aktiv) return;
    return onSnapshot(
      query(collection(db, "abwesenheiten"), where("status", "==", "Beantragt")),
      (snap) => setListe(snap.docs.map((x) => ({ id: x.id, ...x.data() }) as Abwesenheit)),
      () => setListe([]),
    );
  }, [aktiv]);
  return aktiv ? liste.filter((a) => darfFreigeben(ich.rollen, ich.uid, a)) : [];
}

/** Die eigenen Dienste von heute. */
export function useDiensteHeute(): Dienst[] {
  const ich = useIch();
  const [liste, setListe] = useState<Dienst[]>([]);
  useEffect(
    () =>
      onSnapshot(
        query(collection(db, "dienste"), where("mitarbeiterUid", "==", ich.uid), where("datum", "==", heute())),
        (snap) => setListe(snap.docs.map((x) => ({ id: x.id, ...x.data() }) as Dienst).sort((a, b) => a.von.localeCompare(b.von))),
        () => setListe([]),
      ),
    [ich.uid],
  );
  return liste;
}
