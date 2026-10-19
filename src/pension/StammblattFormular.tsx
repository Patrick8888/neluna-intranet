// Öffentliches Stammblatt: die Kundschaft füllt es über den Link ohne Anmeldung aus.
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { heute } from "../lib/format";
import { GESCHLECHTER, IMPF_ARTEN } from "../lib/pension";
import {
  bereinigen, fehlt, KUNDE_FELDER, leereKundeAngaben, leererHundAngaben, MAX_HUNDE, MAX_IMPFUNGEN, type Antwort, type HundAngaben, type HundText,
} from "../lib/selbstauskunft";
import { Logos } from "../seiten/Logos";

type Zustand = "laedt" | "offen" | "ungueltig" | "gesendet";

const PLATZHALTER: Partial<Record<string, string>> = {
  nachname: "z. B. Meier", vorname: "z. B. Anna", adresse: "Strasse und Nummer", plzOrt: "z. B. 8253 Willisdorf", telefon: "079 123 45 67",
  notfallkontakt: "Name und Telefon", notfallkontakt2: "Name und Telefon", versicherung: "Gesellschaft und Police",
};

function Rahmen({ children }: { children: ReactNode }) {
  return (
    <div className="wrap login stammblatt-formular">
      <Logos />
      <main>
        <div style={{ textAlign: "center" }}>
          <div className="eyebrow">Hundepension NeLuna · Willisdorf</div>
          <h1>Stammblatt</h1>
        </div>
        {children}
      </main>
    </div>
  );
}

