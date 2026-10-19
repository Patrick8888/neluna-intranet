// Ferien und Abwesenheiten: Antrag stellen, freigeben (Laden: Leitung Laden, Pension: Leitung Pension), Übersicht.
import { useState, type FormEvent } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useIch } from "../auth";
import { datum, heute, plusTage, zeitstempel } from "../lib/format";
import {
  ABWESENHEIT_ARTEN, abwesenheitBereich, artFuer, darfFreigeben, ferientage, siehtDetails, ueberschneidungen, werktage,
  type Abwesenheit, type AbwesenheitArt,
} from "../lib/personal";
import { LoeschKnopf, speichern, useToast } from "../ui";
import { usePersonal } from "./Personal";

const STATUS_PILL = { Beantragt: "acc", Bewilligt: "good", Abgelehnt: "bad" } as const;

const zeitraum = (a: Pick<Abwesenheit, "von" | "bis">) => (a.von === a.bis ? datum(a.von) : `${datum(a.von)}–${datum(a.bis)}`);
const tageText = (a: Pick<Abwesenheit, "von" | "bis">) => {
  const n = werktage(a.von, a.bis);
  return n === 1 ? "1 Arbeitstag" : `${n} Arbeitstage`;
};

/** Neuer Antrag für sich selbst, oder (wer freigibt) direkt bewilligter Eintrag für jemanden aus dem Team. */
function Formular({ zeigen }: { zeigen: (t: string) => void }) {
  const ich = useIch();
  const p = usePersonal();
  const fuerAndere = p.team.filter((x) => x.uid !== ich.uid && darfFreigeben(ich.rollen, ich.uid, { bereich: abwesenheitBereich(x.rollen), mitarbeiterUid: x.uid }));
  const leer = { fuer: ich.uid, art: "Ferien" as AbwesenheitArt, von: heute(), bis: heute(), notiz: "" };
  const [w, setW] = useState(leer);
  const set = (x: Partial<typeof w>) => setW((alt) => ({ ...alt, ...x }));
  const person = w.fuer === ich.uid ? { uid: ich.uid, name: ich.name, rollen: ich.rollen as string[] } : p.team.find((x) => x.uid === w.fuer);
  const bereich = abwesenheitBereich(person?.rollen ?? []);
  const direkt = !!person && darfFreigeben(ich.rollen, ich.uid, { bereich, mitarbeiterUid: person.uid });
  const andere = person ? ueberschneidungen(p.abwesenheiten, { id: "", bereich, mitarbeiterUid: person.uid, von: w.von, bis: w.bis < w.von ? w.von : w.bis }) : [];

  async function absenden(e: FormEvent) {
    e.preventDefault();
    if (!person) return;
    const bis = w.bis < w.von ? w.von : w.bis;
    const ok = await speichern(zeigen, () => addDoc(collection(db, "abwesenheiten"), {
      mitarbeiterUid: person.uid, mitarbeiterName: person.name, bereich, art: w.art, von: w.von, bis, notiz: w.notiz.trim(),
      status: direkt ? "Bewilligt" : "Beantragt",
      entscheidUid: direkt ? ich.uid : "", entscheidName: direkt ? ich.name : "", entscheidAm: direkt ? zeitstempel() : "", antwort: "",
      erstellt: zeitstempel(), person: ich.name, uid: ich.uid,
    }), direkt ? "Eingetragen" : "Antrag gesendet");
    if (ok) setW({ ...leer, fuer: w.fuer });
  }

  return (
    <section className="panel" aria-labelledby="h-antrag">
      <h2 id="h-antrag">{direkt && w.fuer !== ich.uid ? "Abwesenheit eintragen" : "Ferien oder Abwesenheit beantragen"}</h2>
      <form className="grid" onSubmit={absenden}>
        {fuerAndere.length > 0 && (
          <label>Für
            <select value={w.fuer} onChange={(e) => set({ fuer: e.target.value })}>
              <option value={ich.uid}>mich ({ich.name})</option>
              {fuerAndere.map((x) => <option key={x.uid} value={x.uid}>{x.name}</option>)}
            </select>
          </label>
        )}
        <label>Art<select value={w.art} onChange={(e) => set({ art: e.target.value as AbwesenheitArt })}>{ABWESENHEIT_ARTEN.map((a) => <option key={a}>{a}</option>)}</select></label>
        <label>Von<input type="date" value={w.von} onChange={(e) => set({ von: e.target.value, bis: w.bis < e.target.value ? e.target.value : w.bis })} required /></label>
        <label>Bis<input type="date" value={w.bis} min={w.von} onChange={(e) => set({ bis: e.target.value })} required /></label>
        <label className="wide">Bemerkung<input value={w.notiz} onChange={(e) => set({ notiz: e.target.value })} maxLength={1000} placeholder="z. B. halber Tag, Ersatz organisiert mit Claudia" /></label>
        <p className="hint wide">
          {tageText({ von: w.von, bis: w.bis < w.von ? w.von : w.bis })} (Montag bis Freitag).{" "}
          {direkt ? "Wird direkt als bewilligt eingetragen." : `Der Antrag geht an ${bereich === "laden" ? "die Leitung Laden" : bereich === "pension" ? "die Leitung Pension" : "die Geschäftsführung"}.`}
        </p>
        {andere.length > 0 && (
          <p className="notice wide">
            Zur gleichen Zeit {andere.length === 1 ? "ist" : "sind"} schon abwesend: {andere.map((a) => `${a.mitarbeiterName} (${zeitraum(a)}${a.status === "Beantragt" ? ", beantragt" : ""})`).join(", ")}.
          </p>
        )}
        <div className="wide actions"><button className="btn">{direkt ? "Eintragen" : "Antrag senden"}</button></div>
      </form>
    </section>
  );
}

