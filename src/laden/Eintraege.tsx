// Übergabe, Bestellungen, Reklamationen und Loomis: erfassen oben, Liste darunter.
import { useState, type FormEvent } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useIch } from "../auth";
import { chf, datum, heute, vorname, wochentagKurz, zahl, zeitstempel } from "../lib/format";
import { BESTELL_STATUS, BESTELL_TYPEN, LOOMIS_TYPEN, REKLA_LOESUNGEN, REKLA_STATUS, UEBERGABE_THEMEN } from "../lib/laden";
import { darf, STUFE } from "../lib/rollen";
import { LoeschKnopf, speichern, useToast } from "../ui";
import { useLaden } from "./daten";

/** Wer darf diesen Eintrag löschen? Eigene immer, fremde nur die Leitung. */
function useDarfLoeschen() {
  const ich = useIch();
  const leitung = darf(ich.rollen, "laden", STUFE.verwalten);
  return (x: { uid?: string }) => leitung || x.uid === ich.uid;
}

function Filter<T extends string>({ wert, setWert, optionen }: { wert: T; setWert: (w: T) => void; optionen: [T, string][] }) {
  return (
    <div className="filters">
      {optionen.map(([k, l]) => (
        <button key={k} type="button" className="chip" aria-pressed={wert === k} onClick={() => setWert(k)}>{l}</button>
      ))}
    </div>
  );
}

function neu(ich: { name: string; uid: string }) {
  return { datum: heute(), erstellt: zeitstempel(), person: ich.name, uid: ich.uid };
}

// ---------- Übergabe ----------

