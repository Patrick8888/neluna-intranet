// Mitteilungen der Geschäftsführung an das ganze Team, mit «Gelesen»-Bestätigung.
import { useState, type FormEvent } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useIch } from "../auth";
import { datum, vorname, zeitstempel } from "../lib/format";
import { nochNichtGelesen, type Mitteilung } from "../lib/chat";
import { darf, STUFE } from "../lib/rollen";
import { LoeschKnopf, speichern, useToast } from "../ui";
import { useKommunikation } from "./daten";

export function MitteilungKarte({ m, zeigen }: { m: Mitteilung; zeigen: (t: string) => void }) {
  const ich = useIch();
  const { team } = useKommunikation();
  const leitung = darf(ich.rollen, "start", STUFE.verwalten);
  const [details, setDetails] = useState(false);
  const eigene = m.uid === ich.uid;
  const gelesen = eigene || !!m.gelesen?.[ich.uid];
  const fehlen = nochNichtGelesen(m, team);
  const bestaetigen = () =>
    speichern(zeigen, () => updateDoc(doc(db, "mitteilungen", m.id), { [`gelesen.${ich.uid}`]: zeitstempel() }), "Als gelesen bestätigt");

  return (
    <article className={`item${m.wichtig ? " important" : ""}${gelesen ? "" : " ungelesen"}`}>
      <div className="item-row">
        <strong>{m.titel}</strong>
        <span className="actions">
          {m.wichtig && <span className="pill warn">Wichtig</span>}
          {!gelesen && <span className="pill acc">Neu</span>}
        </span>
      </div>
      <p>{m.text}</p>
      <div className="meta">
        <span>{vorname(m.person)}, {datum(m.erstellt.slice(0, 10))}</span>
        {leitung && (
          <button type="button" className="linkknopf" onClick={() => setDetails(!details)}>
            {fehlen.length ? `${fehlen.length} noch nicht gelesen` : "Alle haben gelesen"}
          </button>
        )}
      </div>
      {leitung && details && (
        <p className="hint">
          {fehlen.length ? `Noch nicht gelesen: ${fehlen.map((p) => p.name).join(", ")}.` : ""}
          {Object.keys(m.gelesen ?? {}).length ? ` Gelesen: ${team.filter((p) => m.gelesen?.[p.uid]).map((p) => vorname(p.name)).join(", ")}.` : ""}
        </p>
      )}
      <div className="actions">
        {!gelesen && <button type="button" className="btn small" onClick={bestaetigen}>Gelesen</button>}
        {leitung && <LoeschKnopf onLoeschen={() => speichern(zeigen, () => deleteDoc(doc(db, "mitteilungen", m.id)), "Gelöscht")} />}
      </div>
    </article>
  );
}

function NeueMitteilung({ fertig, zeigen }: { fertig: () => void; zeigen: (t: string) => void }) {
  const ich = useIch();
  const [titel, setTitel] = useState("");
  const [text, setText] = useState("");
  const [wichtig, setWichtig] = useState(false);

  async function absenden(e: FormEvent) {
    e.preventDefault();
    if (!titel.trim() || !text.trim()) return zeigen("Bitte Titel und Text ausfüllen");
    const ok = await speichern(zeigen, () => addDoc(collection(db, "mitteilungen"), {
      titel: titel.trim(), text: text.trim(), wichtig, erstellt: zeitstempel(), person: ich.name, uid: ich.uid, gelesen: {},
    }), "Mitteilung veröffentlicht");
    if (ok) fertig();
  }

  return (
    <form className="grid" onSubmit={absenden}>
      <label className="wide">Titel<input value={titel} onChange={(e) => setTitel(e.target.value)} maxLength={120} autoFocus /></label>
      <label className="wide">Text<textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} maxLength={8000} /></label>
      <label className="check wide"><input type="checkbox" checked={wichtig} onChange={(e) => setWichtig(e.target.checked)} />Wichtig (erscheint oben auf der Startseite)</label>
      <div className="wide actions">
        <button className="btn">Veröffentlichen</button>
        <button type="button" className="btn ghost" onClick={fertig}>Abbrechen</button>
      </div>
    </form>
  );
}

export function Mitteilungen() {
  const ich = useIch();
  const { mitteilungen } = useKommunikation();
  const { zeigen, element } = useToast();
  const [neu, setNeu] = useState(false);
  const leitung = darf(ich.rollen, "start", STUFE.verwalten);

  return (
    <>
      <section className="panel" aria-labelledby="h-mitt">
        <div className="panel-head">
          <h2 id="h-mitt">Mitteilungen</h2>
          {leitung && !neu && <button type="button" className="btn small" onClick={() => setNeu(true)}>Neue Mitteilung</button>}
        </div>
        {neu && <NeueMitteilung fertig={() => setNeu(false)} zeigen={zeigen} />}
        <p className="hint">Wichtige Infos der Geschäftsführung an alle. Bitte jede Mitteilung mit «Gelesen» bestätigen.</p>
        {mitteilungen.length ? (
          <div className="list">{mitteilungen.map((m) => <MitteilungKarte key={m.id} m={m} zeigen={zeigen} />)}</div>
        ) : <div className="empty">Noch keine Mitteilungen.</div>}
      </section>
      {element}
    </>
  );
}