function HundTeil({ h, nr, setH, entfernen }: { h: HundAngaben; nr: number; setH: (x: Partial<HundAngaben>) => void; entfernen?: () => void }) {
  const feld = (k: HundText, titel: string, platzhalter = "", breit = false) => (
    <label className={breit ? "wide" : undefined}>
      {titel}
      {breit
        ? <textarea value={h[k]} onChange={(e) => setH({ [k]: e.target.value })} placeholder={platzhalter} />
        : <input value={h[k]} onChange={(e) => setH({ [k]: e.target.value })} placeholder={platzhalter} />}
    </label>
  );
  const impfung = (i: number, x: Partial<HundAngaben["impfungen"][number]>) => setH({ impfungen: h.impfungen.map((alt, j) => (j === i ? { ...alt, ...x } : alt)) });

  return (
    <section className="panel" aria-label={`Hund ${nr}`}>
      <div className="panel-head">
        <h2>{h.name.trim() || `Hund ${nr}`}</h2>
        {entfernen && <button type="button" className="btn ghost small" onClick={entfernen}>Entfernen</button>}
      </div>
      <div className="grid">
        <label>Name<input value={h.name} onChange={(e) => setH({ name: e.target.value })} required /></label>
        {feld("rasse", "Rasse")}
        <label>Geburtsdatum<input type="date" value={h.geburtsdatum} max={heute()} onChange={(e) => setH({ geburtsdatum: e.target.value })} /></label>
        <label>Geschlecht<select value={h.geschlecht} onChange={(e) => setH({ geschlecht: e.target.value })}><option value="">–</option>{GESCHLECHTER.map((g) => <option key={g}>{g}</option>)}</select></label>
        {feld("chipnummer", "Chip Nr.")}
        <label>Kastriert/Sterilisiert<select value={h.kastriert ? "ja" : "nein"} onChange={(e) => setH({ kastriert: e.target.value === "ja" })}><option value="nein">Nein</option><option value="ja">Ja</option></select></label>
        {feld("farbe", "Besondere Merkmale", "z. B. Farbe, Narbe, kupiertes Ohr")}
        <label>Gewicht kg<input inputMode="decimal" value={h.gewicht} onChange={(e) => setH({ gewicht: e.target.value })} placeholder="z. B. 28" /></label>
        {h.geschlecht === "Hündin" && feld("laeufigkeit", "Letzte Läufigkeit", "z. B. August 2026")}

        <h3 className="lbl wide">Gesundheitsinformationen</h3>
        {feld("tierarzt", "Tierarzt", "Praxis, Ort")}
        <label>Telefonnummer Tierarzt<input type="tel" value={h.tierarztTelefon} onChange={(e) => setH({ tierarztTelefon: e.target.value })} placeholder="052 123 45 67" /></label>
        {feld("allergien", "Allergien / Unverträglichkeiten")}
        {feld("gesundheit", "Gesundheitliche Probleme", "z. B. Arthrose, Herz, Epilepsie", true)}
        {feld("medikamente", "Medikamente", "Name, Dosis, wann", true)}
        <div className="wide">
          <div className="lbl">Impfungen</div>
          <div className="prows">
            {h.impfungen.map((i, n) => (
              <div key={n} className="impf-zeile">
                <input aria-label="Impfung" list="impfarten" value={i.art} onChange={(e) => impfung(n, { art: e.target.value })} placeholder="Impfung" />
                <input aria-label="Gültig bis" type="date" value={i.gueltigBis} onChange={(e) => impfung(n, { gueltigBis: e.target.value })} />
                <button type="button" className="btn danger small" onClick={() => setH({ impfungen: h.impfungen.filter((_, j) => j !== n) })}>Entfernen</button>
              </div>
            ))}
            {h.impfungen.length < MAX_IMPFUNGEN && <div><button type="button" className="btn ghost small" onClick={() => setH({ impfungen: [...h.impfungen, { art: "", gueltigBis: "" }] })}>Impfung hinzufügen</button></div>}
          </div>
        </div>

        <h3 className="lbl wide">Verhalten und Gewohnheiten</h3>
        <div className="lbl wide">Fütterungsanweisung</div>
        {feld("futter", "Futter", "Marke und Sorte")}
        {feld("menge", "Menge", "z. B. 2 × 150 g, morgens und abends")}
        {feld("fuetterungszeiten", "Fütterungszeiten", "z. B. 7 Uhr und 18 Uhr")}
        {feld("leckerli", "Leckerli / Kauartikel", "erlaubt, nicht erlaubt, eigene")}
        {feld("verhalten", "Besondere Verhaltensweise", "z. B. zieht an der Leine, bellt bei Besuch", true)}
        {feld("sozialverhalten", "Sozialverhalten", "z. B. mit Hündinnen gut, mit Rüden vorsichtig, liebt Kinder", true)}
        <label className="check wide"><input type="checkbox" checked={h.vertraeglich} onChange={(e) => setH({ vertraeglich: e.target.checked })} /> Verträglich mit anderen Hunden</label>
        {feld("freilauf", "Freilauf", "z. B. nur an der Leine, kommt auf Pfiff")}
        {feld("schlafplatz", "Schlafplatz", "z. B. eigenes Körbchen, mag es warm")}
        {feld("kommandos", "Kommandos", "z. B. Sitz, Platz, Bleib, Hier")}
        {feld("aengste", "Ängste", "z. B. Gewitter, Feuerwerk")}
        {feld("spielverhalten", "Spielverhalten", "z. B. liebt Bälle", true)}
        {feld("notiz", "Was wir sonst wissen sollten", "", true)}
      </div>
    </section>
  );
}

