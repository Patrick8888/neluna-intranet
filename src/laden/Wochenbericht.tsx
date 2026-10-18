import { useState, type FormEvent } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useIch } from "../auth";
import { chf, datum, heute, montagVon, plusTage, vorname, wochenLabel } from "../lib/format";
import { WB_FELDER, wochenberichtText, wochenzahlen, type WbFeld, type Wochenbericht as WbT } from "../lib/laden";
import { darf, STUFE } from "../lib/rollen";
import { speichern, useToast } from "../ui";
import { useLaden } from "./daten";

// Die Meldung lebt im Elternteil: nach dem ersten Speichern wird das Formular neu aufgebaut.
function Formular({ montag, setMontag, vorhanden, darfSchreiben, zeigen }: { montag: string; setMontag: (m: string) => void; vorhanden?: WbT; darfSchreiben: boolean; zeigen: (text: string) => void }) {
  const ich = useIch();
  const d = useLaden();
  const [texte, setTexte] = useState<Partial<Record<WbFeld, string>>>(() => Object.fromEntries(WB_FELDER.map(([k]) => [k, vorhanden?.[k] ?? ""])));
  const [kopie, setKopie] = useState("");
  const wochen = Array.from({ length: 10 }, (_, i) => plusTage(montagVon(heute()), -7 * i));
  if (!wochen.includes(montag)) wochen.push(montag);

  async function absenden(e: FormEvent) {
    e.preventDefault();
    const eintrag = { woche: montag, person: ich.name, uid: ich.uid, gespeichert: heute(), zahlen: wochenzahlen(montag, d), ...Object.fromEntries(WB_FELDER.map(([k]) => [k, (texte[k] ?? "").trim()])) };
    await speichern(zeigen, () => setDoc(doc(db, "laden_wochenberichte", montag), eintrag), "Wochenbericht gespeichert");
  }

  async function kopieren() {
    const text = wochenberichtText(wochenLabel(montag), vorhanden?.person ?? ich.name, wochenzahlen(montag, d), texte, chf);
    try {
      await navigator.clipboard.writeText(text);
      zeigen("Text kopiert");
    } catch {
      setKopie(text);
      zeigen("Text unten markieren und kopieren");
    }
  }

  return (
    <section className="panel" aria-labelledby="h-wb">
      <div className="panel-head">
        <h2 id="h-wb">Wochenbericht</h2>
        {vorhanden ? <span className="pill good">Gespeichert {datum(vorhanden.gespeichert)} · {vorname(vorhanden.person)}</span> : <span className="pill warn">Noch nicht erstellt</span>}
      </div>
      <form className="grid" onSubmit={absenden}>
        <label>Woche<select value={montag} onChange={(e) => setMontag(e.target.value)}>{wochen.map((w) => <option key={w} value={w}>{wochenLabel(w)}</option>)}</select></label>
        {WB_FELDER.map(([k, titel, platzhalter]) => (
          <label key={k} className="wide">
            {titel}
            <textarea value={texte[k] ?? ""} readOnly={!darfSchreiben} placeholder={darfSchreiben ? platzhalter : ""} onChange={(e) => setTexte({ ...texte, [k]: e.target.value })} />
          </label>
        ))}
        <div className="wide actions">
          {darfSchreiben && <button className="btn">Bericht speichern</button>}
          <button className="btn ghost" type="button" onClick={kopieren}>Text kopieren</button>
        </div>
        {kopie && <textarea className="wide" readOnly value={kopie} style={{ minHeight: 220 }} onFocus={(e) => e.target.select()} autoFocus />}
      </form>
      <p className="hint">Bis Samstagabend speichern. Nel und Pädi lesen den Bericht hier. Mit «Text kopieren» lässt er sich auch per WhatsApp oder E-Mail senden.</p>
    </section>
  );
}

export function Wochenbericht() {
  const ich = useIch();
  const d = useLaden();
  const [montag, setMontag] = useState(montagVon(heute()));
  const vorhanden = d.wochenberichte.find((w) => w.id === montag);
  const z = wochenzahlen(montag, d);
  const liste = [...d.wochenberichte].sort((a, b) => b.id.localeCompare(a.id));
  const darfSchreiben = darf(ich.rollen, "laden_wochenbericht", STUFE.bearbeiten);
  const { zeigen, element } = useToast();

  return (
    <>
      <section className="panel" aria-labelledby="h-wbz">
        <div className="panel-head"><h2 id="h-wbz">Zahlen der Woche</h2><span className="pill acc">{wochenLabel(montag)}</span></div>
        <div className="calc">
          <div><span>Umsatz total</span><b>{chf(z.total)}</b></div>
          <div><span>Bar</span><b>{chf(z.bar)}</b></div>
          <div><span>Karte</span><b>{chf(z.karte)}</b></div>
          <div><span>TWINT</span><b>{chf(z.twint)}</b></div>
          <div><span>Kassendifferenz</span><b className={z.differenz > 0 ? "pos" : z.differenz < 0 ? "neg" : ""}>{z.differenz > 0 ? "+" : ""}{chf(z.differenz)}</b></div>
          <div><span>Safebags offen</span><b>{z.safebagsOffen}</b></div>
          <div><span>Offene Pendenzen</span><b>{z.pendenzen}</b></div>
          <div><span>Neue Reklamationen</span><b>{z.reklNeu}</b></div>
          <div><span>Offene Kundenbestellungen</span><b>{z.kundenOffen}</b></div>
        </div>
        <p className="hint">Automatisch aus dem Kassenbuch: {z.tage} von 6 Tagesabschlüssen erfasst.</p>
      </section>
      {d.bereit && <Formular key={montag + (vorhanden ? "-da" : "")} montag={montag} setMontag={setMontag} vorhanden={vorhanden} darfSchreiben={darfSchreiben} zeigen={zeigen} />}
      <section className="panel" aria-labelledby="h-wbl">
        <h2 id="h-wbl">Frühere Berichte</h2>
        <div className="list">
          {liste.length ? liste.map((w) => (
            <article key={w.id} className="item">
              <div className="item-row"><strong>{wochenLabel(w.id)}</strong><span>CHF {chf(w.zahlen?.total)}</span></div>
              <div className="meta"><span>{vorname(w.person)}</span><span>{datum(w.gespeichert)}</span></div>
              {w.anliegen && <p><b>Anliegen:</b> {w.anliegen}</p>}
              <div className="actions"><button type="button" className="btn ghost small" onClick={() => { setMontag(w.id); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Öffnen</button></div>
            </article>
          )) : <div className="empty">Noch keine Wochenberichte. Der erste gespeicherte Bericht erscheint hier.</div>}
        </div>
      </section>
      {element}
    </>
  );
}
