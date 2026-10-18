// Kassenbuch Pension und Hofladen: der Tagesabschluss ist neu für das Team, darum führt die App Schritt für Schritt hindurch.
import { useState, type FormEvent } from "react";
import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useIch } from "../auth";
import { chf, datum, heute, vorname, wochentagKurz, zahl } from "../lib/format";
import { kasseId, kasseRechnen, letztesWechselgeld, type Kasse as KasseT } from "../lib/laden";
import { bargeldSumme, kassenVorschlag, MWST, mwstAufteilen, STUECKELUNG } from "../lib/pension";
import { darf, STUFE } from "../lib/rollen";
import { farbe, KassenMonat, vorzeichen } from "../kassenbuch";
import { LoeschKnopf, speichern, useToast } from "../ui";
import { usePension } from "./daten";

type Werte = { anfang: string; bar: string; karte: string; twint: string; hofFutter: string; hofZubehoer: string; ausgaben: string; gezaehlt: string; safebag: string; safebagNr: string; notiz: string };

const SCHRITTE = ["Wechselgeld", "Einnahmen", "Hofladen", "Ausgaben", "Bargeld zählen", "Einzahlung", "Kontrolle"];

function Betrag({ titel, wert, setWert, autoFocus }: { titel: string; wert: string; setWert: (w: string) => void; autoFocus?: boolean }) {
  return (
    <label>
      {titel}
      <input className="num" inputMode="decimal" placeholder="0.00" value={wert} onChange={(e) => setWert(e.target.value)} autoFocus={autoFocus} />
    </label>
  );
}

function Zaehlhilfe({ setGezaehlt }: { setGezaehlt: (w: string) => void }) {
  const [anzahl, setAnzahl] = useState<Record<string, string>>({});
  const summe = bargeldSumme(anzahl);
  return (
    <details className="wide">
      <summary>Zählhilfe: Noten und Münzen einzeln eingeben</summary>
      <div className="zaehlen">
        {STUECKELUNG.map((w) => (
          <label key={w}>
            {w >= 1 ? `${w} Fr.` : `${Math.round(w * 100)} Rp.`}
            <input inputMode="numeric" className="num" placeholder="0" value={anzahl[w] ?? ""} onChange={(e) => {
              const neu = { ...anzahl, [w]: e.target.value };
              setAnzahl(neu);
              setGezaehlt(String(bargeldSumme(neu)));
            }} />
          </label>
        ))}
      </div>
      <p className="hint">Zusammen CHF {chf(summe)}. Der Betrag wird oben eingetragen.</p>
    </details>
  );
}

