// Zeiterfassung: ein- und ausstempeln, nachtragen, Monatsübersicht mit Soll aus dem Dienstplan, Export für den Lohn.
import { useEffect, useState, type FormEvent } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, updateDoc, where, type Query } from "firebase/firestore";
import { db } from "../firebase";
import { useIch } from "../auth";
import { datum, heute, monatLabel, wochentagKurz, zeitstempel } from "../lib/format";
import { meldung } from "../lib/fehler";
import { monatPlus } from "../lib/kalender";
import { abwesenheitBereich, darfFreigeben, stunden, type Dienst } from "../lib/personal";
import { darf, STUFE } from "../lib/rollen";
import { arbeitsMinuten, mindestPause, monatsGrenzen, pausenHinweis, stdMin, zeitCsv, type Zeiteintrag } from "../lib/zeit";
import { LoeschKnopf, speichern, useToast } from "../ui";
import { usePersonal } from "./Personal";

const jetztUhr = () => zeitstempel().slice(11, 16);
const alsEintrag = (id: string, d: Record<string, unknown>) => ({ id, pause: 0, notiz: "", ...d }) as Zeiteintrag;

/** Live-Liste aus mehreren Abfragen (z. B. Laden und Pension für die Geschäftsführung), ohne Doppelte. */
function useZeiten(abfragen: Query[], schluessel: string): [Zeiteintrag[], string] {
  const [liste, setListe] = useState<Zeiteintrag[]>([]);
  const [fehler, setFehler] = useState("");
  useEffect(() => {
    const teile = new Map<number, Zeiteintrag[]>();
    const stopp = abfragen.map((q, i) =>
      onSnapshot(
        q,
        (snap) => {
          teile.set(i, snap.docs.map((x) => alsEintrag(x.id, x.data())));
          const alle = new Map([...teile.values()].flat().map((e) => [e.id, e]));
          setListe([...alle.values()]);
        },
        (e) => setFehler(meldung(e)),
      ),
    );
    return () => stopp.forEach((s) => s());
    // Die Abfragen ändern sich nur mit dem Schlüssel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schluessel]);
  return [liste, fehler];
}

/** Ein- und Ausstempeln; auch auf der Startseite. */
export function Stempeluhr() {
  const ich = useIch();
  const { zeigen, element } = useToast();
  const [offen] = useZeiten([query(collection(db, "zeiten"), where("mitarbeiterUid", "==", ich.uid), where("bis", "==", ""))], `offen-${ich.uid}`);
  const [pause, setPause] = useState("");
  const laufend = offen.sort((a, b) => b.datum.localeCompare(a.datum))[0];
  if (!darf(ich.rollen, "zeiterfassung", STUFE.bearbeiten)) return null;

  const einstempeln = () =>
    speichern(zeigen, () => addDoc(collection(db, "zeiten"), {
      mitarbeiterUid: ich.uid, mitarbeiterName: ich.name, bereich: abwesenheitBereich(ich.rollen), datum: heute(), von: jetztUhr(), bis: "", pause: 0, notiz: "",
      geaendertVon: "", geaendertName: "", erstellt: zeitstempel(), person: ich.name, uid: ich.uid,
    }), `Eingestempelt um ${jetztUhr()}`);

  if (!laufend) {
    return (
      <div className="stempeluhr">
        <button type="button" className="btn" onClick={() => void einstempeln()}>Einstempeln</button>
        <span className="hint">Arbeitsbeginn jetzt erfassen</span>
        {element}
      </div>
    );
  }

  const vergessen = laufend.datum !== heute();
  const bis = vergessen ? "" : jetztUhr();
  const praesenz = bis ? arbeitsMinuten({ von: laufend.von, bis, pause: 0 }) : 0;
  const vorschlag = mindestPause(praesenz);
  async function ausstempeln(e: FormEvent) {
    e.preventDefault();
    if (vergessen) return;
    const p = pause === "" ? vorschlag : Math.max(0, Math.round(Number(pause) || 0));
    // In derselben Minute wieder ausgestempelt: war ein Versehen, der Eintrag fällt weg.
    if (jetztUhr() <= laufend.von) return void speichern(zeigen, () => deleteDoc(doc(db, "zeiten", laufend.id)), "Einstempeln rückgängig gemacht");
    await speichern(zeigen, () => updateDoc(doc(db, "zeiten", laufend.id), { bis: jetztUhr(), pause: p, geaendertVon: ich.uid, geaendertName: ich.name }), "Ausgestempelt");
    setPause("");
  }
  return (
    <form className="stempeluhr" onSubmit={ausstempeln}>
      {vergessen ? (
        <p className="notice bad">Am {datum(laufend.datum)} um {laufend.von} eingestempelt und nicht ausgestempelt. Bitte unter Personal → Zeiterfassung das Ende nachtragen.</p>
      ) : (
        <>
          <span><b>Eingestempelt seit {laufend.von}</b> · {stdMin(praesenz)} h</span>
          <label className="stempel-pause">Pause (Min.)<input inputMode="numeric" value={pause} onChange={(e) => setPause(e.target.value)} placeholder={String(vorschlag)} /></label>
          <button className="btn">Ausstempeln</button>
        </>
      )}
      {element}
    </form>
  );
}

function Formular({ vorhanden, fuer, fertig, zeigen }: { vorhanden?: Zeiteintrag; fuer: { uid: string; name: string; rollen: string[] }; fertig: () => void; zeigen: (t: string) => void }) {
  const ich = useIch();
  const [w, setW] = useState(() => ({
    datum: vorhanden?.datum ?? heute(), von: vorhanden?.von ?? "08:00", bis: vorhanden?.bis ?? "", pause: String(vorhanden?.pause ?? 0), notiz: vorhanden?.notiz ?? "",
  }));
  const set = (x: Partial<typeof w>) => setW((alt) => ({ ...alt, ...x }));
  const pause = Math.max(0, Math.round(Number(w.pause) || 0));
  const hinweis = w.bis ? pausenHinweis({ von: w.von, bis: w.bis, pause }) : "";

  async function absenden(e: FormEvent) {
    e.preventDefault();
    if (w.bis && w.bis <= w.von) return zeigen("Das Ende muss nach dem Beginn liegen");
    const felder = { datum: w.datum, von: w.von, bis: w.bis, pause, notiz: w.notiz.trim(), geaendertVon: ich.uid, geaendertName: ich.name };
    const ok = vorhanden
      ? await speichern(zeigen, () => updateDoc(doc(db, "zeiten", vorhanden.id), felder), "Gespeichert")
      : await speichern(zeigen, () => addDoc(collection(db, "zeiten"), {
          ...felder, mitarbeiterUid: fuer.uid, mitarbeiterName: fuer.name, bereich: abwesenheitBereich(fuer.rollen), erstellt: zeitstempel(), person: ich.name, uid: ich.uid,
        }), "Nachgetragen");
    if (ok) fertig();
  }

  return (
    <section className="panel" aria-labelledby="h-zf">
      <h2 id="h-zf">{vorhanden ? "Zeit ändern" : "Zeit nachtragen"} · {fuer.name}</h2>
      <form className="grid" onSubmit={absenden}>
        <label>Tag<input type="date" value={w.datum} onChange={(e) => set({ datum: e.target.value })} required /></label>
        <label>Beginn<input type="time" value={w.von} onChange={(e) => set({ von: e.target.value })} required /></label>
        <label>Ende<input type="time" value={w.bis} onChange={(e) => set({ bis: e.target.value })} /></label>
        <label>Pause (Min.)<input inputMode="numeric" value={w.pause} onChange={(e) => set({ pause: e.target.value })} /></label>
        <label className="wide">Notiz<input value={w.notiz} onChange={(e) => set({ notiz: e.target.value })} maxLength={300} placeholder="z. B. Inventur, Fahrdienst, Arzttermin" /></label>
        {w.bis && <p className="hint wide">Arbeitszeit {stdMin(arbeitsMinuten({ von: w.von, bis: w.bis, pause }))} h{hinweis && ` · ${hinweis}`}</p>}
        <div className="wide actions">
          <button className="btn">Speichern</button>
          <button type="button" className="btn ghost" onClick={fertig}>Abbrechen</button>
          {vorhanden && <LoeschKnopf onLoeschen={() => speichern(zeigen, () => deleteDoc(doc(db, "zeiten", vorhanden.id)), "Gelöscht").then((ok) => ok && fertig())} />}
        </div>
      </form>
    </section>
  );
}

export function Zeiterfassung() {
  const ich = useIch();
  const p = usePersonal();
  const { zeigen, element } = useToast();
  const [monat, setMonat] = useState(heute().slice(0, 7));
  const [a, b] = monatsGrenzen(monat);
  const gf = ich.rollen.includes("geschaeftsfuehrung");
  const bereiche = gf ? [] : (["laden", "pension"] as const).filter((x) => ich.rollen.includes(x === "laden" ? "leitung_laden" : "leitung_pension"));
  const leitung = gf || bereiche.length > 0;
  const zeitraum = [where("datum", ">=", a), where("datum", "<=", b)];
  const abfragen = gf
    ? [query(collection(db, "zeiten"), ...zeitraum)]
    : [query(collection(db, "zeiten"), where("mitarbeiterUid", "==", ich.uid), ...zeitraum), ...bereiche.map((x) => query(collection(db, "zeiten"), where("bereich", "==", x), ...zeitraum))];
  const [zeiten, fehler] = useZeiten(abfragen, `${monat}-${ich.uid}-${gf}-${bereiche.join()}`);
  const [dienste, setDienste] = useState<Dienst[]>([]);
  useEffect(
    () => onSnapshot(query(collection(db, "dienste"), where("datum", ">=", a), where("datum", "<=", b)), (snap) => setDienste(snap.docs.map((x) => ({ id: x.id, ...x.data() }) as Dienst)), () => setDienste([])),
    [a, b],
  );
  const [person, setPerson] = useState(ich.uid);
  const [form, setForm] = useState<{ eintrag?: Zeiteintrag } | null>(null);

  // Man selbst, das Team, für das man Zeiten korrigiert, und alle mit Zeiten im Monat.
  const team = p.team.filter((x) => x.uid !== ich.uid && darfFreigeben(ich.rollen, ich.uid, { bereich: abwesenheitBereich(x.rollen), mitarbeiterUid: x.uid }));
  const personen = [
    { uid: ich.uid, name: ich.name, rollen: ich.rollen as string[] },
    ...team,
    ...zeiten.map((e) => ({ uid: e.mitarbeiterUid, name: e.mitarbeiterName, rollen: [] as string[] })),
  ].filter((x, i, l) => l.findIndex((y) => y.uid === x.uid) === i);
  const eigene = zeiten.filter((e) => e.mitarbeiterUid === person).sort((x, y) => x.datum.localeCompare(y.datum) || x.von.localeCompare(y.von));
  const ist = eigene.reduce((s, e) => s + arbeitsMinuten(e), 0);
  const soll = Math.round(dienste.filter((d) => d.mitarbeiterUid === person).reduce((s, d) => s + stunden(d.von, d.bis), 0) * 60);
  const fuer = personen.find((x) => x.uid === person) ?? personen[0];
  const name = fuer.name;

  function exportieren() {
    const url = URL.createObjectURL(new Blob([zeitCsv(zeiten)], { type: "text/csv;charset=utf-8" }));
    const l = document.createElement("a");
    l.href = url;
    l.download = `Zeiterfassung_${monat}.csv`;
    document.body.append(l);
    l.click();
    l.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const oeffnen = (eintrag?: Zeiteintrag) => {
    setForm({ eintrag });
    requestAnimationFrame(() => document.getElementById("h-zf")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <>
      <section className="panel" aria-labelledby="h-stempel">
        <h2 id="h-stempel">Stempeluhr</h2>
        <Stempeluhr />
      </section>

      <section className="panel" aria-labelledby="h-zm">
        <div className="panel-head">
          <h2 id="h-zm">{monatLabel(monat)}{person !== ich.uid && ` · ${name}`}</h2>
          <div className="actions">
            <button type="button" className="btn ghost small" onClick={() => setMonat(monatPlus(monat, -1))} aria-label="Monat zurück">←</button>
            <button type="button" className="btn ghost small" onClick={() => setMonat(heute().slice(0, 7))}>Dieser Monat</button>
            <button type="button" className="btn ghost small" onClick={() => setMonat(monatPlus(monat, 1))} aria-label="Monat vor">→</button>
          </div>
        </div>
        {leitung && personen.length > 1 && (
          <label>Person
            <select value={person} onChange={(e) => { setPerson(e.target.value); setForm(null); }}>
              {personen.map((x) => <option key={x.uid} value={x.uid}>{x.name}</option>)}
            </select>
          </label>
        )}
        {fehler && <p className="notice bad">{fehler}</p>}
        <div className="calc">
          <div><span>Gearbeitet</span><b>{stdMin(ist)} h</b></div>
          <div><span>Geplant (Dienstplan)</span><b>{stdMin(soll)} h</b></div>
          <div><span>Differenz</span><b className={ist - soll < 0 ? "neg" : "pos"}>{stdMin(ist - soll)} h</b></div>
        </div>
        {eigene.length ? (
          <div className="tablewrap">
            <table className="zeiten">
              <thead><tr><th>Tag</th><th>Beginn</th><th>Ende</th><th>Pause</th><th>Stunden</th><th>Notiz</th><th></th></tr></thead>
              <tbody>
                {eigene.map((e) => {
                  const hinweis = pausenHinweis(e);
                  const korrigiert = e.geaendertVon && e.geaendertVon !== e.mitarbeiterUid;
                  return (
                    <tr key={e.id}>
                      <td>{wochentagKurz(e.datum)} {datum(e.datum)}</td>
                      <td>{e.von}</td>
                      <td>{e.bis || <span className="pill acc">läuft</span>}</td>
                      <td>{e.pause ? `${e.pause} Min.` : "–"}</td>
                      <td>{e.bis ? stdMin(arbeitsMinuten(e)) : "–"}</td>
                      <td>
                        {e.notiz}
                        {hinweis && <span className="pill warn">{hinweis}</span>}
                        {korrigiert && <span className="pill">korrigiert von {e.geaendertName}</span>}
                      </td>
                      <td><button type="button" className="btn ghost small" onClick={() => oeffnen(e)}>Ändern</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <div className="empty">In diesem Monat ist keine Zeit erfasst.</div>}
        <div className="actions">
          {fuer.rollen.length > 0 && <button type="button" className="btn ghost small" onClick={() => oeffnen()}>Zeit nachtragen</button>}
        </div>
      </section>

      {leitung && (
        <section className="panel" aria-labelledby="h-zt">
          <div className="panel-head">
            <h2 id="h-zt">Team {monatLabel(monat)}</h2>
            <button type="button" className="btn ghost small" onClick={exportieren} disabled={!zeiten.length}>CSV für den Lohn</button>
          </div>
          <div className="tablewrap">
            <table>
              <thead><tr><th>Person</th><th>Gearbeitet</th><th>Geplant</th><th>Differenz</th><th>Offen</th></tr></thead>
              <tbody>
                {personen.map((x) => {
                  const z = zeiten.filter((e) => e.mitarbeiterUid === x.uid);
                  const i = z.reduce((s, e) => s + arbeitsMinuten(e), 0);
                  const s = Math.round(dienste.filter((d) => d.mitarbeiterUid === x.uid).reduce((t, d) => t + stunden(d.von, d.bis), 0) * 60);
                  return (
                    <tr key={x.uid} className="click" onClick={() => setPerson(x.uid)}>
                      <td>{x.name}</td>
                      <td>{stdMin(i)}</td>
                      <td>{stdMin(s)}</td>
                      <td className={i - s < 0 ? "neg" : "pos"}>{stdMin(i - s)}</td>
                      <td>{z.filter((e) => !e.bis).length || "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="hint">Zeile antippen, um die Einträge der Person zu sehen und zu korrigieren. Es erscheinen alle, die im Monat Zeit erfasst haben.</p>
        </section>
      )}
      {form && (form.eintrag || fuer.rollen.length > 0) && <Formular key={`${person}-${form.eintrag?.id ?? "neu"}`} vorhanden={form.eintrag} fuer={fuer} fertig={() => setForm((f) => (f === form ? null : f))} zeigen={zeigen} />}
      {element}
    </>
  );
}
