// Abrechnung: Tage pro Hund und Monat für die Rechnungen der Tages- und Ferienbetreuung, mit CSV für Excel.
import { useState } from "react";
import { heute, monatLabel } from "../lib/format";
import { abrechnungCsv, abrechnungTage } from "../lib/pension";
import { usePension } from "./daten";

export function Abrechnung() {
  const d = usePension();
  const [monat, setMonat] = useState(heute().slice(0, 7));
  const monate = [...new Set([heute().slice(0, 7), ...d.buchungen.flatMap((b) => [b.von.slice(0, 7), b.bis.slice(0, 7)])])].sort().reverse();
  const zeilen = abrechnungTage(d.buchungen, d.kunden, monat);
  const total = (f: "naechte" | "tage" | "tagesbetreuung") => zeilen.reduce((s, z) => s + z[f], 0);

  function exportieren() {
    const url = URL.createObjectURL(new Blob([abrechnungCsv(zeilen)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `Pension_Tage_${monat}.csv`;
    document.body.append(a);
    a.click();
    a.remove();
    // Erst später freigeben, sonst bricht der Download in manchen Browsern ab.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section className="panel" aria-labelledby="h-abr">
      <div className="panel-head">
        <h2 id="h-abr">Tage pro Hund</h2>
        <div className="actions">
          <select aria-label="Monat" value={monat} onChange={(e) => setMonat(e.target.value)} style={{ width: "auto" }}>
            {monate.map((m) => <option key={m} value={m}>{monatLabel(m)}</option>)}
          </select>
          <button type="button" className="btn small" onClick={exportieren} disabled={!zeilen.length}>CSV herunterladen</button>
        </div>
      </div>
      <p className="hint">
        Ferienbetreuung: Nächte und anwesende Tage (Ankunfts- und Abholtag mitgezählt). Tagesbetreuung: am selben Tag gebracht und abgeholt.
        Aufenthalte über das Monatsende werden pro Monat aufgeteilt. Ohne Anfragen, Stornos und Teamhunde.
      </p>
      {zeilen.length ? (
        <div className="tablewrap">
          <table>
            <thead>
              <tr><th>Kundin / Kunde</th><th>Hund</th><th>Nächte</th><th>Tage</th><th>Tagesbetreuung</th><th>Aufenthalte</th></tr>
            </thead>
            <tbody>
              {zeilen.map((z) => (
                <tr key={z.kunde + z.hund}><td>{z.kunde}</td><td>{z.hund}</td><td>{z.naechte}</td><td>{z.tage}</td><td>{z.tagesbetreuung}</td><td>{z.aufenthalte}</td></tr>
              ))}
            </tbody>
            <tfoot>
              <tr><td>Total</td><td>{zeilen.length} Hunde</td><td>{total("naechte")}</td><td>{total("tage")}</td><td>{total("tagesbetreuung")}</td><td /></tr>
            </tfoot>
          </table>
        </div>
      ) : <div className="empty">In diesem Monat gibt es keine abrechenbaren Aufenthalte.</div>}
    </section>
  );
}