function Abschluss({ tag, vorhanden, wechselgeld, fertig, zeigen }: { tag: string; vorhanden?: KasseT; wechselgeld: number | null; fertig: () => void; zeigen: (t: string) => void }) {
  const ich = useIch();
  const d = usePension();
  const [schritt, setSchritt] = useState(0);
  const s = (n: number | undefined | null) => (n == null ? "" : String(n));
  const [w, setW] = useState<Werte>({
    anfang: vorhanden ? s(vorhanden.anfang) : s(wechselgeld),
    bar: s(vorhanden?.bar), karte: s(vorhanden?.karte), twint: s(vorhanden?.twint), hofFutter: s(vorhanden?.hofFutter), hofZubehoer: s(vorhanden?.hofZubehoer), ausgaben: s(vorhanden?.ausgaben),
    gezaehlt: s(vorhanden?.gezaehlt), safebag: s(vorhanden?.safebagBetrag), safebagNr: vorhanden?.safebagNr ?? "", notiz: vorhanden?.notiz ?? "",
  });
  const set = (x: Partial<Werte>) => setW((alt) => ({ ...alt, ...x }));
  const z = { anfang: zahl(w.anfang), bar: zahl(w.bar), karte: zahl(w.karte), twint: zahl(w.twint), ausgaben: zahl(w.ausgaben), gezaehlt: zahl(w.gezaehlt), safebag: zahl(w.safebag) };
  const r = kasseRechnen(z);
  const hof = { futter: zahl(w.hofFutter), zubehoer: zahl(w.hofZubehoer) };
  const m = mwstAufteilen(r.total, hof.futter, hof.zubehoer);
  const vorschlag = kassenVorschlag(d.buchungen, tag);
  const letzter = schritt === SCHRITTE.length - 1;

  async function absenden(e: FormEvent) {
    e.preventDefault();
    if (!letzter) return setSchritt(schritt + 1);
    if (m.pension < 0) {
      setSchritt(SCHRITTE.indexOf("Hofladen"));
      return zeigen("Der Hofladen ist höher als alle Einnahmen. Bitte Einnahmen und Hofladen prüfen.");
    }
    if (r.differenz !== 0 && !w.notiz.trim()) return zeigen("Bitte die Differenz kurz erklären");
    const eintrag = {
      standort: "pension", datum: tag, person: ich.name, uid: ich.uid,
      anfang: z.anfang, bar: z.bar, karte: z.karte, twint: z.twint, ausgaben: z.ausgaben, gezaehlt: z.gezaehlt,
      hofFutter: hof.futter, hofZubehoer: hof.zubehoer, umsatz81: m.umsatz81, umsatz26: m.umsatz26, mwst81: m.mwst81, mwst26: m.mwst26,
      safebagBetrag: z.safebag, safebagNr: w.safebagNr.trim(), notiz: w.notiz.trim(),
      total: r.total, soll: r.soll, differenz: r.differenz, wechselgeldNeu: r.wechselgeldNeu,
      abgeholt: vorhanden?.abgeholt ?? false, abgeholtAm: vorhanden?.abgeholtAm ?? "", geaendertAm: serverTimestamp(),
    };
    const ok = await speichern(zeigen, () => setDoc(doc(db, "kasse", kasseId("pension", tag)), eintrag), "Kassenabschluss gespeichert");
    if (ok) fertig();
  }

  return (
    <section className="panel" aria-labelledby="h-pk">
      <div className="panel-head">
        <h2 id="h-pk">Kassenabschluss {wochentagKurz(tag)} {datum(tag)}</h2>
        <span className="pill acc">Schritt {schritt + 1} von {SCHRITTE.length}</span>
      </div>
      <ol className="schritte" aria-label="Schritte">
        {SCHRITTE.map((t, i) => (
          <li key={t} className={i === schritt ? "jetzt" : i < schritt ? "fertig" : ""}>
            <button type="button" onClick={() => setSchritt(i)} disabled={i > schritt}>{t}</button>
          </li>
        ))}
      </ol>
      <form className="grid" onSubmit={absenden}>
        {schritt === 0 && (
          <>
            <p className="wide">Wie viel Bargeld lag heute Morgen in der Kasse, bevor die erste Zahlung kam?</p>
            <Betrag titel="Wechselgeld am Morgen" wert={w.anfang} setWert={(x) => set({ anfang: x })} autoFocus />
            <p className="hint wide">
              {wechselgeld != null && !vorhanden
                ? `Vom letzten Abschluss übernommen (CHF ${chf(wechselgeld)}). Nur ändern, wenn seither Geld entnommen oder eingelegt wurde.`
                : "Beim allerersten Abschluss: das Bargeld zählen, das am Morgen in der Kasse lag. Ab morgen kommt der Betrag automatisch."}
            </p>
          </>
        )}
        {schritt === 1 && (
          <>
            <p className="wide">Was wurde heute eingenommen? Zahlungen per Rechnung gehören nicht hierher.</p>
            {vorschlag.anzahl > 0 && (
              <div className="wide notice good">
                Aus {vorschlag.anzahl} {vorschlag.anzahl === 1 ? "Check-out" : "Check-outs"} heute: Bar {chf(vorschlag.bar)}, Karte {chf(vorschlag.karte)}, TWINT {chf(vorschlag.twint)}
                {vorschlag.rechnung > 0 && ` (dazu CHF ${chf(vorschlag.rechnung)} per Rechnung)`}.{" "}
                <button type="button" className="btn small" onClick={() => set({ bar: String(vorschlag.bar), karte: String(vorschlag.karte), twint: String(vorschlag.twint) })}>Übernehmen</button>
              </div>
            )}
            <Betrag titel="Bar" wert={w.bar} setWert={(x) => set({ bar: x })} autoFocus />
            <Betrag titel="Karte" wert={w.karte} setWert={(x) => set({ karte: x })} />
            <Betrag titel="TWINT" wert={w.twint} setWert={(x) => set({ twint: x })} />
            <p className="hint wide">Alle Einnahmen von Pension und Hofladen zusammen, auch Tagesgäste ohne Buchung. Kartenzahlungen stehen auf dem Tagesbeleg des Terminals.</p>
          </>
        )}
        {schritt === 2 && (
          <>
            <p className="wide">Wie viel davon war Verkauf im Hofladen? Wegen der MWST getrennt nach Futter und Zubehör.</p>
            <Betrag titel={`Hofladen Futtermittel (${MWST.reduziert} %)`} wert={w.hofFutter} setWert={(x) => set({ hofFutter: x })} autoFocus />
            <Betrag titel={`Hofladen Zubehör und Spielzeug (${MWST.normal} %)`} wert={w.hofZubehoer} setWert={(x) => set({ hofZubehoer: x })} />
            {m.pension < 0
              ? <p className="wide notice">Der Hofladen ist höher als alle Einnahmen (CHF {chf(r.total)}). Bitte prüfen.</p>
              : <p className="hint wide">Bleibt für die Pension: CHF {chf(m.pension)}. Kein Hofladen-Verkauf: einfach weiter. Futter und Leckerli zählen als Futtermittel, alles andere als Zubehör.</p>}
          </>
        )}
        {schritt === 3 && (
          <>
            <p className="wide">Wurde heute Bargeld aus der Kasse ausgegeben, z. B. für Einkäufe oder Porto?</p>
            <Betrag titel="Bar-Ausgaben total" wert={w.ausgaben} setWert={(x) => set({ ausgaben: x })} autoFocus />
            <label className="wide">Wofür?<textarea value={w.notiz} onChange={(e) => set({ notiz: e.target.value })} placeholder="z. B. Hundeleckerli Coop CHF 12.40" /></label>
            <p className="hint wide">Den Beleg in die Kasse legen. Keine Ausgaben: einfach weiter.</p>
          </>
        )}
        {schritt === 4 && (
          <>
            <p className="wide">Jetzt das ganze Bargeld in der Kasse zählen, Noten und Münzen.</p>
            <Betrag titel="Bargeld gezählt" wert={w.gezaehlt} setWert={(x) => set({ gezaehlt: x })} autoFocus />
            <Zaehlhilfe setGezaehlt={(x) => set({ gezaehlt: x })} />
            <p className="hint wide">Erwartet sind CHF {chf(r.soll)}: Wechselgeld {chf(z.anfang)} + Bar {chf(z.bar)} − Ausgaben {chf(z.ausgaben)}.</p>
          </>
        )}
        {schritt === 5 && (
          <>
            <p className="wide">Wird Geld für die Bank aus der Kasse genommen? Der Rest bleibt als Wechselgeld für morgen.</p>
            <Betrag titel="Einzahlung / Safebag" wert={w.safebag} setWert={(x) => set({ safebag: x })} autoFocus />
            <label>Beleg- oder Safebag-Nr.<input value={w.safebagNr} onChange={(e) => set({ safebagNr: e.target.value })} placeholder="optional" /></label>
            <p className="hint wide">Bleibt als Wechselgeld für morgen: CHF {chf(r.wechselgeldNeu)}. Nichts herausgenommen: einfach weiter.</p>
          </>
        )}
        {letzter && (
          <>
            <div className="wide calc" aria-live="polite">
              <div><span>Einnahmen total</span><b>{chf(r.total)}</b></div>
              <div><span>davon Pension</span><b>{chf(m.pension)}</b></div>
              <div><span>davon Hofladen</span><b>{chf(hof.futter + hof.zubehoer)}</b></div>
              <div><span>MWST {MWST.normal} % auf {chf(m.umsatz81)}</span><b>{chf(m.mwst81)}</b></div>
              <div><span>MWST {MWST.reduziert} % auf {chf(m.umsatz26)}</span><b>{chf(m.mwst26)}</b></div>
              <div><span>Soll-Bargeld</span><b>{chf(r.soll)}</b></div>
              <div><span>Gezählt</span><b>{chf(z.gezaehlt)}</b></div>
              <div><span>Differenz</span><b className={farbe(r.differenz)}>{vorzeichen(r.differenz)}{chf(r.differenz)}</b></div>
              <div><span>Wechselgeld für morgen</span><b>{chf(r.wechselgeldNeu)}</b></div>
            </div>
            {r.differenz === 0
              ? <p className="wide notice good">Die Kasse stimmt.</p>
              : <p className="wide notice">Es fehlen oder sind zu viel CHF {chf(Math.abs(r.differenz))}. Bitte nochmals zählen. Stimmt es trotzdem, kurz unten erklären.</p>}
            <label className="wide">Bemerkung<textarea value={w.notiz} onChange={(e) => set({ notiz: e.target.value })} placeholder="Ausgaben, Grund für eine Differenz, Besonderes" /></label>
          </>
        )}
        <div className="wide actions">
          {schritt > 0 && <button type="button" className="btn ghost" onClick={() => setSchritt(schritt - 1)}>Zurück</button>}
          <button className="btn">{letzter ? "Abschluss speichern" : "Weiter"}</button>
          <button type="button" className="btn ghost" onClick={fertig}>Abbrechen</button>
        </div>
      </form>
    </section>
  );
}

