// Fahrdienstplan: Fahrten aus Buchungen einplanen, von Hand erfassen, Fahrer/in und Fahrzeug zuteilen.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router";
import { collection, deleteDoc, doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useIch } from "../auth";
import { datum, heute, plusTage, wochentagKurz, zeitstempel } from "../lib/format";
import {
  FAHRT_STATUS, fahrtenAusBuchungen, fahrtPruefen, fahrzeugBlockiert, RICHTUNGEN, type Fahrt, type FahrtStatus, type Richtung, type Vorschlag,
} from "../lib/fahrdienst";
import { darf, STUFE } from "../lib/rollen";
import { LoeschKnopf, speichern, useAngezeigt, useTeam, useToast } from "../ui";
import { usePension } from "../pension/daten";
import { volleAdresse } from "../lib/pension";
import { FahrtKarte, fahrtFarbe } from "./FahrtKarte";
import { useFahrdienst } from "./daten";

type Werte = Omit<Fahrt, "id" | "erstellt" | "person" | "uid">;

const LEER: Werte = {
  datum: heute(), zeit: "", richtung: "Hinweg", buchungId: "", kundeName: "", telefon: "", adresse: "", hunde: [],
  fahrerUid: "", fahrerName: "", fahrzeugId: "", fahrzeugName: "", status: "Geplant", notiz: "",
};

