import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router";
import { AuthProvider, useAuth } from "./auth";
import { darf, STUFE, type Modul, type Stufe } from "./lib/rollen";
import { BenutzerVerwaltung } from "./seiten/Benutzer";
import { Einrichtung } from "./seiten/Einrichtung";
import { Login } from "./seiten/Login";
import { Profil } from "./seiten/Profil";
import { KeinZugang, Rahmen } from "./seiten/Rahmen";
import { Start } from "./seiten/Start";

/** Zeigt die Seite nur mit genügender Berechtigung (die Datenbankregeln prüfen zusätzlich). */
function Berechtigt({ modul, mindestens = STUFE.lesen, children }: { modul: Modul; mindestens?: Stufe; children: ReactNode }) {
  const z = useAuth();
  if (z.status !== "angemeldet" || !darf(z.ich.rollen, modul, mindestens)) return <Navigate to="/?kein-zugriff=1" replace />;
  return children;
}

function Inhalt() {
  const z = useAuth();
  const { pathname } = useLocation();
  // Die Einrichtung meldet sich selbst an; sie muss sichtbar bleiben, bis sie fertig ist.
  if (pathname === "/einrichtung" && z.status !== "angemeldet") return <Einrichtung />;
  if (z.status === "laedt") return <div className="wrap login"><main><p className="hint" style={{ textAlign: "center" }}>Lädt …</p></main></div>;
  if (z.status === "abgemeldet") {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }
  if (z.status === "ohne-zugang") return <KeinZugang />;
  return (
    <Routes>
      <Route element={<Rahmen />}>
        <Route index element={<Start />} />
        <Route path="profil" element={<Profil />} />
        <Route path="admin/benutzer" element={<Berechtigt modul="admin" mindestens={STUFE.verwalten}><BenutzerVerwaltung /></Berechtigt>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Inhalt />
      </BrowserRouter>
    </AuthProvider>
  );
}
