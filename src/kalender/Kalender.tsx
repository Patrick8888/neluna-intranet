// Gemeinsamer Kalender: eigene Termine und alles aus Pension, Fahrdienst, Fahrzeugen und Sitzungen, nach Ebenen ein- und ausblendbar.
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { addDoc, collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useIch } from "../auth";
import { datum, heute, monatLabel, montagVon, plusTage, wochentagKurz, zeitstempel } from "../lib/format";
import { meldung } from "../lib/fehler";
import { EBENEN, EIGENE_EBENEN, kalenderEintraege, monatPlus, monatsRaster, type Ebene, type Eintrag, type Sitzung, type Termin } from "../lib/kalender";
import { darf, STUFE, type Modul } from "../lib/rollen";
import { FahrdienstProvider, useFahrdienst } from "../fahrdienst/daten";
import { PensionProvider, usePension } from "../pension/daten";
import { LoeschKnopf, speichern, useToast } from "../ui";

const WOCHENTAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const klasse = (e: Ebene) => `ebene-${e.toLowerCase()}`;

/** Welche Ebene wer sieht: die aus den Modulen nur mit Leserecht auf das Modul. */
const EBENE_MODUL: Partial<Record<Ebene, Modul>> = { Pension: "pension", Fahrdienst: "fahrdienst", Fahrzeuge: "fahrzeuge", Sitzungen: "sitzungen_team" };

