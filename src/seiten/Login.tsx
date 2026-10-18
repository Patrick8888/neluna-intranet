import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { sendPasswordResetEmail, signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { meldung } from "../lib/fehler";

export function Login() {
  const [email, setEmail] = useState("");
  const [passwort, setPasswort] = useState("");
  const [fehler, setFehler] = useState("");
  const [info, setInfo] = useState("");
  const [laeuft, setLaeuft] = useState(false);

  async function anmelden(e: FormEvent) {
    e.preventDefault();
    setFehler("");
    setInfo("");
    setLaeuft(true);
    try {
      await signInWithEmailAndPassword(auth, email.trim(), passwort);
    } catch (err) {
      setFehler(meldung(err));
      setLaeuft(false);
    }
  }

  async function vergessen() {
    setFehler("");
    if (!email.trim()) {
      setFehler("Bitte zuerst die E-Mail-Adresse eingeben.");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch {
      // Absichtlich keine Auskunft, ob es die Adresse gibt.
    }
    setInfo("Falls es für diese Adresse einen Zugang gibt, ist eine E-Mail zum Zurücksetzen unterwegs.");
  }

  return (
    <div className="wrap login">
      <img className="logo" src="/logo.webp" alt="NeLuna's Pfötli Shop" width={640} height={401} />
      <main>
        <div style={{ textAlign: "center" }}>
          <div className="eyebrow">Hundepension · Pfötli Shop</div>
          <h1>Pfötli Buch</h1>
        </div>
        <form onSubmit={anmelden} className="panel">
          {fehler && <p className="notice bad" role="alert">{fehler}</p>}
          {info && <p className="notice good" role="status">{info}</p>}
          <label>
            E-Mail
            <input name="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label>
            Passwort
            <input name="passwort" type="password" autoComplete="current-password" required value={passwort} onChange={(e) => setPasswort(e.target.value)} />
          </label>
          <button className="btn" disabled={laeuft}>{laeuft ? "Anmelden …" : "Anmelden"}</button>
          <div className="actions">
            <button type="button" className="btn ghost small" onClick={vergessen}>Passwort vergessen</button>
          </div>
        </form>
        <p className="hint" style={{ textAlign: "center" }}>
          Erster Start? <Link to="/einrichtung">Pfötli Buch einrichten</Link>
        </p>
      </main>
    </div>
  );
}
