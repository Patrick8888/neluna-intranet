// Dienstplan: eine Woche je Bereich, Personen als Zeilen; Ferien und Abwesenheiten sind eingeblendet.
import { useEffect, useState, type FormEvent } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, updateDoc, where, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { useIch } from "../auth";
import { datum, heute, kalenderwoche, montagVon, plusTage, wochentagKurz, zeitstempel } from "../lib/format";
import { meldung } from "../lib/fehler";
import {
  abwesendAm, artFuer, DIENST_BEREICHE, DIENST_ROLLEN, dienstplanBearbeiten, stunden, stundenText, vorwocheUebernehmen,
  type Dienst, type DienstBereich,
} from "../lib/personal";
import { LoeschKnopf, speichern, useToast } from "../ui";
import { usePersonal } from "./Personal";

type Auswahl = DienstBereich | "meine";

function Formular({ bereich, vorhanden, vorschlag, personen, fertig, zeigen }: {
  bereich: DienstBereich; vorhanden?: Dienst; vorschlag: { datum: string; uid: string }; personen: { uid: string; name: string }[];
  fertig: () => void; zeigen: (t: string) => void;
}) {
  const ich = useIch();
  const p = usePersonal();
  const [w, setW] = useState(() => ({
    mitarbeiterUid: vorhanden?.mitarbeiterUid ?? vorschlag.uid, datum: vorhanden?.datum ?? vorschlag.datum,
    von: vorhanden?.von ?? "08:00", bis: vorhanden?.bis ?? "12:00", notiz: vorhanden?.notiz ?? "",
  }));
  const set = (x: Partial<typeof w>) => setW((alt) => ({ ...alt, ...x }));
  const abwesend = abwesendAm(p.abwesenheiten, w.mitarbeiterUid, w.datum);

  async function absenden(e: FormEvent) {
    e.preventDefault();
    if (!w.mitarbeiterUid) return zeigen("Bitte eine Person wählen");
    if (!(w.von < w.bis)) return zeigen("Das Ende muss nach dem Beginn liegen");
    const name = personen.find((x) => x.uid === w.mitarbeiterUid)?.name ?? vorhanden?.mitarbeiterName ?? "";
    const felder = { ...w, mitarbeiterName: name, notiz: w.notiz.trim(), bereich };
    const ok = vorhanden
      ? await speichern(zeigen, () => updateDoc(doc(db, "dienste", vorhanden.id), felder), "Dienst gespeichert")
      : await speichern(zeigen, () => addDoc(collection(db, "dienste"), { ...felder, erstellt: zeitstempel(), person: ich.name, uid: ich.uid }), "Dienst eingetragen");
    if (ok) fertig();
  }

  return (
    <section className="panel" aria-labelledby="h-dienst">
      <h2 id="h-dienst">{vorhanden ? "Dienst bearbeiten" : "Neuer Dienst"} · {DIENST_BEREICHE[bereich]}</h2>
      <form className="grid" onSubmit={absenden}>
        <label>Person
          <select value={w.mitarbeiterUid} onChange={(e) => set({ mitarbeiterUid: e.target.value })} required>
            <option value="">Bitte wählen</option>
            {personen.map((x) => <option key={x.uid} value={x.uid}>{x.name}</option>)}
          </select>
        </label>
        <label>Tag<input type="date" value={w.datum} onChange={(e) => set({ datum: e.target.value })} required /></label>
        <label>Beginn<input type="time" value={w.von} onChange={(e) => set({ von: e.target.value })} required /></label>
        <label>Ende<input type="time" value={w.bis} onChange={(e) => set({ bis: e.target.value })} required /></label>
        <label className="wide">Notiz<input value={w.notiz} onChange={(e) => set({ notiz: e.target.value })} maxLength={300} placeholder="z. B. Kasse, Lieferung annehmen, Fahrten Vormittag" /></label>
        {abwesend && <p className="notice bad wide">Achtung: an diesem Tag {artFuer(abwesend, ich.rollen, ich.uid)} ({datum(abwesend.von)}–{datum(abwesend.bis)}).</p>}
        <div className="wide actions">
          <button className="btn">Speichern</button>
          <button type="button" className="btn ghost" onClick={fertig}>Abbrechen</button>
          {vorhanden && <LoeschKnopf onLoeschen={() => speichern(zeigen, () => deleteDoc(doc(db, "dienste", vorhanden.id)), "Gelöscht").then((ok) => ok && fertig())} />}
        </div>
      </form>
    </section>
  );
}

