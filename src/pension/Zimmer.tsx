// Zimmerübersicht: welcher Hund ist an einem Tag in welchem Zimmer; Hunde direkt im Zimmer eintragen, dazu Futter und Medikamente.
import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { collection, doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useIch } from "../auth";
import { datum, heute, plusTage, wochentagKurz, zeitstempel } from "../lib/format";
import { belegungPruefen, preisProHund, zimmerAm, type Gast, type Hund, type Zimmer as ZimmerTyp } from "../lib/pension";
import { darf, STUFE } from "../lib/rollen";
import { speichern, useToast } from "../ui";
import { Auschecken } from "./BuchungKarte";
import { usePension } from "./daten";

/** Suchfeld im Zimmer: Hund suchen und direkt für diesen Tag eintragen (Buchung ab dem Tag). */
function Eintragen({ z, tag, zeigen }: { z: ZimmerTyp; tag: string; zeigen: (t: string) => void }) {
  const ich = useIch();
  const d = usePension();
  const [suche, setSuche] = useState("");
  const [hund, setHund] = useState<Hund | null>(null);
  const [bis, setBis] = useState(plusTage(tag, 1));
  const [id] = useState(() => doc(collection(db, "pension_buchungen")).id);
  const imHaus = new Set(zimmerAm(d, tag).flatMap((r) => r.gaeste.map((g) => g.hund.id)));
  const q = suche.trim().toLowerCase();
  const treffer = q
    ? d.hunde
        .filter((h) => !imHaus.has(h.id))
        .map((h) => ({ h, k: d.kunden.find((k) => k.id === h.kundeId) }))
        .filter(({ h, k }) => [h.name, h.rasse, k?.name].some((x) => x?.toLowerCase().includes(q)))
        .sort((x, y) => x.h.name.localeCompare(y.h.name, "de"))
        .slice(0, 6)
    : [];
  const fehler = hund ? belegungPruefen(d, { id, zimmerId: z.id, von: tag, bis, hundIds: [hund.id] }) : null;

  async function speichernBuchung(e: FormEvent) {
    e.preventDefault();
    if (!hund) return;
    if (fehler) return zeigen(fehler);
    const kunde = d.kunden.find((k) => k.id === hund.kundeId);
    const ok = await speichern(zeigen, () => setDoc(doc(db, "pension_buchungen", id), {
      kundeId: hund.kundeId, kundeName: kunde?.name ?? "", hunde: [{ id: hund.id, name: hund.name }], zimmerId: z.id, von: tag, bis,
      status: tag === heute() ? "Eingecheckt" : "Bestätigt", leistungen: [], preis: preisProHund({ von: tag, bis }, d.preise), bemerkung: "",
      bezahlt: false, zahlungsart: "", betrag: 0, bezahltAm: "", erstellt: zeitstempel(), person: ich.name, uid: ich.uid,
    }), `${hund.name} in ${z.name} eingetragen`);
    if (ok) {
      setHund(null);
      setSuche("");
    }
  }

  if (hund) {
    return (
      <form className="zimmer-eintragen" onSubmit={speichernBuchung}>
        <strong>{hund.name} eintragen</strong>
        <label>Abholung<input type="date" value={bis} min={tag} onChange={(e) => setBis(e.target.value)} required /></label>
        {fehler && <p className="notice bad">{fehler}</p>}
        <div className="actions">
          <button className="btn small" disabled={!!fehler}>Eintragen</button>
          <button type="button" className="btn ghost small" onClick={() => setHund(null)}>Abbrechen</button>
        </div>
      </form>
    );
  }
  return (
    <div className="zimmer-eintragen">
      <input type="search" aria-label={`Hund eintragen in ${z.name}`} placeholder="Hund suchen und eintragen" value={suche} onChange={(e) => setSuche(e.target.value)} />
      {q && (
        <div className="zimmer-treffer">
          {treffer.length ? treffer.map(({ h, k }) => (
            <button key={h.id} type="button" className="chip" onClick={() => { setHund(h); setBis(plusTage(tag, 1)); }}>
              {h.name}{k ? ` · ${k.name}` : ""}
            </button>
          )) : <span className="hint">Kein Hund gefunden. Neue Hunde in der <Link to="/pension/kartei">Kartei</Link> erfassen.</span>}
        </div>
      )}
    </div>
  );
}

/**
 * Hundename im Zimmer, am heutigen Tag mit dem nächsten Schritt: Einchecken bei der Ankunft,
 * Auschecken mit Zahlung bei der Abholung (der Betrag geht als Vorschlag in den Kassenabschluss).
 */
