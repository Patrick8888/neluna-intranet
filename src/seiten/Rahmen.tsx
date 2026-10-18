import { Link, NavLink, Outlet } from "react-router";
import { signOut } from "firebase/auth";
import { auth } from "../firebase";
import { useIch } from "../auth";
import { BEREICHE } from "../lib/navigation";
import { darf } from "../lib/rollen";

export function Rahmen() {
  const ich = useIch();
  const eintraege = [
    { titel: "Heute", pfad: "/" },
    ...BEREICHE.filter((x) => x.pfad && darf(ich.rollen, x.modul)).map((x) => ({ titel: x.titel, pfad: x.pfad! })),
  ];

  return (
    <div className="wrap">
      <header className="kopf">
        <Link to="/" aria-label="Zur Startseite">
          <img className="logo" src="/logo.webp" alt="NeLuna's Pfötli Shop" width={640} height={401} />
        </Link>
        <div className="wer">
          <Link to="/profil">{ich.name}</Link>
          <button className="btn ghost small" onClick={() => signOut(auth)}>Abmelden</button>
        </div>
      </header>
      <nav className="tabs" aria-label="Bereiche">
        {eintraege.map((e) => (
          <NavLink key={e.pfad} to={e.pfad} end={e.pfad === "/"} className="tab">
            {e.titel}
          </NavLink>
        ))}
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  );
}

export function KeinZugang() {
  return (
    <div className="wrap login">
      <main>
        <section className="panel">
          <h1>Kein Zugang</h1>
          <p className="muted" style={{ margin: 0 }}>
            Für dieses Konto ist kein aktiver Zugang zum Intranet eingerichtet. Bitte bei Patrick Schaub melden.
          </p>
          <div className="actions"><button className="btn ghost" onClick={() => signOut(auth)}>Abmelden</button></div>
        </section>
      </main>
    </div>
  );
}