/** Die eigenen Dienste der nächsten Wochen, über alle Bereiche. */
function MeineDienste() {
  const ich = useIch();
  const p = usePersonal();
  const [dienste, setDienste] = useState<Dienst[] | null>(null);
  const [fehler, setFehler] = useState("");
  useEffect(
    () =>
      onSnapshot(
        query(collection(db, "dienste"), where("mitarbeiterUid", "==", ich.uid), where("datum", ">=", heute()), orderBy("datum")),
        (snap) => setDienste(snap.docs.map((x) => ({ id: x.id, ...x.data() }) as Dienst)),
        (e) => setFehler(meldung(e)),
      ),
    [ich.uid],
  );
  const eigene = p.abwesenheiten.filter((a) => a.mitarbeiterUid === ich.uid && a.status === "Bewilligt" && a.bis >= heute());
  return (
    <section className="panel" aria-labelledby="h-meine">
      <h2 id="h-meine">Meine Dienste</h2>
      {fehler && <p className="notice bad">{fehler}</p>}
      {dienste === null ? <p className="hint">Lädt …</p> : !dienste.length ? <div className="empty">Keine Dienste geplant.</div> : (
        <div className="list">
          {dienste.sort((a, b) => a.datum.localeCompare(b.datum) || a.von.localeCompare(b.von)).map((d) => (
            <div key={d.id} className={`item${d.datum === heute() ? " important" : ""}`}>
              <div className="item-row">
                <strong>{wochentagKurz(d.datum)} {datum(d.datum)} · {d.von}–{d.bis}</strong>
                <span className="pill">{DIENST_BEREICHE[d.bereich]}</span>
              </div>
              {d.notiz && <p>{d.notiz}</p>}
            </div>
          ))}
        </div>
      )}
      {eigene.length > 0 && (
        <>
          <div className="lbl">Deine bewilligten Abwesenheiten</div>
          <div className="list">{eigene.map((a) => <div key={a.id} className="item"><strong>{a.art}</strong> {datum(a.von)}–{datum(a.bis)}</div>)}</div>
        </>
      )}
    </section>
  );
}

