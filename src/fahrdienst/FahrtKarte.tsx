// Eine Fahrt mit Adresse zum Antippen, Telefon und den nächsten Schritten.
import { Link } from "react-router";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useIch } from "../auth";
import { datum, wochentagKurz } from "../lib/format";
import { kartenLink, type Fahrt, type FahrtStatus } from "../lib/fahrdienst";
import { darf, STUFE } from "../lib/rollen";
import { speichern } from "../ui";

export const fahrtFarbe: Record<FahrtStatus, string> = { Geplant: "acc", Unterwegs: "warn", Erledigt: "good", Abgesagt: "bad" };

export function FahrtKarte({ f, zeigen, mitDatum = false }: { f: Fahrt; zeigen: (t: string) => void; mitDatum?: boolean }) {
  const ich = useIch();
  const bearbeiten = darf(ich.rollen, "fahrdienst", STUFE.bearbeiten);
  const meine = f.fahrerUid === ich.uid;
  const status = (neu: FahrtStatus, ok: string) =>
    speichern(zeigen, () => updateDoc(doc(db, "fahrten", f.id), { status: neu, geaendertVon: ich.uid }), ok);
  const fertig = f.status === "Erledigt" || f.status === "Abgesagt";

  return (
    <article className={`item${fertig ? " done" : ""}${meine && !fertig ? " important" : ""}`}>
      <div className="item-row">
        <strong>
          {f.zeit && <span className="zeit">{f.zeit}</span>}
          {f.richtung === "Hinweg" ? "Abholen" : "Nach Hause bringen"}: {f.hunde.map((h) => h.name).join(", ") || f.kundeName}
        </strong>
        <span className={`pill ${fahrtFarbe[f.status]}`}>{f.status}</span>
      </div>
      <div className="meta">
        {mitDatum && <span>{wochentagKurz(f.datum)} {datum(f.datum)}</span>}
        <span className="pill">{f.richtung}</span>
        <span>{f.kundeName}</span>
        {f.telefon && <a href={`tel:${f.telefon.replace(/\s/g, "")}`}>{f.telefon}</a>}
      </div>
      <a className="adresse" href={kartenLink(f.adresse)} target="_blank" rel="noreferrer">{f.adresse}</a>
      <div className="meta">
        <span>{f.fahrerName ? `Fahrer/in: ${f.fahrerName}` : <span className="pill warn">Noch niemand eingeteilt</span>}</span>
        {f.fahrzeugName && <span>{f.fahrzeugName}</span>}
      </div>
      {f.notiz && <p>{f.notiz}</p>}
      {(bearbeiten || meine) && (
        <div className="actions">
          {f.status === "Geplant" && <button type="button" className="btn small" onClick={() => status("Unterwegs", "Gute Fahrt")}>Losfahren</button>}
          {(f.status === "Geplant" || f.status === "Unterwegs") && (
            <button type="button" className={`btn small${f.status === "Geplant" ? " ghost" : ""}`} onClick={() => status("Erledigt", "Fahrt erledigt")}>Erledigt</button>
          )}
          {fertig && <button type="button" className="btn ghost small" onClick={() => status("Geplant", "Wieder offen")}>Wieder öffnen</button>}
          {bearbeiten && <Link className="btn ghost small" to={`/fahrdienst/plan?fahrt=${f.id}`}>Bearbeiten</Link>}
        </div>
      )}
    </article>
  );
}
