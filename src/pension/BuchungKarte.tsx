// Eine Buchung mit den nächsten Schritten: bestätigen, einchecken, auschecken mit Zahlung, stornieren.
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useIch } from "../auth";
import { chf, datum, heute, wochentagKurz, zahl } from "../lib/format";
import { impfWarnungen, naechte, ZAHLUNGSARTEN, type Buchung, type Zahlungsart } from "../lib/pension";
import { darf, STUFE } from "../lib/rollen";
import { speichern } from "../ui";
import { usePension } from "./daten";

export const statusFarbe: Record<string, string> = { Anfrage: "warn", "Bestätigt": "acc", Eingecheckt: "good", Abgeholt: "", Storniert: "bad" };

function Auschecken({ b, zeigen, fertig }: { b: Buchung; zeigen: (t: string) => void; fertig: () => void }) {
  const ich = useIch();
  const [betrag, setBetrag] = useState(String(b.preis || ""));
  const [art, setArt] = useState<Zahlungsart>("Bar");

  async function absenden(e: FormEvent) {
    e.preventDefault();
    const tag = heute();
    const rechnung = art === "Rechnung";
    // Früher abgeholt: das Zimmer ist ab heute wieder frei.
    const bis = tag < b.bis && tag >= b.von ? tag : b.bis;
    const ok = await speichern(zeigen, () => updateDoc(doc(db, "pension_buchungen", b.id), {
      status: "Abgeholt", bis, betrag: zahl(betrag), zahlungsart: art, bezahlt: !rechnung, bezahltAm: rechnung ? "" : tag, geaendertVon: ich.uid,
    }), rechnung ? "Ausgecheckt, Rechnung offen" : "Ausgecheckt und bezahlt");
    if (ok) fertig();
  }

  return (
    <form className="grid" onSubmit={absenden}>
      <label>Betrag CHF<input className="num" inputMode="decimal" value={betrag} onChange={(e) => setBetrag(e.target.value)} required /></label>
      <label>Bezahlt mit<select value={art} onChange={(e) => setArt(e.target.value as Zahlungsart)}>{ZAHLUNGSARTEN.map((z) => <option key={z}>{z}</option>)}</select></label>
      <p className="hint wide">{art === "Rechnung" ? "Die Rechnung läuft nicht über die Kasse. Sobald sie bezahlt ist, hier als bezahlt markieren." : "Der Betrag erscheint am Abend im Kassenabschluss als Vorschlag."}</p>
      <div className="wide actions"><button className="btn">Auschecken</button><button className="btn ghost" type="button" onClick={fertig}>Abbrechen</button></div>
    </form>
  );
}

export function BuchungKarte({ b, zeigen }: { b: Buchung; zeigen: (t: string) => void }) {
  const ich = useIch();
  const d = usePension();
  const [checkout, setCheckout] = useState(false);
  const bearbeiten = darf(ich.rollen, "pension", STUFE.bearbeiten);
  const zimmer = d.zimmer.find((z) => z.id === b.zimmerId);
  const kunde = d.kunden.find((k) => k.id === b.kundeId);
  const warnungen = b.status === "Abgeholt" || b.status === "Storniert" ? [] : b.hunde.flatMap((x) => {
    const h = d.hunde.find((y) => y.id === x.id);
    return h ? impfWarnungen(h, b.bis, heute()) : [];
  });
  const status = (neu: Buchung["status"], ok: string) =>
    speichern(zeigen, () => updateDoc(doc(db, "pension_buchungen", b.id), { status: neu, geaendertVon: ich.uid }), ok);

  return (
    <article className={`item${b.status === "Storniert" || b.status === "Abgeholt" ? " done" : ""}`}>
      <div className="item-row">
        <strong>{b.hunde.map((h) => h.name).join(", ")}</strong>
        <span className={`pill ${statusFarbe[b.status]}`}>{b.status}</span>
      </div>
      <div className="meta">
        <span>{zimmer?.name ?? b.zimmerId}</span>
        <span>{wochentagKurz(b.von)} {datum(b.von)} – {wochentagKurz(b.bis)} {datum(b.bis)}</span>
        <span>{naechte(b) ? `${naechte(b)} Nächte` : "Tagesgast"}</span>
        <span>{b.kundeName}</span>
        {kunde?.telefon && <a href={`tel:${kunde.telefon.replace(/\s/g, "")}`}>{kunde.telefon}</a>}
        {b.preis > 0 && <span>CHF {chf(b.preis)}</span>}
      </div>
      {b.leistungen.length > 0 && <div className="meta">{b.leistungen.map((l) => <span key={l} className="pill">{l}</span>)}</div>}
      {b.bemerkung && <p>{b.bemerkung}</p>}
      {warnungen.map((w) => <p key={w} className="notice">{w}</p>)}
      {b.status === "Abgeholt" && b.zahlungsart && (
        <div className="meta">
          <span>CHF {chf(b.betrag)} · {b.zahlungsart}</span>
          {b.bezahlt ? <span className="pill good">Bezahlt {datum(b.bezahltAm)}</span> : <span className="pill warn">Rechnung offen</span>}
        </div>
      )}
      {bearbeiten && (checkout ? (
        <Auschecken b={b} zeigen={zeigen} fertig={() => setCheckout(false)} />
      ) : (
        <div className="actions">
          {b.status === "Anfrage" && <button type="button" className="btn small" onClick={() => status("Bestätigt", "Bestätigt")}>Bestätigen</button>}
          {(b.status === "Anfrage" || b.status === "Bestätigt") && b.von <= heute() && (
            <button type="button" className="btn small" onClick={() => status("Eingecheckt", "Eingecheckt")}>Einchecken</button>
          )}
          {b.status === "Eingecheckt" && <button type="button" className="btn small" onClick={() => setCheckout(true)}>Auschecken</button>}
          {b.status === "Abgeholt" && !b.bezahlt && b.zahlungsart === "Rechnung" && (
            <button type="button" className="btn ghost small" onClick={() => speichern(zeigen, () => updateDoc(doc(db, "pension_buchungen", b.id), { bezahlt: true, bezahltAm: heute(), geaendertVon: ich.uid }), "Als bezahlt markiert")}>
              Rechnung bezahlt
            </button>
          )}
          <Link className="btn ghost small" to={`/pension/belegung?buchung=${b.id}`}>Bearbeiten</Link>
        </div>
      ))}
    </article>
  );
}
