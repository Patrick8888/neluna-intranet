// Stammblatt: alle Angaben zu Halter/in und Hunden auf einer Seite, zum Prüfen mit der Kundschaft oder zum Ausdrucken.
import { Link, useParams } from "react-router";
import { datum, heute } from "../lib/format";
import { klassenName, type Hund } from "../lib/pension";
import { usePension } from "./daten";

function Zeile({ titel, wert }: { titel: string; wert?: string | null }) {
  return (
    <div className="sb-zeile">
      <span>{titel}</span>
      <b>{wert?.trim() || " "}</b>
    </div>
  );
}

export function HundBlatt({ h }: { h: Hund }) {
  const alter = h.geburtsdatum ? Math.floor((Date.parse(heute()) - Date.parse(h.geburtsdatum)) / (365.25 * 864e5)) : null;
  return (
    <section className="panel sb-block">
      <h2>{h.name}</h2>
      <div className="sb-raster">
        <Zeile titel="Rasse" wert={h.rasse} />
        <Zeile titel="Farbe / Aussehen" wert={h.farbe} />
        <Zeile titel="Geburtsdatum" wert={h.geburtsdatum ? `${datum(h.geburtsdatum)}${alter != null ? ` (${alter} Jahre)` : ""}` : ""} />
        <Zeile titel="Geschlecht" wert={[h.geschlecht, h.kastriert ? "kastriert" : h.geschlecht ? "nicht kastriert" : ""].filter(Boolean).join(", ")} />
        <Zeile titel="Chipnummer" wert={h.chipnummer} />
        <Zeile titel="Gewicht" wert={[h.gewicht ? `${h.gewicht} kg` : "", klassenName(h.gewichtsklasse)].filter(Boolean).join(" · ")} />
        {h.geschlecht === "Hündin" && <Zeile titel="Letzte Läufigkeit" wert={h.laeufigkeit} />}
        <Zeile titel="Verträglich mit Hunden" wert={h.vertraeglich ? "ja" : "nein"} />
      </div>
      <h3 className="lbl">Füttern und Gesundheit</h3>
      <div className="sb-raster">
        <Zeile titel="Futter" wert={h.futter} />
        <Zeile titel="Menge" wert={h.menge} />
        <Zeile titel="Fütterungszeiten" wert={h.fuetterungszeiten} />
        <Zeile titel="Leckerli / Kauartikel" wert={h.leckerli} />
        <Zeile titel="Allergien" wert={h.allergien} />
        <Zeile titel="Medikamente" wert={h.medikamente} />
      </div>
      <h3 className="lbl">Impfungen</h3>
      <div className="sb-raster">
        {h.impfungen.length ? h.impfungen.map((i) => <Zeile key={i.art + i.gueltigBis} titel={i.art} wert={`gültig bis ${datum(i.gueltigBis)}`} />) : <Zeile titel="Impfungen" wert="" />}
      </div>
      <h3 className="lbl">Verhalten und Gewohnheiten</h3>
      <div className="sb-raster">
        <Zeile titel="Freilauf" wert={h.freilauf} />
        <Zeile titel="Schlafplatz" wert={h.schlafplatz} />
        <Zeile titel="Kommandos" wert={h.kommandos} />
        <Zeile titel="Ängste" wert={h.aengste} />
        <Zeile titel="Spielverhalten" wert={h.spielverhalten} />
        <Zeile titel="Verhalten" wert={h.verhalten} />
        <Zeile titel="Besonderes" wert={h.notiz} />
      </div>
    </section>
  );
}

export function Stammblatt() {
  const { kundeId } = useParams();
  const d = usePension();
  const k = d.kunden.find((x) => x.id === kundeId);
  if (!k) return d.bereit ? <section className="panel"><p className="hint">Diesen Eintrag gibt es nicht.</p></section> : null;
  const hunde = d.hunde.filter((h) => h.kundeId === k.id);
  const aufenthalte = d.buchungen.filter((b) => b.kundeId === k.id && b.status !== "Storniert" && b.status !== "Anfrage");

  return (
    <div className="stammblatt">
      <div className="actions no-print">
        <Link className="btn ghost small" to={`/pension/kartei?kunde=${k.id}`}>Zurück zur Kartei</Link>
        <button type="button" className="btn small" onClick={() => window.print()}>Drucken</button>
      </div>
      <section className="panel sb-block">
        <div className="eyebrow">Stammblatt Hundepension Willisdorf · Stand {datum(heute())}</div>
        <h1>{k.name}</h1>
        <div className="sb-raster">
          <Zeile titel="Telefon" wert={k.telefon} />
          <Zeile titel="Telefon 2" wert={k.telefon2} />
          <Zeile titel="E-Mail" wert={k.email} />
          <Zeile titel="Adresse" wert={k.adresse} />
          <Zeile titel="Notfallkontakt" wert={k.notfallkontakt} />
          <Zeile titel="Tierarzt" wert={k.tierarzt} />
          <Zeile titel="Haftpflicht / Versicherung" wert={k.versicherung} />
          <Zeile titel="Aufenthalte bisher" wert={String(aufenthalte.length)} />
        </div>
        {k.notiz && <p>{k.notiz}</p>}
      </section>
      {hunde.map((h) => <HundBlatt key={h.id} h={h} />)}
      <section className="panel sb-block">
        <p className="hint">Die Angaben sind korrekt. Änderungen teile ich der Pension mit.</p>
        <div className="sb-raster">
          <Zeile titel="Ort, Datum" wert="" />
          <Zeile titel="Unterschrift Halter/in" wert="" />
        </div>
      </section>
    </div>
  );
}
