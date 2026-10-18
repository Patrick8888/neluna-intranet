// Einmalige Übernahme der Daten aus dem bisherigen Ladenbuch (JSON-Export).
// Bereits vorhandene Einträge werden übersprungen; man kann den Import also gefahrlos wiederholen.
import { useState, type FormEvent } from "react";
import { collection, doc, getDocs, query, where, writeBatch, type DocumentData } from "firebase/firestore";
import { db } from "../firebase";
import { useIch } from "../auth";
import { meldung } from "../lib/fehler";
import { zahl } from "../lib/format";
import { kasseId, kasseRechnen, WB_FELDER } from "../lib/laden";

type Roh = Record<string, unknown> & { id: string };
type Export = Partial<Record<"kasse" | "uebergabe" | "bestellungen" | "reklamationen" | "lommis" | "wochenberichte" | "protokolle" | "kader", Roh[]>> & {
  kaderconfig?: { salt: string; iv: string; ct: string } | null;
};
type Ziel = { sammlung: string; id: string; daten: DocumentData };

const s = (v: unknown) => (v == null ? "" : String(v));
const b = (v: unknown) => v === true;

// Entschlüsselung wie im Ladenbuch: PBKDF2 (SHA-256, 250 000 Runden) → AES-GCM.
const unb64 = (x: string) => Uint8Array.from(atob(x), (c) => c.charCodeAt(0));
async function schluessel(passwort: string, salt: string) {
  const basis = await crypto.subtle.importKey("raw", new TextEncoder().encode(passwort), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", salt: unb64(salt), iterations: 250000, hash: "SHA-256" }, basis, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
}
async function entschluesseln(key: CryptoKey, r: { iv: string; ct: string }) {
  const klar = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(r.iv) }, key, unb64(r.ct));
  return JSON.parse(new TextDecoder().decode(klar)) as Record<string, unknown>;
}

function protokoll(p: Record<string, unknown>, ich: { uid: string; name: string }): DocumentData {
  const pendenzen = Array.isArray(p.pendenzen) ? p.pendenzen : [];
  return {
    datum: s(p.datum), zeit: s(p.zeit), ort: s(p.ort), leitung: s(p.leitung), protokoll: s(p.protokoll),
    anwesend: Array.isArray(p.anwesend) ? p.anwesend.map(s) : [], abwesend: s(p.abwesend),
    t: Array.isArray(p.t) ? p.t.map(s) : [],
    pendenzen: pendenzen.map((x: Record<string, unknown>) => ({ was: s(x.was), wer: s(x.wer), bis: s(x.bis), erledigt: b(x.erledigt) })),
    naechste: s(p.naechste), gespeichert: s(p.gespeichert), uid: ich.uid, person: ich.name,
  };
}

/** Wandelt den Ladenbuch-Export in Einträge für das Pfötli Buch um. */
export async function umwandeln(e: Export, ich: { uid: string; name: string }, kaderPasswort: string): Promise<{ ziele: Ziel[]; hinweise: string[] }> {
  const ziele: Ziel[] = [];
  const hinweise: string[] = [];
  const eintrag = (x: Roh) => ({ datum: s(x.datum), erstellt: s(x.erstellt), person: s(x.person), uid: ich.uid });

  for (const k of e.kasse ?? []) {
    const { safebag, ...betraege } = { anfang: zahl(k.anfang), bar: zahl(k.bar), karte: zahl(k.karte), twint: zahl(k.twint), ausgaben: zahl(k.ausgaben), gezaehlt: zahl(k.gezaehlt), safebag: zahl(k.safebagBetrag) };
    ziele.push({
      sammlung: "kasse", id: kasseId("laden", k.id),
      daten: {
        standort: "laden", datum: k.id, person: s(k.person), uid: ich.uid, ...betraege, safebagBetrag: safebag,
        safebagNr: s(k.safebagNr), notiz: s(k.notiz), ...kasseRechnen({ ...betraege, safebag }), abgeholt: b(k.abgeholt), abgeholtAm: s(k.abgeholtAm),
      },
    });
  }
  for (const x of e.uebergabe ?? []) {
    ziele.push({ sammlung: "laden_uebergabe", id: x.id, daten: { ...eintrag(x), kategorie: s(x.kategorie), text: s(x.text) || "–", pendenz: b(x.pendenz), wichtig: b(x.wichtig), erledigt: b(x.erledigt), erledigtVon: s(x.erledigtVon), erledigtAm: s(x.erledigtAm) } });
  }
  for (const x of e.bestellungen ?? []) {
    ziele.push({ sammlung: "laden_bestellungen", id: x.id, daten: { ...eintrag(x), typ: s(x.typ) || "Nachbestellung", artikel: s(x.artikel) || "–", menge: s(x.menge), lieferant: s(x.lieferant), kunde: s(x.kunde), telefon: s(x.telefon), notiz: s(x.notiz), status: s(x.status) || "Offen" } });
  }
  for (const x of e.reklamationen ?? []) {
    ziele.push({ sammlung: "laden_reklamationen", id: x.id, daten: { ...eintrag(x), kunde: s(x.kunde), artikel: s(x.artikel) || "–", grund: s(x.grund) || "–", loesung: s(x.loesung), betrag: zahl(x.betrag), status: s(x.status) || "Offen" } });
  }
  for (const x of e.lommis ?? []) {
    ziele.push({ sammlung: "laden_loomis", id: x.id, daten: { ...eintrag(x), typ: s(x.typ), betrag: zahl(x.betrag), notiz: s(x.notiz) } });
  }
  for (const w of e.wochenberichte ?? []) {
    ziele.push({
      sammlung: "laden_wochenberichte", id: w.id,
      daten: { woche: w.id, person: s(w.person), uid: ich.uid, gespeichert: s(w.gespeichert), ...(w.zahlen ? { zahlen: w.zahlen } : {}), ...Object.fromEntries(WB_FELDER.map(([k]) => [k, s(w[k])])) },
    });
  }
  for (const p of e.protokolle ?? []) ziele.push({ sammlung: "sitzungen_team", id: p.id, daten: protokoll(p, ich) });

  const kader = e.kader ?? [];
  if (kader.length) {
    if (!e.kaderconfig || !kaderPasswort) {
      hinweise.push(`${kader.length} Kader-Protokolle übersprungen: dafür braucht es das Kader-Passwort aus dem Ladenbuch.`);
    } else {
      const key = await schluessel(kaderPasswort, e.kaderconfig.salt);
      try {
        const probe = await entschluesseln(key, e.kaderconfig);
        if (probe.ok !== "neluna") throw new Error();
      } catch {
        throw new Error("Das Kader-Passwort stimmt nicht.");
      }
      for (const r of kader) {
        try {
          ziele.push({ sammlung: "sitzungen_kader", id: r.id, daten: protokoll(await entschluesseln(key, r as unknown as { iv: string; ct: string }), ich) });
        } catch {
          hinweise.push(`Kader-Protokoll ${r.id} liess sich nicht entschlüsseln.`);
        }
      }
    }
  }
  return { ziele, hinweise };
}

