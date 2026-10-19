import type { ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router";
import { AuthProvider, useAuth } from "./auth";
import { darf, STUFE, type Modul, type Stufe } from "./lib/rollen";
import { BenutzerVerwaltung } from "./seiten/Benutzer";
import { Einrichtung } from "./seiten/Einrichtung";
import { Login } from "./seiten/Login";
import { Import } from "./seiten/Import";
import { Profil } from "./seiten/Profil";
import { KeinZugang, Rahmen } from "./seiten/Rahmen";
import { Start } from "./seiten/Start";
import { Bestellungen, Loomis, Reklamationen, Uebergabe } from "./laden/Eintraege";
import { Kasse } from "./laden/Kasse";
import { Laden } from "./laden/Laden";
import { Wochenbericht } from "./laden/Wochenbericht";
import { Sitzungen } from "./sitzungen/Sitzungen";
import { Belegung } from "./pension/Belegung";
import { Heute } from "./pension/Heute";
import { Kartei } from "./pension/Kartei";
import { Abrechnung } from "./pension/Abrechnung";
import { Stammblatt } from "./pension/Stammblatt";
import { HundSeite } from "./pension/HundSeite";
import { Zimmer } from "./pension/Zimmer";
import { PensionKasse } from "./pension/Kasse";
import { Pension } from "./pension/Pension";
import { Tagesplan } from "./pension/Tagesplan";
import { PensionUebergabe } from "./pension/Uebergabe";
import { Fahrdienst } from "./fahrdienst/Fahrdienst";
import { Fahrzeuge } from "./fahrdienst/Fahrzeuge";
import { FahrdienstHeute } from "./fahrdienst/Heute";
import { FahrdienstPlan } from "./fahrdienst/Plan";
import { Kalender } from "./kalender/Kalender";
import { Chat } from "./chat/Chat";
import { Mitteilungen } from "./chat/Mitteilungen";
import { Personal } from "./personal/Personal";
import { Dienstplan } from "./personal/Dienstplan";
import { Abwesenheiten } from "./personal/Abwesenheiten";
import { Zeiterfassung } from "./personal/Zeiterfassung";
import { Aufgaben } from "./aufgaben/Aufgaben";
import { Dokumente } from "./dokumente/Dokumente";

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
        <Route path="chat" element={<Berechtigt modul="chat"><Chat /></Berechtigt>} />
        <Route path="mitteilungen" element={<Berechtigt modul="start"><Mitteilungen /></Berechtigt>} />
        <Route path="laden" element={<Berechtigt modul="laden"><Laden /></Berechtigt>}>
          <Route index element={<Navigate to="kasse" replace />} />
          <Route path="kasse" element={<Kasse />} />
          <Route path="uebergabe" element={<Uebergabe />} />
          <Route path="bestellungen" element={<Bestellungen />} />
          <Route path="reklamationen" element={<Reklamationen />} />
          <Route path="loomis" element={<Loomis />} />
          <Route path="wochenbericht" element={<Berechtigt modul="laden_wochenbericht"><Wochenbericht /></Berechtigt>} />
        </Route>
        <Route path="pension" element={<Berechtigt modul="pension"><Pension /></Berechtigt>}>
          <Route index element={<Navigate to="heute" replace />} />
          <Route path="heute" element={<Heute />} />
          <Route path="belegung" element={<Belegung />} />
          <Route path="kartei" element={<Kartei />} />
          <Route path="stammblatt/:kundeId" element={<Stammblatt />} />
          <Route path="hund/:hundId" element={<HundSeite />} />
          <Route path="zimmer" element={<Zimmer />} />
          <Route path="abrechnung" element={<Berechtigt modul="pension" mindestens={STUFE.bearbeiten}><Abrechnung /></Berechtigt>} />
          <Route path="tagesplan" element={<Berechtigt modul="tagesplan" mindestens={STUFE.bearbeiten}><Tagesplan /></Berechtigt>} />
          <Route path="uebergabe" element={<Berechtigt modul="pension" mindestens={STUFE.bearbeiten}><PensionUebergabe /></Berechtigt>} />
          <Route path="kasse" element={<Berechtigt modul="pension_kasse" mindestens={STUFE.bearbeiten}><PensionKasse /></Berechtigt>} />
        </Route>
        <Route path="fahrdienst" element={<Berechtigt modul="fahrdienst"><Fahrdienst /></Berechtigt>}>
          <Route index element={<Navigate to="heute" replace />} />
          <Route path="heute" element={<FahrdienstHeute />} />
          <Route path="plan" element={<FahrdienstPlan />} />
          <Route path="fahrzeuge" element={<Berechtigt modul="fahrzeuge"><Fahrzeuge /></Berechtigt>} />
        </Route>
        <Route path="kalender" element={<Berechtigt modul="kalender"><Kalender /></Berechtigt>} />
        <Route path="personal" element={<Berechtigt modul="personal"><Personal /></Berechtigt>}>
          <Route index element={<Navigate to="dienstplan" replace />} />
          <Route path="dienstplan" element={<Dienstplan />} />
          <Route path="abwesenheiten" element={<Abwesenheiten />} />
          <Route path="zeiterfassung" element={<Berechtigt modul="zeiterfassung" mindestens={STUFE.bearbeiten}><Zeiterfassung /></Berechtigt>} />
        </Route>
        <Route path="aufgaben" element={<Berechtigt modul="aufgaben"><Aufgaben /></Berechtigt>} />
        <Route path="dokumente" element={<Berechtigt modul="dokumente"><Dokumente /></Berechtigt>} />
        <Route path="sitzungen" element={<Berechtigt modul="sitzungen_team"><Sitzungen /></Berechtigt>} />
        <Route path="admin/benutzer" element={<Berechtigt modul="admin" mindestens={STUFE.verwalten}><BenutzerVerwaltung /></Berechtigt>} />
        <Route path="admin/import" element={<Berechtigt modul="admin" mindestens={STUFE.verwalten}><Import /></Berechtigt>} />
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
