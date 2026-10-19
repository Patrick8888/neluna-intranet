// Zimmerübersicht: welcher Hund ist an einem Tag in welchem Zimmer, mit Futter und Medikamenten.
import { useState } from "react";
import { Link } from "react-router";
import { datum, heute, plusTage, wochentagKurz } from "../lib/format";
import { klassenName, zimmerAm, type Gast } from "../lib/pension";
import { usePension } from "./daten";

function GastZeile({ g, tag }: { g: Gast; tag: string }) {
  const { hund: h, buchung: b } = g;
  return (
    <div className="zimmer-gast">
      <div className="item-row">
        <Link to={`/pension/hund/${h.id}`}><strong>{h.name}</strong></Link>
        <span className="actions">
          {b.von === tag && <span className="pill good">Ankunft</span>}
          {b.bis === tag && <span className="pill warn">Abholung</span>}
          {b.status === "Bestätigt" && b.von < tag && <span className="pill acc">nicht eingecheckt</span>}
        </span>
      </div>
      <div className="meta">
        {[h.rasse, klassenName(h.gewichtsklasse)].filter(Boolean).join(" · ") && <span>{[h.rasse, klassenName(h.gewichtsklasse)].filter(Boolean).join(" · ")}</span>}
        <span>{b.kundeName}</span>
        <span>bis {wochentagKurz(b.bis)} {datum(b.bis)}</span>
      </div>
      <div className="zimmer-futter">
        <span><b>Futter:</b> {[h.futter, h.menge, h.fuetterungszeiten].filter(Boolean).join(" · ") || "nicht erfasst"}</span>
        {h.medikamente && <span className="pill bad">Medikamente: {h.medikamente}</span>}
        {h.allergien && <span className="pill warn">Allergie: {h.allergien}</span>}
        {!h.vertraeglich && <span className="pill bad">nicht verträglich</span>}
        {b.leistungen.includes("Eigenes Futter") && <span className="pill">eigenes Futter</span>}
      </div>
    </div>
  );
}

export function Zimmer() {
  const d = usePension();
  const [tag, setTag] = useState(heute());
  const raeume = zimmerAm(d, tag);
  const gaeste = raeume.flatMap((r) => r.gaeste.map((g) => ({ ...g, zimmer: r.zimmer.name })));

  return (
    <>
      <section className="panel" aria-labelledby="h-zi">
        <div className="panel-head">
          <h2 id="h-zi">Zimmer {wochentagKurz(tag)} {datum(tag)}</h2>
          <div className="actions no-print">
            <button type="button" className="btn ghost small" onClick={() => setTag(plusTage(tag, -1))} aria-label="Vortag">←</button>
            <button type="button" className="btn ghost small" onClick={() => setTag(heute())}>Heute</button>
            <button type="button" className="btn ghost small" onClick={() => setTag(plusTage(tag, 1))} aria-label="Folgetag">→</button>
            <button type="button" className="btn small" onClick={() => window.print()}>Drucken</button>
          </div>
        </div>
        <p className="hint">{gaeste.length ? `${gaeste.length} ${gaeste.length === 1 ? "Hund" : "Hunde"} im Haus · ${raeume.filter((r) => !r.gaeste.length).length} Zimmer frei` : "An diesem Tag ist kein Hund in der Pension."}</p>
        <div className="zimmer-raster">
          {raeume.map(({ zimmer: z, gaeste: g }) => (
            <article key={z.id} className={`item zimmer-karte${g.length ? "" : " frei"}`}>
              <div className="item-row">
                <strong>{z.name}</strong>
                <span className="pill">{g.length ? `${g.length} / ${z.maxHunde}` : "frei"}</span>
              </div>
              {g.map((x) => <GastZeile key={`${x.buchung.id}-${x.hund.id}`} g={x} tag={tag} />)}
            </article>
          ))}
        </div>
      </section>

      {gaeste.length > 0 && (
        <section className="panel" aria-labelledby="h-fm">
          <h2 id="h-fm">Fütterung und Medikamente</h2>
          <div className="tablewrap">
            <table className="futterplan">
              <thead><tr><th>Zimmer</th><th>Hund</th><th>Futter</th><th>Menge</th><th>Zeiten</th><th>Medikamente</th><th>Allergien</th></tr></thead>
              <tbody>
                {gaeste.map((g) => (
                  <tr key={`${g.buchung.id}-${g.hund.id}`}>
                    <td>{g.zimmer}</td>
                    <td><Link to={`/pension/hund/${g.hund.id}`}>{g.hund.name}</Link></td>
                    <td>{g.hund.futter || "–"}</td>
                    <td>{g.hund.menge || "–"}</td>
                    <td>{g.hund.fuetterungszeiten || "–"}</td>
                    <td className={g.hund.medikamente ? "warnzelle" : ""}>{g.hund.medikamente || "–"}</td>
                    <td>{g.hund.allergien || "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint no-print">Abhaken unter <Link to="/pension/tagesplan">Tagesplan</Link>. Angaben ändern im Stammblatt des Hundes.</p>
        </section>
      )}
    </>
  );
}