export function Uebergabe() {
  const ich = useIch();
  const d = useLaden();
  const darfLoeschen = useDarfLoeschen();
  const { zeigen, element } = useToast();
  const [filter, setFilter] = useState<"offen" | "heute" | "alle">("offen");
  const [text, setText] = useState("");
  const [kategorie, setKategorie] = useState(UEBERGABE_THEMEN[0]);
  const [pendenz, setPendenz] = useState(false);
  const [wichtig, setWichtig] = useState(false);

  let liste = [...d.uebergabe].sort((a, b) => b.erstellt.localeCompare(a.erstellt));
  if (filter === "offen") liste = liste.filter((x) => x.pendenz && !x.erledigt);
  if (filter === "heute") liste = liste.filter((x) => x.datum === heute());

  async function absenden(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return zeigen("Bitte eine Nachricht eingeben");
    const ok = await speichern(zeigen, () => addDoc(collection(db, "laden_uebergabe"), { ...neu(ich), kategorie, text: text.trim(), pendenz, wichtig, erledigt: false }), "Eintrag gespeichert");
    if (ok) { setText(""); setPendenz(false); setWichtig(false); }
  }

  return (
    <>
      <section className="panel" aria-labelledby="h-ub">
        <h2 id="h-ub">Neuer Eintrag</h2>
        <form className="grid" onSubmit={absenden}>
          <label>Thema<select value={kategorie} onChange={(e) => setKategorie(e.target.value)}>{UEBERGABE_THEMEN.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="wide">Nachricht<textarea value={text} onChange={(e) => setText(e.target.value)} required placeholder="z. B. Frau Meier holt morgen 12 kg Hundefutter ab, liegt im Lager links." /></label>
          <label className="check wide"><input type="checkbox" checked={pendenz} onChange={(e) => setPendenz(e.target.checked)} /> Ist eine Pendenz (muss jemand erledigen)</label>
          <label className="check wide"><input type="checkbox" checked={wichtig} onChange={(e) => setWichtig(e.target.checked)} /> Wichtig</label>
          <div className="wide actions"><button className="btn">Eintrag speichern</button></div>
        </form>
      </section>
      <section className="panel" aria-labelledby="h-ub2">
        <div className="panel-head">
          <h2 id="h-ub2">Übergabebuch</h2>
          <Filter wert={filter} setWert={setFilter} optionen={[["offen", "Offene Pendenzen"], ["heute", "Heute"], ["alle", "Alle"]]} />
        </div>
        <div className="list">
          {liste.length ? liste.map((x) => (
            <article key={x.id} className={`item${x.erledigt ? " done" : ""}${x.wichtig && !x.erledigt ? " important" : ""}`}>
              <div className="meta">
                <span>{wochentagKurz(x.datum)} {datum(x.datum)} {x.erstellt.slice(11, 16)}</span>
                <span>{x.person}</span>
                <span className="pill">{x.kategorie}</span>
                {x.pendenz && (x.erledigt
                  ? <span className="pill good">Erledigt{x.erledigtVon ? ` · ${vorname(x.erledigtVon)}` : ""}</span>
                  : <span className="pill warn">Pendenz</span>)}
                {x.wichtig && <span className="pill bad">Wichtig</span>}
              </div>
              <p>{x.text}</p>
              <div className="actions">
                {x.pendenz && (
                  <button className="btn ghost small" type="button" onClick={() => speichern(zeigen, () => updateDoc(doc(db, "laden_uebergabe", x.id), {
                    erledigt: !x.erledigt, erledigtVon: x.erledigt ? "" : ich.name, erledigtAm: x.erledigt ? "" : zeitstempel(),
                  }), x.erledigt ? "Wieder geöffnet" : "Erledigt")}>
                    {x.erledigt ? "Wieder öffnen" : "Als erledigt markieren"}
                  </button>
                )}
                <LoeschKnopf disabled={!darfLoeschen(x)} onLoeschen={() => speichern(zeigen, () => deleteDoc(doc(db, "laden_uebergabe", x.id)), "Gelöscht")} />
              </div>
            </article>
          )) : <div className="empty">{filter === "offen" ? "Keine offenen Pendenzen." : "Noch keine Einträge. Was die nächste Schicht wissen muss, kommt oben hinein."}</div>}
        </div>
      </section>
      {element}
    </>
  );
}

// ---------- Bestellungen ----------

const bestellFarbe: Record<string, string> = { Offen: "warn", Bestellt: "acc", Eingetroffen: "good", Abgeholt: "", Storniert: "bad" };

export function Bestellungen() {
  const ich = useIch();
  const d = useLaden();
  const darfLoeschen = useDarfLoeschen();
  const { zeigen, element } = useToast();
  const [filter, setFilter] = useState<"aktiv" | "kunde" | "nach" | "alle">("aktiv");
  const [f, setF] = useState({ typ: BESTELL_TYPEN[0], artikel: "", menge: "", lieferant: "", kunde: "", telefon: "", notiz: "" });
  const kunde = f.typ === "Kundenbestellung";

  let liste = [...d.bestellungen].sort((a, b) => b.erstellt.localeCompare(a.erstellt));
  if (filter === "aktiv") liste = liste.filter((x) => !["Abgeholt", "Storniert"].includes(x.status));
  if (filter === "kunde") liste = liste.filter((x) => x.typ === "Kundenbestellung");
  if (filter === "nach") liste = liste.filter((x) => x.typ === "Nachbestellung");

  async function absenden(e: FormEvent) {
    e.preventDefault();
    if (!f.artikel.trim()) return zeigen("Bitte Artikel eingeben");
    const eintrag = {
      ...neu(ich), typ: f.typ, artikel: f.artikel.trim(), menge: f.menge.trim(), lieferant: f.lieferant.trim(),
      kunde: kunde ? f.kunde.trim() : "", telefon: kunde ? f.telefon.trim() : "", notiz: f.notiz.trim(), status: "Offen",
    };
    if (await speichern(zeigen, () => addDoc(collection(db, "laden_bestellungen"), eintrag), "Bestellung gespeichert")) {
      setF({ ...f, artikel: "", menge: "", kunde: "", telefon: "", notiz: "" });
    }
  }

  const feld = (k: keyof typeof f) => ({ value: f[k], onChange: (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value }) });

  return (
    <>
      <section className="panel" aria-labelledby="h-bs">
        <h2 id="h-bs">Neue Bestellung</h2>
        <form className="grid" onSubmit={absenden}>
          <label>Art<select {...feld("typ")}>{BESTELL_TYPEN.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label className="wide">Artikel<input {...feld("artikel")} required placeholder="z. B. Markus Mühle Naturnah 15 kg" /></label>
          <label>Menge<input {...feld("menge")} inputMode="numeric" placeholder="1" /></label>
          <label>Lieferant<input {...feld("lieferant")} placeholder="z. B. Sonderbestellung" /></label>
          {kunde && <label>Kunde / Kundin<input {...feld("kunde")} placeholder="Name" /></label>}
          {kunde && <label>Telefon<input {...feld("telefon")} inputMode="tel" placeholder="079 …" /></label>}
          <label className="wide">Notiz<input {...feld("notiz")} placeholder="z. B. bezahlt, Abholung Samstag" /></label>
          <div className="wide actions"><button className="btn">Bestellung speichern</button></div>
        </form>
      </section>
      <section className="panel" aria-labelledby="h-bs2">
        <div className="panel-head">
          <h2 id="h-bs2">Bestellbuch</h2>
          <Filter wert={filter} setWert={setFilter} optionen={[["aktiv", "Aktiv"], ["kunde", "Kunden"], ["nach", "Nachbestellungen"], ["alle", "Alle"]]} />
        </div>
        <div className="list">
          {liste.length ? liste.map((x) => (
            <article key={x.id} className="item">
              <div className="item-row">
                <strong>{x.menge ? `${x.menge} × ` : ""}{x.artikel}</strong>
                <span className={`pill ${bestellFarbe[x.status] ?? ""}`}>{x.status}</span>
              </div>
              <div className="meta">
                <span>{x.typ}</span>
                {x.lieferant && <span>{x.lieferant}</span>}
                {x.kunde && <span>Für {x.kunde}{x.telefon && <> · <a href={`tel:${x.telefon}`}>{x.telefon}</a></>}</span>}
                <span>{datum(x.datum)}</span>
                <span>{vorname(x.person)}</span>
              </div>
              {x.notiz && <p>{x.notiz}</p>}
              <div className="actions">
                <label className="check" style={{ gap: 6 }}>
                  Status
                  <select value={x.status} style={{ width: "auto" }} onChange={(e) => speichern(zeigen, () => updateDoc(doc(db, "laden_bestellungen", x.id), { status: e.target.value }), "Status: " + e.target.value)}>
                    {BESTELL_STATUS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </label>
                <LoeschKnopf disabled={!darfLoeschen(x)} onLoeschen={() => speichern(zeigen, () => deleteDoc(doc(db, "laden_bestellungen", x.id)), "Gelöscht")} />
              </div>
            </article>
          )) : <div className="empty">Keine Bestellungen in dieser Ansicht. Kundenwünsche und fehlende Artikel oben erfassen.</div>}
        </div>
      </section>
      {element}
    </>
  );
}

// ---------- Reklamationen ----------

export function Reklamationen() {
  const ich = useIch();
  const d = useLaden();
  const darfLoeschen = useDarfLoeschen();
  const { zeigen, element } = useToast();
  const [f, setF] = useState({ kunde: "", artikel: "", grund: "", loesung: REKLA_LOESUNGEN[0], betrag: "", lieferant: false });

  const liste = [...d.reklamationen].sort((a, b) => Number(a.status === "Erledigt") - Number(b.status === "Erledigt") || b.erstellt.localeCompare(a.erstellt));

  async function absenden(e: FormEvent) {
    e.preventDefault();
    if (!f.artikel.trim() || !f.grund.trim()) return zeigen("Bitte Artikel und Grund eingeben");
    const status = f.lieferant ? "Beim Lieferanten" : f.loesung === "Noch offen" ? "Offen" : "Erledigt";
    const eintrag = { ...neu(ich), kunde: f.kunde.trim(), artikel: f.artikel.trim(), grund: f.grund.trim(), loesung: f.loesung, betrag: zahl(f.betrag), status };
    if (await speichern(zeigen, () => addDoc(collection(db, "laden_reklamationen"), eintrag), "Reklamation gespeichert")) {
      setF({ kunde: "", artikel: "", grund: "", loesung: REKLA_LOESUNGEN[0], betrag: "", lieferant: false });
    }
  }

  return (
    <>
      <section className="panel" aria-labelledby="h-rk">
        <h2 id="h-rk">Neue Reklamation</h2>
        <form className="grid" onSubmit={absenden}>
          <label>Kunde / Kundin<input value={f.kunde} onChange={(e) => setF({ ...f, kunde: e.target.value })} placeholder="Name, Telefon" /></label>
          <label className="wide">Artikel<input value={f.artikel} onChange={(e) => setF({ ...f, artikel: e.target.value })} required placeholder="z. B. Kratzbaum Modell X, gekauft am …" /></label>
          <label className="wide">Grund<textarea value={f.grund} onChange={(e) => setF({ ...f, grund: e.target.value })} required placeholder="Was ist das Problem?" /></label>
          <label>Lösung<select value={f.loesung} onChange={(e) => setF({ ...f, loesung: e.target.value })}>{REKLA_LOESUNGEN.map((l) => <option key={l}>{l}</option>)}</select></label>
          <label>Betrag CHF<input className="num" inputMode="decimal" placeholder="0.00" value={f.betrag} onChange={(e) => setF({ ...f, betrag: e.target.value })} /></label>
          <label className="check wide"><input type="checkbox" checked={f.lieferant} onChange={(e) => setF({ ...f, lieferant: e.target.checked })} /> Mangel an Lieferanten melden</label>
          <div className="wide actions"><button className="btn">Reklamation speichern</button></div>
        </form>
        <p className="hint">Gutschrift oder Umtausch: Rahel und Claudia bis CHF 200, darüber Morena. Nel wird immer informiert.</p>
      </section>
      <section className="panel" aria-labelledby="h-rk2">
        <h2 id="h-rk2">Reklamationsbuch</h2>
        <div className="list">
          {liste.length ? liste.map((x) => (
            <article key={x.id} className={`item${x.status === "Erledigt" ? " done" : ""}`}>
              <div className="item-row">
                <strong>{x.artikel}</strong>
                <span className={`pill ${x.status === "Erledigt" ? "good" : x.status === "Offen" ? "warn" : "acc"}`}>{x.status}</span>
              </div>
              <div className="meta">
                <span>{datum(x.datum)}</span>
                {x.kunde && <span>{x.kunde}</span>}
                <span>{x.loesung}{x.betrag ? ` · CHF ${chf(x.betrag)}` : ""}</span>
                <span>{vorname(x.person)}</span>
              </div>
              <p>{x.grund}</p>
              <div className="actions">
                <label className="check" style={{ gap: 6 }}>
                  Status
                  <select value={x.status} style={{ width: "auto" }} onChange={(e) => speichern(zeigen, () => updateDoc(doc(db, "laden_reklamationen", x.id), { status: e.target.value }), "Status: " + e.target.value)}>
                    {REKLA_STATUS.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </label>
                <LoeschKnopf disabled={!darfLoeschen(x)} onLoeschen={() => speichern(zeigen, () => deleteDoc(doc(db, "laden_reklamationen", x.id)), "Gelöscht")} />
              </div>
            </article>
          )) : <div className="empty">Keine Reklamationen erfasst.</div>}
        </div>
      </section>
      {element}
    </>
  );
}

// ---------- Loomis ----------

export function Loomis() {
  const ich = useIch();
  const d = useLaden();
  const darfLoeschen = useDarfLoeschen();
  const { zeigen, element } = useToast();
  const [f, setF] = useState({ typ: LOOMIS_TYPEN[0], betrag: "", notiz: "" });

  const bags = d.kasse.filter((k) => k.safebagBetrag > 0).sort((a, b) => b.datum.localeCompare(a.datum));
  const offen = bags.filter((b) => !b.abgeholt);
  const abgeholt = bags.filter((b) => b.abgeholt).slice(0, 15);
  const offenSumme = offen.reduce((s, b) => s + b.safebagBetrag, 0);
  const log = [...d.loomis].sort((a, b) => b.erstellt.localeCompare(a.erstellt)).slice(0, 40);

  async function absenden(e: FormEvent) {
    e.preventDefault();
    if (await speichern(zeigen, () => addDoc(collection(db, "laden_loomis"), { ...neu(ich), typ: f.typ, betrag: zahl(f.betrag), notiz: f.notiz.trim() }), "Gespeichert")) {
      setF({ ...f, betrag: "", notiz: "" });
    }
  }

  const bag = (b: (typeof bags)[number]) => (
    <article key={b.id} className="item">
      <div className="item-row">
        <strong>CHF {chf(b.safebagBetrag)}</strong>
        <span className={`pill ${b.abgeholt ? "good" : "warn"}`}>{b.abgeholt ? `Abgeholt ${datum(b.abgeholtAm)}` : "Bereit zur Abholung"}</span>
      </div>
      <div className="meta">
        <span>Tagesabschluss {datum(b.datum)}</span>
        {b.safebagNr ? <span>Safebag {b.safebagNr}</span> : <span className="pill bad">Safebag-Nr. fehlt</span>}
      </div>
      <div className="actions">
        <button className="btn ghost small" type="button" onClick={() => speichern(zeigen, () => updateDoc(doc(db, "kasse", b.id), { abgeholt: !b.abgeholt, abgeholtAm: b.abgeholt ? "" : heute() }), b.abgeholt ? "Abholung zurückgenommen" : "Abholung bestätigt")}>
          {b.abgeholt ? "Abholung zurücknehmen" : "Von Loomis abgeholt"}
        </button>
      </div>
    </article>
  );

  return (
    <>
      <section className="panel" aria-labelledby="h-lm">
        <div className="panel-head">
          <h2 id="h-lm">Safebags für Loomis</h2>
          {offen.length ? <span className="pill warn">{offen.length} offen · CHF {chf(offenSumme)}</span> : <span className="pill good">Alles abgeholt</span>}
        </div>
        <p className="hint">Safebags entstehen aus dem Tagesabschluss im Kassenbuch. Bei der Abholung hier bestätigen.</p>
        <div className="list">{offen.length ? offen.map(bag) : <div className="empty">Keine Safebags zur Abholung bereit.</div>}</div>
        {abgeholt.length > 0 && (
          <details>
            <summary>Zuletzt abgeholt ({abgeholt.length})</summary>
            <div className="list" style={{ marginTop: 8 }}>{abgeholt.map(bag)}</div>
          </details>
        )}
      </section>
      <section className="panel" aria-labelledby="h-lm2">
        <h2 id="h-lm2">Wechselgeld</h2>
        <form className="grid" onSubmit={absenden}>
          <label>Vorgang<select value={f.typ} onChange={(e) => setF({ ...f, typ: e.target.value })}>{LOOMIS_TYPEN.map((t) => <option key={t}>{t}</option>)}</select></label>
          <label>Betrag CHF<input className="num" inputMode="decimal" placeholder="0.00" value={f.betrag} onChange={(e) => setF({ ...f, betrag: e.target.value })} /></label>
          <label className="wide">Stückelung / Notiz<input value={f.notiz} onChange={(e) => setF({ ...f, notiz: e.target.value })} placeholder="z. B. 2 Rollen 5.–, 4 Rollen 1.–, 10 × 10er-Noten" /></label>
          <div className="wide actions"><button className="btn">Speichern</button></div>
        </form>
        <div className="list">
          {log.length ? log.map((x) => (
            <article key={x.id} className="item">
              <div className="item-row"><strong>{x.typ}</strong>{x.betrag ? <span>CHF {chf(x.betrag)}</span> : null}</div>
              <div className="meta"><span>{datum(x.datum)}</span><span>{vorname(x.person)}</span></div>
              {x.notiz && <p>{x.notiz}</p>}
              <div className="actions"><LoeschKnopf disabled={!darfLoeschen(x)} onLoeschen={() => speichern(zeigen, () => deleteDoc(doc(db, "laden_loomis", x.id)), "Gelöscht")} /></div>
            </article>
          )) : <div className="empty">Noch keine Wechselgeld-Vorgänge erfasst.</div>}
        </div>
      </section>
      {element}
    </>
  );
}
