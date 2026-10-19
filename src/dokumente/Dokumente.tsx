// Dokumente: Organisationshandbuch, Reglemente, Anleitungen, Formulare. Text, Link und Datei (bis 5 MB).
import { Fragment, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { collection, deleteDoc, doc, getDoc, limit, onSnapshot, orderBy, query, setDoc, where, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { useIch } from "../auth";
import { datum, zeitstempel } from "../lib/format";
import { meldung } from "../lib/fehler";
import {
  bloecke, dateiGroesse, inTeile, KATEGORIEN, linkOk, MAX_DATEI, SICHTBAR, suchen, type DateiInfo, type Dokument, type Kategorie, type Sichtbar,
} from "../lib/dokumente";
import { darf, STUFE } from "../lib/rollen";
import { LoeschKnopf, speichern, useToast } from "../ui";

const LEITUNG = ["geschaeftsfuehrung", "leitung_pension", "leitung_laden"];

const neuerSchluessel = () => crypto.randomUUID().replace(/-/g, "").slice(0, 20);

function alsDataUrl(datei: File): Promise<string> {
  return new Promise((ok, fehler) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => fehler(r.error);
    r.readAsDataURL(datei);
  });
}

/** Links im Text anklickbar machen. */
function mitLinks(text: string): ReactNode[] {
  return text.split(/(https?:\/\/\S+)/g).map((t, i) => (i % 2 ? <a key={i} href={t} target="_blank" rel="noreferrer">{t}</a> : <Fragment key={i}>{t}</Fragment>));
}

function Inhalt({ text }: { text: string }) {
  return (
    <div className="dok-inhalt">
      {bloecke(text).map((b, i) =>
        b.art === "titel" ? <h3 key={i}>{b.zeilen[0]}</h3>
          : b.art === "liste" ? <ul key={i}>{b.zeilen.map((z, j) => <li key={j}>{mitLinks(z)}</li>)}</ul>
            : <p key={i}>{b.zeilen.map((z, j) => <Fragment key={j}>{j > 0 && <br />}{mitLinks(z)}</Fragment>)}</p>,
      )}
    </div>
  );
}

async function herunterladen(d: Dokument, zeigen: (t: string) => void) {
  if (!d.datei) return;
  try {
    const teile = await Promise.all(Array.from({ length: d.datei.teile }, (_, i) => getDoc(doc(db, "dokumente", d.id, "teile", `${d.datei!.schluessel}_${i}`))));
    const daten = teile.map((t) => String(t.data()?.daten ?? "")).join("");
    const blob = await (await fetch(daten)).blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = d.datei.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    zeigen(meldung(e));
  }
}

function Formular({ vorhanden, fertig, zeigen }: { vorhanden?: Dokument; fertig: () => void; zeigen: (t: string) => void }) {
  const ich = useIch();
  const [w, setW] = useState(() => ({
    titel: vorhanden?.titel ?? "", kategorie: vorhanden?.kategorie ?? ("Anleitungen" as Kategorie), inhalt: vorhanden?.inhalt ?? "",
    link: vorhanden?.link ?? "", fuer: vorhanden?.fuer ?? ("alle" as Sichtbar),
  }));
  const [datei, setDatei] = useState<File | null>(null);
  const [dateiWeg, setDateiWeg] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const set = (x: Partial<typeof w>) => setW((alt) => ({ ...alt, ...x }));

  async function absenden(e: FormEvent) {
    e.preventDefault();
    if (!w.titel.trim()) return zeigen("Bitte einen Titel eingeben");
    if (!linkOk(w.link.trim())) return zeigen("Der Link muss mit https:// beginnen");
    if (datei && datei.size > MAX_DATEI) return zeigen(`Die Datei ist grösser als ${dateiGroesse(MAX_DATEI)}. Bitte als Link ablegen.`);
    setLaeuft(true);
    const id = vorhanden?.id ?? doc(collection(db, "dokumente")).id;
    const ok = await speichern(zeigen, async () => {
      let info: DateiInfo | undefined = dateiWeg ? undefined : vorhanden?.datei;
      if (datei) {
        // Zuerst die Teile, dann das Dokument; alte Teile erst danach löschen.
        const teile = inTeile(await alsDataUrl(datei));
        const schluessel = neuerSchluessel();
        for (let i = 0; i < teile.length; i++) await setDoc(doc(db, "dokumente", id, "teile", `${schluessel}_${i}`), { daten: teile[i] });
        info = { schluessel, name: datei.name.slice(0, 200), typ: (datei.type || "application/octet-stream").slice(0, 100), groesse: datei.size, teile: teile.length };
      }
      const felder: Record<string, unknown> = {
        ...w, titel: w.titel.trim(), link: w.link.trim(), inhalt: w.inhalt.trim(),
        erstellt: vorhanden?.erstellt ?? zeitstempel(), geaendert: zeitstempel(), person: ich.name, uid: ich.uid,
      };
      if (info) felder.datei = info;
      await setDoc(doc(db, "dokumente", id), felder);
      const alt = vorhanden?.datei;
      if (alt && alt.schluessel !== info?.schluessel) {
        const batch = writeBatch(db);
        for (let i = 0; i < alt.teile; i++) batch.delete(doc(db, "dokumente", id, "teile", `${alt.schluessel}_${i}`));
        await batch.commit();
      }
    }, vorhanden ? "Dokument gespeichert" : "Dokument abgelegt");
    setLaeuft(false);
    if (ok) fertig();
  }

  return (
    <section className="panel" aria-labelledby="h-dok-form">
      <h2 id="h-dok-form">{vorhanden ? "Dokument bearbeiten" : "Neues Dokument"}</h2>
      <form className="grid" onSubmit={absenden}>
        <label className="wide">Titel<input value={w.titel} onChange={(e) => set({ titel: e.target.value })} maxLength={200} required /></label>
        <label>Kategorie<select value={w.kategorie} onChange={(e) => set({ kategorie: e.target.value as Kategorie })}>{KATEGORIEN.map((k) => <option key={k}>{k}</option>)}</select></label>
        <label>Sichtbar für<select value={w.fuer} onChange={(e) => set({ fuer: e.target.value as Sichtbar })}>{(Object.keys(SICHTBAR) as Sichtbar[]).map((k) => <option key={k} value={k}>{SICHTBAR[k]}</option>)}</select></label>
        <label className="wide">Link (freiwillig)<input type="url" value={w.link} onChange={(e) => set({ link: e.target.value })} placeholder="https://… z. B. Organisationshandbuch oder Google Drive" /></label>
        <label className="wide">Text (freiwillig)
          <textarea rows={10} value={w.inhalt} onChange={(e) => set({ inhalt: e.target.value })} maxLength={60000} placeholder={"# Überschrift\nEin Absatz Text.\n- Punkt einer Liste\n- noch ein Punkt"} />
        </label>
        <label className="wide">Datei (PDF, Word, Bild, bis {dateiGroesse(MAX_DATEI)})<input type="file" onChange={(e) => setDatei(e.target.files?.[0] ?? null)} /></label>
        {vorhanden?.datei && !datei && (
          <label className="check wide"><input type="checkbox" checked={dateiWeg} onChange={(e) => setDateiWeg(e.target.checked)} />Bisherige Datei «{vorhanden.datei.name}» entfernen</label>
        )}
        <p className="hint wide">Im Text: «# » am Zeilenanfang für eine Überschrift, «- » für eine Aufzählung, Leerzeile für einen neuen Absatz.</p>
        <div className="wide actions">
          <button className="btn" disabled={laeuft}>{laeuft ? "Speichert …" : "Speichern"}</button>
          <button type="button" className="btn ghost" onClick={fertig}>Abbrechen</button>
        </div>
      </form>
    </section>
  );
}

function DokumentKarte({ d, offen, umschalten, bearbeiten, zeigen }: { d: Dokument; offen: boolean; umschalten: () => void; bearbeiten?: () => void; zeigen: (t: string) => void }) {
  const verwalten = !!bearbeiten;
  async function loeschen() {
    await speichern(zeigen, async () => {
      if (d.datei) {
        const batch = writeBatch(db);
        for (let i = 0; i < d.datei.teile; i++) batch.delete(doc(db, "dokumente", d.id, "teile", `${d.datei.schluessel}_${i}`));
        await batch.commit();
      }
      await deleteDoc(doc(db, "dokumente", d.id));
    }, "Gelöscht");
  }
  return (
    <article className="item">
      <button type="button" className="item-row dok-kopf" onClick={umschalten} aria-expanded={offen}>
        <strong>{d.titel}</strong>
        <span className="actions">
          {d.fuer === "leitung" && <span className="pill warn">Leitung</span>}
          <span className="pill">{d.kategorie}</span>
        </span>
      </button>
      <div className="meta">
        <span>aktualisiert {datum(d.geaendert)} von {d.person}</span>
        {d.datei && <span>{d.datei.name} · {dateiGroesse(d.datei.groesse)}</span>}
      </div>
      {offen && d.inhalt && <Inhalt text={d.inhalt} />}
      <div className="actions">
        {d.link && <a className="btn ghost small" href={d.link} target="_blank" rel="noreferrer">Öffnen</a>}
        {d.datei && <button type="button" className="btn ghost small" onClick={() => void herunterladen(d, zeigen)}>Datei herunterladen</button>}
        {d.inhalt && <button type="button" className="btn ghost small" onClick={umschalten}>{offen ? "Text zuklappen" : "Text lesen"}</button>}
        {verwalten && <button type="button" className="btn ghost small" onClick={bearbeiten}>Bearbeiten</button>}
        {verwalten && <LoeschKnopf onLoeschen={() => void loeschen()} />}
      </div>
    </article>
  );
}

export function Dokumente() {
  const ich = useIch();
  const { zeigen, element } = useToast();
  const [liste, setListe] = useState<Dokument[] | null>(null);
  const [fehler, setFehler] = useState("");
  const [suche, setSuche] = useState("");
  const [kategorie, setKategorie] = useState<Kategorie | "">("");
  const [offen, setOffen] = useState<string | null>(null);
  const [form, setForm] = useState<{ dokument?: Dokument } | null>(null);
  const verwalten = darf(ich.rollen, "dokumente", STUFE.verwalten);
  const leitung = ich.rollen.some((r) => LEITUNG.includes(r));

  useEffect(() => {
    // Wer nicht zur Leitung gehört, darf nur nach «alle» fragen (die Regeln prüfen die Abfrage).
    const q = leitung ? query(collection(db, "dokumente"), orderBy("titel"), limit(500)) : query(collection(db, "dokumente"), where("fuer", "==", "alle"), limit(500));
    return onSnapshot(q, (snap) => setListe(snap.docs.map((x) => ({ id: x.id, ...x.data() }) as Dokument)), (e) => setFehler(meldung(e)));
  }, [leitung]);

  const gefunden = suchen((liste ?? []).filter((d) => !kategorie || d.kategorie === kategorie), suche).sort((a, b) => a.titel.localeCompare(b.titel, "de"));
  const oeffnen = (dokument?: Dokument) => {
    setForm({ dokument });
    requestAnimationFrame(() => document.getElementById("h-dok-form")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <>
      <section className="panel" aria-labelledby="h-dok">
        <div className="panel-head">
          <h2 id="h-dok">Dokumente</h2>
          {verwalten && !form && <button type="button" className="btn small" onClick={() => oeffnen()}>Neues Dokument</button>}
        </div>
        <div className="filters">
          <input type="search" value={suche} onChange={(e) => setSuche(e.target.value)} placeholder="Suchen, z. B. Reinigung, Kasse, Ferien" aria-label="Dokumente durchsuchen" />
          <select value={kategorie} onChange={(e) => setKategorie(e.target.value as Kategorie | "")} aria-label="Kategorie">
            <option value="">Alle Kategorien</option>
            {KATEGORIEN.map((k) => <option key={k}>{k}</option>)}
          </select>
        </div>
        {fehler && <p className="notice bad">{fehler}</p>}
        {liste === null ? <p className="hint">Lädt …</p> : !gefunden.length ? (
          <div className="empty">{liste.length ? "Nichts gefunden." : "Noch keine Dokumente abgelegt."}</div>
        ) : (
          KATEGORIEN.filter((k) => gefunden.some((d) => d.kategorie === k)).map((k) => (
            <div key={k}>
              <div className="lbl">{k}</div>
              <div className="list">
                {gefunden.filter((d) => d.kategorie === k).map((d) => (
                  <DokumentKarte key={d.id} d={d} offen={offen === d.id} umschalten={() => setOffen(offen === d.id ? null : d.id)} bearbeiten={verwalten ? () => oeffnen(d) : undefined} zeigen={zeigen} />
                ))}
              </div>
            </div>
          ))
        )}
      </section>
      {form && <Formular key={form.dokument?.id ?? "neu"} vorhanden={form.dokument} fertig={() => setForm((f) => (f === form ? null : f))} zeigen={zeigen} />}
      {element}
    </>
  );
}