export function StammblattFormular({ token }: { token: string }) {
  const [zustand, setZustand] = useState<Zustand>("laedt");
  const [a, setA] = useState<Antwort>({ kunde: leereKundeAngaben(), hunde: [leererHundAngaben()] });
  const [fehler, setFehler] = useState("");
  const [laeuft, setLaeuft] = useState(false);

  useEffect(() => {
    let aktiv = true;
    getDoc(doc(db, "stammblatt_links", token))
      .then((snap) => {
        if (!aktiv) return;
        if (!snap.exists()) return setZustand("ungueltig");
        const vorlage = snap.data().vorlage;
        if (vorlage) {
          const v = bereinigen(vorlage);
          setA({ kunde: v.kunde, hunde: v.hunde.length ? v.hunde : [leererHundAngaben()] });
        }
        setZustand("offen");
      })
      .catch(() => aktiv && setZustand("ungueltig"));
    return () => { aktiv = false; };
  }, [token]);

  const setKunde = (k: string, v: string) => setA((x) => ({ ...x, kunde: { ...x.kunde, [k]: v } }));
  const setHund = (i: number, h: Partial<HundAngaben>) => setA((x) => ({ ...x, hunde: x.hunde.map((alt, j) => (j === i ? { ...alt, ...h } : alt)) }));

  async function absenden(e: FormEvent) {
    e.preventDefault();
    setFehler("");
    const sauber = bereinigen(a);
    const fehlend = fehlt({ kunde: sauber.kunde, hunde: a.hunde.map((h) => ({ ...h, name: h.name.trim() })) });
    if (fehlend) return setFehler(fehlend);
    setLaeuft(true);
    try {
      const b = writeBatch(db);
      b.set(doc(db, "stammblatt_antworten", token), { ...sauber, eingegangen: serverTimestamp() });
      b.update(doc(db, "stammblatt_links", token), { status: "ausgefuellt" });
      await b.commit();
      setZustand("gesendet");
      window.scrollTo({ top: 0 });
    } catch {
      setFehler("Das Absenden hat nicht geklappt. Vielleicht ist der Link abgelaufen oder wurde schon benutzt. Bitte melden Sie sich bei uns.");
    } finally {
      setLaeuft(false);
    }
  }

  if (zustand === "laedt") return <Rahmen><p className="hint" style={{ textAlign: "center" }}>Lädt …</p></Rahmen>;
  if (zustand === "ungueltig") {
    return (
      <Rahmen>
        <p className="notice">Dieser Link ist abgelaufen oder wurde schon benutzt. Bitte melden Sie sich bei der Hundepension NeLuna, wir schicken Ihnen gerne einen neuen.</p>
      </Rahmen>
    );
  }
  if (zustand === "gesendet") {
    return (
      <Rahmen>
        <p className="notice good" role="status">Herzlichen Dank! Ihre Angaben sind bei uns angekommen. Wir freuen uns auf {a.hunde.map((h) => h.name.trim()).filter(Boolean).join(" und ")}.</p>
      </Rahmen>
    );
  }

  return (
    <Rahmen>
      <form onSubmit={absenden}>
        <p className="hint">Bitte füllen Sie das Stammblatt vor dem ersten Aufenthalt aus. Felder mit Stern sind nötig, alles andere hilft uns, Ihren Hund gut zu betreuen.</p>
        <section className="panel" aria-label="Halter/in">
          <h2>Halter/in</h2>
          <div className="grid">
            {KUNDE_FELDER.filter(([k]) => k !== "notiz").map(([k, titel]) => {
              const noetig = k === "nachname" || k === "vorname" || k === "telefon";
              return (
                <label key={k}>{titel}{noetig && " *"}
                  <input value={a.kunde[k]} onChange={(e) => setKunde(k, e.target.value)} placeholder={PLATZHALTER[k]} required={noetig}
                    type={k === "email" ? "email" : k === "geburtsdatum" ? "date" : k.startsWith("telefon") ? "tel" : "text"} max={k === "geburtsdatum" ? heute() : undefined}
                    autoComplete={{ nachname: "family-name", vorname: "given-name", adresse: "street-address", email: "email", telefon: "tel" }[k as string]} />
                </label>
              );
            })}
          </div>
        </section>
        {a.hunde.map((h, i) => (
          <HundTeil key={i} h={h} nr={i + 1} setH={(x) => setHund(i, x)}
            entfernen={a.hunde.length > 1 ? () => setA((x) => ({ ...x, hunde: x.hunde.filter((_, j) => j !== i) })) : undefined} />
        ))}
        {a.hunde.length < MAX_HUNDE && (
          <p><button type="button" className="btn ghost" onClick={() => setA((x) => ({ ...x, hunde: [...x.hunde, leererHundAngaben()] }))}>Weiteren Hund hinzufügen</button></p>
        )}
        <section className="panel">
          <label>Bemerkungen<textarea value={a.kunde.notiz} onChange={(e) => setKunde("notiz", e.target.value)} placeholder="z. B. wer den Hund abholen darf" /></label>
          {fehler && <p className="notice bad" role="alert">{fehler}</p>}
          <p className="hint">Ihre Angaben sehen nur das Team der Hundepension NeLuna. Wir brauchen sie für die Betreuung und im Notfall.</p>
          <button className="btn" disabled={laeuft}>{laeuft ? "Wird gesendet …" : "Stammblatt absenden"}</button>
        </section>
        <datalist id="impfarten">{IMPF_ARTEN.map((x) => <option key={x} value={x} />)}</datalist>
      </form>
    </Rahmen>
  );
}
