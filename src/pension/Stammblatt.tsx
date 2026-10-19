// Stammblatt: alle Angaben zu Halter/in und Hunden auf einer Seite, zum Prüfen mit der Kundschaft oder zum Ausdrucken.
import { Link, useParams } from "react-router";
import { datum, heute } from "../lib/format";
import { klassenName, type Hund, type Kunde } from "../lib/pension";
import { usePension } from "./daten";

function Zeile({ titel, wert }: { titel: string; wert?: string | null }) {
  return (
    <div className="sb-zeile">
      <span>{titel}</span>
      <b>{wert?.trim() || " "}</b>
    </div>
  );
}

export function HundBlatt({ h, kunde }: { h: Hund; kunde?: Kunde }) {
  const alter = h.geburtsdatum ? Math.floor((Date.parse(heute()) - Date.parse(h.geburtsdatum)) / (365.25 * 864e5)) : null;
  return (
    <section className="panel sb-block">
      <h2>{h.name}</h2>
      <div className="sb-raster">
        <Zeile titel="Name" wert={h.name} />
        <Zeile titel="Rasse" wert={h.rasse} />
        <Zeile titel="Geburtsdatum" wert={h.geburtsdatum ? `${datum(h.geburtsdatum)}${alter != null ? ` (${alter} Jahre)` : ""}` : ""} />
        <Zeile titel="Geschlecht" wert={h.geschlecht} />
        <Zeile titel="Chip Nr." wert={h.chipnummer} />
        <Zeile titel="Kastriert/Sterilisiert" wert={h.kastriert ? "Ja" : "Nein"} />
        <Zeile titel="Besondere Merkmale" wert={h.farbe} />
        <Zeile titel="Gewicht" wert={[h.gewicht ? `${h.gewicht} kg` : "", klassenName(h.gewichtsklasse)].filter(Boolean).join(" · ")} />
        {h.geschlecht === "Hündin" && <Zeile titel="Letzte Läufigkeit" wert={h.laeufigkeit} />}
      </div>
      <h3 className="lbl">Gesundheitsinformationen</h3>
      <div className="sb-raster">
        <Zeile titel="Tierarzt" wert={h.tierarzt || kunde?.tierarzt} />
        <Zeile titel="Telefonnummer Tierarzt" wert={h.tierarztTelefon} />
        <Zeile titel="Allergien" wert={h.allergien} />
        <Zeile titel="Gesundheitliche Probleme" wert={h.gesundheit} />
        <Zeile titel="Medikamente" wert={h.medikamente} />
        {h.impfungen.length ? h.impfungen.map((i) => <Zeile key={i.art + i.gueltigBis} titel={`Impfung ${i.art}`} wert={`gültig bis ${datum(i.gueltigBis)}`} />) : <Zeile titel="Impfungen" wert="" />}
      </div>
      <h3 className="lbl">Verhalten und Gewohnheiten</h3>
      <div className="sb-raster">
        <Zeile titel="Fütterungsanweisung" wert={[h.futter, h.menge, h.fuetterungszeiten].filter((x) => x?.trim()).join(" · ")} />
        <Zeile titel="Leckerli / Kauartikel" wert={h.leckerli} />
        <Zeile titel="Besondere Verhaltensweise" wert={h.verhalten} />
        <Zeile titel="Sozialverhalten" wert={[h.vertraeglich ? "verträglich mit anderen Hunden" : "nicht verträglich mit anderen Hunden", h.sozialverhalten].filter((x) => x?.trim()).join(" · ")} />
        <Zeile titel="Freilauf" wert={h.freilauf} />
        <Zeile titel="Schlafplatz" wert={h.schlafplatz} />
        <Zeile titel="Kommandos" wert={h.kommandos} />
        <Zeile titel="Ängste" wert={h.aengste} />
        <Zeile titel="Spielverhalten" wert={h.spielverhalten} />
        <Zeile titel="Besonderes" wert={h.notiz} />
      </div>
    </section>
  );
}

/** Notfallkontakte der Halter/in, auf beiden Stammblättern gleich. */
export function Notfall({ k }: { k: Kunde }) {
  return (
    <div className="sb-raster">
      <Zeile titel="Notfallkontakt 1" wert={k.notfallkontakt} />
      <Zeile titel="Notfallkontakt 2" wert={k.notfallkontakt2} />
    </div>
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
          <Zeile titel="Name" wert={k.vorname || k.nachname ? k.nachname : k.name} />
          <Zeile titel="Vorname" wert={k.vorname} />
          <Zeile titel="Adresse" wert={k.adresse} />
          <Zeile titel="PLZ/Ort" wert={k.plzOrt} />
          <Zeile titel="Geburtsdatum" wert={k.geburtsdatum ? datum(k.geburtsdatum) : ""} />
          <Zeile titel="Telefonnummer" wert={k.telefon} />
          <Zeile titel="E-Mail" wert={k.email} />
          <Zeile titel="Telefon 2" wert={k.telefon2} />
          <Zeile titel="Haftpflicht / Versicherung" wert={k.versicherung} />
          <Zeile titel="Aufenthalte bisher" wert={String(aufenthalte.length)} />
        </div>
        <h3 className="lbl">Notfallkontakte</h3>
        <Notfall k={k} />
        {k.notiz && <p>{k.notiz}</p>}
      </section>
      {hunde.map((h) => <HundBlatt key={h.id} h={h} kunde={k} />)}
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
