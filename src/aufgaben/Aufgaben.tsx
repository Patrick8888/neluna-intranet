// Aufgaben und Pendenzen: wer, bis wann, in welchem Bereich; wiederkehrende rücken beim Abhaken vor.
import { useEffect, useState, type FormEvent } from "react";
import { addDoc, collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useIch } from "../auth";
import { datum, heute, zeitstempel } from "../lib/format";
import { meldung } from "../lib/fehler";
import {
  AUFGABEN_BEREICHE, nachFaelligkeit, naechsteFaelligkeit, WIEDERHOLUNGEN, type Aufgabe, type AufgabenBereich, type Wiederholung,
} from "../lib/aufgaben";
import { darf, STUFE } from "../lib/rollen";
import { LoeschKnopf, speichern, useTeam, useToast } from "../ui";

type Ansicht = "meine" | "offen" | "erledigt";

/** Bereich, der zu den Rollen am besten passt (Vorschlag für neue Aufgaben). */
function bereichFuer(rollen: readonly string[]): AufgabenBereich {
  if (rollen.some((r) => r === "leitung_laden" || r === "verkauf")) return "Laden";
  if (rollen.some((r) => r === "leitung_pension" || r === "mitarbeit_pension")) return "Pension";
  if (rollen.includes("fahrdienst")) return "Fahrdienst";
  return "Firma";
}

function Formular({ vorhanden, fertig, zeigen }: { vorhanden?: Aufgabe; fertig: () => void; zeigen: (t: string) => void }) {
  const ich = useIch();
  const team = useTeam();
  const [w, setW] = useState(() => ({
    titel: vorhanden?.titel ?? "", beschreibung: vorhanden?.beschreibung ?? "", bereich: vorhanden?.bereich ?? bereichFuer(ich.rollen),
    zustaendigUid: vorhanden?.zustaendigUid ?? ich.uid, faellig: vorhanden?.faellig ?? "", wiederholung: vorhanden?.wiederholung ?? ("" as Wiederholung),
  }));
  const set = (x: Partial<typeof w>) => setW((alt) => ({ ...alt, ...x }));

  async function absenden(e: FormEvent) {
    e.preventDefault();
    if (!w.titel.trim()) return zeigen("Bitte einen Titel eingeben");
    const faellig = w.wiederholung && !w.faellig ? heute() : w.faellig;
    const zustaendigName = w.zustaendigUid ? team.find((x) => x.uid === w.zustaendigUid)?.name ?? (w.zustaendigUid === ich.uid ? ich.name : vorhanden?.zustaendigName ?? "") : "";
    const felder = { ...w, titel: w.titel.trim(), beschreibung: w.beschreibung.trim(), faellig, zustaendigName };
    const ok = vorhanden
      ? await speichern(zeigen, () => updateDoc(doc(db, "aufgaben", vorhanden.id), felder), "Aufgabe gespeichert")
      : await speichern(zeigen, () => addDoc(collection(db, "aufgaben"), {
          ...felder, erledigt: false, erledigtVon: "", erledigtAm: "", erstellt: zeitstempel(), person: ich.name, uid: ich.uid,
        }), "Aufgabe erfasst");
    if (ok) fertig();
  }

  return (
    <section className="panel" aria-labelledby="h-aufgabe">
      <h2 id="h-aufgabe">{vorhanden ? "Aufgabe bearbeiten" : "Neue Aufgabe"}</h2>
      <form className="grid" onSubmit={absenden}>
        <label className="wide">Was ist zu tun?<input value={w.titel} onChange={(e) => set({ titel: e.target.value })} maxLength={200} placeholder="z. B. Hundezimmer gründlich reinigen, Inventur Futter, Impfausweise prüfen" autoFocus required /></label>
        <label>Bereich<select value={w.bereich} onChange={(e) => set({ bereich: e.target.value as AufgabenBereich })}>{AUFGABEN_BEREICHE.map((b) => <option key={b}>{b}</option>)}</select></label>
        <label>Zuständig
          <select value={w.zustaendigUid} onChange={(e) => set({ zustaendigUid: e.target.value })}>
            <option value="">Wer gerade Zeit hat</option>
            {team.map((x) => <option key={x.uid} value={x.uid}>{x.name}</option>)}
          </select>
        </label>
        <label>Fällig am<input type="date" value={w.faellig} onChange={(e) => set({ faellig: e.target.value })} /></label>
        <label>Wiederholen<select value={w.wiederholung} onChange={(e) => set({ wiederholung: e.target.value as Wiederholung })}>{(Object.keys(WIEDERHOLUNGEN) as Wiederholung[]).map((k) => <option key={k} value={k}>{WIEDERHOLUNGEN[k]}</option>)}</select></label>
        <label className="wide">Details<textarea value={w.beschreibung} onChange={(e) => set({ beschreibung: e.target.value })} maxLength={4000} /></label>
        {w.wiederholung && <p className="hint wide">Beim Abhaken rückt die Fälligkeit automatisch auf den nächsten Termin vor.</p>}
        <div className="wide actions">
          <button className="btn">Speichern</button>
          <button type="button" className="btn ghost" onClick={fertig}>Abbrechen</button>
          {vorhanden && <LoeschKnopf onLoeschen={() => speichern(zeigen, () => deleteDoc(doc(db, "aufgaben", vorhanden.id)), "Gelöscht").then((ok) => ok && fertig())} />}
        </div>
      </form>
    </section>
  );
}