function Entscheiden({ a, zeigen }: { a: Abwesenheit; zeigen: (t: string) => void }) {
  const ich = useIch();
  const p = usePersonal();
  const [antwort, setAntwort] = useState("");
  const andere = ueberschneidungen(p.abwesenheiten, a);
  const entscheiden = (status: "Bewilligt" | "Abgelehnt") =>
    speichern(zeigen, () => updateDoc(doc(db, "abwesenheiten", a.id), { status, antwort: antwort.trim(), entscheidUid: ich.uid, entscheidName: ich.name, entscheidAm: zeitstempel() }), status);
  return (
    <article className="item important">
      <div className="item-row">
        <strong>{a.mitarbeiterName}: {a.art}</strong>
        <span className="pill acc">Beantragt</span>
      </div>
      <p>{zeitraum(a)} · {tageText(a)}{a.notiz && ` · ${a.notiz}`}</p>
      <div className="meta">
        <span>Ferien {a.von.slice(0, 4)} bisher bewilligt: {ferientage(p.abwesenheiten, a.mitarbeiterUid, a.von.slice(0, 4))} Tage</span>
        <span>beantragt {datum(a.erstellt)}</span>
      </div>
      {andere.length > 0 && <p className="notice">Gleichzeitig abwesend: {andere.map((x) => `${x.mitarbeiterName} (${zeitraum(x)}${x.status === "Beantragt" ? ", beantragt" : ""})`).join(", ")}</p>}
      <input value={antwort} onChange={(e) => setAntwort(e.target.value)} maxLength={1000} placeholder="Antwort (freiwillig)" aria-label={`Antwort an ${a.mitarbeiterName}`} />
      <div className="actions">
        <button type="button" className="btn small" onClick={() => void entscheiden("Bewilligt")}>Bewilligen</button>
        <button type="button" className="btn ghost small" onClick={() => void entscheiden("Abgelehnt")}>Ablehnen</button>
      </div>
    </article>
  );
}