export function Import() {
  const ich = useIch();
  const [datei, setDatei] = useState<File | null>(null);
  const [passwort, setPasswort] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [bericht, setBericht] = useState<string[]>([]);
  const [fehler, setFehler] = useState("");

  async function importieren(e: FormEvent) {
    e.preventDefault();
    if (!datei) return;
    setLaeuft(true);
    setFehler("");
    setBericht([]);
    try {
      const daten = JSON.parse(await datei.text()) as Export;
      const { ziele, hinweise } = await umwandeln(daten, ich, passwort);
      const sammlungen = [...new Set(ziele.map((z) => z.sammlung))];
      const vorhanden = new Set<string>();
      for (const sm of sammlungen) {
        // Das Kassenbuch ist nach Standort getrennt lesbar; übernommen wird nur der Laden.
        const q = sm === "kasse" ? query(collection(db, sm), where("standort", "==", "laden")) : collection(db, sm);
        (await getDocs(q)).forEach((d) => vorhanden.add(`${sm}/${d.id}`));
      }
      const neu = ziele.filter((z) => !vorhanden.has(`${z.sammlung}/${z.id}`));
      for (let i = 0; i < neu.length; i += 400) {
        const batch = writeBatch(db);
        for (const z of neu.slice(i, i + 400)) batch.set(doc(db, z.sammlung, z.id), z.daten);
        await batch.commit();
      }
      const zaehlen = (liste: Ziel[]) => sammlungen.map((sm) => `${sm}: ${liste.filter((z) => z.sammlung === sm).length}`).join(", ");
      setBericht([`Übernommen: ${neu.length} Einträge (${zaehlen(neu)}).`, `Schon vorhanden und übersprungen: ${ziele.length - neu.length}.`, ...hinweise]);
    } catch (err) {
      setFehler(err instanceof SyntaxError ? "Die Datei ist kein gültiger Ladenbuch-Export." : err instanceof Error && !("code" in err) ? err.message : meldung(err));
    }
    setLaeuft(false);
  }

  return (
    <section className="panel" aria-labelledby="h-imp">
      <div><div className="eyebrow">Verwaltung</div><h1 id="h-imp">Ladenbuch übernehmen</h1></div>
      <p className="hint">Einmalig beim Umstieg: den Export aus dem bisherigen Ladenbuch hier hochladen. Einträge, die schon da sind, werden übersprungen. Als «Erfasst von» bleibt der ursprüngliche Name stehen.</p>
      <form className="grid" onSubmit={importieren}>
        <label className="wide">Export-Datei (JSON)<input type="file" accept="application/json,.json" onChange={(e) => setDatei(e.target.files?.[0] ?? null)} required /></label>
        <label className="wide">Kader-Passwort aus dem Ladenbuch (für die Kader-Protokolle)<input type="password" value={passwort} onChange={(e) => setPasswort(e.target.value)} autoComplete="off" /></label>
        <div className="wide actions"><button className="btn" disabled={!datei || laeuft}>{laeuft ? "Übernehmen …" : "Übernehmen"}</button></div>
      </form>
      {fehler && <p className="notice bad" role="alert">{fehler}</p>}
      {bericht.length > 0 && <div className="notice good" role="status">{bericht.map((z) => <div key={z}>{z}</div>)}</div>}
    </section>
  );
}
