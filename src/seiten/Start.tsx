import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useIch } from "../auth";
import { heute } from "../lib/format";
import { BEREICHE } from "../lib/navigation";
import { darf, ROLLEN, STUFE } from "../lib/rollen";

/** Abends erinnern, wenn der Kassenabschluss der Pension fehlt (er ist dort neu). */
function KassenErinnerung({ stunde }: { stunde: number }) {
  const [fehlt, setFehlt] = useState(false);
  useEffect(() => onSnapshot(doc(db, "kasse", `pension_${heute()}`), (snap) => setFehlt(!snap.exists()), () => setFehlt(false)), []);
  if (!fehlt || stunde < 17) return null;
  return (
    <p className="notice">
      Der Kassenabschluss der Pension fehlt heute noch. <Link to="/pension/kasse">Jetzt Schritt für Schritt abschliessen</Link>
    </p>
  );
}

function begruessung(stunde: number) {
  if (stunde < 11) return "Guten Morgen";
  if (stunde < 17) return "Guten Tag";
  return "Guten Abend";
}

export function Start() {
  const ich = useIch();
  const [params] = useSearchParams();
  const jetzt = new Date();
  const stunde = Number(
    new Intl.DateTimeFormat("de-CH", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/Zurich" })
      .formatToParts(jetzt)
      .find((t) => t.type === "hour")?.value,
  );
  const datum = jetzt.toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Zurich" });
  const meine = BEREICHE.filter((x) => darf(ich.rollen, x.modul));

  return (
    <>
      {params.has("kein-zugriff") && <p className="notice bad">Für diesen Bereich fehlt dir die Berechtigung.</p>}
      {darf(ich.rollen, "pension_kasse", STUFE.bearbeiten) && <KassenErinnerung stunde={stunde} />}
      <section className="panel">
        <div className="eyebrow">{datum}</div>
        <h1>{begruessung(stunde)}, {ich.name.split(" ")[0]}</h1>
        <p className="muted" style={{ margin: 0 }}>
          {ich.rollen.length ? ich.rollen.map((r) => ROLLEN[r]).join(" · ") : "Noch keine Rolle zugewiesen. Bitte bei Patrick Schaub melden."}
        </p>
      </section>

      <section className="panel" aria-labelledby="h-bereiche">
        <h2 id="h-bereiche">Deine Bereiche</h2>
        <div className="kacheln">
          {meine.map((x) =>
            x.pfad ? (
              <Link key={x.modul} to={x.pfad} className="kachel">
                <strong>{x.titel}</strong>
                <span className="hint">{x.beschreibung}</span>
              </Link>
            ) : (
              <div key={x.modul} className="kachel bald">
                <strong>{x.titel}</strong>
                <span className="hint">{x.beschreibung}</span>
                <span><span className="pill">Kommt in Phase {x.phase}</span></span>
              </div>
            ),
          )}
        </div>
      </section>
    </>
  );
}
