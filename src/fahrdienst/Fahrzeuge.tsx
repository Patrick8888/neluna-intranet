// Fahrzeuge mit Kilometerstand und Garagen- und Unterhaltsterminen. Wiederkehrende Termine planen den nächsten selbst.
import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { addDoc, collection, deleteDoc, doc, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { useIch } from "../auth";
import { chf, datum, heute, wochentagKurz, zahl, zeitstempel } from "../lib/format";
import {
  faelligeTermine, naechsterTermin, STANDARD_WIEDERHOLUNG, TERMIN_ARTEN, type Fahrzeug, type FahrzeugTermin, type TerminArt,
} from "../lib/fahrdienst";
import { darf, STUFE } from "../lib/rollen";
import { LoeschKnopf, speichern, useToast } from "../ui";
import { useFahrdienst } from "./daten";

const ganz = (v: string) => Math.max(0, Math.round(zahl(v)));
const km = (n: number) => `${n.toLocaleString("de-CH")} km`;

// Versicherung und Vignette sind keine Garagenbesuche; das Fahrzeug bleibt verfügbar.
const blockiertStandard = (art: TerminArt) => !["Versicherung", "Vignette"].includes(art);

type TerminWerte = { art: TerminArt; datum: string; zeit: string; garage: string; blockiert: boolean; wiederholungMonate: string; faelligKm: string; wiederholungKm: string; notiz: string };

function TerminFormular({ fz, vorhanden, fertig, zeigen }: { fz: Fahrzeug; vorhanden?: FahrzeugTermin; fertig: () => void; zeigen: (t: string) => void }) {
  const ich = useIch();
  const [w, setW] = useState<TerminWerte>(() => ({
    art: vorhanden?.art ?? "Reifenwechsel",
    datum: vorhanden?.datum ?? heute(),
    zeit: vorhanden?.zeit ?? "",
    garage: vorhanden?.garage ?? "",
    blockiert: vorhanden?.blockiert ?? true,
    wiederholungMonate: String(vorhanden?.wiederholungMonate ?? STANDARD_WIEDERHOLUNG.Reifenwechsel),
    faelligKm: vorhanden?.faelligKm ? String(vorhanden.faelligKm) : "",
    wiederholungKm: vorhanden?.wiederholungKm ? String(vorhanden.wiederholungKm) : "",
    notiz: vorhanden?.notiz ?? "",
  }));
  const set = (x: Partial<TerminWerte>) => setW((alt) => ({ ...alt, ...x }));

  async function absenden(e: FormEvent) {
    e.preventDefault();
    const felder = {
      fahrzeugId: fz.id, art: w.art, datum: w.datum, zeit: w.zeit.slice(0, 5), garage: w.garage.trim(), blockiert: w.blockiert,
      wiederholungMonate: Math.min(60, ganz(w.wiederholungMonate)), faelligKm: ganz(w.faelligKm), wiederholungKm: ganz(w.wiederholungKm), notiz: w.notiz.trim(),
    };
    const ok = vorhanden
      ? await speichern(zeigen, () => updateDoc(doc(db, "fahrzeug_termine", vorhanden.id), felder), "Termin gespeichert")
      : await speichern(zeigen, () => addDoc(collection(db, "fahrzeug_termine"), {
          ...felder, kosten: 0, kmStand: 0, erledigt: false, erledigtAm: "", erstellt: zeitstempel(), person: ich.name, uid: ich.uid,
        }), "Termin eingetragen");
    if (ok) fertig();
  }

  return (
    <form className="grid" onSubmit={absenden}>
      <label>
        Art
        <select value={w.art} onChange={(e) => {
          const art = e.target.value as TerminArt;
          set({ art, blockiert: blockiertStandard(art), wiederholungMonate: String(STANDARD_WIEDERHOLUNG[art]) });
        }}>
          {TERMIN_ARTEN.map((a) => <option key={a}>{a}</option>)}
        </select>
      </label>
      <label>Datum<input type="date" value={w.datum} onChange={(e) => set({ datum: e.target.value })} required /></label>
      <label>Zeit<input type="time" value={w.zeit} onChange={(e) => set({ zeit: e.target.value })} /></label>
      <label>Garage<input value={w.garage} onChange={(e) => set({ garage: e.target.value })} placeholder="z. B. Garage Huber, Diessenhofen" /></label>
      <label>Wiederholen alle … Monate<input type="number" min={0} max={60} value={w.wiederholungMonate} onChange={(e) => set({ wiederholungMonate: e.target.value })} /></label>
      {w.art === "Service" && (
        <>
          <label>Fällig bei km<input className="num" inputMode="numeric" value={w.faelligKm} onChange={(e) => set({ faelligKm: e.target.value })} placeholder={String(fz.kmStand + 15000)} /></label>
          <label>Wiederholen alle … km<input className="num" inputMode="numeric" value={w.wiederholungKm} onChange={(e) => set({ wiederholungKm: e.target.value })} placeholder="z. B. 15000" /></label>
        </>
      )}
      <label className="check wide"><input type="checkbox" checked={w.blockiert} onChange={(e) => set({ blockiert: e.target.checked })} /> Fahrzeug ist an diesem Tag nicht für den Fahrdienst verfügbar</label>
      <label className="wide">Notiz<textarea value={w.notiz} onChange={(e) => set({ notiz: e.target.value })} placeholder="z. B. Winterreifen sind bei der Garage eingelagert" /></label>
      <p className="hint wide">0 Monate heisst: kommt nicht wieder. Beim Abhaken wird der nächste Termin automatisch eingetragen.</p>
      <div className="wide actions">
        <button className="btn">{vorhanden ? "Speichern" : "Termin eintragen"}</button>
        <button className="btn ghost" type="button" onClick={fertig}>Abbrechen</button>
      </div>
    </form>
  );
}

function Abschliessen({ t, fz, fertig, zeigen }: { t: FahrzeugTermin; fz: Fahrzeug; fertig: () => void; zeigen: (x: string) => void }) {
  const ich = useIch();
  const [tag, setTag] = useState(heute());
  const [kosten, setKosten] = useState("");
  const [stand, setStand] = useState(String(fz.kmStand || ""));
  const verwalten = darf(ich.rollen, "fahrzeuge", STUFE.verwalten);

  async function absenden(e: FormEvent) {
    e.preventDefault();
    const kmStand = ganz(stand);
    // Der nächste Termin richtet sich nach dem geplanten Datum (z. B. Reifenwechsel jeden Oktober und April).
    const naechster = naechsterTermin({ ...t, kmStand }, Math.max(kmStand, fz.kmStand));
    const ok = await speichern(zeigen, async () => {
      const b = writeBatch(db);
      b.update(doc(db, "fahrzeug_termine", t.id), { erledigt: true, erledigtAm: tag, kosten: zahl(kosten), kmStand });
      // Kilometer nur nachtragen, wenn sie steigen (die Leitung darf auch korrigieren).
      if (kmStand > fz.kmStand || (verwalten && kmStand && kmStand !== fz.kmStand)) b.update(doc(db, "fahrzeuge", fz.id), { kmStand });
      if (naechster) b.set(doc(collection(db, "fahrzeug_termine")), { ...naechster, erstellt: zeitstempel(), person: ich.name, uid: ich.uid });
      await b.commit();
    }, naechster ? `Erledigt. Nächster Termin: ${naechster.faelligKm && !naechster.wiederholungMonate ? km(naechster.faelligKm) : datum(naechster.datum)}` : "Erledigt");
    if (ok) fertig();
  }

  return (
    <form className="grid" onSubmit={absenden}>
      <label>Erledigt am<input type="date" value={tag} onChange={(e) => setTag(e.target.value)} required /></label>
      <label>Kosten CHF<input className="num" inputMode="decimal" value={kosten} onChange={(e) => setKosten(e.target.value)} placeholder="0.00" /></label>
      <label>Kilometerstand<input className="num" inputMode="numeric" value={stand} onChange={(e) => setStand(e.target.value)} /></label>
      <div className="wide actions"><button className="btn">Abhaken</button><button className="btn ghost" type="button" onClick={fertig}>Abbrechen</button></div>
    </form>
  );
}

function TerminZeile({ t, fz, zeigen }: { t: FahrzeugTermin; fz: Fahrzeug; zeigen: (x: string) => void }) {
  const ich = useIch();
  const [modus, setModus] = useState<"" | "bearbeiten" | "abschliessen">("");
  const verwalten = darf(ich.rollen, "fahrzeuge", STUFE.verwalten);
  const nurKm = t.faelligKm > 0 && !t.wiederholungMonate;
  return (
    <article className={`item${t.erledigt ? " done" : ""}`}>
      <div className="item-row">
        <strong>{t.art}{t.garage ? ` · ${t.garage}` : ""}</strong>
        {t.erledigt ? <span className="pill good">Erledigt {datum(t.erledigtAm)}</span> : t.blockiert ? <span className="pill warn">Fahrzeug in der Garage</span> : null}
      </div>
      <div className="meta">
        {nurKm && !t.erledigt ? <span>fällig bei {km(t.faelligKm)}</span> : <span>{wochentagKurz(t.datum)} {datum(t.datum)}{t.zeit ? `, ${t.zeit}` : ""}</span>}
        {t.erledigt && t.kosten > 0 && <span>CHF {chf(t.kosten)}</span>}
        {t.erledigt && t.kmStand > 0 && <span>{km(t.kmStand)}</span>}
        {(t.wiederholungMonate > 0 || t.wiederholungKm > 0) && (
          <span>wiederkehrend {[t.wiederholungMonate ? `alle ${t.wiederholungMonate} Monate` : "", t.wiederholungKm ? `alle ${km(t.wiederholungKm)}` : ""].filter(Boolean).join(" oder ")}</span>
        )}
      </div>
      {t.notiz && <p>{t.notiz}</p>}
      {modus === "bearbeiten" && <TerminFormular fz={fz} vorhanden={t} fertig={() => setModus("")} zeigen={zeigen} />}
      {modus === "abschliessen" && <Abschliessen t={t} fz={fz} fertig={() => setModus("")} zeigen={zeigen} />}
      {!modus && (
        <div className="actions">
          {!t.erledigt && <button type="button" className="btn small" onClick={() => setModus("abschliessen")}>Erledigt</button>}
          {!t.erledigt && <button type="button" className="btn ghost small" onClick={() => setModus("bearbeiten")}>Bearbeiten</button>}
          <LoeschKnopf disabled={!verwalten && t.uid !== ich.uid} onLoeschen={() => speichern(zeigen, () => deleteDoc(doc(db, "fahrzeug_termine", t.id)), "Gelöscht")} />
        </div>
      )}
    </article>
  );
}

function FahrzeugFormular({ vorhanden, fertig, zeigen }: { vorhanden?: Fahrzeug; fertig: () => void; zeigen: (t: string) => void }) {
  const [name, setName] = useState(vorhanden?.name ?? "");
  const [kennzeichen, setKennzeichen] = useState(vorhanden?.kennzeichen ?? "");
  const [stand, setStand] = useState(vorhanden ? String(vorhanden.kmStand) : "");
  const [aktiv, setAktiv] = useState(vorhanden?.aktiv ?? true);
  const [notiz, setNotiz] = useState(vorhanden?.notiz ?? "");

  async function absenden(e: FormEvent) {
    e.preventDefault();
    const felder = { name: name.trim(), kennzeichen: kennzeichen.trim().toUpperCase(), kmStand: ganz(stand), aktiv, notiz: notiz.trim() };
    const ref = vorhanden ? doc(db, "fahrzeuge", vorhanden.id) : doc(collection(db, "fahrzeuge"));
    if (await speichern(zeigen, () => setDoc(ref, felder), `${felder.name} gespeichert`)) fertig();
  }

  return (
    <form className="grid" onSubmit={absenden}>
      <label>Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. VW Caddy" required /></label>
      <label>Kennzeichen<input value={kennzeichen} onChange={(e) => setKennzeichen(e.target.value)} placeholder="SH 12345" /></label>
      <label>Kilometerstand<input className="num" inputMode="numeric" value={stand} onChange={(e) => setStand(e.target.value)} /></label>
      <label className="check"><input type="checkbox" checked={aktiv} onChange={(e) => setAktiv(e.target.checked)} /> in Betrieb</label>
      <label className="wide">Notiz<input value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="z. B. 2 Hundeboxen, Anhängerkupplung" /></label>
      <div className="wide actions"><button className="btn">Speichern</button><button className="btn ghost" type="button" onClick={fertig}>Abbrechen</button></div>
    </form>
  );
}

function KmErfassen({ fz, zeigen }: { fz: Fahrzeug; zeigen: (t: string) => void }) {
  const [stand, setStand] = useState("");
  async function absenden(e: FormEvent) {
    e.preventDefault();
    const kmStand = ganz(stand);
    if (kmStand < fz.kmStand) return zeigen(`Der Stand ist schon bei ${km(fz.kmStand)}`);
    if (await speichern(zeigen, () => updateDoc(doc(db, "fahrzeuge", fz.id), { kmStand }), "Kilometerstand gespeichert")) setStand("");
  }
  return (
    <form className="actions" onSubmit={absenden}>
      <input className="num" inputMode="numeric" aria-label={`Kilometerstand ${fz.name}`} value={stand} onChange={(e) => setStand(e.target.value)} placeholder="Neuer km-Stand" style={{ width: 160 }} required />
      <button className="btn ghost small">Kilometer speichern</button>
    </form>
  );
}

function FahrzeugKarte({ fz, zeigen, offen }: { fz: Fahrzeug; zeigen: (t: string) => void; offen: boolean }) {
  const ich = useIch();
  const d = useFahrdienst();
  const [modus, setModus] = useState<"" | "termin" | "fahrzeug">("");
  const verwalten = darf(ich.rollen, "fahrzeuge", STUFE.verwalten);
  const termine = d.termine.filter((t) => t.fahrzeugId === fz.id);
  const offene = termine.filter((t) => !t.erledigt).sort((a, b) => a.datum.localeCompare(b.datum));
  const erledigte = termine.filter((t) => t.erledigt).sort((a, b) => b.erledigtAm.localeCompare(a.erledigtAm));
  const jahr = heute().slice(0, 4);
  const kostenJahr = erledigte.filter((t) => t.erledigtAm.startsWith(jahr)).reduce((s, t) => s + t.kosten, 0);

  return (
    <section className={`panel${fz.aktiv ? "" : " inaktiv"}`} id={`fahrzeug-${fz.id}`} aria-labelledby={`h-${fz.id}`}>
      <div className="panel-head">
        <h2 id={`h-${fz.id}`}>{fz.name}</h2>
        <div className="meta">
          {fz.kennzeichen && <span className="pill acc">{fz.kennzeichen}</span>}
          <span>{km(fz.kmStand)}</span>
          {!fz.aktiv && <span className="pill">ausser Betrieb</span>}
        </div>
      </div>
      {fz.notiz && <p className="hint">{fz.notiz}</p>}
      {modus === "fahrzeug" && <FahrzeugFormular vorhanden={fz} fertig={() => setModus("")} zeigen={zeigen} />}
      {modus === "termin" && <TerminFormular fz={fz} fertig={() => setModus("")} zeigen={zeigen} />}
      {!modus && (
        <div className="actions">
          <button type="button" className="btn small" onClick={() => setModus("termin")}>Termin eintragen</button>
          {verwalten && <button type="button" className="btn ghost small" onClick={() => setModus("fahrzeug")}>Fahrzeug bearbeiten</button>}
        </div>
      )}
      <KmErfassen fz={fz} zeigen={zeigen} />
      <div className="list">
        <h3 className="lbl">Anstehende Termine</h3>
        {offene.length ? offene.map((t) => <TerminZeile key={t.id} t={t} fz={fz} zeigen={zeigen} />) : <div className="empty">Keine Termine eingetragen.</div>}
      </div>
      {erledigte.length > 0 && (
        <details open={offen}>
          <summary>Erledigt ({erledigte.length}) · Kosten {jahr}: CHF {chf(kostenJahr)}</summary>
          <div className="list" style={{ marginTop: 10 }}>{erledigte.slice(0, 20).map((t) => <TerminZeile key={t.id} t={t} fz={fz} zeigen={zeigen} />)}</div>
        </details>
      )}
    </section>
  );
}

export function Fahrzeuge() {
  const ich = useIch();
  const d = useFahrdienst();
  const [params] = useSearchParams();
  const [neu, setNeu] = useState(false);
  const { zeigen, element } = useToast();
  const verwalten = darf(ich.rollen, "fahrzeuge", STUFE.verwalten);
  const faellig = faelligeTermine(d.termine, d.fahrzeuge, heute());
  const ziel = params.get("fahrzeug");

  useEffect(() => {
    if (ziel && d.bereit) document.getElementById(`fahrzeug-${ziel}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [ziel, d.bereit]);

  return (
    <>
      {faellig.length > 0 && (
        <section className="panel" aria-labelledby="h-faellig">
          <h2 id="h-faellig">Bald fällig</h2>
          <div className="list">
            {faellig.map(({ termin: t, fahrzeug, ueberfaellig, grund }) => (
              <a key={t.id} href={`#fahrzeug-${t.fahrzeugId}`} className={`notice${ueberfaellig ? " bad" : ""}`}>
                {t.art} {fahrzeug?.name}: {grund || `${ueberfaellig ? "überfällig seit" : "am"} ${datum(t.datum)}`}
              </a>
            ))}
          </div>
        </section>
      )}
      {d.bereit && !d.fahrzeuge.length && (
        <section className="panel">
          <h2>Noch keine Fahrzeuge</h2>
          <p className="hint">{verwalten ? "Lege zuerst die Fahrzeuge des Fahrdienstes an." : "Die Leitung Pension legt die Fahrzeuge an."}</p>
        </section>
      )}
      {d.fahrzeuge.map((fz) => <FahrzeugKarte key={fz.id} fz={fz} zeigen={zeigen} offen={ziel === fz.id} />)}
      {verwalten && (
        <section className="panel" aria-labelledby="h-neu-fz">
          <h2 id="h-neu-fz">Fahrzeug hinzufügen</h2>
          {neu ? <FahrzeugFormular fertig={() => setNeu(false)} zeigen={zeigen} /> : (
            <div className="actions"><button type="button" className="btn ghost small" onClick={() => setNeu(true)}>Neues Fahrzeug</button></div>
          )}
        </section>
      )}
      {element}
    </>
  );
}
