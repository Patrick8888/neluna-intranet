// Tagesübersicht: wer kommt, wer geht, wer ist im Haus.
import { Link } from "react-router";
import { useIch } from "../auth";
import { heute, plusTage, stunde } from "../lib/format";
import { belegteTage, istDa } from "../lib/pension";
import { darf, STUFE } from "../lib/rollen";
import { useToast } from "../ui";
import { BuchungKarte } from "./BuchungKarte";
import { usePension } from "./daten";

export function Heute() {
  const ich = useIch();
  const d = usePension();
  const { zeigen, element } = useToast();
  const tag = heute();
  const aktiv = d.buchungen.filter((b) => b.status !== "Storniert");
  const ankuenfte = aktiv.filter((b) => b.von === tag).sort((a, b) => a.zimmerId.localeCompare(b.zimmerId));
  const abholungen = aktiv.filter((b) => b.bis === tag && b.von !== tag && b.status !== "Anfrage");
  const imHaus = aktiv.filter((b) => b.status === "Eingecheckt" && b.von !== tag && b.bis !== tag);
  const anfragen = aktiv.filter((b) => b.status === "Anfrage" && b.von > tag).sort((a, b) => a.von.localeCompare(b.von));
  const naechste = aktiv.filter((b) => b.status === "Bestätigt" && b.von > tag && b.von <= plusTage(tag, 7)).sort((a, b) => a.von.localeCompare(b.von));
  const hundeHeute = aktiv.filter((b) => istDa(b, tag)).reduce((n, b) => n + b.hunde.length, 0);
  const plaetze = d.zimmer.filter((z) => z.aktiv).reduce((n, z) => n + z.maxHunde, 0);
  const belegtHeute = aktiv.filter((b) => {
    const [s, e] = belegteTage(b);
    return s <= tag && tag <= e && b.status !== "Anfrage";
  }).reduce((n, b) => n + b.hunde.length, 0);
  const kasseFehlt = darf(ich.rollen, "pension_kasse", STUFE.bearbeiten) && d.bereit && stunde() >= 17 && !d.kasse.some((k) => k.datum === tag);

  const liste = (titel: string, eintraege: typeof aktiv, leer: string) => (
    <section className="panel">
      <h2>{titel}</h2>
      <div className="list">
        {eintraege.length ? eintraege.map((b) => <BuchungKarte key={b.id} b={b} zeigen={zeigen} />) : <div className="empty">{leer}</div>}
      </div>
    </section>
  );

  return (
    <>
      {kasseFehlt && (
        <p className="notice">
          Der Kassenabschluss für heute fehlt noch. <Link to="/pension/kasse">Jetzt Schritt für Schritt abschliessen</Link>
        </p>
      )}
      <section className="panel" aria-labelledby="h-ph">
        <h2 id="h-ph">Heute in der Pension</h2>
        <div className="calc">
          <div><span>Hunde im Haus</span><b>{hundeHeute}</b></div>
          <div><span>Ankünfte</span><b>{ankuenfte.length}</b></div>
          <div><span>Abholungen</span><b>{abholungen.length}</b></div>
          <div><span>Freie Plätze heute Nacht</span><b>{Math.max(0, plaetze - belegtHeute)} von {plaetze}</b></div>
        </div>
      </section>
      {liste("Ankünfte heute", ankuenfte, "Heute kommt kein Hund an.")}
      {liste("Abholungen heute", abholungen, "Heute wird kein Hund abgeholt.")}
      {liste("Im Haus", imHaus, "Sonst ist kein Hund eingecheckt.")}
      {anfragen.length > 0 && liste("Offene Anfragen", anfragen, "")}
      {liste("Nächste 7 Tage", naechste, "In den nächsten 7 Tagen sind keine Ankünfte bestätigt.")}
      {element}
    </>
  );
}
