// Sitzungsprotokolle (Team und Kader) mit Traktanden und Pendenzen, wie im Ladenbuch.
// Statt eines Passworts schützen beim Kader die Rollen (Datenbankregeln) die Protokolle.
import { useEffect, useState, type FormEvent } from "react";
import { collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useIch } from "../auth";
import { meldung } from "../lib/fehler";
import { datum, heute, vorname, wochentagKurz } from "../lib/format";
import { darf, STUFE } from "../lib/rollen";
import { LoeschKnopf, speichern, useTeamNamen, useToast } from "../ui";

type Art = "team" | "kader";
type Pendenz = { was: string; wer: string; bis: string; erledigt: boolean };
type Protokoll = {
  id?: string; datum: string; zeit: string; ort: string; leitung: string; protokoll: string;
  anwesend: string[]; abwesend: string; t: string[]; pendenzen: Pendenz[]; naechste: string; gespeichert?: string; person?: string;
};

const ARTEN: Record<Art, { titel: string; sammlung: string; ort: string; traktanden: string[] }> = {
  team: {
    titel: "Teamsitzung", sammlung: "sitzungen_team", ort: "Laden",
    traktanden: ["Pendenzen der letzten Sitzung durchgehen", "Rückblick Monat: was lief gut, was nicht", "Kundschaft: Feedback, Reklamationen, Wünsche", "Sortiment und Ware: neue Artikel, Engpässe, MHD-Kontrolle", "Aktionen, Deko und Schaufenster im nächsten Monat", "Abläufe: Kasse, Ladenbuch, Bestellungen, Reinigungsplan", "Dienstplan und Ferien (Info)", "Infos aus der Geschäftsführung", "Runde: jede Person ein Anliegen oder eine Idee"],
  },
  kader: {
    titel: "Kadersitzung", sammlung: "sitzungen_kader", ort: "",
    traktanden: ["Pendenzen der letzten Sitzung durchgehen", "Zahlen des Monats: Umsatz gegenüber Vorjahr, Durchschnittseinkauf, Kundenfrequenz, Marge, Abschriften, Personalkosten", "Wochenberichte: Erkenntnisse und Anliegen von Morena", "Personal: Dienstplan, Ferien, Absenzen, Pensen, Gespräche", "Sortiment, Lieferanten und Preisgestaltung", "Marketing und Aktionen", "Laden, Technik und Unterhalt: Kasse, TORMAX, Alarmanlage", "Abläufe und Strukturierung, Anpassungen am Organisationshandbuch", "Budget und Investitionen", "Infos für die nächste Teamsitzung", "Verschiedenes"],
  },
};

const leerePendenz = (): Pendenz => ({ was: "", wer: "", bis: "", erledigt: false });

function entwurf(art: Art, leitung: string): Protokoll {
  return { datum: heute(), zeit: "", ort: ARTEN[art].ort, leitung, protokoll: "", anwesend: [], abwesend: "", t: ARTEN[art].traktanden.map(() => ""), pendenzen: [leerePendenz()], naechste: "" };
}

function oeffnen(art: Art, p: Protokoll): Protokoll {
  const k = structuredClone(p);
  k.t = ARTEN[art].traktanden.map((_, i) => p.t?.[i] ?? "");
  k.pendenzen = p.pendenzen?.length ? k.pendenzen : [leerePendenz()];
  k.anwesend = p.anwesend ?? [];
  return k;
}

