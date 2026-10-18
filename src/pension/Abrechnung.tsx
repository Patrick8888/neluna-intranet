// Abrechnung: Tage pro Hund und Monat für die Rechnungen der Tages- und Ferienbetreuung, mit Beträgen und CSV für Excel.
import { useState, type FormEvent } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useIch } from "../auth";
import { chf, heute, monatLabel, zahl } from "../lib/format";
import { abrechnungBetrag, abrechnungCsv, abrechnungTage, MWST, mwstAnteil, type Preise } from "../lib/pension";
import { darf, STUFE } from "../lib/rollen";
import { speichern, useToast } from "../ui";
import { usePension } from "./daten";

function PreiseAendern({ preise, fertig, zeigen }: { preise: Preise; fertig: () => void; zeigen: (t: string) => void }) {
  const ich = useIch();
  const [tag, setTag] = useState(String(preise.tagesbetreuung));
  const [nacht, setNacht] = useState(String(preise.uebernachtung));

  async function absenden(e: FormEvent) {
    e.preventDefault();
    const neu = { tagesbetreuung: zahl(tag), uebernachtung: zahl(nacht), person: ich.name, uid: ich.uid };
    if (await speichern(zeigen, () => setDoc(doc(db, "pension_einstellungen", "preise"), neu), "Preise gespeichert")) fertig();
  }

  return (
    <form className="item grid" onSubmit={absenden}>
      <label>Tagesbetreuung pro Tag (CHF)<input className="num" inputMode="decimal" value={tag} onChange={(e) => setTag(e.target.value)} autoFocus /></label>
      <label>Übernachtung pro Nacht (CHF)<input className="num" inputMode="decimal" value={nacht} onChange={(e) => setNacht(e.target.value)} /></label>
      <div className="wide actions">
        <button className="btn small">Preise speichern</button>
        <button type="button" className="btn ghost small" onClick={fertig}>Abbrechen</button>
      </div>
    </form>
  );
}

export function Abrechnung() {
  const d = usePension();
  const ich = useIch();
  const { zeigen, element } = useToast();
  const leitung = darf(ich.rollen, "pension", STUFE.verwalten);
  const [aendern, setAendern] = useState(false);
  const [monat, setMonat] = useState(heute().slice(0, 7));
  const monate = [...new Set([heute().slice(0, 7), ...d.buchungen.flatMap((b) => [b.von.slice(0, 7), b.bis.slice(0, 7)])])].sort().reverse();
  const zeilen = abrechnungTage(d.buchungen, d.kunden, monat);
  const total = (f: "naechte" | "tage" | "tagesbetreuung") => zeilen.reduce((s, z) => s + z[f], 0);
  const betrag = zeilen.reduce((s, z) => s + abrechnungBetrag(z, d.preise), 0);

  function exportieren() {
    const url = URL.createObjectURL(new Blob([abrechnungCsv(zeilen, d.preise)], { type: "text/csv;charset=utf-8" }));
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
    <>
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
          Betrag nach Preisliste ohne Fahrdienst und Zusatzleistungen, inklusive {MWST.normal} % MWST.
        </p>
        {zeilen.length ? (
          <div className="tablewrap">
            <table>
              <thead>
                <tr><th>Kundin / Kunde</th><th>Hund</th><th>Nächte</th><th>Tage</th><th>Tagesbetreuung</th><th>Aufenthalte</th><th>Betrag CHF</th></tr>
              </thead>
              <tbody>
                {zeilen.map((z) => (
                  <tr key={z.kunde + z.hund}><td>{z.kunde}</td><td>{z.hund}</td><td>{z.naechte}</td><td>{z.tage}</td><td>{z.tagesbetreuung}</td><td>{z.aufenthalte}</td><td>{chf(abrechnungBetrag(z, d.preise))}</td></tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td>Total</td><td>{zeilen.length} Hunde</td><td>{total("naechte")}</td><td>{total("tage")}</td><td>{total("tagesbetreuung")}</td><td /><td>{chf(betrag)}</td></tr>
                <tr><td colSpan={6}>davon MWST {MWST.normal} %</td><td>{chf(mwstAnteil(betrag, MWST.normal))}</td></tr>
              </tfoot>
            </table>
          </div>
        ) : <div className="empty">In diesem Monat gibt es keine abrechenbaren Aufenthalte.</div>}
      </section>
      <section className="panel" aria-labelledby="h-preise">
        <div className="panel-head">
          <h2 id="h-preise">Preise pro Hund</h2>
          {leitung && !aendern && <button type="button" className="btn ghost small" onClick={() => setAendern(true)}>Preise ändern</button>}
        </div>
        {aendern
          ? <PreiseAendern preise={d.preise} fertig={() => setAendern(false)} zeigen={zeigen} />
          : (
            <div className="calc">
              <div><span>Tagesbetreuung pro Tag</span><b>{chf(d.preise.tagesbetreuung)}</b></div>
              <div><span>Übernachtung pro Nacht</span><b>{chf(d.preise.uebernachtung)}</b></div>
            </div>
          )}
        <p className="hint">
          Ferien: jeder anwesende Tag zählt als Tagesbetreuung, dazu jede Nacht. Beispiel Freitag bis Sonntag: 3 × {chf(d.preise.tagesbetreuung)} + 2 × {chf(d.preise.uebernachtung)} = CHF {chf(3 * d.preise.tagesbetreuung + 2 * d.preise.uebernachtung)}.
        </p>
      </section>
      {element}
    </>
  );
}
