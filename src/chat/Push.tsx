// Push-Nachrichten: auf diesem Gerät einschalten und wählen, wofür.
import { useEffect, useState } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useIch } from "../auth";
import { meldung } from "../lib/fehler";
import { PUSH_ARTEN, pushErlaubt, type PushArt, type PushEinstellungen } from "../lib/push";
import { darf, STUFE } from "../lib/rollen";
import { iosOhneHomeBildschirm, pushAktiv, pushAusschalten, pushEinschalten, pushMoeglich } from "../push";

/** Knopf zum Einschalten auf diesem Gerät, mit Hinweisen, wenn es (noch) nicht geht. */
export function PushSchalter({ kurz = false }: { kurz?: boolean }) {
  const ich = useIch();
  const [moeglich, setMoeglich] = useState<boolean | null>(null);
  const [aktiv, setAktiv] = useState(pushAktiv);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState("");
  useEffect(() => { void pushMoeglich().then(setMoeglich); }, []);

  if (moeglich === null || (kurz && (aktiv || !moeglich))) return null;
  if (!moeglich) {
    return <p className="hint">{iosOhneHomeBildschirm()
      ? "Push-Nachrichten gibt es auf dem iPhone nur, wenn das Pfötli Buch auf dem Home-Bildschirm liegt: in Safari «Teilen» › «Zum Home-Bildschirm», dann von dort öffnen."
      : "Push-Nachrichten sind noch nicht eingerichtet oder werden von diesem Browser nicht unterstützt."}</p>;
  }

  async function umschalten() {
    setLaeuft(true);
    setFehler("");
    try {
      if (aktiv) await pushAusschalten();
      else await pushEinschalten(ich.uid);
      setAktiv(!aktiv);
    } catch (e) {
      setFehler(e instanceof Error && !("code" in e) ? e.message : meldung(e));
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <div className="actions">
      <button type="button" className={`btn small${aktiv ? " ghost" : ""}`} onClick={umschalten} disabled={laeuft}>
        {aktiv ? "Push auf diesem Gerät ausschalten" : "Push-Nachrichten auf diesem Gerät einschalten"}
      </button>
      {aktiv && !kurz && <span className="pill good">Auf diesem Gerät aktiv</span>}
      {fehler && <p className="notice bad wide" role="alert">{fehler}</p>}
    </div>
  );
}

export function PushEinstellungenPanel() {
  const ich = useIch();
  const [e, setE] = useState<PushEinstellungen>({});
  useEffect(() => onSnapshot(doc(db, "push_einstellungen", ich.uid), (s) => setE((s.data() as PushEinstellungen) ?? {}), () => {}), [ich.uid]);
  if (!darf(ich.rollen, "chat")) return null;
  const arten = (Object.keys(PUSH_ARTEN) as PushArt[]).filter((a) => (a !== "fahrten" || darf(ich.rollen, "fahrdienst")) && (a !== "aufgaben" || darf(ich.rollen, "aufgaben", STUFE.bearbeiten)));
  return (
    <section className="panel" aria-labelledby="h-push">
      <h2 id="h-push">Push-Nachrichten</h2>
      <p className="hint">Neue Nachrichten erscheinen auf dem Handy oder Computer, auch wenn das Pfötli Buch geschlossen ist. Auf jedem Gerät einzeln einschalten.</p>
      <PushSchalter />
      <fieldset>
        <legend className="lbl">Was soll eine Push-Nachricht auslösen?</legend>
        <div className="checks">
          {arten.map((a) => (
            <label key={a} className="check">
              <input type="checkbox" checked={pushErlaubt(e, a)} onChange={(x) => {
                const neu = x.target.checked;
                setE((alt) => ({ ...alt, [a]: neu }));
                void setDoc(doc(db, "push_einstellungen", ich.uid), { [a]: neu }, { merge: true });
              }} />
              {PUSH_ARTEN[a]}
            </label>
          ))}
        </div>
      </fieldset>
    </section>
  );
}