function Zusammenfassung({ k, korrigieren }: { k: KasseT; korrigieren: () => void }) {
  const ich = useIch();
  const { zeigen, element } = useToast();
  const leitung = darf(ich.rollen, "pension_kasse", STUFE.verwalten);
  const mw = mwstAufteilen(k.total, k.hofFutter ?? 0, k.hofZubehoer ?? 0);
  return (
    <section className="panel" aria-labelledby="h-pkz">
      <div className="panel-head">
        <h2 id="h-pkz">Kassenabschluss {wochentagKurz(k.datum)} {datum(k.datum)}</h2>
        <span className="pill good">Erfasst von {vorname(k.person)}</span>
      </div>
      <div className="calc">
        <div><span>Bar</span><b>{chf(k.bar)}</b></div>
        <div><span>Karte</span><b>{chf(k.karte)}</b></div>
        <div><span>TWINT</span><b>{chf(k.twint)}</b></div>
        <div><span>Total</span><b>{chf(k.total)}</b></div>
        {(k.hofFutter || k.hofZubehoer) ? <div><span>davon Hofladen</span><b>{chf((k.hofFutter ?? 0) + (k.hofZubehoer ?? 0))}</b></div> : null}
        <div><span>MWST {MWST.normal} %</span><b>{chf(mw.mwst81)}</b></div>
        <div><span>MWST {MWST.reduziert} %</span><b>{chf(mw.mwst26)}</b></div>
        <div><span>Differenz</span><b className={farbe(k.differenz)}>{vorzeichen(k.differenz)}{chf(k.differenz)}</b></div>
        <div><span>Wechselgeld für morgen</span><b>{chf(k.wechselgeldNeu)}</b></div>
      </div>
      {k.notiz && <p className="hint">{k.notiz}</p>}
      <div className="actions">
        <button type="button" className="btn ghost small" onClick={korrigieren}>Korrigieren</button>
        <LoeschKnopf disabled={!leitung} onLoeschen={() => speichern(zeigen, () => deleteDoc(doc(db, "kasse", k.id)), "Gelöscht")} />
      </div>
      {element}
    </section>
  );
}

