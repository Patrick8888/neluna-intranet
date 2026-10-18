// Monatsübersicht eines Kassenbuchs (Laden oder Pension) mit Total und CSV für die Treuhand.
import { useState } from "react";
import { chf, datum, heute, monatLabel, vorname, wochentagKurz } from "./lib/format";
import { kasseCsv, summe, type Kasse } from "./lib/laden";
import { MWST, mwstAufteilen } from "./lib/pension";

export const vorzeichen = (n: number) => (n > 0 ? "+" : "");
export const farbe = (n: number) => (n > 0 ? "pos" : n < 0 ? "neg" : "");

export function KassenMonat({ kasse, setTag, dateiname, safebagTitel = "Safebag", mitMwst = false }: { kasse: Kasse[]; setTag: (t: string) => void; dateiname: string; safebagTitel?: string; mitMwst?: boolean }) {
  const [monat, setMonat] = useState(heute().slice(0, 7));
  const zeilen = kasse.filter((k) => k.datum.startsWith(monat)).sort((a, b) => a.datum.localeCompare(b.datum));
  // Pension: MWST je Satz; ältere Abschlüsse ohne Hofladen zählen ganz zum Normalsatz.
  const mw = (r: Kasse) => mwstAufteilen(r.total, r.hofFutter ?? 0, r.hofZubehoer ?? 0);
  const mwSumme = (f: "mwst81" | "mwst26" | "hof") => zeilen.reduce((s, r) => s + (f === "hof" ? (r.hofFutter ?? 0) + (r.hofZubehoer ?? 0) : mw(r)[f]), 0);
  const monate = [...new Set([heute().slice(0, 7), ...kasse.map((k) => k.datum.slice(0, 7))])].sort().reverse();

  function exportieren() {
    const url = URL.createObjectURL(new Blob([kasseCsv(zeilen, mitMwst)], { type: "text/csv;charset=utf-8" }));
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
                  <tr><th>Datum</th><th>Bar</th><th>Karte</th><th>TWINT</th><th>Total</th>{mitMwst && <><th>Hofladen</th><th>MWST {MWST.normal} %</th><th>MWST {MWST.reduziert} %</th></>}<th>Ausgaben</th><th>Differenz</th><th>{safebagTitel}</th><th>Wer</th></tr>
                </thead>
                <tbody>
                  {zeilen.map((r) => (
                    <tr key={r.id} className="click" onClick={() => { setTag(r.datum); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                      <td>{wochentagKurz(r.datum)} {datum(r.datum)}</td>
                      <td>{chf(r.bar)}</td><td>{chf(r.karte)}</td><td>{chf(r.twint)}</td><td>{chf(r.total)}</td>{mitMwst && <><td>{chf((r.hofFutter ?? 0) + (r.hofZubehoer ?? 0))}</td><td>{chf(mw(r).mwst81)}</td><td>{chf(mw(r).mwst26)}</td></>}<td>{chf(r.ausgaben)}</td>
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
                    <td>{chf(summe(zeilen, "total"))}</td>{mitMwst && <><td>{chf(mwSumme("hof"))}</td><td>{chf(mwSumme("mwst81"))}</td><td>{chf(mwSumme("mwst26"))}</td></>}<td>{chf(summe(zeilen, "ausgaben"))}</td><td>{chf(summe(zeilen, "differenz"))}</td>
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
