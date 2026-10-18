import { useState, type FormEvent } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useIch } from "../auth";
import { chf, heute, vorname, zahl } from "../lib/format";
import { kasseId, kasseRechnen, letztesWechselgeld, type Kasse as KasseT } from "../lib/laden";
import { farbe, KassenMonat, vorzeichen } from "../kassenbuch";
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
  const vorhanden = d.kasse.find((k) => k.datum === tag);

  return (
    <>
      {d.bereit ? (
        <Abschluss key={tag} tag={tag} setTag={setTag} vorhanden={vorhanden} wechselgeld={letztesWechselgeld(d.kasse, tag)} />
      ) : (
        <section className="panel"><p className="hint">Lädt …</p></section>
      )}
      <KassenMonat kasse={d.kasse} setTag={setTag} dateiname="Kassenbuch" />
    </>
  );
}
