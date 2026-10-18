// Übergabebuch für Laden und Pension: was die nächste Schicht wissen muss, mit Pendenzen zum Abhaken.
import { useState, type FormEvent } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "./firebase";
import { useIch } from "./auth";
import { datum, heute, vorname, wochentagKurz, zeitstempel } from "./lib/format";
import type { Uebergabe } from "./lib/laden";
import { LoeschKnopf, speichern, useToast } from "./ui";

export function Filter<T extends string>({ wert, setWert, optionen }: { wert: T; setWert: (w: T) => void; optionen: [T, string][] }) {
  return (
    <div className="filters">
      {optionen.map(([k, l]) => (
        <button key={k} type="button" className="chip" aria-pressed={wert === k} onClick={() => setWert(k)}>{l}</button>
      ))}
    </div>
  );
}

type Props = {
  sammlung: string;
  eintraege: Uebergabe[];
  themen: string[];
  darfLoeschen: (x: { uid?: string }) => boolean;
  beispiel: string;
};

export function UebergabeBuch({ sammlung, eintraege, themen, darfLoeschen, beispiel }: Props) {
  const ich = useIch();
  const { zeigen, element } = useToast();
  const [filter, setFilter] = useState<"offen" | "heute" | "alle">("offen");
  const [text, setText] = useState("");
  const [kategorie, setKategorie] = useState(themen[0]);
  const [pendenz, setPendenz] = useState(false);
  const [wichtig, setWichtig] = useState(false);

  let liste = [...eintraege].sort((a, b) => b.erstellt.localeCompare(a.erstellt));
  if (filter === "offen") liste = liste.filter((x) => x.pendenz && !x.erledigt);
  if (filter === "heute") liste = liste.filter((x) => x.datum === heute());

  async function absenden(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return zeigen("Bitte eine Nachricht eingeben");
    const eintrag = { datum: heute(), erstellt: zeitstempel(), person: ich.name, uid: ich.uid, kategorie, text: text.trim(), pendenz, wichtig, erledigt: false };
    const ok = await speichern(zeigen, () => addDoc(collection(db, sammlung), eintrag), "Eintrag gespeichert");
    if (ok) { setText(""); setPendenz(false); setWichtig(false); }
  }

  return (
    <>
      <section className="panel" aria-labelledby="h-ub">
        <h2 id="h-ub">Neuer Eintrag</h2>
        <form className="grid" onSubmit={absenden}>
          <label>Thema<select value={kategorie} onChange={(e) => setKategorie(e.target.value)}>{themen.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="wide">Nachricht<textarea value={text} onChange={(e) => setText(e.target.value)} required placeholder={beispiel} /></label>
          <label className="check wide"><input type="checkbox" checked={pendenz} onChange={(e) => setPendenz(e.target.checked)} /> Ist eine Pendenz (muss jemand erledigen)</label>
          <label className="check wide"><input type="checkbox" checked={wichtig} onChange={(e) => setWichtig(e.target.checked)} /> Wichtig</label>
          <div className="wide actions"><button className="btn">Eintrag speichern</button></div>
        </form>
      </section>
      <section className="panel" aria-labelledby="h-ub2">
        <div className="panel-head">
          <h2 id="h-ub2">Übergabebuch</h2>
          <Filter wert={filter} setWert={setFilter} optionen={[["offen", "Offene Pendenzen"], ["heute", "Heute"], ["alle", "Alle"]]} />
        </div>
        <div className="list">
          {liste.length ? liste.map((x) => (
            <article key={x.id} className={`item${x.erledigt ? " done" : ""}${x.wichtig && !x.erledigt ? " important" : ""}`}>
              <div className="meta">
                <span>{wochentagKurz(x.datum)} {datum(x.datum)} {x.erstellt.slice(11, 16)}</span>
                <span>{x.person}</span>
                <span className="pill">{x.kategorie}</span>
                {x.pendenz && (x.erledigt
                  ? <span className="pill good">Erledigt{x.erledigtVon ? ` · ${vorname(x.erledigtVon)}` : ""}</span>
                  : <span className="pill warn">Pendenz</span>)}
                {x.wichtig && <span className="pill bad">Wichtig</span>}
              </div>
              <p>{x.text}</p>
              <div className="actions">
                {x.pendenz && (
                  <button className="btn ghost small" type="button" onClick={() => speichern(zeigen, () => updateDoc(doc(db, sammlung, x.id), {
                    erledigt: !x.erledigt, erledigtVon: x.erledigt ? "" : ich.name, erledigtAm: x.erledigt ? "" : zeitstempel(),
                  }), x.erledigt ? "Wieder geöffnet" : "Erledigt")}>
                    {x.erledigt ? "Wieder öffnen" : "Als erledigt markieren"}
                  </button>
                )}
                <LoeschKnopf disabled={!darfLoeschen(x)} onLoeschen={() => speichern(zeigen, () => deleteDoc(doc(db, sammlung, x.id)), "Gelöscht")} />
              </div>
            </article>
          )) : <div className="empty">{filter === "offen" ? "Keine offenen Pendenzen." : "Noch keine Einträge. Was die nächste Schicht wissen muss, kommt oben hinein."}</div>}
        </div>
      </section>
      {element}
    </>
  );
}
