import { useState, type FormEvent } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useIch } from "../auth";
import { chf, datum, heute, monatLabel, vorname, wochentagKurz, zahl } from "../lib/format";
import { kasseCsv, kasseId, kasseRechnen, letztesWechselgeld, summe, type Kasse as KasseT } from "../lib/laden";
import { darf, STUFE } from "../lib/rollen";
import { LoeschKnopf, speichern, useToast } from "../ui";
import { deleteDoc } from "firebase/firestore";
import { useLaden } from "./daten";

const FELDER = [
  ["anfang", "Wechselgeld Anfang (CHF)"],
  ["bar", "Umsatz bar lt. Z-Bon"],
  ["karte", "Umsatz Karte"],
  ["twint", "Umsatz TWINT"],
  ["ausgaben", "Bar-Ausgaben (mit Beleg)"],
  ["gezaehlt", "Bargeld gezählt"],
  ["safebag", "In Safebag für Loomis"],
] as const;
type Feld = (typeof FELDER)[number][0];

const vorzeichen = (n: number) => (n > 0 ? "+" : "");
const farbe = (n: number) => (n > 0 ? "pos" : n < 0 ? "neg" : "");

function Abschluss({ tag, setTag, vorhanden, wechselgeld }: { tag: string; setTag: (t: string) => void; vorhanden?: KasseT; wechselgeld: number | null }) {
  const ich = useIch();
  const { zeigen, element } = useToast();
  const leitung = darf(ich.rollen, "laden", STUFE.verwalten);
  const start = (w: number | null | undefined) => (w == null ? "" : String(w));
  const [werte, setWerte] = useState<Record<Feld, string>>({
    anfang: vorhanden ? start(vorhanden.anfang) : start(wechselgeld),
    bar: start(vorhanden?.bar),
    karte: start(vorhanden?.karte),
    twint: start(vorhanden?.twint),
    ausgaben: start(vorhanden?.ausgaben),
    gezaehlt: start(vorhanden?.gezaehlt),
    safebag: start(vorhanden?.safebagBetrag),
  });
  const [safebagNr, setSafebagNr] = useState(vorhanden?.safebagNr ?? "");
  const [notiz, setNotiz] = useState(vorhanden?.notiz ?? "");
  const zahlen = Object.fromEntries(FELDER.map(([k]) => [k, zahl(werte[k])])) as Record<Feld, number>;
  const r = kasseRechnen(zahlen);

  async function absenden(e: FormEvent) {
    e.preventDefault();
    const eintrag = {
      standort: "laden", datum: tag, person: ich.name, uid: ich.uid,
      anfang: zahlen.anfang, bar: zahlen.bar, karte: zahlen.karte, twint: zahlen.twint, ausgaben: zahlen.ausgaben, gezaehlt: zahlen.gezaehlt,
      safebagBetrag: zahlen.safebag, safebagNr: safebagNr.trim(), notiz: notiz.trim(),
      total: r.total, soll: r.soll, differenz: r.differenz, wechselgeldNeu: r.wechselgeldNeu,
      abgeholt: vorhanden?.abgeholt ?? false, abgeholtAm: vorhanden?.abgeholtAm ?? "", geaendertAm: serverTimestamp(),
    };
    await speichern(zeigen, () => setDoc(doc(db, "kasse", kasseId("laden", tag)), eintrag), "Tagesabschluss gespeichert");
  }

  return (
    <section className="panel" aria-labelledby="h-kasse">
      <div className="panel-head">
        <h2 id="h-kasse">Tagesabschluss</h2>
        {vorhanden && <span className="pill acc">Bereits erfasst von {vorname(vorhanden.person)} · Speichern überschreibt</span>}
      </div>
      <form className="grid" onSubmit={absenden}>
        <label>Datum<input type="date" value={tag} max={heute()} onChange={(e) => setTag(e.target.value || heute())} /></label>
        <label>Erfasst von<input value={ich.name} readOnly /></label>
        {FELDER.map(([k, titel]) => (
          <label key={k}>
            {titel}
            <input className="num" inputMode="decimal" placeholder="0.00" value={werte[k]} onChange={(e) => setWerte({ ...werte, [k]: e.target.value })} />
          </label>
        ))}
        <label>Safebag-Nr.<input value={safebagNr} onChange={(e) => setSafebagNr(e.target.value)} placeholder="z. B. 004512" /></label>
        <label className="wide">Bemerkung (Ausgaben, Differenz, Besonderes)<textarea value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="z. B. Porto CHF 8.50, Differenz wegen …" /></label>
        <div className="wide calc" aria-live="polite">
          <div><span>Tagesumsatz total</span><b>{chf(r.total)}</b></div>
          <div><span>Soll-Bargeld</span><b>{chf(r.soll)}</b></div>
          <div><span>Kassendifferenz</span><b className={farbe(r.differenz)}>{vorzeichen(r.differenz)}{chf(r.differenz)}</b></div>
          <div><span>Wechselgeld für morgen</span><b>{chf(r.wechselgeldNeu)}</b></div>
        </div>
        <div className="wide actions">
          <button className="btn">Abschluss speichern</button>
          {vorhanden && (
            <LoeschKnopf disabled={!leitung} onLoeschen={() => speichern(zeigen, () => deleteDoc(doc(db, "kasse", vorhanden.id)), "Gelöscht")} />
          )}
        </div>
      </form>
      <p className="hint">Differenz = Bargeld gezählt − (Wechselgeld Anfang + Umsatz bar − Bar-Ausgaben). Das Wechselgeld für morgen wird am nächsten Tag automatisch übernommen.</p>
      {element}
    </section>
  );
}

export function Kasse() {
  const d = useLaden();
  const [tag, setTag] = useState(heute());
  const [monat, setMonat] = useState(heute().slice(0, 7));
  const vorhanden = d.kasse.find((k) => k.datum === tag);
  const zeilen = d.kasse.filter((k) => k.datum.startsWith(monat)).sort((a, b) => a.datum.localeCompare(b.datum));
  const monate = [...new Set([heute().slice(0, 7), ...d.kasse.map((k) => k.datum.slice(0, 7))])].sort().reverse();

  function exportieren() {
    const url = URL.createObjectURL(new Blob([kasseCsv(zeilen)], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `Kassenbuch_${monat}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {d.bereit ? (
        <Abschluss key={tag} tag={tag} setTag={setTag} vorhanden={vorhanden} wechselgeld={letztesWechselgeld(d.kasse, tag)} />
      ) : (
        <section className="panel"><p className="hint">Lädt …</p></section>
      )}
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
                  <tr><th>Datum</th><th>Bar</th><th>Karte</th><th>TWINT</th><th>Total</th><th>Ausgaben</th><th>Differenz</th><th>Safebag</th><th>Wer</th></tr>
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
    </>
  );
}
