import { NavLink, Outlet } from "react-router";
import { useIch } from "../auth";
import { heute } from "../lib/format";
import { faelligeTermine, fahrtenAusBuchungen, tagesRoute } from "../lib/fahrdienst";
import { darf, STUFE } from "../lib/rollen";
import { PensionProvider, usePension } from "../pension/daten";
import { FahrdienstProvider, useFahrdienst } from "./daten";

function Unternavigation({ bearbeiten, fahrzeuge }: { bearbeiten: boolean; fahrzeuge: boolean }) {
  const ich = useIch();
  const d = useFahrdienst();
  const p = usePension();
  const tag = heute();
  const plan = fahrtenAusBuchungen(p.buchungen, d.fahrten, p.kunden, tag);
  const hinweise: Record<string, number> = {
    heute: tagesRoute(d.fahrten, tag, ich.uid).filter((f) => f.status === "Geplant" || f.status === "Unterwegs").length,
    plan: bearbeiten && p.bereit && d.bereit ? plan.fehlend.length + plan.abweichend.length : 0,
    fahrzeuge: faelligeTermine(d.termine, d.fahrzeuge, tag).length,
  };
  const bereiche = [
    { pfad: "heute", titel: "Heute", zeigen: true },
    { pfad: "plan", titel: "Plan", zeigen: true },
    { pfad: "fahrzeuge", titel: "Fahrzeuge", zeigen: fahrzeuge },
  ];
  return (
    <>
      <nav className="unternav" aria-label="Fahrdienst">
        {bereiche.filter((b) => b.zeigen).map((b) => (
          <NavLink key={b.pfad} to={b.pfad} className="chip">
            {b.titel}
            {hinweise[b.pfad] ? <span className="badge">{hinweise[b.pfad]}</span> : null}
          </NavLink>
        ))}
      </nav>
      {(d.fehler || p.fehler) && <p className="notice bad">{d.fehler || p.fehler}</p>}
    </>
  );
}

export function Fahrdienst() {
  const ich = useIch();
  const bearbeiten = darf(ich.rollen, "fahrdienst", STUFE.bearbeiten);
  const fahrzeuge = darf(ich.rollen, "fahrzeuge");
  return (
    <PensionProvider mitTeam={false} mitKasse={false}>
      <FahrdienstProvider mitFahrzeugen={fahrzeuge}>
        <Unternavigation bearbeiten={bearbeiten} fahrzeuge={fahrzeuge} />
        <Outlet />
      </FahrdienstProvider>
    </PensionProvider>
  );
}