function useListe<T>(sammlung: string, aktiv: boolean, abbilden: (id: string, d: Record<string, unknown>) => T): [T[], string] {
  const [liste, setListe] = useState<T[]>([]);
  const [fehler, setFehler] = useState("");
  useEffect(() => {
    if (!aktiv) return;
    return onSnapshot(
      query(collection(db, sammlung), orderBy("datum", "desc"), limit(1500)),
      (snap) => setListe(snap.docs.map((x) => abbilden(x.id, x.data()))),
      (err) => setFehler(meldung(err)),
    );
    // abbilden ist pro Sammlung fest.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sammlung, aktiv]);
  return [liste, fehler];
}

const alsTermin = (id: string, d: Record<string, unknown>) => ({ id, ...d }) as Termin;
const alsTeam = (id: string, d: Record<string, unknown>): Sitzung => ({ id, art: "Teamsitzung", datum: String(d.datum ?? ""), zeit: String(d.zeit ?? ""), ort: String(d.ort ?? "") });
const alsKader = (id: string, d: Record<string, unknown>): Sitzung => ({ ...alsTeam(id, d), art: "Kadersitzung" });

type Werte = Omit<Termin, "id" | "erstellt" | "person" | "uid">;

function Formular({ vorhanden, tag, fertig, zeigen }: { vorhanden?: Termin; tag: string; fertig: () => void; zeigen: (t: string) => void }) {
  const ich = useIch();
  const [w, setW] = useState<Werte>(() => ({
    titel: vorhanden?.titel ?? "", datum: vorhanden?.datum ?? tag, bis: vorhanden?.bis ?? tag, zeit: vorhanden?.zeit ?? "", zeitBis: vorhanden?.zeitBis ?? "",
    ebene: vorhanden?.ebene ?? "Firma", ort: vorhanden?.ort ?? "", beschreibung: vorhanden?.beschreibung ?? "",
  }));
  const set = (x: Partial<Werte>) => setW((alt) => ({ ...alt, ...x }));
  const darfAendern = !vorhanden || vorhanden.uid === ich.uid || darf(ich.rollen, "kalender", STUFE.verwalten) || ich.rollen.some((r) => r.startsWith("leitung_"));

  async function absenden(e: FormEvent) {
    e.preventDefault();
    const felder = { ...w, titel: w.titel.trim(), bis: w.bis < w.datum ? w.datum : w.bis, ort: w.ort.trim(), beschreibung: w.beschreibung.trim() };
    const ok = vorhanden
      ? await speichern(zeigen, () => updateDoc(doc(db, "termine", vorhanden.id), felder), "Termin gespeichert")
      : await speichern(zeigen, () => addDoc(collection(db, "termine"), { ...felder, erstellt: zeitstempel(), person: ich.name, uid: ich.uid }), "Termin eingetragen");
    if (ok) fertig();
  }

  return (
    <section className="panel" aria-labelledby="h-kt">
      <div className="panel-head">
        <h2 id="h-kt">{vorhanden ? "Termin bearbeiten" : "Neuer Termin"}</h2>
        {vorhanden?.person && <span className="hint">eingetragen von {vorhanden.person}</span>}
      </div>
      <form className="grid" onSubmit={absenden}>
        <label className="wide">Titel<input value={w.titel} onChange={(e) => set({ titel: e.target.value })} placeholder="z. B. Lieferung Royal Canin, Ferien Rahel, Tierarztbesuch" required disabled={!darfAendern} /></label>
        <label>Ebene<select value={w.ebene} onChange={(e) => set({ ebene: e.target.value as Ebene })} disabled={!darfAendern}>{EIGENE_EBENEN.map((x) => <option key={x}>{x}</option>)}</select></label>
        <label>Ort<input value={w.ort} onChange={(e) => set({ ort: e.target.value })} placeholder="z. B. Laden Stein am Rhein" disabled={!darfAendern} /></label>
        <label>Von<input type="date" value={w.datum} onChange={(e) => set({ datum: e.target.value, bis: w.bis < e.target.value ? e.target.value : w.bis })} required disabled={!darfAendern} /></label>
        <label>Bis<input type="date" value={w.bis} min={w.datum} onChange={(e) => set({ bis: e.target.value })} disabled={!darfAendern} /></label>
        <label>Beginn<input type="time" value={w.zeit} onChange={(e) => set({ zeit: e.target.value })} disabled={!darfAendern} /></label>
        <label>Ende<input type="time" value={w.zeitBis} onChange={(e) => set({ zeitBis: e.target.value })} disabled={!darfAendern} /></label>
        <label className="wide">Beschreibung<textarea value={w.beschreibung} onChange={(e) => set({ beschreibung: e.target.value })} disabled={!darfAendern} /></label>
        <p className="hint wide">Ohne Beginn gilt der Termin als ganztägig. Für Ferien oder Messen «Bis» auf den letzten Tag setzen.</p>
        <div className="wide actions">
          {darfAendern && <button className="btn">Speichern</button>}
          <button className="btn ghost" type="button" onClick={fertig}>{darfAendern ? "Abbrechen" : "Schliessen"}</button>
          {vorhanden && darfAendern && <LoeschKnopf onLoeschen={() => speichern(zeigen, () => deleteDoc(doc(db, "termine", vorhanden.id)), "Gelöscht").then((ok) => ok && fertig())} />}
        </div>
      </form>
    </section>
  );
}

function EintragZeile({ e, oeffnen }: { e: Eintrag; oeffnen: (t: Termin) => void }) {
  const inhalt = (
    <>
      <span className="k-zeit">{e.zeit || "ganzer Tag"}</span>
      <span className="k-text"><b>{e.titel}</b>{e.info && <span className="hint"> · {e.info}</span>}</span>
      <span className={`k-ebene ${klasse(e.ebene)}`}>{e.ebene}</span>
    </>
  );
  if (e.termin) return <button type="button" className="k-eintrag" onClick={() => oeffnen(e.termin!)}>{inhalt}</button>;
  if (e.link) return <Link className="k-eintrag" to={e.link}>{inhalt}</Link>;
  return <div className="k-eintrag">{inhalt}</div>;
}

function Ansicht() {
  const ich = useIch();
  const p = usePension();
  const f = useFahrdienst();
  const { zeigen, element } = useToast();
  const sichtbar = EBENEN.filter((e) => !EBENE_MODUL[e] || darf(ich.rollen, EBENE_MODUL[e]!));
  const [ebenen, setEbenen] = useState<Ebene[]>(sichtbar);
  const [modus, setModus] = useState<"monat" | "woche">("monat");
  const [tag, setTag] = useState(heute());
  const [form, setForm] = useState<{ termin?: Termin } | null>(null);
  const [termine, fehlerT] = useListe("termine", true, alsTermin);
  const [team] = useListe("sitzungen_team", darf(ich.rollen, "sitzungen_team"), alsTeam);
  const [kader] = useListe("sitzungen_kader", darf(ich.rollen, "sitzungen_kader"), alsKader);
  const bearbeiten = darf(ich.rollen, "kalender", STUFE.bearbeiten);

  const monat = tag.slice(0, 7);
  const raster = modus === "monat" ? monatsRaster(monat) : Array.from({ length: 7 }, (_, i) => plusTage(montagVon(tag), i));
  const alle = kalenderEintraege(
    { termine, buchungen: p.buchungen, fahrten: f.fahrten, fahrzeugTermine: f.termine, fahrzeuge: f.fahrzeuge, sitzungen: [...team, ...kader] },
    raster[0], raster[raster.length - 1],
  ).filter((e) => ebenen.includes(e.ebene));
  const amTag = (t: string) => alle.filter((e) => e.datum === t);
  const blaettern = (n: number) => setTag(modus === "monat" ? `${monatPlus(monat, n)}-01` : plusTage(tag, 7 * n));
  const umschalten = (e: Ebene) => setEbenen(ebenen.includes(e) ? ebenen.filter((x) => x !== e) : [...ebenen, e]);
  const oeffnen = (t?: Termin) => {
    setForm({ termin: t });
    requestAnimationFrame(() => document.getElementById("h-kt")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return (
    <>
      <section className="panel" aria-labelledby="h-kal">
        <div className="panel-head">
          <h2 id="h-kal">{modus === "monat" ? monatLabel(monat) : `Woche ${datum(raster[0]).slice(0, 6)}–${datum(raster[6])}`}</h2>
          <div className="actions">
            <button type="button" className="btn ghost small" onClick={() => blaettern(-1)} aria-label="Zurück">←</button>
            <button type="button" className="btn ghost small" onClick={() => setTag(heute())}>Heute</button>
            <button type="button" className="btn ghost small" onClick={() => blaettern(1)} aria-label="Vor">→</button>
            <button type="button" className="chip" aria-pressed={modus === "monat"} onClick={() => setModus("monat")}>Monat</button>
            <button type="button" className="chip" aria-pressed={modus === "woche"} onClick={() => setModus("woche")}>Woche</button>
          </div>
        </div>
        <div className="filters" aria-label="Ebenen">
          {sichtbar.map((e) => (
            <button key={e} type="button" className={`chip ${klasse(e)}`} aria-pressed={ebenen.includes(e)} onClick={() => umschalten(e)}>{e}</button>
          ))}
        </div>
        {(fehlerT || p.fehler || f.fehler) && <p className="notice bad">{fehlerT || p.fehler || f.fehler}</p>}
        {modus === "monat" ? (
          <div className="monat">
            {WOCHENTAGE.map((w) => <div key={w} className="monat-kopf">{w}</div>)}
            {raster.map((t) => {
              const e = amTag(t);
              return (
                <button
                  key={t}
                  type="button"
                  className={`monat-tag${t.slice(0, 7) !== monat ? " fremd" : ""}${t === heute() ? " heute" : ""}${t === tag ? " gewaehlt" : ""}`}
                  onClick={() => setTag(t)}
                  aria-label={`${datum(t)}, ${e.length} Einträge`}
                >
                  <span className="monat-nr">{Number(t.slice(8))}</span>
                  {e.slice(0, 3).map((x) => <span key={x.schluessel} className={`monat-eintrag ${klasse(x.ebene)}`}>{x.zeit && `${x.zeit.slice(0, 5)} `}{x.titel}</span>)}
                  {e.length > 3 && <span className="hint">+{e.length - 3}</span>}
                </button>
              );
            })}
          </div>
        ) : (
          <div className="list">
            {raster.map((t) => (
              <div key={t} className={`woche-tag${t === heute() ? " heute" : ""}`}>
                <button type="button" className="lbl woche-titel" onClick={() => setTag(t)}>{wochentagKurz(t)} {datum(t)}</button>
                {amTag(t).length ? amTag(t).map((e) => <EintragZeile key={e.schluessel} e={e} oeffnen={oeffnen} />) : <span className="hint">–</span>}
              </div>
            ))}
          </div>
        )}
      </section>

      {modus === "monat" && (
        <section className="panel" aria-labelledby="h-tag">
          <div className="panel-head">
            <h2 id="h-tag">{wochentagKurz(tag)} {datum(tag)}</h2>
            {bearbeiten && <button type="button" className="btn small" onClick={() => oeffnen()}>Neuer Termin</button>}
          </div>
          <div className="list">
            {amTag(tag).length ? amTag(tag).map((e) => <EintragZeile key={e.schluessel} e={e} oeffnen={oeffnen} />) : <div className="empty">Keine Einträge an diesem Tag.</div>}
          </div>
        </section>
      )}
      {modus === "woche" && bearbeiten && (
        <div className="actions"><button type="button" className="btn small" onClick={() => oeffnen()}>Neuer Termin am {datum(tag)}</button></div>
      )}
      {form && <Formular key={form.termin?.id ?? `neu-${tag}`} vorhanden={form.termin} tag={tag} fertig={() => setForm(null)} zeigen={zeigen} />}
      {element}
    </>
  );
}

export function Kalender() {
  const ich = useIch();
  return (
    <PensionProvider mitTeam={false} mitKasse={false}>
      <FahrdienstProvider mitFahrzeugen={darf(ich.rollen, "fahrzeuge")}>
        <Ansicht />
      </FahrdienstProvider>
    </PensionProvider>
  );
}
