import { useState, type FormEvent } from "react";
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from "firebase/auth";
import { doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { useIch } from "../auth";
import { meldung } from "../lib/fehler";
import { passwortFehler } from "../lib/passwort";
import { ROLLEN } from "../lib/rollen";
import { PushEinstellungenPanel } from "../chat/Push";

type Zustand = { fehler?: string; ok?: string };

function Meldung({ z }: { z: Zustand }) {
  if (z.fehler) return <p className="notice bad" role="alert">{z.fehler}</p>;
  if (z.ok) return <p className="notice good" role="status">{z.ok}</p>;
  return null;
}

function ProfilFormular() {
  const ich = useIch();
  const [name, setName] = useState(ich.name);
  const [telefon, setTelefon] = useState(ich.telefon ?? "");
  const [z, setZ] = useState<Zustand>({});

  async function speichern(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setZ({ fehler: "Bitte einen Namen angeben." });
    try {
      await updateDoc(doc(db, "benutzer", ich.uid), { name: name.trim(), telefon: telefon.trim() || null, geaendertAm: serverTimestamp() });
      setZ({ ok: "Profil gespeichert." });
    } catch (err) {
      setZ({ fehler: meldung(err) });
    }
  }

  return (
    <form onSubmit={speichern} className="panel">
      <h2>Profil</h2>
      <Meldung z={z} />
      <div className="grid">
        <label>Name<input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" /></label>
        <label>Telefon<input type="tel" value={telefon} onChange={(e) => setTelefon(e.target.value)} autoComplete="tel" /></label>
      </div>
      <div className="actions"><button className="btn">Speichern</button></div>
    </form>
  );
}

function PasswortFormular() {
  const [alt, setAlt] = useState("");
  const [neu, setNeu] = useState("");
  const [wdh, setWdh] = useState("");
  const [z, setZ] = useState<Zustand>({});
  const [laeuft, setLaeuft] = useState(false);

  async function aendern(e: FormEvent) {
    e.preventDefault();
    if (neu !== wdh) return setZ({ fehler: "Die beiden neuen Passwörter stimmen nicht überein." });
    if (neu === alt) return setZ({ fehler: "Das neue Passwort muss sich vom bisherigen unterscheiden." });
    const pf = passwortFehler(neu);
    if (pf) return setZ({ fehler: pf });
    const konto = auth.currentUser;
    if (!konto?.email) return;
    setLaeuft(true);
    try {
      await reauthenticateWithCredential(konto, EmailAuthProvider.credential(konto.email, alt));
      await updatePassword(konto, neu);
      setAlt(""); setNeu(""); setWdh("");
      setZ({ ok: "Passwort geändert." });
    } catch (err) {
      const code = (err as { code?: string }).code;
      setZ({ fehler: code === "auth/invalid-credential" || code === "auth/wrong-password" ? "Das bisherige Passwort stimmt nicht." : meldung(err) });
    }
    setLaeuft(false);
  }

  return (
    <form onSubmit={aendern} className="panel">
      <h2>Passwort ändern</h2>
      <Meldung z={z} />
      <div className="grid">
        <label className="wide">Bisheriges Passwort<input type="password" value={alt} onChange={(e) => setAlt(e.target.value)} required autoComplete="current-password" /></label>
        <label>Neues Passwort<input type="password" value={neu} onChange={(e) => setNeu(e.target.value)} required minLength={10} autoComplete="new-password" /></label>
        <label>Neues Passwort wiederholen<input type="password" value={wdh} onChange={(e) => setWdh(e.target.value)} required minLength={10} autoComplete="new-password" /></label>
      </div>
      <p className="hint">Mindestens 10 Zeichen, mit Buchstaben und Zahlen.</p>
      <div className="actions"><button className="btn" disabled={laeuft}>Passwort ändern</button></div>
    </form>
  );
}

export function Profil() {
  const ich = useIch();
  return (
    <>
      <section className="panel">
        <div className="eyebrow">Mein Profil</div>
        <h1>{ich.name}</h1>
        <div className="meta">
          <span>{ich.email}</span>
          {ich.funktion && <span>{ich.funktion}</span>}
          {ich.pensum != null && <span>{ich.pensum} %</span>}
        </div>
        <div className="checks">
          {ich.rollen.map((r) => <span key={r} className="pill acc">{ROLLEN[r]}</span>)}
        </div>
      </section>
      <ProfilFormular />
      <PushEinstellungenPanel />
      <PasswortFormular />
    </>
  );
}
