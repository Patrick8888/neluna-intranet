import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import { createUserWithEmailAndPassword, deleteUser, signInWithEmailAndPassword } from "firebase/auth";
import { doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { auth, db } from "../firebase";
import { meldung } from "../lib/fehler";
import { passwortFehler } from "../lib/passwort";

// Einmalig: die erste Person richtet das Intranet ein und wird Admin.
// Die Sicherheitsregeln lassen das nur zu, solange noch niemand eingerichtet hat.
export function Einrichtung() {
  const [name, setName] = useState("Patrick Schaub");
  const [email, setEmail] = useState("");
  const [passwort, setPasswort] = useState("");
  const [fehler, setFehler] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const navigate = useNavigate();

  async function einrichten(e: FormEvent) {
    e.preventDefault();
    setFehler("");
    const pf = passwortFehler(passwort);
    if (pf) return setFehler(pf);
    setLaeuft(true);
    const adresse = email.trim().toLowerCase();
    let neuesKonto = false;
    try {
      try {
        await createUserWithEmailAndPassword(auth, adresse, passwort);
        neuesKonto = true;
      } catch (err) {
        if ((err as { code?: string }).code !== "auth/email-already-in-use") throw err;
        await signInWithEmailAndPassword(auth, adresse, passwort);
      }
      const uid = auth.currentUser!.uid;
      const b = writeBatch(db);
      b.set(doc(db, "benutzer", uid), {
        name: name.trim(),
        email: adresse,
        funktion: "Inhaber, Geschäftsführer",
        pensum: null,
        telefon: null,
        rollen: ["admin", "geschaeftsfuehrung"],
        aktiv: true,
        erstelltAm: serverTimestamp(),
        geaendertAm: serverTimestamp(),
      });
      b.set(doc(db, "system", "einrichtung"), { von: uid, zeit: serverTimestamp() });
      await b.commit();
      navigate("/");
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code === "permission-denied") {
        if (neuesKonto && auth.currentUser) await deleteUser(auth.currentUser).catch(() => {});
        await auth.signOut();
        setFehler("Das Pfötli Buch ist bereits eingerichtet. Bitte beim Admin einen Zugang anfragen.");
      } else {
        setFehler(meldung(err));
      }
      setLaeuft(false);
    }
  }

  return (
    <div className="wrap login">
      <img className="logo" src="/logo.webp" alt="NeLuna's Pfötli Shop" width={640} height={401} />
      <main>
        <div style={{ textAlign: "center" }}>
          <div className="eyebrow">Erster Start</div>
          <h1>Pfötli Buch einrichten</h1>
        </div>
        <form onSubmit={einrichten} className="panel">
          <p className="hint">Nur beim allerersten Mal: Wer das Pfötli Buch einrichtet, wird Admin und legt danach das Team an.</p>
          {fehler && <p className="notice bad" role="alert">{fehler}</p>}
          <label>Name<input value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" /></label>
          <label>E-Mail<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" /></label>
          <label>Passwort<input type="password" value={passwort} onChange={(e) => setPasswort(e.target.value)} required minLength={10} autoComplete="new-password" /></label>
          <p className="hint">Mindestens 10 Zeichen, mit Buchstaben und Zahlen.</p>
          <button className="btn" disabled={laeuft}>{laeuft ? "Einrichten …" : "Einrichten"}</button>
        </form>
        <p className="hint" style={{ textAlign: "center" }}><Link to="/">Zurück zur Anmeldung</Link></p>
      </main>
    </div>
  );
}