function Formular({ vorhanden, vorschlag, fertig, zeigen }: { vorhanden?: Fahrt; vorschlag?: Vorschlag; fertig: () => void; zeigen: (t: string) => void }) {
  const ich = useIch();
  const angezeigt = useAngezeigt();
  const d = useFahrdienst();
  const p = usePension();
  const team = useTeam();
  const verwalten = darf(ich.rollen, "fahrdienst", STUFE.verwalten);
  const [w, setW] = useState<Werte>(() => {
    if (vorhanden) {
      const { id: _id, erstellt: _e, person: _p, uid: _u, ...rest } = vorhanden;
      return { ...LEER, ...rest };
    }
    if (vorschlag) {
      const { id: _id, ...rest } = vorschlag;
      return { ...LEER, ...rest };
    }
    return LEER;
  });
  const [id] = useState(() => vorhanden?.id ?? vorschlag?.id ?? doc(collection(db, "fahrten")).id);
  const set = (x: Partial<Werte>) => setW((alt) => ({ ...alt, ...x }));
  const ausBuchung = !!w.buchungId;
  const kundeId = p.kunden.find((k) => k.name === w.kundeName)?.id ?? "";
  const fahrer = [...team].sort((a, b) => Number(b.rollen.includes("fahrdienst")) - Number(a.rollen.includes("fahrdienst")));
  const fehler = fahrtPruefen(w, d.fahrzeuge, d.termine);

  function kundeWaehlen(kid: string) {
    const k = p.kunden.find((x) => x.id === kid);
    if (!k) return set({ kundeName: "", telefon: "", adresse: "", hunde: [] });
    set({ kundeName: k.name, telefon: k.telefon, adresse: volleAdresse(k), hunde: p.hunde.filter((h) => h.kundeId === k.id).map((h) => ({ id: h.id, name: h.name })) });
  }

  async function absenden(e: FormEvent) {
    e.preventDefault();
    if (fehler) return zeigen(fehler);
    const felder = {
      ...w,
      zeit: w.zeit.slice(0, 5),
      adresse: w.adresse.trim(),
      notiz: w.notiz.trim(),
      fahrerName: team.find((t) => t.uid === w.fahrerUid)?.name ?? "",
      fahrzeugName: d.fahrzeuge.find((f) => f.id === w.fahrzeugId)?.name ?? "",
      geaendertVon: ich.uid,
    };
    const ok = vorhanden
      ? await speichern(zeigen, () => updateDoc(doc(db, "fahrten", vorhanden.id), felder), "Fahrt gespeichert")
      : await speichern(zeigen, () => setDoc(doc(db, "fahrten", id), { ...felder, erstellt: zeitstempel(), person: ich.name, uid: ich.uid }), "Fahrt eingeplant");
    if (ok && angezeigt.current) fertig();
  }

  return (
    <section className="panel" aria-labelledby="h-ff" id="fahrt">
      <div className="panel-head">
        <h2 id="h-ff">{vorhanden ? "Fahrt bearbeiten" : vorschlag ? "Fahrt aus Buchung einplanen" : "Neue Fahrt"}</h2>
        {vorhanden && <span className={`pill ${fahrtFarbe[vorhanden.status]}`}>{vorhanden.status}</span>}
      </div>
      <form className="grid" onSubmit={absenden}>
        {ausBuchung ? (
          <p className="hint wide">Aus der Buchung von {w.kundeName}: {w.hunde.map((h) => h.name).join(", ")}</p>
        ) : (
          <label className="wide">
            Kundin / Kunde aus der Kartei
            <select value={kundeId} onChange={(e) => kundeWaehlen(e.target.value)}>
              <option value="">– frei erfassen –</option>
              {p.kunden.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
            </select>
          </label>
        )}
        <label>Datum<input type="date" value={w.datum} onChange={(e) => set({ datum: e.target.value })} required /></label>
        <label>Zeit<input type="time" value={w.zeit} onChange={(e) => set({ zeit: e.target.value })} /></label>
        <label>Richtung<select value={w.richtung} onChange={(e) => set({ richtung: e.target.value as Richtung })} disabled={ausBuchung}>{RICHTUNGEN.map((r) => <option key={r}>{r}</option>)}</select></label>
        <label>Status<select value={w.status} onChange={(e) => set({ status: e.target.value as FahrtStatus })}>{FAHRT_STATUS.map((s) => <option key={s}>{s}</option>)}</select></label>
        {!ausBuchung && <label>Name<input value={w.kundeName} onChange={(e) => set({ kundeName: e.target.value })} required /></label>}
        <label>Telefon<input type="tel" value={w.telefon} onChange={(e) => set({ telefon: e.target.value })} /></label>
        <label className="wide">Adresse<input value={w.adresse} onChange={(e) => set({ adresse: e.target.value })} placeholder="Strasse, PLZ Ort" required /></label>
        <label>
          Fahrer/in
          <select value={w.fahrerUid} onChange={(e) => set({ fahrerUid: e.target.value })}>
            <option value="">– noch offen –</option>
            {fahrer.map((t) => <option key={t.uid} value={t.uid}>{t.name}{t.rollen.includes("fahrdienst") ? "" : " (Aushilfe)"}</option>)}
          </select>
        </label>
        <label>
          Fahrzeug
          <select value={w.fahrzeugId} onChange={(e) => set({ fahrzeugId: e.target.value })}>
            <option value="">– noch offen –</option>
            {d.fahrzeuge.filter((f) => f.aktiv || f.id === w.fahrzeugId).map((f) => (
              <option key={f.id} value={f.id}>{f.name}{fahrzeugBlockiert(d.termine, f.id, w.datum) ? " · nicht verfügbar" : ""}</option>
            ))}
          </select>
        </label>
        <label className="wide">Notiz<textarea value={w.notiz} onChange={(e) => set({ notiz: e.target.value })} placeholder="z. B. Schlüssel beim Nachbarn, Hund an der Leine übergeben" /></label>
        {fehler && <p className="notice bad wide" role="alert">{fehler}</p>}
        <div className="wide actions">
          <button className="btn" disabled={!!fehler}>{vorhanden ? "Speichern" : "Einplanen"}</button>
          <button className="btn ghost" type="button" onClick={fertig}>Abbrechen</button>
          {vorhanden && (
            <LoeschKnopf
              disabled={!verwalten && vorhanden.uid !== ich.uid}
              onLoeschen={() => speichern(zeigen, () => deleteDoc(doc(db, "fahrten", vorhanden.id)), "Gelöscht").then((ok) => ok && angezeigt.current && fertig())}
            />
          )}
        </div>
      </form>
    </section>
  );
}

export function FahrdienstPlan() {
  const ich = useIch();
  const d = useFahrdienst();
  const p = usePension();
  const [params, setParams] = useSearchParams();
  const [start, setStart] = useState(heute());
  const { zeigen, element } = useToast();
  const formular = useRef<HTMLDivElement>(null);
  const bearbeiten = darf(ich.rollen, "fahrdienst", STUFE.bearbeiten);
  const tag = heute();
  const { fehlend, abweichend } = fahrtenAusBuchungen(p.buchungen, d.fahrten, p.kunden, tag);
  const offen = params.get("fahrt");
  const neu = params.get("neu");
  const vorhanden = offen ? d.fahrten.find((f) => f.id === offen) : undefined;
  const vorschlag = neu ? fehlend.find((f) => f.id === neu) : undefined;
  const ende = plusTage(start, 13);
  const tage = Array.from({ length: 14 }, (_, i) => plusTage(start, i));
  const imZeitraum = d.fahrten.filter((f) => f.datum >= start && f.datum <= ende);

  useEffect(() => {
    if (offen || neu) formular.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [offen, neu]);

  const schliessen = () => setParams({});
  const aendern = (f: Fahrt, felder: Partial<Fahrt>, ok: string) =>
    speichern(zeigen, () => updateDoc(doc(db, "fahrten", f.id), { ...felder, geaendertVon: ich.uid }), ok);

  return (
    <>
      <div ref={formular}>
        {bearbeiten && (vorhanden || vorschlag || neu === "manuell") && (
          <Formular key={offen ?? neu} vorhanden={vorhanden} vorschlag={vorschlag} fertig={schliessen} zeigen={zeigen} />
        )}
      </div>

      {bearbeiten && abweichend.length > 0 && (
        <section className="panel" aria-labelledby="h-abw">
          <h2 id="h-abw">Bitte prüfen</h2>
          <div className="list">
            {abweichend.map(({ fahrt: f, grund, datum: neuesDatum }) => (
              <div key={f.id} className="notice item-row">
                <span>{f.richtung} {f.hunde.map((h) => h.name).join(", ")} am {datum(f.datum)}: {grund}{neuesDatum ? ` ${datum(neuesDatum)}` : ""}.</span>
                <span className="actions">
                  {neuesDatum
                    ? <button type="button" className="btn small" onClick={() => aendern(f, { datum: neuesDatum }, "Datum übernommen")}>Datum übernehmen</button>
                    : <button type="button" className="btn small" onClick={() => aendern(f, { status: "Abgesagt" }, "Fahrt abgesagt")}>Fahrt absagen</button>}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {bearbeiten && (
        <section className="panel" aria-labelledby="h-vor">
          <div className="panel-head">
            <h2 id="h-vor">Aus Buchungen einplanen</h2>
            <button type="button" className="btn ghost small" onClick={() => setParams({ neu: "manuell" })}>Fahrt von Hand erfassen</button>
          </div>
          <div className="list">
            {fehlend.length ? fehlend.map((v) => (
              <div key={v.id} className="item">
                <div className="item-row">
                  <strong>{wochentagKurz(v.datum)} {datum(v.datum)} · {v.richtung}: {v.hunde.map((h) => h.name).join(", ")}</strong>
                  <button type="button" className="btn small" onClick={() => setParams({ neu: v.id })}>Einplanen</button>
                </div>
                <div className="meta"><span>{v.kundeName}</span><span>{v.adresse || "Adresse fehlt in der Kartei"}</span></div>
              </div>
            )) : <div className="empty">Alle gebuchten Fahrten sind eingeplant.</div>}
          </div>
          <p className="hint">Hier erscheinen Buchungen mit «Fahrdienst Hinweg» oder «Fahrdienst Rückweg», sobald sie bestätigt sind.</p>
        </section>
      )}

      <section className="panel" aria-labelledby="h-plan">
        <div className="panel-head">
          <h2 id="h-plan">Fahrten {datum(start).slice(0, 6)}–{datum(ende)}</h2>
          <div className="actions">
            <button type="button" className="btn ghost small" onClick={() => setStart(plusTage(start, -7))} aria-label="Eine Woche zurück">←</button>
            <button type="button" className="btn ghost small" onClick={() => setStart(heute())}>Heute</button>
            <button type="button" className="btn ghost small" onClick={() => setStart(plusTage(start, 7))} aria-label="Eine Woche vor">→</button>
          </div>
        </div>
        {imZeitraum.length ? tage.map((t) => {
          const fahrten = imZeitraum.filter((f) => f.datum === t).sort((a, b) => (a.zeit || "99").localeCompare(b.zeit || "99"));
          if (!fahrten.length) return null;
          return (
            <div key={t} className="list">
              <h3 className="lbl">{wochentagKurz(t)} {datum(t)}{t === tag ? " · heute" : ""}</h3>
              {fahrten.map((f) => <FahrtKarte key={f.id} f={f} zeigen={zeigen} />)}
            </div>
          );
        }) : <div className="empty">In diesen zwei Wochen sind keine Fahrten geplant.</div>}
      </section>
      {element}
    </>
  );
}
