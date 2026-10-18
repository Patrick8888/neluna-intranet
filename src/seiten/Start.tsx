import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { useIch } from "../auth";
import { datum, heute } from "../lib/format";
import { faelligeTermine, kartenLink, tagesRoute, type Fahrt, type Fahrzeug, type FahrzeugTermin } from "../lib/fahrdienst";
import { BEREICHE } from "../lib/navigation";
import { darf, ROLLEN, STUFE } from "../lib/rollen";

/** Abends erinnern, wenn der Kassenabschluss der Pension fehlt (er ist dort neu). */
function KassenErinnerung({ stunde }: { stunde: number }) {
  const [fehlt, setFehlt] = useState(false);
  useEffect(() => onSnapshot(doc(db, "kasse", `pension_${heute()}`), (snap) => setFehlt(!snap.exists()), () => setFehlt(false)), []);
  if (!fehlt || stunde < 17) return null;
  return (
    <p className="notice">
      Der Kassenabschluss der Pension fehlt heute noch. <Link to="/pension/kasse">Jetzt Schritt für Schritt abschliessen</Link>
    </p>
  );
}

/** Die eigenen Fahrten von heute, mit Adresse zum Antippen. */
function MeineFahrten() {
  const ich = useIch();
  const [fahrten, setFahrten] = useState<Fahrt[]>([]);
  useEffect(
    () =>
      onSnapshot(
        query(collection(db, "fahrten"), where("fahrerUid", "==", ich.uid), where("datum", "==", heute())),
        (snap) => setFahrten(snap.docs.map((x) => ({ id: x.id, ...x.data() }) as Fahrt)),
        () => setFahrten([]),
      ),
    [ich.uid],
  );
  const route = tagesRoute(fahrten, heute()).filter((f) => f.status !== "Erledigt");
  if (!route.length) return null;
  return (
    <section className="panel" aria-labelledby="h-mf">
      <div className="panel-head">
        <h2 id="h-mf">Deine Fahrten heute</h2>
        <Link className="btn ghost small" to="/fahrdienst/heute">Zum Fahrdienst</Link>
      </div>
      <div className="list">
        {route.map((f) => (
          <div key={f.id} className="item">
            <strong>{f.zeit && `${f.zeit} · `}{f.richtung === "Hinweg" ? "Abholen" : "Nach Hause bringen"}: {(f.hunde ?? []).map((h) => h.name).join(", ") || f.kundeName}</strong>
            <a className="adresse" href={kartenLink(f.adresse)} target="_blank" rel="noreferrer">{f.adresse}</a>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Garagen- und Unterhaltstermine, die bald fällig sind. */
function FaelligeTermine() {
  const [fahrzeuge, setFahrzeuge] = useState<Fahrzeug[]>([]);
  const [termine, setTermine] = useState<FahrzeugTermin[]>([]);
  useEffect(() => {
    const a = onSnapshot(collection(db, "fahrzeuge"), (snap) => setFahrzeuge(snap.docs.map((x) => ({ id: x.id, ...x.data() }) as Fahrzeug)), () => setFahrzeuge([]));
    const b = onSnapshot(query(collection(db, "fahrzeug_termine"), where("erledigt", "==", false)), (snap) => setTermine(snap.docs.map((x) => ({ id: x.id, ...x.data() }) as FahrzeugTermin)), () => setTermine([]));
    return () => { a(); b(); };
  }, []);
  const faellig = faelligeTermine(termine, fahrzeuge, heute(), 14);
  if (!faellig.length) return null;
  return (
    <section className="panel" aria-labelledby="h-ft">
      <h2 id="h-ft">Fahrzeuge: bald fällig</h2>
      <div className="list">
        {faellig.map(({ termin: t, fahrzeug, ueberfaellig, grund }) => (
          <Link key={t.id} to={`/fahrdienst/fahrzeuge?fahrzeug=${t.fahrzeugId}`} className={`notice${ueberfaellig ? " bad" : ""}`}>
            {t.art} {fahrzeug?.name}: {grund || `${ueberfaellig ? "überfällig seit" : "am"} ${datum(t.datum)}`}
          </Link>
        ))}
      </div>
    </section>
  );
}

function begruessung(stunde: number) {
  if (stunde < 11) return "Guten Morgen";
  if (stunde < 17) return "Guten Tag";
  return "Guten Abend";
}

export function Start() {
  const ich = useIch();
  const [params] = useSearchParams();
  const jetzt = new Date();
  const stunde = Number(
    new Intl.DateTimeFormat("de-CH", { hour: "numeric", hourCycle: "h23", timeZone: "Europe/Zurich" })
      .formatToParts(jetzt)
      .find((t) => t.type === "hour")?.value,
  );
  const datum = jetzt.toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Zurich" });
  const meine = BEREICHE.filter((x) => darf(ich.rollen, x.modul));

  return (
    <>
      {params.has("kein-zugriff") && <p className="notice bad">Für diesen Bereich fehlt dir die Berechtigung.</p>}
      {darf(ich.rollen, "pension_kasse", STUFE.bearbeiten) && <KassenErinnerung stunde={stunde} />}
      <section className="panel">
        <div className="eyebrow">{datum}</div>
        <h1>{begruessung(stunde)}, {ich.name.split(" ")[0]}</h1>
        <p className="muted" style={{ margin: 0 }}>
          {ich.rollen.length ? ich.rollen.map((r) => ROLLEN[r]).join(" · ") : "Noch keine Rolle zugewiesen. Bitte bei Patrick Schaub melden."}
        </p>
      </section>

      {darf(ich.rollen, "fahrdienst") && <MeineFahrten />}
      {darf(ich.rollen, "fahrzeuge", STUFE.bearbeiten) && <FaelligeTermine />}

      <section className="panel" aria-labelledby="h-bereiche">
        <h2 id="h-bereiche">Deine Bereiche</h2>
        <div className="kacheln">
          {meine.map((x) =>
            x.pfad ? (
              <Link key={x.modul} to={x.pfad} className="kachel">
                <strong>{x.titel}</strong>
                <span className="hint">{x.beschreibung}</span>
              </Link>
            ) : (
              <div key={x.modul} className="kachel bald">
                <strong>{x.titel}</strong>
                <span className="hint">{x.beschreibung}</span>
                <span><span className="pill">Kommt in Phase {x.phase}</span></span>
              </div>
            ),
          )}
        </div>
      </section>
    </>
  );
}
