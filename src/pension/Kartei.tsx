// Kunden- und Hundekartei: Kontakt, Notfall, Tierarzt; pro Hund Futter, Medikamente, Verhalten und Impfungen.
import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { addDoc, collection, deleteDoc, doc, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { useIch } from "../auth";
import { datum, heute, zeitstempel } from "../lib/format";
import {
  aufenthaltVon, GESCHLECHTER, GEWICHTSKLASSEN, IMPF_ARTEN, impfWarnungen, istDa, klasseAusGewicht, klassenName, TEAMHUNDE, type Gewichtsklasse, type Hund, type Impfung, type Kunde,
} from "../lib/pension";
import { darf, STUFE } from "../lib/rollen";
import { LoeschKnopf, speichern, useAngezeigt, useToast } from "../ui";
import { statusFarbe } from "./BuchungKarte";
import { usePension } from "./daten";

const KUNDE_FELDER = [
  ["name", "Name", "Vorname Nachname"],
  ["telefon", "Telefon", "079 123 45 67"],
  ["telefon2", "Telefon 2", "z. B. Partner/in, Geschäft"],
  ["email", "E-Mail", ""],
  ["adresse", "Adresse", "Strasse, PLZ Ort"],
  ["notfallkontakt", "Notfallkontakt", "Name und Telefon"],
  ["tierarzt", "Tierarzt", "Praxis und Telefon"],
  ["versicherung", "Haftpflicht / Tierversicherung", "Gesellschaft und Police"],
] as const;
type KundeFeld = (typeof KUNDE_FELDER)[number][0] | "notiz";

function KundeFormular({ vorhanden, neuAngelegt, darfBearbeiten, zeigen }: { vorhanden?: Kunde; neuAngelegt: (id: string) => void; darfBearbeiten: boolean; zeigen: (t: string) => void }) {
  const ich = useIch();
  const verwalten = darf(ich.rollen, "pension", STUFE.verwalten);
  const [w, setW] = useState<Record<KundeFeld, string>>(() => ({
    name: vorhanden?.name ?? "", telefon: vorhanden?.telefon ?? "", telefon2: vorhanden?.telefon2 ?? "", email: vorhanden?.email ?? "", adresse: vorhanden?.adresse ?? "",
    notfallkontakt: vorhanden?.notfallkontakt ?? "", tierarzt: vorhanden?.tierarzt ?? "", versicherung: vorhanden?.versicherung ?? "", notiz: vorhanden?.notiz ?? "",
  }));
  const [team, setTeam] = useState(vorhanden?.team ?? false);
  const angezeigt = useAngezeigt();
  const [, setParams] = useSearchParams();

  async function absenden(e: FormEvent) {
    e.preventDefault();
    const felder = { ...(Object.fromEntries(Object.entries(w).map(([k, v]) => [k, v.trim()])) as Record<KundeFeld, string>), team };
    if (!felder.name) return zeigen("Bitte einen Namen eingeben");
    if (vorhanden) {
      await speichern(zeigen, () => updateDoc(doc(db, "pension_kunden", vorhanden.id), felder), "Gespeichert");
    } else {
      let id = "";
      const ok = await speichern(zeigen, async () => {
        id = (await addDoc(collection(db, "pension_kunden"), { ...felder, erstellt: zeitstempel(), person: ich.name, uid: ich.uid })).id;
      }, "Kundin / Kunde angelegt");
      if (ok && angezeigt.current) neuAngelegt(id);
    }
  }

  return (
    <form className="grid" onSubmit={absenden}>
      <fieldset className="wide grid" disabled={!darfBearbeiten}>
        {KUNDE_FELDER.map(([k, titel, platzhalter]) => (
          <label key={k}>{titel}<input value={w[k]} onChange={(e) => setW({ ...w, [k]: e.target.value })} placeholder={platzhalter} required={k === "name"} type={k === "email" ? "email" : "text"} /></label>
        ))}
        <label className="wide">Notiz<textarea value={w.notiz} onChange={(e) => setW({ ...w, notiz: e.target.value })} placeholder="z. B. Schlüssel für Abholung beim Nachbarn" /></label>
        <label className="check wide"><input type="checkbox" checked={team} onChange={(e) => setTeam(e.target.checked)} /> Hunde vom Team (erscheinen nicht in der Abrechnung)</label>
      </fieldset>
      {darfBearbeiten && (
        <div className="wide actions">
          <button className="btn">{vorhanden ? "Kontakt speichern" : "Anlegen"}</button>
          {vorhanden && <LoeschKnopf disabled={!verwalten} onLoeschen={() => speichern(zeigen, () => deleteDoc(doc(db, "pension_kunden", vorhanden.id)), "Gelöscht").then((ok) => ok && angezeigt.current && setParams({}))} />}
        </div>
      )}
    </form>
  );
}

type HundWerte = Omit<Hund, "id" | "kundeId" | "erstellt" | "person" | "uid">;

const leererHund: HundWerte = {
  name: "", rasse: "", geburtsdatum: "", geschlecht: "", kastriert: false, futter: "", menge: "", medikamente: "", allergien: "",
  verhalten: "", vertraeglich: true, notiz: "", impfungen: [],
  gewicht: "", gewichtsklasse: "", chipnummer: "", farbe: "", fuetterungszeiten: "", leckerli: "", schlafplatz: "", kommandos: "",
  aengste: "", spielverhalten: "", freilauf: "", laeufigkeit: "",
};

function HundFormular({ kundeId, vorhanden, fertig, darfBearbeiten, zeigen }: { kundeId: string; vorhanden?: Hund; fertig?: () => void; darfBearbeiten: boolean; zeigen: (t: string) => void }) {
  const ich = useIch();
  const verwalten = darf(ich.rollen, "pension", STUFE.verwalten);
  const [w, setW] = useState<HundWerte>(() => (vorhanden ? { ...leererHund, ...vorhanden } : leererHund));
  const set = (x: Partial<HundWerte>) => setW((alt) => ({ ...alt, ...x }));
  const text = (k: keyof HundWerte, titel: string, platzhalter = "", breit = false) => (
    <label className={breit ? "wide" : undefined}>
      {titel}
      {breit
        ? <textarea value={String(w[k] ?? "")} onChange={(e) => set({ [k]: e.target.value })} placeholder={platzhalter} />
        : <input value={String(w[k] ?? "")} onChange={(e) => set({ [k]: e.target.value })} placeholder={platzhalter} />}
    </label>
  );
  const impfung = (i: number, x: Partial<Impfung>) => set({ impfungen: w.impfungen.map((alt, j) => (j === i ? { ...alt, ...x } : alt)) });

  async function absenden(e: FormEvent) {
    e.preventDefault();
    if (!w.name.trim()) return zeigen("Bitte einen Namen eingeben");
    const felder = {
      ...Object.fromEntries(Object.entries(w).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v])),
      kundeId,
      impfungen: w.impfungen.filter((i) => i.art.trim()).map((i) => ({ art: i.art.trim(), gueltigBis: i.gueltigBis })),
    } as HundWerte & { kundeId: string };
    const ok = vorhanden
      ? await speichern(zeigen, () => updateDoc(doc(db, "pension_hunde", vorhanden.id), felder), `${w.name} gespeichert`)
      : await speichern(zeigen, () => addDoc(collection(db, "pension_hunde"), { ...felder, erstellt: zeitstempel(), person: ich.name, uid: ich.uid }), `${w.name} erfasst`);
    if (ok && fertig) fertig();
  }

  return (
    <form className="grid" onSubmit={absenden}>
      <fieldset className="wide grid" disabled={!darfBearbeiten}>
        <label>Name<input value={w.name} onChange={(e) => set({ name: e.target.value })} required /></label>
        {text("rasse", "Rasse")}
        <label>Geburtsdatum<input type="date" value={w.geburtsdatum} max={heute()} onChange={(e) => set({ geburtsdatum: e.target.value })} /></label>
        <label>Geschlecht<select value={w.geschlecht} onChange={(e) => set({ geschlecht: e.target.value })}><option value="">–</option>{GESCHLECHTER.map((g) => <option key={g}>{g}</option>)}</select></label>
        {text("farbe", "Farbe / Aussehen")}
        {text("chipnummer", "Chipnummer")}
        <label>Gewicht kg<input inputMode="decimal" value={w.gewicht ?? ""} onChange={(e) => set({ gewicht: e.target.value, gewichtsklasse: klasseAusGewicht(e.target.value) || w.gewichtsklasse })} placeholder="z. B. 28" /></label>
        <fieldset>
          <legend>Grösse fürs Zimmer</legend>
          <div className="filters">
            {GEWICHTSKLASSEN.map(([k, name]) => (
              <button key={k} type="button" className="chip" aria-pressed={w.gewichtsklasse === k} onClick={() => set({ gewichtsklasse: w.gewichtsklasse === k ? "" : (k as Gewichtsklasse) })}>{name}</button>
            ))}
          </div>
        </fieldset>
        <label className="check"><input type="checkbox" checked={w.kastriert} onChange={(e) => set({ kastriert: e.target.checked })} /> Kastriert</label>
        <label className="check"><input type="checkbox" checked={w.vertraeglich} onChange={(e) => set({ vertraeglich: e.target.checked })} /> Verträglich mit anderen Hunden</label>
        {w.geschlecht === "Hündin" && text("laeufigkeit", "Letzte Läufigkeit", "z. B. August 2026")}
        <h3 className="lbl wide">Füttern</h3>
        {text("futter", "Futter", "Marke und Sorte")}
        {text("menge", "Menge", "z. B. 2 × 150 g, morgens und abends")}
        {text("fuetterungszeiten", "Fütterungszeiten", "z. B. 7 Uhr und 18 Uhr")}
        {text("leckerli", "Leckerli / Kauartikel", "erlaubt, nicht erlaubt, eigene")}
        {text("allergien", "Allergien / Unverträglichkeiten")}
        {text("medikamente", "Medikamente", "Name, Dosis, wann", true)}
        <h3 className="lbl wide">Verhalten und Gewohnheiten</h3>
        {text("freilauf", "Freilauf", "z. B. nur an der Leine, kommt auf Pfiff")}
        {text("schlafplatz", "Schlafplatz", "z. B. eigenes Körbchen, mag es warm")}
        {text("kommandos", "Kommandos", "z. B. Sitz, Platz, Bleib, Hier")}
        {text("aengste", "Ängste", "z. B. Gewitter, Feuerwerk, Männer mit Hut")}
        {text("spielverhalten", "Spielverhalten", "z. B. liebt Bälle, grob mit kleinen Hunden", true)}
        {text("verhalten", "Verhalten", "z. B. zieht an der Leine, bellt bei Besuch", true)}
        {text("notiz", "Besonderes", "", true)}
        <div className="wide">
          <div className="lbl">Impfungen</div>
          <div className="prows">
            {w.impfungen.map((i, n) => (
              <div key={n} className="impf-zeile">
                <input aria-label="Impfung" list="impfarten" value={i.art} onChange={(e) => impfung(n, { art: e.target.value })} placeholder="Impfung" />
                <input aria-label="Gültig bis" type="date" value={i.gueltigBis} onChange={(e) => impfung(n, { gueltigBis: e.target.value })} />
                {darfBearbeiten && <button type="button" className="btn danger small" onClick={() => set({ impfungen: w.impfungen.filter((_, j) => j !== n) })}>Entfernen</button>}
              </div>
            ))}
            {darfBearbeiten && <div><button type="button" className="btn ghost small" onClick={() => set({ impfungen: [...w.impfungen, { art: "", gueltigBis: "" }] })}>Impfung hinzufügen</button></div>}
          </div>
          <datalist id="impfarten">{IMPF_ARTEN.map((a) => <option key={a} value={a} />)}</datalist>
        </div>
      </fieldset>
      {darfBearbeiten && (
        <div className="wide actions">
          <button className="btn">{vorhanden ? "Hund speichern" : "Hund erfassen"}</button>
          {fertig && <button className="btn ghost" type="button" onClick={fertig}>Abbrechen</button>}
          {vorhanden && <LoeschKnopf disabled={!verwalten} onLoeschen={() => speichern(zeigen, () => deleteDoc(doc(db, "pension_hunde", vorhanden.id)), "Gelöscht")} />}
        </div>
      )}
    </form>
  );
}

