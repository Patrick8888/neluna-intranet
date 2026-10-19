import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { sendPasswordResetEmail } from "firebase/auth";
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { auth, db, kontoAnlegen } from "../firebase";
import { alsBenutzer, useIch, type Benutzer } from "../auth";
import { meldung } from "../lib/fehler";
import { vollerName } from "../lib/format";
import { zufallsPasswort } from "../lib/passwort";
import { ALLE_ROLLEN, istRolle, ROLLEN, type Rolle } from "../lib/rollen";

type Zustand = { fehler?: string; ok?: string };

function Meldung({ z }: { z: Zustand }) {
  if (z.fehler) return <p className="notice bad" role="alert">{z.fehler}</p>;
  if (z.ok) return <p className="notice good" role="status">{z.ok}</p>;
  return null;
}

const protokoll = (uid: string, aktion: string, details: unknown) =>
  addDoc(collection(db, "protokoll"), { uid, aktion, details, zeit: serverTimestamp() }).catch(() => {});

function felder(form: HTMLFormElement) {
  const f = new FormData(form);
  const pensumText = String(f.get("pensum") ?? "").trim();
  const pensum = pensumText ? Math.round(Number(pensumText)) : null;
  const vorname = String(f.get("vorname") ?? "").trim();
  const nachname = String(f.get("nachname") ?? "").trim();
  return {
    name: vollerName(vorname, nachname),
    vorname,
    nachname,
    telefon: String(f.get("telefon") ?? "").trim() || null,
    funktion: String(f.get("funktion") ?? "").trim() || null,
    pensum: pensum != null && Number.isFinite(pensum) ? pensum : null,
    rollen: f.getAll("rolle").map(String).filter(istRolle) as Rolle[],
  };
}