function GastAktion({ g, tag, ersterDerBuchung, bearbeiten, offen, setOffen, zeigen }: {
  g: Gast; tag: string; ersterDerBuchung: boolean; bearbeiten: boolean; offen: boolean; setOffen: (o: boolean) => void; zeigen: (t: string) => void;
}) {
  const ich = useIch();
  const b = g.buchung;
  const heuteAktiv = bearbeiten && ersterDerBuchung && tag === heute();
  const einchecken = heuteAktiv && (b.status === "Anfrage" || b.status === "Bestätigt") && b.von <= tag;
  const auschecken = heuteAktiv && b.status === "Eingecheckt";
  const name = b.hunde.length > 1 && ersterDerBuchung ? b.hunde.map((h) => h.name).join(" + ") : g.hund.name;
  if (b.hunde.length > 1 && !ersterDerBuchung) return null;
  return (
    <div className={`zimmer-gastzeile${offen ? " offen" : ""}`}>
      <div className="zimmer-gastkopf">
        <Link className="pill zimmer-hund" to={`/pension/hund/${g.hund.id}`}>{name}</Link>
        {einchecken && (
          <button type="button" className="btn small" onClick={() => void speichern(zeigen, () => updateDoc(doc(db, "pension_buchungen", b.id), { status: "Eingecheckt", geaendertVon: ich.uid }), `${name} eingecheckt`)}>
            Einchecken
          </button>
        )}
        {auschecken && !offen && (
          <button type="button" className={`btn small${b.bis === tag ? "" : " ghost"}`} onClick={() => setOffen(true)}>Auschecken</button>
        )}
      </div>
      {offen && <Auschecken b={b} zeigen={zeigen} fertig={() => setOffen(false)} />}
    </div>
  );
}

export function Zimmer() {
  const d = usePension();
  const ich = useIch();
  const { zeigen, element } = useToast();
  const bearbeiten = darf(ich.rollen, "pension", STUFE.bearbeiten);
  const [tag, setTag] = useState(heute());
  const [checkout, setCheckout] = useState<string | null>(null);
  const raeume = zimmerAm(d, tag);
  const gaeste = raeume.flatMap((r) => r.gaeste.map((g) => ({ ...g, zimmer: r.zimmer.name })));

  return (
    <>
      <section className="panel" aria-labelledby="h-zi">
        <div className="panel-head">
          <h2 id="h-zi">Zimmer {wochentagKurz(tag)} {datum(tag)}</h2>
          <div className="actions no-print">
            <button type="button" className="btn ghost small" onClick={() => setTag(plusTage(tag, -1))} aria-label="Vortag">←</button>
            <button type="button" className="btn ghost small" onClick={() => setTag(heute())}>Heute</button>
            <button type="button" className="btn ghost small" onClick={() => setTag(plusTage(tag, 1))} aria-label="Folgetag">→</button>
            <button type="button" className="btn small" onClick={() => window.print()}>Drucken</button>
          </div>
        </div>
        <p className="hint">{gaeste.length ? `${gaeste.length} ${gaeste.length === 1 ? "Hund" : "Hunde"} im Haus · ${raeume.filter((r) => !r.gaeste.length).length} Zimmer frei` : "An diesem Tag ist kein Hund in der Pension."}</p>
        <div className="zimmer-raster">
          {raeume.map(({ zimmer: z, gaeste: g }) => (
            <article key={z.id} className={`item zimmer-karte${g.length ? "" : " frei"}`}>
              <div className="item-row">
                <strong>{z.name}</strong>
                <span className="pill">{g.length ? `${g.length} / ${z.maxHunde}` : "frei"}</span>
              </div>
              {g.length > 0 && (
                <div className="zimmer-namen">
                  {g.map((x, i) => (
                    <GastAktion key={`${x.buchung.id}-${x.hund.id}`} g={x} tag={tag} ersterDerBuchung={g.findIndex((y) => y.buchung.id === x.buchung.id) === i}
                      bearbeiten={bearbeiten} offen={checkout === x.buchung.id} setOffen={(o) => setCheckout(o ? x.buchung.id : null)} zeigen={zeigen} />
                  ))}
                </div>
              )}
              {bearbeiten && g.length < z.maxHunde && <div className="no-print"><Eintragen key={tag} z={z} tag={tag} zeigen={zeigen} /></div>}
            </article>
          ))}
        </div>
      </section>

      {gaeste.length > 0 && (
        <section className="panel" aria-labelledby="h-fm">
          <h2 id="h-fm">Fütterung und Medikamente</h2>
          <div className="tablewrap">
            <table className="futterplan">
              <thead><tr><th>Zimmer</th><th>Hund</th><th>Futter</th><th>Menge</th><th>Zeiten</th><th>Medikamente</th><th>Allergien</th></tr></thead>
              <tbody>
                {gaeste.map((g) => (
                  <tr key={`${g.buchung.id}-${g.hund.id}`}>
                    <td>{g.zimmer}</td>
                    <td><Link to={`/pension/hund/${g.hund.id}`}>{g.hund.name}</Link></td>
                    <td>{g.hund.futter || "–"}</td>
                    <td>{g.hund.menge || "–"}</td>
                    <td>{g.hund.fuetterungszeiten || "–"}</td>
                    <td className={g.hund.medikamente ? "warnzelle" : ""}>{g.hund.medikamente || "–"}</td>
                    <td>{g.hund.allergien || "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint no-print">Abhaken unter <Link to="/pension/tagesplan">Tagesplan</Link>. Angaben ändern im Stammblatt des Hundes.</p>
        </section>
      )}
      {element}
    </>
  );
}