export function AufgabeZeile({ a, zeigen, bearbeiten }: { a: Aufgabe; zeigen: (t: string) => void; bearbeiten?: (a: Aufgabe) => void }) {
  const ich = useIch();
  const t = heute();
  const darfAendern = a.uid === ich.uid || a.zustaendigUid === ich.uid || ich.rollen.includes("geschaeftsfuehrung");

  function abhaken() {
    const wann = zeitstempel();
    // Wiederkehrend: gleiche Aufgabe, nächste Fälligkeit; einmalig: erledigt.
    const felder = a.wiederholung
      ? { faellig: naechsteFaelligkeit(a.faellig, a.wiederholung, t), erledigtVon: ich.name, erledigtAm: wann }
      : { erledigt: true, erledigtVon: ich.name, erledigtAm: wann };
    void speichern(zeigen, () => updateDoc(doc(db, "aufgaben", a.id), felder), a.wiederholung ? `Erledigt, nächstes Mal am ${datum(felder.faellig)}` : "Erledigt");
  }

  return (
    <article className={`item${a.erledigt ? " done" : ""}${a.faellig && a.faellig < t && !a.erledigt ? " important" : ""}`}>
      <div className="item-row">
        <strong>{a.titel}</strong>
        <span className="actions">
          <span className="pill">{a.bereich}</span>
          {a.wiederholung && <span className="pill acc">{WIEDERHOLUNGEN[a.wiederholung]}</span>}
        </span>
      </div>
      {a.beschreibung && <p>{a.beschreibung}</p>}
      <div className="meta">
        <span>{a.zustaendigName || "Wer gerade Zeit hat"}</span>
        {a.faellig && <span>{a.erledigt ? "war fällig" : "fällig"} {a.faellig === t ? "heute" : datum(a.faellig)}</span>}
        {a.erledigtVon && <span>{a.erledigt ? "erledigt" : "zuletzt erledigt"} von {a.erledigtVon}, {datum(a.erledigtAm)}</span>}
      </div>
      <div className="actions">
        {a.erledigt ? (
          <button type="button" className="btn ghost small" onClick={() => void speichern(zeigen, () => updateDoc(doc(db, "aufgaben", a.id), { erledigt: false, erledigtVon: "", erledigtAm: "" }), "Wieder offen")}>Wieder öffnen</button>
        ) : (
          <button type="button" className="btn small" onClick={abhaken}>Erledigt</button>
        )}
        {bearbeiten && darfAendern && !a.erledigt && <button type="button" className="btn ghost small" onClick={() => bearbeiten(a)}>Bearbeiten</button>}
      </div>
    </article>
  );
}

