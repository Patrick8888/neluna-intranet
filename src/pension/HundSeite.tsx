// Stammblatt eines Hundes: alles zum Hund auf einer Seite, mit Halter/in, Zimmer und Aufenthalten.
import { Link, useParams } from "react-router";
import { useIch } from "../auth";
import { datum, heute, wochentagKurz } from "../lib/format";
import { aufenthaltVon, impfWarnungen, istDa, volleAdresse } from "../lib/pension";
import { darf, STUFE } from "../lib/rollen";
import { statusFarbe } from "./BuchungKarte";
import { usePension } from "./daten";
import { HundBlatt, Notfall } from "./Stammblatt";

export function HundSeite() {
  const { hundId } = useParams();
  const ich = useIch();
  const d = usePension();
  const h = d.hunde.find((x) => x.id === hundId);
  if (!h) return d.bereit ? <section className="panel"><p className="hint">Diesen Hund gibt es nicht.</p></section> : null;
  const kunde = d.kunden.find((k) => k.id === h.kundeId);
  const tag = heute();
  const jetzt = aufenthaltVon(d.buchungen, h.id, tag);
  const da = jetzt && istDa(jetzt, tag);
  const zimmer = jetzt && d.zimmer.find((z) => z.id === jetzt.zimmerId);
  const aufenthalte = d.buchungen.filter((b) => b.hunde.some((x) => x.id === h.id) && b.status !== "Storniert").sort((a, b) => b.von.localeCompare(a.von));
  const warnungen = impfWarnungen(h, jetzt?.bis ?? tag, tag);
  const bearbeiten = darf(ich.rollen, "pension", STUFE.bearbeiten);

  return (
    <div className="stammblatt">
      <div className="actions no-print">
        <Link className="btn ghost small" to="/pension/kartei">Zur Kartei</Link>
        {bearbeiten && kunde && <Link className="btn ghost small" to={`/pension/kartei?kunde=${kunde.id}`}>Angaben bearbeiten</Link>}
        {kunde && <Link className="btn ghost small" to={`/pension/stammblatt/${kunde.id}`}>Stammblatt Halter/in</Link>}
        <button type="button" className="btn small" onClick={() => window.print()}>Drucken</button>
      </div>
      <section className="panel sb-block">
        <div className="eyebrow">Stammblatt Hund · Hundepension Willisdorf · Stand {datum(tag)}</div>
        <h1>{h.name}{kunde?.team && <span className="pill acc" style={{ marginLeft: 8 }}>Teamhund</span>}</h1>
        <div className="meta">
          {da ? <span className="pill good">Jetzt im Haus · {zimmer?.name}</span>
            : jetzt ? <span className="pill acc">Nächster Aufenthalt {wochentagKurz(jetzt.von)} {datum(jetzt.von)} · {zimmer?.name}</span>
              : <span className="pill">Kein Aufenthalt geplant</span>}
          {jetzt && <span>bis {wochentagKurz(jetzt.bis)} {datum(jetzt.bis)}</span>}
        </div>
        {warnungen.map((w) => <p key={w} className="notice">{w}</p>)}
        {kunde && (
          <div className="sb-raster">
            <div className="sb-zeile"><span>Halter/in</span><b>{kunde.name}</b></div>
            <div className="sb-zeile"><span>Telefon</span><b>{kunde.telefon ? <a href={`tel:${kunde.telefon.replace(/\s/g, "")}`}>{kunde.telefon}</a> : " "}</b></div>
            <div className="sb-zeile"><span>Adresse</span><b>{volleAdresse(kunde) || " "}</b></div>
          </div>
        )}
        {kunde && <><h3 className="lbl">Notfallkontakte Halter/in</h3><Notfall k={kunde} /></>}
      </section>
      <HundBlatt h={h} kunde={kunde} />
      <section className="panel sb-block">
        <h2>Aufenthalte</h2>
        {aufenthalte.length ? (
          <div className="list">
            {aufenthalte.slice(0, 20).map((b) => (
              <div key={b.id} className="meta">
                <span>{datum(b.von)}–{datum(b.bis)}</span>
                <span>{d.zimmer.find((z) => z.id === b.zimmerId)?.name}</span>
                <span className={`pill ${statusFarbe[b.status]}`}>{b.status}</span>
                {b.bemerkung && <span>{b.bemerkung}</span>}
              </div>
            ))}
          </div>
        ) : <p className="hint">Noch keine Aufenthalte.</p>}
      </section>
    </div>
  );
}