function Formular({ art, start, team, onNeu }: { art: Art; start: Protokoll; team: string[]; onNeu: () => void }) {
  const ich = useIch();
  const { zeigen, element } = useToast();
  const [p, setP] = useState<Protokoll>(start);
  const personen = [...new Set([...team, p.leitung, p.protokoll].filter(Boolean))];
  const setze = (w: Partial<Protokoll>) => setP({ ...p, ...w });
  const setzePendenz = (i: number, w: Partial<Pendenz>) => setze({ pendenzen: p.pendenzen.map((x, j) => (j === i ? { ...x, ...w } : x)) });

  async function absenden(e: FormEvent) {
    e.preventDefault();
    if (!p.datum) return zeigen("Bitte Datum wählen");
    const id = p.id ?? `${p.datum}-${Math.random().toString(36).slice(2, 6)}`;
    const { id: _ohneId, ...rest } = p;
    void _ohneId;
    const eintrag = {
      ...rest, uid: ich.uid, person: ich.name, gespeichert: heute(),
      pendenzen: p.pendenzen.filter((x) => x.was.trim()).map((x) => ({ ...x, was: x.was.trim() })),
    };
    if (await speichern(zeigen, () => setDoc(doc(db, ARTEN[art].sammlung, id), eintrag), "Protokoll gespeichert")) {
      setP({ ...p, id, gespeichert: eintrag.gespeichert });
    }
  }

  const auswahl = (wert: string, onChange: (w: string) => void, label: string) => (
    <select value={wert} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      <option value="">–</option>
      {personen.map((n) => <option key={n}>{n}</option>)}
    </select>
  );

  return (
    <section className="panel" aria-labelledby="h-pr">
      <div className="panel-head">
        <h2 id="h-pr">Protokoll {ARTEN[art].titel}</h2>
        <div className="actions">
          {p.id ? <span className="pill good">Gespeichert {datum(p.gespeichert)}</span> : <span className="pill warn">Neues Protokoll</span>}
          <button type="button" className="btn ghost small" onClick={onNeu}>Neues Protokoll</button>
        </div>
      </div>
      <form className="grid" onSubmit={absenden}>
        <label>Datum<input type="date" value={p.datum} onChange={(e) => setze({ datum: e.target.value })} /></label>
        <label>Zeit<input value={p.zeit} onChange={(e) => setze({ zeit: e.target.value })} placeholder="z. B. 18:30–19:15" /></label>
        <label>Ort<input value={p.ort} onChange={(e) => setze({ ort: e.target.value })} placeholder="Ort" /></label>
        <label>Leitung{auswahl(p.leitung, (w) => setze({ leitung: w }), "Leitung")}</label>
        <label>Protokoll{auswahl(p.protokoll, (w) => setze({ protokoll: w }), "Protokoll")}</label>
        <div className="wide">
          <div className="lbl">Anwesend</div>
          <div className="checks">
            {personen.map((n) => (
              <label key={n} className="check">
                <input type="checkbox" checked={p.anwesend.includes(n)} onChange={(e) => setze({ anwesend: e.target.checked ? [...p.anwesend, n] : p.anwesend.filter((x) => x !== n) })} /> {n}
              </label>
            ))}
          </div>
        </div>
        <label className="wide">Abwesend / entschuldigt<input value={p.abwesend} onChange={(e) => setze({ abwesend: e.target.value })} placeholder="Namen" /></label>
        {ARTEN[art].traktanden.map((t, i) => (
          <label key={i} className="wide">
            {i + 1}. {t}
            <textarea value={p.t[i]} onChange={(e) => setze({ t: p.t.map((x, j) => (j === i ? e.target.value : x)) })} placeholder="Notizen und Beschlüsse" />
          </label>
        ))}
        <div className="wide">
          <div className="lbl">Neue Pendenzen</div>
          <div className="prows">
            {p.pendenzen.map((x, i) => (
              <div key={i} className="prow">
                <input value={x.was} onChange={(e) => setzePendenz(i, { was: e.target.value })} placeholder="Was ist zu tun?" aria-label={`Pendenz ${i + 1}`} />
                {auswahl(x.wer, (w) => setzePendenz(i, { wer: w }), "Wer")}
                <input type="date" value={x.bis} onChange={(e) => setzePendenz(i, { bis: e.target.value })} aria-label="Bis wann" />
                <button type="button" className="btn danger small" aria-label="Pendenz entfernen" onClick={() => {
                  const rest = p.pendenzen.filter((_, j) => j !== i);
                  setze({ pendenzen: rest.length ? rest : [leerePendenz()] });
                }}>×</button>
              </div>
            ))}
          </div>
          <button type="button" className="btn ghost small" style={{ marginTop: 8 }} onClick={() => setze({ pendenzen: [...p.pendenzen, leerePendenz()] })}>+ Pendenz</button>
        </div>
        <label className="wide">Nächste Sitzung<input value={p.naechste} onChange={(e) => setze({ naechste: e.target.value })} placeholder="Datum und Zeit" /></label>
        <div className="wide actions"><button className="btn">Protokoll speichern</button></div>
      </form>
      {element}
    </section>
  );
}

function Inhalt({ art, p }: { art: Art; p: Protokoll }) {
  return (
    <div className="list" style={{ marginTop: 8 }}>
      <div className="meta">
        {p.zeit && <span>{p.zeit}</span>}
        {p.ort && <span>{p.ort}</span>}
        {p.anwesend?.length > 0 && <span>Anwesend: {p.anwesend.join(", ")}</span>}
        {p.abwesend && <span>Abwesend: {p.abwesend}</span>}
      </div>
      {ARTEN[art].traktanden.map((t, i) => p.t?.[i] ? <p key={i}><b>{i + 1}. {t}</b>{"\n"}{p.t[i]}</p> : null)}
      {p.naechste && <p><b>Nächste Sitzung:</b> {p.naechste}</p>}
    </div>
  );
}