function RollenAuswahl({ gewaehlt = [] }: { gewaehlt?: Rolle[] }) {
  return (
    <fieldset className="wide">
      <legend>Rollen</legend>
      <div className="checks">
        {ALLE_ROLLEN.map((r) => (
          <label key={r} className="check">
            <input type="checkbox" name="rolle" value={r} defaultChecked={gewaehlt.includes(r)} />
            {ROLLEN[r]}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function NeuePerson() {
  const ich = useIch();
  const [z, setZ] = useState<Zustand>({});
  const [laeuft, setLaeuft] = useState(false);

  async function anlegen(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = felder(form);
    const email = String(new FormData(form).get("email") ?? "").trim().toLowerCase();
    if (!f.vorname || !f.nachname || !email.includes("@")) return setZ({ fehler: "Bitte Name, Vorname und gültige E-Mail angeben." });
    setLaeuft(true);
    try {
      const uid = await kontoAnlegen(email, zufallsPasswort());
      await setDoc(doc(db, "benutzer", uid), { ...f, email, aktiv: true, erstelltAm: serverTimestamp(), geaendertAm: serverTimestamp() });
      await sendPasswordResetEmail(auth, email);
      await protokoll(ich.uid, "benutzer_angelegt", { uid, email, rollen: f.rollen });
      form.reset();
      setZ({ ok: `${f.name} ist angelegt. Eine E-Mail an ${email} ist unterwegs, damit sie ein eigenes Passwort setzen kann.` });
    } catch (err) {
      setZ({ fehler: meldung(err) });
    }
    setLaeuft(false);
  }

  return (
    <form onSubmit={anlegen} className="panel" aria-labelledby="h-neu">
      <h2 id="h-neu">Person hinzufügen</h2>
      <Meldung z={z} />
      <div className="grid">
        <label>Name<input name="nachname" required autoComplete="off" /></label>
        <label>Vorname<input name="vorname" required autoComplete="off" /></label>
        <label>E-Mail<input name="email" type="email" required /></label>
        <label>Telefonnummer<input name="telefon" type="tel" placeholder="079 123 45 67" /></label>
        <label>Funktion<input name="funktion" placeholder="z. B. Verkäuferin" /></label>
        <label>Pensum %<input name="pensum" type="number" min={0} max={100} step={5} inputMode="numeric" /></label>
        <RollenAuswahl />
      </div>
      <p className="hint">Die Person erhält eine E-Mail mit einem Link, über den sie ihr eigenes Passwort festlegt.</p>
      <div className="actions"><button className="btn" disabled={laeuft}>{laeuft ? "Hinzufügen …" : "Hinzufügen"}</button></div>
    </form>
  );
}

function PersonBearbeiten({ b }: { b: Benutzer }) {
  const ich = useIch();
  const [z, setZ] = useState<Zustand>({});

  async function speichern(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = felder(e.currentTarget);
    const aktiv = new FormData(e.currentTarget).get("aktiv") === "on";
    if (!f.vorname || !f.nachname) return setZ({ fehler: "Bitte Name und Vorname angeben." });
    if (b.uid === ich.uid && (!aktiv || !f.rollen.includes("admin"))) {
      return setZ({ fehler: "Du kannst dir die Admin-Rolle nicht selbst entziehen oder dich deaktivieren." });
    }
    try {
      await updateDoc(doc(db, "benutzer", b.uid), { ...f, aktiv, geaendertAm: serverTimestamp() });
      await protokoll(ich.uid, "benutzer_geaendert", { uid: b.uid, rollen: f.rollen, aktiv });
      setZ({ ok: "Gespeichert." });
    } catch (err) {
      setZ({ fehler: meldung(err) });
    }
  }

  async function passwortLink() {
    try {
      await sendPasswordResetEmail(auth, b.email);
      setZ({ ok: `E-Mail zum Zurücksetzen an ${b.email} gesendet.` });
    } catch (err) {
      setZ({ fehler: meldung(err) });
    }
  }

  return (
    <article className={`item${b.aktiv ? "" : " inaktiv"}`}>
      <div className="item-row">
        <strong>{b.nachname ? `${b.nachname} ${b.vorname}` : b.name}</strong>
        <span className="checks">
          {!b.aktiv && <span className="pill bad">Deaktiviert</span>}
          {b.rollen.map((r) => <span key={r} className="pill acc">{ROLLEN[r]}</span>)}
        </span>
      </div>
      <div className="meta">
        <span>{b.email}</span>
        {b.funktion && <span>{b.funktion}</span>}
        {b.pensum != null && <span>{b.pensum} %</span>}
        {b.telefon ? <a href={`tel:${b.telefon.replace(/\s/g, "")}`}>{b.telefon}</a> : <span>Telefon fehlt</span>}
      </div>
      <Meldung z={z} />
      <details>
        <summary>Bearbeiten</summary>
        <form onSubmit={speichern} className="grid" style={{ marginTop: 12 }}>
          <label>Name<input name="nachname" defaultValue={b.nachname} required /></label>
          <label>Vorname<input name="vorname" defaultValue={b.vorname} required /></label>
          <label>Telefonnummer<input name="telefon" type="tel" defaultValue={b.telefon ?? ""} /></label>
          <label>Funktion<input name="funktion" defaultValue={b.funktion ?? ""} /></label>
          <label>Pensum %<input name="pensum" type="number" min={0} max={100} step={5} defaultValue={b.pensum ?? ""} /></label>
          <label className="check" style={{ alignSelf: "end" }}>
            <input type="checkbox" name="aktiv" defaultChecked={b.aktiv} /> Aktiv
          </label>
          <RollenAuswahl gewaehlt={b.rollen} />
          <div className="actions wide">
            <button className="btn small">Speichern</button>
            <button type="button" className="btn ghost small" onClick={passwortLink}>Passwort-Link senden</button>
          </div>
        </form>
      </details>
    </article>
  );
}

export function BenutzerVerwaltung() {
  const [liste, setListe] = useState<Benutzer[] | null>(null);
  const [fehler, setFehler] = useState("");

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, "benutzer"), orderBy("name")),
        (snap) => setListe(snap.docs.map((d) => alsBenutzer(d.id, d.data())).sort((a, b) => `${a.nachname} ${a.vorname}`.localeCompare(`${b.nachname} ${b.vorname}`, "de"))),
        (err) => setFehler(meldung(err)),
      ),
    [],
  );

  return (
    <>
      <section className="panel">
        <div className="panel-head">
          <div>
            <div className="eyebrow">Verwaltung</div>
            <h1>Benutzer</h1>
          </div>
          <div className="actions">
            {liste && <span className="pill">{liste.filter((b) => b.aktiv).length} aktiv</span>}
            <Link to="/admin/import" className="btn ghost small">Ladenbuch übernehmen</Link>
          </div>
        </div>
        {fehler && <p className="notice bad">{fehler}</p>}
        {!liste && !fehler && <p className="hint">Lädt …</p>}
        <div className="list">{liste?.map((b) => <PersonBearbeiten key={b.uid} b={b} />)}</div>
      </section>
      <NeuePerson />
    </>
  );
}
