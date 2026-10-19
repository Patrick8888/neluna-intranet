// Personal: Wochenplan je Bereich sowie Ferien und Abwesenheiten mit Antrag und Freigabe.
import { createContext, use, useEffect, useState, type ReactNode } from "react";
import { NavLink, Outlet } from "react-router";
import { collection, limit, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import { useIch } from "../auth";
import { meldung } from "../lib/fehler";
import { darfFreigeben, type Abwesenheit } from "../lib/personal";
import { useTeam, type TeamPerson } from "../ui";

type PersonalDaten = { abwesenheiten: Abwesenheit[]; team: TeamPerson[]; bereit: boolean; fehler: string };

const Kontext = createContext<PersonalDaten>({ abwesenheiten: [], team: [], bereit: false, fehler: "" });

export const usePersonal = () => use(Kontext);

function PersonalProvider({ children }: { children: ReactNode }) {
  const team = useTeam();
  const [abwesenheiten, setAbwesenheiten] = useState<Abwesenheit[]>([]);
  const [bereit, setBereit] = useState(false);
  const [fehler, setFehler] = useState("");
  useEffect(
    () =>
      onSnapshot(
        query(collection(db, "abwesenheiten"), orderBy("von", "desc"), limit(1500)),
        (snap) => {
          setAbwesenheiten(snap.docs.map((x) => ({ id: x.id, ...x.data() }) as Abwesenheit));
          setBereit(true);
        },
        (e) => setFehler(meldung(e)),
      ),
    [],
  );
  return <Kontext value={{ abwesenheiten, team, bereit, fehler }}>{children}</Kontext>;
}

function Unternavigation() {
  const ich = useIch();
  const p = usePersonal();
  const offen = p.abwesenheiten.filter((a) => a.status === "Beantragt" && darfFreigeben(ich.rollen, ich.uid, a)).length;
  return (
    <>
      <nav className="unternav" aria-label="Personal">
        <NavLink to="dienstplan" className="chip">Dienstplan</NavLink>
        <NavLink to="zeiterfassung" className="chip">Zeiterfassung</NavLink>
        <NavLink to="abwesenheiten" className="chip">
          Ferien und Abwesenheiten
          {offen ? <span className="badge" aria-label={`${offen} offene Anträge`}>{offen}</span> : null}
        </NavLink>
      </nav>
      {p.fehler && <p className="notice bad">{p.fehler}</p>}
    </>
  );
}

export function Personal() {
  return (
    <PersonalProvider>
      <Unternavigation />
      <Outlet />
    </PersonalProvider>
  );
}