export function Aufgaben() {
  const ich = useIch();
  const { zeigen, element } = useToast();
  const [liste, setListe] = useState<Aufgabe[] | null>(null);
  const [fehler, setFehler] = useState("");
  const [ansicht, setAnsicht] = useState<Ansicht>("meine");
  const [bereich, setBereich] = useState<AufgabenBereich | "">("");
  const [form, setForm] = useState<{ aufgabe?: Aufgabe } | null>(null);
  const erfassen = darf(ich.rollen, "aufgaben", STUFE.bearbeiten);

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, "aufgaben"), orderBy("erstellt", "desc"), limit(1500)),
        (snap) => setListe(snap.docs.map((x) => ({ id: x.id, ...x.data() }) as Aufgabe)),
        (e) => setFehler(meldung(e)),
      ),
    [],
  );

  const alle = (liste ?? []).filter((a) => !bereich || a.bereich === bereich);
  const offen = alle.filter((a) => !a.erledigt);
  const sichtbar =
    ansicht === "meine" ? offen.filter((a) => a.zustaendigUid === ich.uid || (!a.zustaendigUid && a.uid === ich.uid))
      : ansicht === "offen" ? offen
        : alle.filter((a) => a.erledigt).sort((a, b) => b.erledigtAm.localeCompare(a.erledigtAm)).slice(0, 100);
  const oeffnen = (aufgabe?: Aufgabe) => {
    setForm({ aufgabe });
    requestAnimationFrame(() => document.getElementById("h-aufgabe")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <>
      <section className="panel" aria-labelledby="h-aufgaben">
        <div className="panel-head">
          <h2 id="h-aufgaben">Aufgaben</h2>
          {erfassen && !form && <button type="button" className="btn small" onClick={() => oeffnen()}>Neue Aufgabe</button>}
        </div>
        <div className="filters" aria-label="Ansicht">
          <button type="button" className="chip" aria-pressed={ansicht === "meine"} onClick={() => setAnsicht("meine")}>Meine</button>
          <button type="button" className="chip" aria-pressed={ansicht === "offen"} onClick={() => setAnsicht("offen")}>Alle offenen</button>
          <button type="button" className="chip" aria-pressed={ansicht === "erledigt"} onClick={() => setAnsicht("erledigt")}>Erledigt</button>
          <select value={bereich} onChange={(e) => setBereich(e.target.value as AufgabenBereich | "")} aria-label="Bereich">
            <option value="">Alle Bereiche</option>
            {AUFGABEN_BEREICHE.map((b) => <option key={b}>{b}</option>)}
          </select>
        </div>
        {fehler && <p className="notice bad">{fehler}</p>}
        {liste === null ? <p className="hint">Lädt …</p> : !sichtbar.length ? (
          <div className="empty">{ansicht === "meine" ? "Für dich ist gerade nichts offen." : ansicht === "offen" ? "Keine offenen Aufgaben." : "Noch nichts erledigt."}</div>
        ) : ansicht === "erledigt" ? (
          <div className="list">{sichtbar.map((a) => <AufgabeZeile key={a.id} a={a} zeigen={zeigen} />)}</div>
        ) : (
          nachFaelligkeit(sichtbar, heute()).map((g) => (
            <div key={g.titel}>
              <div className={`lbl${g.warn ? " warn" : ""}`}>{g.titel} ({g.aufgaben.length})</div>
              <div className="list">{g.aufgaben.map((a) => <AufgabeZeile key={a.id} a={a} zeigen={zeigen} bearbeiten={erfassen ? oeffnen : undefined} />)}</div>
            </div>
          ))
        )}
      </section>
      {form && <Formular key={form.aufgabe?.id ?? "neu"} vorhanden={form.aufgabe} fertig={() => setForm((f) => (f === form ? null : f))} zeigen={zeigen} />}
      {element}
    </>
  );
}
