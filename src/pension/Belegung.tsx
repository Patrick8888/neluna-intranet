// Belegungsplan: Zimmer × Tage, Buchungen als Balken. Darunter das Buchungsformular und die Zimmer-Einstellungen.
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { collection, deleteDoc, doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useIch } from "../auth";
import { datum, heute, plusTage, wochentagKurz, zahl, zeitstempel } from "../lib/format";
import {
  belegteTage, belegungPruefen, BUCHUNG_STATUS, GEWICHTSKLASSEN, impfWarnungen, LEISTUNGEN, naechte, platzFuer, platzText, type Buchung, type BuchungStatus, type Gewichtsklasse, type Zimmer,
} from "../lib/pension";
import { darf, STUFE } from "../lib/rollen";
import { LoeschKnopf, speichern, useAngezeigt, useToast } from "../ui";
import { statusFarbe } from "./BuchungKarte";
import { usePension } from "./daten";

const TAGE = 14;
const tageZwischen = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);

function Plan({ start, oeffnen }: { start: string; oeffnen: (id: string) => void }) {
  const d = usePension();
  const tage = Array.from({ length: TAGE }, (_, i) => plusTage(start, i));
  const ende = tage[TAGE - 1];
  const tag = heute();
  const spalten = { gridTemplateColumns: `repeat(${TAGE}, minmax(44px, 1fr))` };

  return (
    <div className="tablewrap">
      <div className="plan">
        <div className="plan-zeile kopf">
          <div className="plan-name" />
          <div className="plan-spur" style={spalten}>
            {tage.map((t) => (
              <div key={t} className={`plan-tag${t === tag ? " heute" : ""}${[0, 6].includes(new Date(t + "T12:00:00Z").getUTCDay()) ? " we" : ""}`}>
                <span>{wochentagKurz(t)}</span>
                <b>{t.slice(8)}.</b>
              </div>
            ))}
          </div>
        </div>
        {d.zimmer.filter((z) => z.aktiv).map((z) => {
          const balken = d.buchungen
            .filter((b) => b.zimmerId === z.id && b.status !== "Storniert")
            .map((b) => ({ b, tage: belegteTage(b) }))
            .filter(({ tage: [s, e] }) => s <= ende && e >= start)
            .sort((a, b) => a.tage[0].localeCompare(b.tage[0]));
          return (
            <div key={z.id} className="plan-zeile">
              <div className="plan-name"><b>{z.name}</b><span>{platzText(z)}</span></div>
              <div className="plan-spur" style={spalten}>
                {balken.map(({ b, tage: [s, e] }) => {
                  const von = s < start ? 0 : tageZwischen(start, s);
                  const bis = e > ende ? TAGE - 1 : tageZwischen(start, e);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      className={`balken ${statusFarbe[b.status] || "aus"}`}
                      style={{ gridColumn: `${von + 1} / ${bis + 2}` }}
                      title={`${b.hunde.map((h) => h.name).join(", ")} · ${b.kundeName} · ${datum(b.von)}–${datum(b.bis)} · ${b.status}`}
                      onClick={() => oeffnen(b.id)}
                    >
                      {b.hunde.map((h) => h.name).join(", ")}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type Werte = { kundeId: string; hundIds: string[]; zimmerId: string; von: string; bis: string; status: BuchungStatus; leistungen: string[]; preis: string; bemerkung: string };

function Formular({ vorhanden, fertig, zeigen }: { vorhanden?: Buchung; fertig: () => void; zeigen: (t: string) => void }) {
  const ich = useIch();
  const angezeigt = useAngezeigt();
  const d = usePension();
  const verwalten = darf(ich.rollen, "pension", STUFE.verwalten);
  const [w, setW] = useState<Werte>(() => ({
    kundeId: vorhanden?.kundeId ?? "",
    hundIds: vorhanden?.hunde.map((h) => h.id) ?? [],
    zimmerId: vorhanden?.zimmerId ?? "",
    von: vorhanden?.von ?? heute(),
    bis: vorhanden?.bis ?? plusTage(heute(), 1),
    status: vorhanden?.status ?? "Bestätigt",
    leistungen: vorhanden?.leistungen ?? [],
    preis: vorhanden ? String(vorhanden.preis || "") : "",
    bemerkung: vorhanden?.bemerkung ?? "",
  }));
  // Die ID steht schon vor dem Speichern fest, damit sich eine neue Buchung nicht selbst als Belegung meldet.
  const [id] = useState(() => vorhanden?.id ?? doc(collection(db, "pension_buchungen")).id);
  const set = (x: Partial<Werte>) => setW((alt) => ({ ...alt, ...x }));
  const kunden = [...d.kunden].sort((a, b) => a.name.localeCompare(b.name, "de"));
  const hundeDesKunden = d.hunde.filter((h) => h.kundeId === w.kundeId);
  const pruefen = (zimmerId: string) => belegungPruefen(d, { id, zimmerId, von: w.von, bis: w.bis, hundIds: w.hundIds });
  const fehler = w.status === "Storniert" ? null : !w.kundeId ? "Bitte eine Kundin oder einen Kunden wählen." : !w.zimmerId ? "Bitte ein Zimmer wählen." : pruefen(w.zimmerId);
  const warnungen = w.hundIds.flatMap((id) => {
    const h = d.hunde.find((x) => x.id === id);
    return h ? impfWarnungen(h, w.bis, heute()) : [];
  });

  async function absenden(e: FormEvent) {
    e.preventDefault();
    if (fehler) return zeigen(fehler);
    const kunde = d.kunden.find((k) => k.id === w.kundeId);
    const felder = {
      kundeId: w.kundeId,
      kundeName: kunde?.name ?? "",
      hunde: w.hundIds.map((id) => ({ id, name: d.hunde.find((h) => h.id === id)?.name ?? "" })),
      zimmerId: w.zimmerId, von: w.von, bis: w.bis, status: w.status, leistungen: w.leistungen, preis: zahl(w.preis), bemerkung: w.bemerkung.trim(),
    };
    const ok = vorhanden
      ? await speichern(zeigen, () => updateDoc(doc(db, "pension_buchungen", vorhanden.id), { ...felder, geaendertVon: ich.uid }), "Buchung gespeichert")
      : await speichern(zeigen, () => setDoc(doc(db, "pension_buchungen", id), {
          ...felder, bezahlt: false, zahlungsart: "", betrag: 0, bezahltAm: "", erstellt: zeitstempel(), person: ich.name, uid: ich.uid,
        }), "Buchung gespeichert");
    if (ok && angezeigt.current) fertig();
  }

  return (
    <section className="panel" aria-labelledby="h-bf" id="buchung">
      <div className="panel-head">
        <h2 id="h-bf">{vorhanden ? "Buchung bearbeiten" : "Neue Buchung"}</h2>
        {vorhanden && <span className={`pill ${statusFarbe[vorhanden.status]}`}>{vorhanden.status}</span>}
      </div>
      <form className="grid" onSubmit={absenden}>
        <label className="wide">
          Kundin / Kunde
          <select value={w.kundeId} onChange={(e) => set({ kundeId: e.target.value, hundIds: d.hunde.filter((h) => h.kundeId === e.target.value).map((h) => h.id).slice(0, 1) })} required>
            <option value="">– wählen –</option>
            {kunden.map((k) => <option key={k.id} value={k.id}>{k.name}</option>)}
          </select>
        </label>
        {w.kundeId && (
          <fieldset className="wide">
            <legend>Hunde</legend>
            {hundeDesKunden.length ? (
              <div className="checks">
                {hundeDesKunden.map((h) => (
                  <label key={h.id} className="check">
                    <input type="checkbox" checked={w.hundIds.includes(h.id)} onChange={(e) => set({ hundIds: e.target.checked ? [...w.hundIds, h.id] : w.hundIds.filter((x) => x !== h.id) })} />
                    {h.name}{h.vertraeglich ? "" : " (nicht verträglich)"}
                  </label>
                ))}
              </div>
            ) : <p className="hint">Für diese Person ist noch kein Hund erfasst. <Link to={`/pension/kartei?kunde=${w.kundeId}`}>In der Kartei erfassen</Link></p>}
          </fieldset>
        )}
        {!kunden.length && <p className="hint wide">Noch keine Kundschaft erfasst. <Link to="/pension/kartei">Zuerst in der Kartei anlegen</Link></p>}
        <label>Ankunft<input type="date" value={w.von} onChange={(e) => set({ von: e.target.value, bis: w.bis < e.target.value ? e.target.value : w.bis })} required /></label>
        <label>Abholung<input type="date" value={w.bis} min={w.von} onChange={(e) => set({ bis: e.target.value })} required /></label>
        <label>
          Zimmer
          <select value={w.zimmerId} onChange={(e) => set({ zimmerId: e.target.value })} required>
            <option value="">– wählen –</option>
            {d.zimmer.filter((z) => z.aktiv || z.id === w.zimmerId).map((z) => (
              <option key={z.id} value={z.id}>{z.name} · {w.hundIds.length && !pruefen(z.id) ? "frei" : w.hundIds.length ? "belegt" : `${z.maxHunde} ${z.maxHunde === 1 ? "Platz" : "Plätze"}`}</option>
            ))}
          </select>
        </label>
        <label>Status<select value={w.status} onChange={(e) => set({ status: e.target.value as BuchungStatus })}>{BUCHUNG_STATUS.map((s) => <option key={s}>{s}</option>)}</select></label>
        <fieldset className="wide">
          <legend>Leistungen</legend>
          <div className="checks">
            {LEISTUNGEN.map((l) => (
              <label key={l} className="check">
                <input type="checkbox" checked={w.leistungen.includes(l)} onChange={(e) => set({ leistungen: e.target.checked ? [...w.leistungen, l] : w.leistungen.filter((x) => x !== l) })} />
                {l}
              </label>
            ))}
          </div>
        </fieldset>
        <label>Preis CHF<input className="num" inputMode="decimal" value={w.preis} onChange={(e) => set({ preis: e.target.value })} placeholder="0.00" /></label>
        <label className="wide">Bemerkung<textarea value={w.bemerkung} onChange={(e) => set({ bemerkung: e.target.value })} placeholder="z. B. bringt eigenes Körbchen mit, Abholung 9 Uhr" /></label>
        <p className="hint wide">{naechte(w) ? `${naechte(w)} Nächte` : "Tagesgast (gleicher Tag)"} · Am Abholtag ist das Zimmer wieder frei.</p>
        {fehler && <p className="notice bad wide" role="alert">{fehler}</p>}
        {warnungen.map((x) => <p key={x} className="notice wide">{x}</p>)}
        <div className="wide actions">
          <button className="btn" disabled={!!fehler}>Buchung speichern</button>
          <button className="btn ghost" type="button" onClick={fertig}>Abbrechen</button>
          {vorhanden && <LoeschKnopf disabled={!verwalten} onLoeschen={() => speichern(zeigen, () => deleteDoc(doc(db, "pension_buchungen", vorhanden.id)), "Gelöscht").then((ok) => ok && angezeigt.current && fertig())} />}
        </div>
      </form>
    </section>
  );
}

function ZimmerEinstellung({ z }: { z: Zimmer }) {
  const { zeigen, element } = useToast();
  const [name, setName] = useState(z.name);
  const [max, setMax] = useState(String(z.maxHunde));
  // Leer heisst: gleich viele wie «Hunde» insgesamt.
  const [plaetze, setPlaetze] = useState<Record<Gewichtsklasse, string>>(() => ({
    klein: z.plaetze ? String(platzFuer(z, "klein")) : "", mittel: z.plaetze ? String(platzFuer(z, "mittel")) : "", gross: z.plaetze ? String(platzFuer(z, "gross")) : "",
  }));
  const [aktiv, setAktiv] = useState(z.aktiv);
  const [notiz, setNotiz] = useState(z.notiz);

  async function absenden(e: FormEvent) {
    e.preventDefault();
    const maxHunde = Math.round(zahl(max));
    if (maxHunde < 1 || maxHunde > 10) return zeigen("Zwischen 1 und 10 Hunden");
    const felder = { name: name.trim() || z.name, maxHunde, aktiv, notiz: notiz.trim() };
    const mitKlassen = GEWICHTSKLASSEN.some(([k]) => plaetze[k].trim() !== "");
    const p = Object.fromEntries(GEWICHTSKLASSEN.map(([k]) => [k, plaetze[k].trim() === "" ? maxHunde : Math.min(maxHunde, Math.max(0, Math.round(zahl(plaetze[k]))))]));
    await speichern(zeigen, () => setDoc(doc(db, "pension_zimmer", z.id), mitKlassen ? { ...felder, plaetze: p } : felder), `${name} gespeichert`);
  }

  return (
    <form className="item zimmer-form" onSubmit={absenden}>
      <div className="zimmer-zeile">
        <input aria-label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <label className="inline">Hunde<input aria-label={`Anzahl Hunde ${z.name}`} type="number" min={1} max={10} value={max} onChange={(e) => setMax(e.target.value)} /></label>
        <input aria-label="Notiz" value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="Notiz, z. B. mit Auslauf" />
        <label className="check"><input type="checkbox" checked={aktiv} onChange={(e) => setAktiv(e.target.checked)} /> in Betrieb</label>
        <button className="btn ghost small">Speichern</button>
      </div>
      <div className="actions">
        <span className="hint">Platz für Hunde</span>
        {GEWICHTSKLASSEN.map(([k, titel]) => (
          <label key={k} className="inline">
            {titel}
            <input aria-label={`${titel} ${z.name}`} type="number" min={0} max={10} value={plaetze[k]} placeholder={max} onChange={(e) => setPlaetze({ ...plaetze, [k]: e.target.value })} />
          </label>
        ))}
      </div>
      {element}
    </form>
  );
}

export function Belegung() {
  const ich = useIch();
  const d = usePension();
  const [params, setParams] = useSearchParams();
  const [start, setStart] = useState(() => plusTage(heute(), -1));
  const formular = useRef<HTMLDivElement>(null);
  const bearbeiten = darf(ich.rollen, "pension", STUFE.bearbeiten);
  const verwalten = darf(ich.rollen, "pension", STUFE.verwalten);
  const { zeigen, element } = useToast();
  const offen = params.get("buchung");
  const vorhanden = offen && offen !== "neu" ? d.buchungen.find((b) => b.id === offen) : undefined;

  const oeffnen = (id: string) => setParams({ buchung: id });
  const schliessen = () => setParams({});

  useEffect(() => {
    if (offen) formular.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [offen]);

  return (
    <>
      <section className="panel" aria-labelledby="h-plan">
        <div className="panel-head">
          <h2 id="h-plan">Belegungsplan</h2>
          <div className="actions">
            <button type="button" className="btn ghost small" onClick={() => setStart(plusTage(start, -7))} aria-label="Eine Woche zurück">←</button>
            <button type="button" className="btn ghost small" onClick={() => setStart(plusTage(heute(), -1))}>Heute</button>
            <button type="button" className="btn ghost small" onClick={() => setStart(plusTage(start, 7))} aria-label="Eine Woche vor">→</button>
            {bearbeiten && <button type="button" className="btn small" onClick={() => oeffnen("neu")}>Neue Buchung</button>}
          </div>
        </div>
        <Plan start={start} oeffnen={oeffnen} />
        <div className="meta">
          <span className="pill warn">Anfrage</span><span className="pill acc">Bestätigt</span><span className="pill good">Eingecheckt</span><span className="pill">Abgeholt</span>
          <span>Tippe auf einen Balken, um die Buchung zu öffnen.</span>
        </div>
      </section>
      <div ref={formular}>
        {offen && bearbeiten && (offen === "neu" || vorhanden) && <Formular key={offen} vorhanden={vorhanden} fertig={schliessen} zeigen={zeigen} />}
        {offen && !bearbeiten && vorhanden && (
          <section className="panel">
            <h2>{vorhanden.hunde.map((h) => h.name).join(", ")}</h2>
            <p className="muted">{vorhanden.kundeName} · {datum(vorhanden.von)}–{datum(vorhanden.bis)} · {vorhanden.status}</p>
            <div className="actions"><button className="btn ghost small" type="button" onClick={schliessen}>Schliessen</button></div>
          </section>
        )}
      </div>
      {verwalten && (
        <section className="panel" aria-labelledby="h-zi">
          <h2 id="h-zi">Zimmer</h2>
          <p className="hint">Wie viele Hunde ein Zimmer aufnimmt, entscheidet ihr hier. Pro Grösse gilt: so viele Hunde dieser Klasse hätten allein Platz, z. B. 3 bis 25 kg, 2 von 25–45 kg oder 1 ab 45 kg; gemischt rechnet das Intranet anteilig (1 grosser Hund füllt dann das Zimmer, 1 mittlerer und 1 kleiner passen zusammen). 0 heisst: diese Grösse passt nicht ins Zimmer, leer heisst: gleich viele wie «Hunde». Hunde derselben Familie dürfen immer zusammen ins Zimmer. Mit fremden Hunden teilen sie nur, wenn alle in der Kartei als verträglich markiert sind.</p>
          <div className="list">{d.zimmer.map((z) => <ZimmerEinstellung key={z.id} z={z} />)}</div>
        </section>
      )}
      {element}
    </>
  );
}
