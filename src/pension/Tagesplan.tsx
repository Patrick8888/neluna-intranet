// Tagesplan: pro Hund im Haus füttern, Spaziergänge und Medikamente abhaken. Wer hat es wann erledigt.
import { useEffect, useState } from "react";
import { deleteField, doc, FieldPath, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useIch } from "../auth";
import { datum, heute, plusTage, vorname, wochentagKurz, zeitstempel } from "../lib/format";
import { meldung } from "../lib/fehler";
import { aufgabenFuer, istDa, type Hund } from "../lib/pension";
import { speichern, useToast } from "../ui";
import { usePension } from "./daten";

type Erledigt = Record<string, { person: string; zeit: string }>;
type Plan = { erledigt: Erledigt; notizen: Record<string, string> };

function usePlan(tag: string): [Plan, string] {
  const [plan, setPlan] = useState<Plan>({ erledigt: {}, notizen: {} });
  const [fehler, setFehler] = useState("");
  useEffect(
    () =>
      onSnapshot(
        doc(db, "pension_tagesplan", tag),
        (snap) => setPlan({ erledigt: snap.get("erledigt") ?? {}, notizen: snap.get("notizen") ?? {} }),
        (err) => setFehler(meldung(err)),
      ),
    [tag],
  );
  return [plan, fehler];
}

function Notiz({ tag, hundId, wert, zeigen }: { tag: string; hundId: string; wert: string; zeigen: (t: string) => void }) {
  const [text, setText] = useState(wert);
  return (
    <label className="wide">
      Auffälligkeiten
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => text !== wert && speichern(zeigen, () => setDoc(doc(db, "pension_tagesplan", tag), { notizen: { [hundId]: text.trim() } }, { merge: true }), "Notiz gespeichert")}
        placeholder="z. B. frisst wenig, Durchfall, humpelt"
      />
    </label>
  );
}

export function Tagesplan() {
  const ich = useIch();
  const d = usePension();
  const { zeigen, element } = useToast();
  const [tag, setTag] = useState(heute());
  const [plan, fehler] = usePlan(tag);
  const gaeste = d.buchungen
    .filter((b) => istDa(b, tag))
    .flatMap((b) => b.hunde.map((x) => ({ b, hund: d.hunde.find((h) => h.id === x.id) ?? ({ id: x.id, name: x.name, medikamente: "" } as Hund) })))
    .sort((a, b) => a.b.zimmerId.localeCompare(b.b.zimmerId) || a.hund.name.localeCompare(b.hund.name));
  const alle = gaeste.flatMap(({ hund }) => aufgabenFuer(hund).map(([k]) => `${hund.id}:${k}`));
  const fertig = alle.filter((k) => plan.erledigt[k]).length;

  function abhaken(schluessel: string, an: boolean) {
    const ref = doc(db, "pension_tagesplan", tag);
    return speichern(
      zeigen,
      () => (an
        ? setDoc(ref, { erledigt: { [schluessel]: { person: ich.name, zeit: zeitstempel().slice(11, 16) } } }, { merge: true })
        : updateDoc(ref, new FieldPath("erledigt", schluessel), deleteField())),
      an ? "Erledigt" : "Zurückgesetzt",
    );
  }

  return (
    <>
      <section className="panel" aria-labelledby="h-tp">
        <div className="panel-head">
          <h2 id="h-tp">Tagesplan {wochentagKurz(tag)} {datum(tag)}</h2>
          <div className="actions">
            <button type="button" className="btn ghost small" onClick={() => setTag(plusTage(tag, -1))} aria-label="Vortag">←</button>
            <input type="date" aria-label="Datum" value={tag} onChange={(e) => setTag(e.target.value || heute())} style={{ width: "auto" }} />
            <button type="button" className="btn ghost small" onClick={() => setTag(plusTage(tag, 1))} aria-label="Folgetag">→</button>
          </div>
        </div>
        {fehler && <p className="notice bad">{fehler}</p>}
        <p className="hint">{gaeste.length ? `${fertig} von ${alle.length} Aufgaben erledigt · ${gaeste.length} ${gaeste.length === 1 ? "Hund" : "Hunde"} im Haus` : "An diesem Tag ist kein Hund in der Pension."}</p>
      </section>
      {gaeste.map(({ b, hund }) => {
        const zimmer = d.zimmer.find((z) => z.id === b.zimmerId);
        return (
          <section key={`${b.id}-${hund.id}`} className="panel">
            <div className="panel-head">
              <h2>{hund.name}</h2>
              <div className="meta">
                <span className="pill acc">{zimmer?.name}</span>
                {b.von === tag && <span className="pill good">Ankunft</span>}
                {b.bis === tag && <span className="pill warn">Abholung</span>}
              </div>
            </div>
            <div className="meta">
              {hund.futter && <span>Futter: {hund.futter}{hund.menge ? ` · ${hund.menge}` : ""}</span>}
              {hund.allergien && <span className="pill bad">Allergie: {hund.allergien}</span>}
              {!hund.vertraeglich && <span className="pill bad">nicht verträglich</span>}
            </div>
            {hund.medikamente && <p className="notice">Medikamente: {hund.medikamente}</p>}
            {hund.verhalten && <p className="hint">{hund.verhalten}</p>}
            <div className="aufgaben">
              {aufgabenFuer(hund).map(([k, titel]) => {
                const schluessel = `${hund.id}:${k}`;
                const e = plan.erledigt[schluessel];
                return (
                  <label key={k} className={`check aufgabe${e ? " erledigt" : ""}`}>
                    <input type="checkbox" checked={!!e} onChange={(x) => abhaken(schluessel, x.target.checked)} />
                    <span>{titel}</span>
                    {e && <span className="hint">{vorname(e.person)} {e.zeit}</span>}
                  </label>
                );
              })}
            </div>
            <Notiz key={tag + hund.id + (plan.notizen[hund.id] ?? "")} tag={tag} hundId={hund.id} wert={plan.notizen[hund.id] ?? ""} zeigen={zeigen} />
          </section>
        );
      })}
      {element}
    </>
  );
}