function Woche({ bereich }: { bereich: DienstBereich }) {
  const ich = useIch();
  const p = usePersonal();
  const { zeigen, element } = useToast();
  const [montag, setMontag] = useState(montagVon(heute()));
  const [dienste, setDienste] = useState<Dienst[]>([]);
  const [fehler, setFehler] = useState("");
  const [form, setForm] = useState<{ dienst?: Dienst; datum: string; uid: string } | null>(null);
  const bearbeiten = dienstplanBearbeiten(ich.rollen, bereich);
  const tage = Array.from({ length: 7 }, (_, i) => plusTage(montag, i));

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, "dienste"), where("datum", ">=", plusTage(montag, -7)), where("datum", "<=", plusTage(montag, 6)), orderBy("datum")),
        (snap) => setDienste(snap.docs.map((x) => ({ id: x.id, ...x.data() }) as Dienst)),
        (e) => setFehler(meldung(e)),
      ),
    [montag],
  );

  const woche = dienste.filter((d) => d.bereich === bereich && d.datum >= montag).sort((a, b) => a.von.localeCompare(b.von));
  const ausRollen = p.team.filter((x) => x.rollen.some((r) => (DIENST_ROLLEN[bereich] as readonly string[]).includes(r)));
  const personen = [
    ...ausRollen.map((x) => ({ uid: x.uid, name: x.name })),
    ...woche.filter((d) => !ausRollen.some((x) => x.uid === d.mitarbeiterUid)).map((d) => ({ uid: d.mitarbeiterUid, name: d.mitarbeiterName })),
  ].filter((x, i, a) => a.findIndex((y) => y.uid === x.uid) === i);
  const vorwoche = bearbeiten ? vorwocheUebernehmen(dienste, p.abwesenheiten, bereich, montag) : [];

  // Ein späteres «fertig» eines vorherigen Formulars (Speichern dauert) schliesst nur dieses.
  const oeffnen = (f: { dienst?: Dienst; datum: string; uid: string }) => {
    setForm(f);
    requestAnimationFrame(() => document.getElementById("h-dienst")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  async function uebernehmen() {
    const batch = writeBatch(db);
    for (const d of vorwoche) batch.set(doc(collection(db, "dienste")), { ...d, erstellt: zeitstempel(), person: ich.name, uid: ich.uid });
    await speichern(zeigen, () => batch.commit(), `${vorwoche.length} Dienste übernommen`);
  }

  return (
    <>
      <section className="panel" aria-labelledby="h-woche">
        <div className="panel-head">
          <h2 id="h-woche">{DIENST_BEREICHE[bereich]} · KW {kalenderwoche(montag)}, {datum(montag).slice(0, 6)}–{datum(plusTage(montag, 6))}</h2>
          <div className="actions">
            <button type="button" className="btn ghost small" onClick={() => setMontag(plusTage(montag, -7))} aria-label="Woche zurück">←</button>
            <button type="button" className="btn ghost small" onClick={() => setMontag(montagVon(heute()))}>Diese Woche</button>
            <button type="button" className="btn ghost small" onClick={() => setMontag(plusTage(montag, 7))} aria-label="Woche vor">→</button>
          </div>
        </div>
        {fehler && <p className="notice bad">{fehler}</p>}
        <div className="tablewrap">
          <table className="dienstplan">
            <thead>
              <tr>
                <th>Person</th>
                {tage.map((t) => <th key={t} className={t === heute() ? "heute" : ""}>{wochentagKurz(t)} {datum(t).slice(0, 6)}</th>)}
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {personen.map((x) => {
                const eigene = woche.filter((d) => d.mitarbeiterUid === x.uid);
                return (
                  <tr key={x.uid} className={x.uid === ich.uid ? "ich" : ""}>
                    <td className="dp-name">{x.name}</td>
                    {tage.map((t) => {
                      const abw = abwesendAm(p.abwesenheiten, x.uid, t);
                      const an = eigene.filter((d) => d.datum === t);
                      return (
                        <td key={t} className={`dp-zelle${t === heute() ? " heute" : ""}`}>
                          {abw && <span className="pill warn">{artFuer(abw, ich.rollen, ich.uid)}</span>}
                          {an.map((d) =>
                            bearbeiten ? (
                              <button key={d.id} type="button" className="dp-dienst" onClick={() => oeffnen({ dienst: d, datum: t, uid: x.uid })} title={d.notiz}>
                                {d.von}–{d.bis}{d.notiz && <small>{d.notiz}</small>}
                              </button>
                            ) : (
                              <span key={d.id} className="dp-dienst" title={d.notiz}>{d.von}–{d.bis}{d.notiz && <small>{d.notiz}</small>}</span>
                            ),
                          )}
                          {bearbeiten && <button type="button" className="dp-neu" onClick={() => oeffnen({ datum: t, uid: x.uid })} aria-label={`Dienst für ${x.name} am ${datum(t)} eintragen`}>+</button>}
                        </td>
                      );
                    })}
                    <td>{stundenText(eigene.reduce((s, d) => s + stunden(d.von, d.bis), 0))}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td className="dp-name">Besetzt</td>
                {tage.map((t) => <td key={t}>{new Set(woche.filter((d) => d.datum === t).map((d) => d.mitarbeiterUid)).size || "–"}</td>)}
                <td>{stundenText(woche.reduce((s, d) => s + stunden(d.von, d.bis), 0))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        {bearbeiten && (
          <div className="actions">
            {vorwoche.length > 0 && <button type="button" className="btn ghost small" onClick={() => void uebernehmen()}>Vorwoche übernehmen ({vorwoche.length} Dienste)</button>}
            <span className="hint">Tippe auf «+», um einen Dienst einzutragen, oder auf einen Dienst, um ihn zu ändern.</span>
          </div>
        )}
      </section>
      {form && bearbeiten && (
        <Formular key={form.dienst?.id ?? `${form.uid}-${form.datum}`} bereich={bereich} vorhanden={form.dienst} vorschlag={form} personen={personen} fertig={() => setForm((f) => (f === form ? null : f))} zeigen={zeigen} />
      )}
      {element}
    </>
  );
}

export function Dienstplan() {
  const ich = useIch();
  const eigene = (Object.keys(DIENST_BEREICHE) as DienstBereich[]).filter((b) => dienstplanBearbeiten(ich.rollen, b) || DIENST_ROLLEN[b].some((r) => ich.rollen.includes(r)));
  // Wer selbst plant, startet im eigenen Bereich; alle anderen bei den eigenen Diensten.
  const plant = (Object.keys(DIENST_BEREICHE) as DienstBereich[]).find((b) => dienstplanBearbeiten(ich.rollen, b));
  const [auswahl, setAuswahl] = useState<Auswahl>(plant ?? (eigene.length ? "meine" : "laden"));
  return (
    <>
      <div className="filters" aria-label="Bereich">
        <button type="button" className="chip" aria-pressed={auswahl === "meine"} onClick={() => setAuswahl("meine")}>Meine Dienste</button>
        {(Object.keys(DIENST_BEREICHE) as DienstBereich[]).map((b) => (
          <button key={b} type="button" className="chip" aria-pressed={auswahl === b} onClick={() => setAuswahl(b)}>{DIENST_BEREICHE[b]}</button>
        ))}
      </div>
      {auswahl === "meine" ? <MeineDienste /> : <Woche key={auswahl} bereich={auswahl} />}
    </>
  );
}
