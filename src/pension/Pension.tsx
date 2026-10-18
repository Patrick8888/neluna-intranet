import { NavLink, Outlet } from "react-router";
import { useIch } from "../auth";
import { heute, stunde } from "../lib/format";
import { darf, STUFE } from "../lib/rollen";
import { PensionProvider, usePension } from "./daten";

/** Zahlen an den Reitern: was heute noch zu tun ist. */
function useHinweise(): Record<string, number> {
  const d = usePension();
  const tag = heute();
  return {
    heute: d.buchungen.filter((b) => (b.von === tag && ["Anfrage", "Bestätigt"].includes(b.status)) || (b.bis === tag && b.status === "Eingecheckt")).length,
    uebergabe: d.uebergabe.filter((x) => x.pendenz && !x.erledigt).length,
    kasse: d.bereit && !d.kasse.some((k) => k.datum === tag) && stunde() >= 17 ? 1 : 0,
  };
}

function Unternavigation({ team, tagesplan, kasse }: { team: boolean; tagesplan: boolean; kasse: boolean }) {
  const h = useHinweise();
  const d = usePension();
  const bereiche = [
    { pfad: "heute", titel: "Übersicht", zeigen: true },
    { pfad: "belegung", titel: "Belegung", zeigen: true },
    { pfad: "kartei", titel: "Kartei", zeigen: true },
    { pfad: "tagesplan", titel: "Tagesplan", zeigen: tagesplan },
    { pfad: "uebergabe", titel: "Übergabe", zeigen: team },
    { pfad: "kasse", titel: "Kasse", zeigen: kasse },
  ];
  return (
    <>
      <nav className="unternav" aria-label="Hundepension">
        {bereiche.filter((b) => b.zeigen).map((b) => (
          <NavLink key={b.pfad} to={b.pfad} className="chip">
            {b.titel}
            {h[b.pfad] ? <span className="badge">{h[b.pfad]}</span> : null}
          </NavLink>
        ))}
      </nav>
      {d.fehler && <p className="notice bad">{d.fehler}</p>}
    </>
  );
}

export function Pension() {
  const ich = useIch();
  const team = darf(ich.rollen, "pension", STUFE.bearbeiten);
  const kasse = darf(ich.rollen, "pension_kasse", STUFE.bearbeiten);
  const tagesplan = darf(ich.rollen, "tagesplan", STUFE.bearbeiten);
  return (
    <PensionProvider mitTeam={team} mitKasse={kasse}>
      <Unternavigation team={team} tagesplan={tagesplan} kasse={kasse} />
      <Outlet />
    </PensionProvider>
  );
}
