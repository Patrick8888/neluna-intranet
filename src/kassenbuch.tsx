// Monatsübersicht eines Kassenbuchs (Laden oder Pension) mit Total und CSV für die Treuhand.
import { useState } from "react";
import { chf, datum, heute, monatLabel, vorname, wochentagKurz } from "./lib/format";
import { kasseCsv, summe, type Kasse } from "./lib/laden";

export const vorzeichen = (n: number) => (n > 0 ? "+" : "");
export const farbe = (n: number) => (n > 0 ? "pos" : n < 0 ? "neg" : "");

export function KassenMonat({ kasse, setTag, dateiname, safebagTitel = "Safebag" }: { kasse: Kasse[]; setTag: (t: string) => void; dateiname: string; safebagTitel?: string }) {
  const [monat, setMonat] = useState(heute().slice(0, 7));
  const zeilen = kasse.filter((k) => k.datum.startsWith(monat)).sort((a, b) => a.datum.localeCompare(b.datum));
  const monate = [...new Set([heute().slice(0, 7), ...kasse.map((k) => k.datum.slice(0, 7))])].sort().reverse();

  function exportieren() {
    const url = URL.createObjectURL(new Blob([kasseCsv(zeilen)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${dateiname}_${monat}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
      <section className="panel" aria-labelledby="h-kmonat">
        <div className="panel-head">
          <h2 id="h-kmonat">Kassenbuch</h2>
          <div className="actions">
            <select aria-label="Monat" value={monat} onChange={(e) => setMonat(e.target.value)} style={{ width: "auto" }}>
              {monate.map((m) => <option key={m} value={m}>{monatLabel(m)}</option>)}
            </select>
            <button className="btn ghost small" type="button" onClick={exportieren} disabled={!zeilen.length}>CSV für Treuhand</button>
          </div>
        </div>
        {zeilen.length ? (
          <>
            <div className="tablewrap">
              <table>
                <thead>
                  <tr><th>Datum</th><th>Bar</th><th>Karte</th><th>TWINT</th><th>Total</th><th>Ausgaben</th><th>Differenz</th><th>{safebagTitel}</th><th>Wer</th></tr>
                </thead>
                <tbody>
                  {zeilen.map((r) => (
                    <tr key={r.id} className="click" onClick={() => { setTag(r.datum); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                      <td>{wochentagKurz(r.datum)} {datum(r.datum)}</td>
                      <td>{chf(r.bar)}</td><td>{chf(r.karte)}</td><td>{chf(r.twint)}</td><td>{chf(r.total)}</td><td>{chf(r.ausgaben)}</td>
                      <td className={farbe(r.differenz)}>{vorzeichen(r.differenz)}{chf(r.differenz)}</td>
                      <td>{r.safebagBetrag ? chf(r.safebagBetrag) : "–"}</td>
                      <td>{vorname(r.person)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Total {zeilen.length} Tage</td>
                    <td>{chf(summe(zeilen, "bar"))}</td><td>{chf(summe(zeilen, "karte"))}</td><td>{chf(summe(zeilen, "twint"))}</td>
                    <td>{chf(summe(zeilen, "total"))}</td><td>{chf(summe(zeilen, "ausgaben"))}</td><td>{chf(summe(zeilen, "differenz"))}</td>
                    <td>{chf(summe(zeilen, "safebagBetrag"))}</td><td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="hint">Tippe auf einen Tag, um ihn zu öffnen und zu korrigieren.</p>
          </>
        ) : (
          <div className="empty">Noch keine Abschlüsse in diesem Monat. Der erste Tagesabschluss oben erscheint hier mit Monatstotal.</div>
        )}
      </section>
  );
}