export function PensionKasse() {
  const d = usePension();
  const [tag, setTag] = useState(heute());
  const [offen, setOffen] = useState(false);
  const { zeigen, element } = useToast();
  const vorhanden = d.kasse.find((k) => k.datum === tag);

  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <h2>Kassenbuch Pension und Hofladen</h2>
          <label className="inline">Tag<input type="date" value={tag} max={heute()} onChange={(e) => { setTag(e.target.value || heute()); setOffen(false); }} style={{ width: "auto" }} /></label>
        </div>
        {!d.bereit ? <p className="hint">Lädt …</p> : !vorhanden && !offen && (
          <>
            <p className="muted" style={{ margin: 0 }}>
              {tag === heute() ? "Für heute ist noch kein Abschluss erfasst." : `Für den ${datum(tag)} fehlt der Abschluss.`} Am Abend dauert er etwa fünf Minuten: die App fragt Schritt für Schritt nach Wechselgeld, Einnahmen, Hofladen, Ausgaben und dem gezählten Bargeld.
            </p>
            <div className="actions"><button type="button" className="btn" onClick={() => setOffen(true)}>Kassenabschluss starten</button></div>
          </>
        )}
      </section>
      {d.bereit && offen && <Abschluss key={tag} tag={tag} vorhanden={vorhanden} wechselgeld={letztesWechselgeld(d.kasse, tag)} fertig={() => setOffen(false)} zeigen={zeigen} />}
      {d.bereit && vorhanden && !offen && <Zusammenfassung k={vorhanden} korrigieren={() => setOffen(true)} />}
      <KassenMonat kasse={d.kasse} setTag={(t) => { setTag(t); setOffen(false); }} dateiname="Kassenbuch_Pension" safebagTitel="Einzahlung" mitMwst />
      {element}
    </>
  );
}
