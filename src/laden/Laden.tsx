import { NavLink, Outlet } from "react-router";
import { useIch } from "../auth";
import { heute, montagVon, stunde } from "../lib/format";
import { darf, STUFE } from "../lib/rollen";
import { LadenProvider, useLaden } from "./daten";

const BEREICHE = [
  { pfad: "kasse", titel: "Kassenbuch" },
  { pfad: "uebergabe", titel: "Übergabe" },
  { pfad: "bestellungen", titel: "Bestellungen" },
  { pfad: "reklamationen", titel: "Reklamationen" },
  { pfad: "loomis", titel: "Loomis" },
  { pfad: "wochenbericht", titel: "Wochenbericht" },
] as const;

/** Zahlen an den Reitern: was heute noch zu tun ist. */
function useHinweise(): Record<string, number> {
  const d = useLaden();
  const tag = heute();
  return {
    kasse: d.bereit && !d.kasse.some((k) => k.datum === tag) && stunde() >= 17 ? 1 : 0,
    uebergabe: d.uebergabe.filter((x) => x.pendenz && !x.erledigt).length,
    bestellungen: d.bestellungen.filter((x) => x.status === "Eingetroffen").length,
    reklamationen: d.reklamationen.filter((x) => x.status === "Offen").length,
    loomis: d.kasse.filter((k) => k.safebagBetrag > 0 && !k.abgeholt).length,
    wochenbericht: d.bereit && new Date(tag + "T12:00:00Z").getUTCDay() >= 5 && !d.wochenberichte.some((w) => w.id === montagVon(tag)) ? 1 : 0,
  };
}

function Unternavigation({ mitWochenbericht }: { mitWochenbericht: boolean }) {
  const h = useHinweise();
  const d = useLaden();
  return (
    <>
      <nav className="unternav" aria-label="Laden">
        {BEREICHE.filter((b) => mitWochenbericht || b.pfad !== "wochenbericht").map((b) => (
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

export function Laden() {
  const ich = useIch();
  const mitWochenbericht = darf(ich.rollen, "laden_wochenbericht", STUFE.lesen);
  return (
    <LadenProvider mitWochenbericht={mitWochenbericht}>
      <Unternavigation mitWochenbericht={mitWochenbericht} />
      <Outlet />
    </LadenProvider>
  );
}