function Zeile({ a, zeigen, mitName }: { a: Abwesenheit; zeigen: (t: string) => void; mitName: boolean }) {
  const ich = useIch();
  const eigene = a.mitarbeiterUid === ich.uid;
  const freigeben = darfFreigeben(ich.rollen, ich.uid, a);
  const sieht = siehtDetails(ich.rollen, ich.uid, a);
  return (
    <article className={`item${a.status === "Abgelehnt" ? " done" : ""}`}>
      <div className="item-row">
        <strong>{mitName && `${a.mitarbeiterName}: `}{artFuer(a, ich.rollen, ich.uid)}</strong>
        <span className={`pill ${STATUS_PILL[a.status]}`}>{a.status}</span>
      </div>
      <p>{zeitraum(a)} · {tageText(a)}{sieht && a.notiz && ` · ${a.notiz}`}</p>
      {sieht && a.entscheidName && <div className="meta"><span>{a.status === "Bewilligt" ? "Bewilligt" : "Entschieden"} von {a.entscheidName}{a.antwort && `: «${a.antwort}»`}</span></div>}
      {(freigeben || (eigene && a.status === "Beantragt")) && (
        <div className="actions">
          <LoeschKnopf onLoeschen={() => speichern(zeigen, () => deleteDoc(doc(db, "abwesenheiten", a.id)), eigene && a.status === "Beantragt" ? "Antrag zurückgezogen" : "Gelöscht")} />
        </div>
      )}
    </article>
  );
}

export function Abwesenheiten() {
  const ich = useIch();
  const p = usePersonal();
  const { zeigen, element } = useToast();
  const jahr = heute().slice(0, 4);
  // Ferientage-Übersicht: die Personen, deren Anträge man freigibt.
  const meinTeam = p.team.filter((x) => darfFreigeben(ich.rollen, ich.uid, { bereich: abwesenheitBereich(x.rollen), mitarbeiterUid: x.uid }));
  const offen = p.abwesenheiten.filter((a) => a.status === "Beantragt" && darfFreigeben(ich.rollen, ich.uid, a)).sort((a, b) => a.von.localeCompare(b.von));
  const meine = p.abwesenheiten.filter((a) => a.mitarbeiterUid === ich.uid && (a.bis >= plusTage(heute(), -60) || a.status === "Beantragt"));
  const bald = p.abwesenheiten
    .filter((a) => a.status === "Bewilligt" && a.bis >= heute() && a.von <= plusTage(heute(), 90))
    .sort((a, b) => a.von.localeCompare(b.von));

  return (
    <>
      {offen.length > 0 && (
        <section className="panel" aria-labelledby="h-offen">
          <h2 id="h-offen">Offene Anträge</h2>
          <div className="list">{offen.map((a) => <Entscheiden key={a.id} a={a} zeigen={zeigen} />)}</div>
        </section>
      )}
      <Formular zeigen={zeigen} />
      <section className="panel" aria-labelledby="h-meine-abw">
        <div className="panel-head">
          <h2 id="h-meine-abw">Meine Anträge</h2>
          <span className="hint">Ferien {jahr} bewilligt: {ferientage(p.abwesenheiten, ich.uid, jahr)} Tage</span>
        </div>
        {meine.length ? <div className="list">{meine.map((a) => <Zeile key={a.id} a={a} zeigen={zeigen} mitName={false} />)}</div> : <div className="empty">Noch keine Anträge.</div>}
      </section>
      <section className="panel" aria-labelledby="h-bald">
        <h2 id="h-bald">Wer ist wann weg? (nächste 3 Monate)</h2>
        {bald.length ? <div className="list">{bald.map((a) => <Zeile key={a.id} a={a} zeigen={zeigen} mitName />)}</div> : <div className="empty">Keine Abwesenheiten geplant.</div>}
      </section>
      {meinTeam.length > 0 && (
        <section className="panel" aria-labelledby="h-tage">
          <h2 id="h-tage">Bewilligte Ferientage {jahr}</h2>
          <div className="tablewrap">
            <table>
              <thead><tr><th>Person</th><th>Ferientage (Mo–Fr)</th><th>Offen beantragt</th></tr></thead>
              <tbody>
                {meinTeam.map((x) => (
                  <tr key={x.uid}>
                    <td>{x.name}</td>
                    <td>{ferientage(p.abwesenheiten, x.uid, jahr)}</td>
                    <td>{p.abwesenheiten.filter((a) => a.mitarbeiterUid === x.uid && a.status === "Beantragt").length || "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {element}
    </>
  );
}
