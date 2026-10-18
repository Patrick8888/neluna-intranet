import { Link, useSearchParams } from "react-router";
import { useIch } from "../auth";
import { BEREICHE } from "../lib/navigation";
import { darf, ROLLEN } from "../lib/rollen";

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