export function Sitzungen() {
  const ich = useIch();
  const team = useTeamNamen();
  const { zeigen, element } = useToast();
  const darfKader = darf(ich.rollen, "sitzungen_kader", STUFE.bearbeiten);
  const darfSchreiben = darf(ich.rollen, "sitzungen_team", STUFE.bearbeiten);
  const darfLoeschen = darf(ich.rollen, "sitzungen_team", STUFE.verwalten);
  const [art, setArt] = useState<Art>("team");
  const [liste, setListe] = useState<Protokoll[]>([]);
  const [fehler, setFehler] = useState("");
  const [offen, setOffen] = useState<{ nr: number; p: Protokoll }>(() => ({ nr: 0, p: entwurf("team", ich.name) }));

  useEffect(() => {
    return onSnapshot(
      query(collection(db, ARTEN[art].sammlung), orderBy("datum", "desc"), limit(200)),
      (snap) => { setFehler(""); setListe(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Protokoll) }))); },
      (err) => setFehler(meldung(err)),
    );
  }, [art]);

  const wechseln = (a: Art) => { if (a === art) return; setListe([]); setArt(a); setOffen((o) => ({ nr: o.nr + 1, p: entwurf(a, ich.name) })); };
  const pendenzen = liste.flatMap((p) => (p.pendenzen ?? []).map((x, i) => ({ ...x, i, pid: p.id!, sitzung: p.datum }))).filter((x) => !x.erledigt);
  pendenzen.sort((a, b) => (a.bis || "9999").localeCompare(b.bis || "9999"));

  async function abhaken(pid: string, i: number) {
    const p = liste.find((x) => x.id === pid);
    if (!p) return;
    const neu = p.pendenzen.map((x, j) => (j === i ? { ...x, erledigt: !x.erledigt } : x));
    await speichern(zeigen, () => updateDoc(doc(db, ARTEN[art].sammlung, pid), { pendenzen: neu }), "Pendenz erledigt");
  }

  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <div><div className="eyebrow">Sitzungen</div><h1>{ARTEN[art].titel}</h1></div>
          {darfKader && (
            <div className="filters">
              <button type="button" className="chip" aria-pressed={art === "team"} onClick={() => wechseln("team")}>Teamsitzung</button>
              <button type="button" className="chip" aria-pressed={art === "kader"} onClick={() => wechseln("kader")}>Kadersitzung</button>
            </div>
          )}
        </div>
        {art === "kader" && <p className="hint">Nur für Geschäftsführung und Leitungen sichtbar.</p>}
        {fehler && <p className="notice bad">{fehler}</p>}
      </section>
      {darfSchreiben && <Formular key={`${art}-${offen.nr}`} art={art} start={offen.p} team={team} onNeu={() => setOffen((o) => ({ nr: o.nr + 1, p: entwurf(art, ich.name) }))} />}
      <section className="panel" aria-labelledby="h-pp">
        <div className="panel-head"><h2 id="h-pp">Offene Pendenzen</h2>{pendenzen.length > 0 && <span className="pill warn">{pendenzen.length} offen</span>}</div>
        <div className="list">
          {pendenzen.length ? pendenzen.map((x) => (
            <article key={`${x.pid}-${x.i}`} className="item">
              <div className="item-row"><strong>{x.was}</strong>{x.bis && x.bis < heute() && <span className="pill bad">Überfällig</span>}</div>
              <div className="meta">{x.wer && <span>{x.wer}</span>}{x.bis && <span>bis {datum(x.bis)}</span>}<span>aus Sitzung {datum(x.sitzung)}</span></div>
              <div className="actions"><button type="button" className="btn ghost small" onClick={() => abhaken(x.pid, x.i)}>Erledigt</button></div>
            </article>
          )) : <div className="empty">Keine offenen Pendenzen.</div>}
        </div>
      </section>
      <section className="panel" aria-labelledby="h-pl">
        <h2 id="h-pl">Frühere Protokolle</h2>
        <div className="list">
          {liste.length ? liste.map((p) => {
            const pe = p.pendenzen ?? [];
            return (
              <article key={p.id} className="item">
                <div className="item-row">
                  <strong>{ARTEN[art].titel} {wochentagKurz(p.datum)} {datum(p.datum)}</strong>
                  <span className="pill">{pe.filter((x) => !x.erledigt).length} von {pe.length} Pendenzen offen</span>
                </div>
                <div className="meta">{p.leitung && <span>Leitung {vorname(p.leitung)}</span>}{p.protokoll && <span>Protokoll {vorname(p.protokoll)}</span>}</div>
                <details><summary>Protokoll lesen</summary><Inhalt art={art} p={p} /></details>
                <div className="actions">
                  {darfSchreiben && <button type="button" className="btn ghost small" onClick={() => { setOffen((o) => ({ nr: o.nr + 1, p: oeffnen(art, p) })); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Bearbeiten</button>}
                  <LoeschKnopf disabled={!darfLoeschen} onLoeschen={() => speichern(zeigen, () => deleteDoc(doc(db, ARTEN[art].sammlung, p.id!)), "Gelöscht")} />
                </div>
              </article>
            );
          }) : <div className="empty">Noch keine Protokolle. Das erste gespeicherte Protokoll erscheint hier.</div>}
        </div>
      </section>
      {element}
    </>
  );
}