function KundeDetail({ kundeId, darfBearbeiten }: { kundeId: string; darfBearbeiten: boolean }) {
  const d = usePension();
  const [params, setParams] = useSearchParams();
  const [neuerHund, setNeuerHund] = useState(params.get("hund") === "neu");
  // Die Meldung lebt hier, weil die Formulare nach dem Speichern verschwinden oder neu aufgebaut werden.
  const { zeigen, element } = useToast();
  const kunde = kundeId === "neu" ? undefined : d.kunden.find((k) => k.id === kundeId);
  const hunde = d.hunde.filter((h) => h.kundeId === kundeId);
  const buchungen = d.buchungen.filter((b) => b.kundeId === kundeId).sort((a, b) => b.von.localeCompare(a.von));

  if (kundeId !== "neu" && !kunde) return d.bereit ? <section className="panel"><p className="hint">Diesen Eintrag gibt es nicht mehr.</p></section> : null;

  return (
    <section className="panel" aria-labelledby="h-kd">
      <div className="panel-head">
        <h2 id="h-kd">{kunde ? kunde.name : "Neue Kundin / neuer Kunde"}{kunde?.team && <span className="pill acc" style={{ marginLeft: 8 }}>Team</span>}</h2>
        <div className="actions">
          {kunde && <Link className="btn ghost small" to={`/pension/stammblatt/${kunde.id}`}>Stammblatt</Link>}
          <button type="button" className="btn ghost small" onClick={() => setParams({})}>Schliessen</button>
        </div>
      </div>
      <KundeFormular key={kundeId} vorhanden={kunde} darfBearbeiten={darfBearbeiten} zeigen={zeigen} neuAngelegt={(id) => setParams({ kunde: id, hund: "neu" })} />
      {kunde && (
        <>
          <h2>Hunde</h2>
          <div className="list">
            {hunde.map((h) => (
              <details key={h.id} className="item">
                <summary>
                  {h.name}
                  {h.rasse && ` · ${h.rasse}`}
                  {h.gewichtsklasse && ` · ${klassenName(h.gewichtsklasse)}`}
                  {!h.vertraeglich && <span className="pill bad" style={{ marginLeft: 8 }}>nicht verträglich</span>}
                  {impfWarnungen(h, heute(), heute()).length > 0 && <span className="pill warn" style={{ marginLeft: 8 }}>Impfung prüfen</span>}
                </summary>
                <div className="actions"><Link className="btn ghost small" to={`/pension/hund/${h.id}`}>Stammblatt {h.name}</Link></div>
                <HundFormular kundeId={kunde.id} vorhanden={h} darfBearbeiten={darfBearbeiten} zeigen={zeigen} />
              </details>
            ))}
            {neuerHund ? (
              <div className="item"><HundFormular kundeId={kunde.id} darfBearbeiten={darfBearbeiten} fertig={() => setNeuerHund(false)} zeigen={zeigen} /></div>
            ) : darfBearbeiten && (
              <div><button type="button" className="btn ghost small" onClick={() => setNeuerHund(true)}>Hund hinzufügen</button></div>
            )}
          </div>
          {buchungen.length > 0 && (
            <>
              <h2>Aufenthalte</h2>
              <div className="list">
                {buchungen.slice(0, 10).map((b) => (
                  <div key={b.id} className="meta">
                    <span>{datum(b.von)}–{datum(b.bis)}</span>
                    <span>{b.hunde.map((h) => h.name).join(", ")}</span>
                    <span className={`pill ${statusFarbe[b.status]}`}>{b.status}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
      {element}
    </section>
  );
}

/** Legt die Teamhunde an, die noch fehlen (einmalig, von der Leitung). */
function TeamhundeAnlegen({ zeigen }: { zeigen: (t: string) => void }) {
  const ich = useIch();
  const d = usePension();
  const fehlend = TEAMHUNDE.flatMap((t) => {
    const k = d.kunden.find((x) => x.name === t.kunde);
    const hunde = t.hunde.filter((n) => !k || !d.hunde.some((h) => h.kundeId === k.id && h.name === n));
    return hunde.length ? [{ ...t, kundeId: k?.id, hunde }] : [];
  });
  if (!d.bereit || !fehlend.length) return null;

  function anlegen() {
    return speichern(zeigen, async () => {
      const b = writeBatch(db);
      const wer = { erstellt: zeitstempel(), person: ich.name, uid: ich.uid };
      for (const t of fehlend) {
        const kRef = t.kundeId ? doc(db, "pension_kunden", t.kundeId) : doc(collection(db, "pension_kunden"));
        if (!t.kundeId) {
          b.set(kRef, { name: t.kunde, telefon: "", telefon2: "", email: "", adresse: "", notfallkontakt: "", tierarzt: "", versicherung: "", notiz: "", team: true, ...wer });
        }
        for (const name of t.hunde) b.set(doc(collection(db, "pension_hunde")), { ...leererHund, name, kundeId: kRef.id, ...wer });
      }
      await b.commit();
    }, "Teamhunde angelegt");
  }

  return (
    <p className="notice">
      Teamhunde noch nicht in der Kartei: {fehlend.flatMap((t) => t.hunde).join(", ")}.{" "}
      <button type="button" className="btn small" onClick={anlegen}>Jetzt anlegen</button>
    </p>
  );
}

export function Kartei() {
  const ich = useIch();
  const d = usePension();
  const [params, setParams] = useSearchParams();
  const [suche, setSuche] = useState("");
  const darfBearbeiten = darf(ich.rollen, "pension", STUFE.bearbeiten);
  const verwalten = darf(ich.rollen, "pension", STUFE.verwalten);
  const { zeigen, element } = useToast();
  const offen = params.get("kunde");
  const [ansicht, setAnsicht] = useState<"hunde" | "kunden">("hunde");
  const s = suche.trim().toLowerCase();
  const hundTreffer = d.hunde
    .map((h) => ({ h, k: d.kunden.find((k) => k.id === h.kundeId) }))
    .filter(({ h, k }) => !s || `${h.name} ${h.rasse} ${h.chipnummer ?? ""} ${k?.name ?? ""} ${k?.telefon ?? ""}`.toLowerCase().includes(s))
    .sort((a, b) => a.h.name.localeCompare(b.h.name, "de"));
  const treffer = d.kunden.filter((k) => {
    if (!s) return true;
    const hunde = d.hunde.filter((h) => h.kundeId === k.id).map((h) => h.name).join(" ");
    return `${k.name} ${k.telefon} ${hunde}`.toLowerCase().includes(s);
  });

  return (
    <>
      {verwalten && <TeamhundeAnlegen zeigen={zeigen} />}
      {offen && <KundeDetail key={offen} kundeId={offen} darfBearbeiten={darfBearbeiten} />}
      <section className="panel" aria-labelledby="h-ka">
        <div className="panel-head">
          <h2 id="h-ka">Kartei</h2>
          {darfBearbeiten && <button type="button" className="btn small" onClick={() => { setParams({ kunde: "neu" }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Neue Kundin / neuer Kunde</button>}
        </div>
        <div className="filters">
          <button type="button" className="chip" aria-pressed={ansicht === "hunde"} onClick={() => setAnsicht("hunde")}>Hunde ({d.hunde.length})</button>
          <button type="button" className="chip" aria-pressed={ansicht === "kunden"} onClick={() => setAnsicht("kunden")}>Kundschaft ({d.kunden.length})</button>
        </div>
        <input type="search" aria-label="Suchen" placeholder="Suchen nach Hund, Rasse, Halter/in oder Telefon" value={suche} onChange={(e) => setSuche(e.target.value)} />
        {ansicht === "hunde" ? (
          <div className="list">
            {hundTreffer.length ? hundTreffer.slice(0, 200).map(({ h, k }) => {
              const jetzt = aufenthaltVon(d.buchungen, h.id, heute());
              const da = jetzt && istDa(jetzt, heute());
              return (
                <Link key={h.id} to={`/pension/hund/${h.id}`} className="item hund-eintrag">
                  <div className="item-row">
                    <strong>{h.name}</strong>
                    <span className="actions">
                      {da && <span className="pill good">{d.zimmer.find((z) => z.id === jetzt.zimmerId)?.name}</span>}
                      {!da && jetzt && <span className="pill acc">ab {datum(jetzt.von)}</span>}
                      {h.medikamente && <span className="pill bad">Medikamente</span>}
                      {!h.vertraeglich && <span className="pill bad">nicht verträglich</span>}
                      {impfWarnungen(h, heute(), heute()).length > 0 && <span className="pill warn">Impfung prüfen</span>}
                    </span>
                  </div>
                  <div className="meta">
                    {[h.rasse, klassenName(h.gewichtsklasse)].filter(Boolean).map((x) => <span key={x}>{x}</span>)}
                    <span>{k?.name ?? "ohne Halter/in"}{k?.team ? " (Team)" : ""}</span>
                  </div>
                </Link>
              );
            }) : <div className="empty">{d.hunde.length ? "Nichts gefunden." : "Noch kein Hund erfasst. Zuerst die Kundin oder den Kunden anlegen, dann den Hund."}</div>}
          </div>
        ) : (
        <div className="list">
          {treffer.length ? treffer.slice(0, 100).map((k) => {
            const hunde = d.hunde.filter((h) => h.kundeId === k.id);
            return (
              <article key={k.id} className="item">
                <div className="item-row">
                  <strong>{k.name}{k.team && <span className="pill acc" style={{ marginLeft: 8 }}>Team</span>}</strong>
                  <button type="button" className="btn ghost small" onClick={() => { setParams({ kunde: k.id }); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Öffnen</button>
                </div>
                <div className="meta">
                  {k.telefon && <a href={`tel:${k.telefon.replace(/\s/g, "")}`}>{k.telefon}</a>}
                  {hunde.map((h) => <Link key={h.id} to={`/pension/hund/${h.id}`} className="pill">{h.name}</Link>)}
                  {!hunde.length && <span>noch kein Hund erfasst</span>}
                </div>
              </article>
            );
          }) : <div className="empty">{d.kunden.length ? "Nichts gefunden." : "Noch keine Kundschaft erfasst. Die erste Kundin oder den ersten Kunden oben anlegen."}</div>}
        </div>
        )}
      </section>
      {element}
    </>
  );
}
