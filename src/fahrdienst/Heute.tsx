// Fahreransicht: die Fahrten eines Tages in Reihenfolge, die eigenen zuerst.
import { useState } from "react";
import { useIch } from "../auth";
import { datum, heute, plusTage, wochentagKurz } from "../lib/format";
import { tagesRoute } from "../lib/fahrdienst";
import { useToast } from "../ui";
import { FahrtKarte } from "./FahrtKarte";
import { useFahrdienst } from "./daten";

export function FahrdienstHeute() {
  const ich = useIch();
  const d = useFahrdienst();
  const { zeigen, element } = useToast();
  const [tag, setTag] = useState(heute());
  const alle = tagesRoute(d.fahrten, tag);
  const meine = alle.filter((f) => f.fahrerUid === ich.uid);
  const andere = alle.filter((f) => f.fahrerUid !== ich.uid);
  const offen = alle.filter((f) => f.status === "Geplant" || f.status === "Unterwegs").length;

  return (
    <>
      <section className="panel" aria-labelledby="h-fh">
        <div className="panel-head">
          <h2 id="h-fh">Fahrten {wochentagKurz(tag)} {datum(tag)}</h2>
          <div className="actions">
            <button type="button" className="btn ghost small" onClick={() => setTag(plusTage(tag, -1))} aria-label="Vortag">←</button>
            <input type="date" aria-label="Datum" value={tag} onChange={(e) => setTag(e.target.value || heute())} style={{ width: "auto" }} />
            <button type="button" className="btn ghost small" onClick={() => setTag(plusTage(tag, 1))} aria-label="Folgetag">→</button>
          </div>
        </div>
        <p className="hint">
          {alle.length ? `${alle.length} ${alle.length === 1 ? "Fahrt" : "Fahrten"}, davon ${offen} offen.` : "An diesem Tag sind keine Fahrten geplant."} Tippe auf die Adresse, um die Karten-App zu öffnen.
        </p>
      </section>
      {meine.length > 0 && (
        <section className="panel" aria-labelledby="h-meine">
          <h2 id="h-meine">Meine Fahrten</h2>
          <div className="list">{meine.map((f) => <FahrtKarte key={f.id} f={f} zeigen={zeigen} />)}</div>
        </section>
      )}
      {andere.length > 0 && (
        <section className="panel" aria-labelledby="h-andere">
          <h2 id="h-andere">{meine.length ? "Weitere Fahrten" : "Alle Fahrten"}</h2>
          <div className="list">{andere.map((f) => <FahrtKarte key={f.id} f={f} zeigen={zeigen} />)}</div>
        </section>
      )}
      {element}
    </>
  );
}
