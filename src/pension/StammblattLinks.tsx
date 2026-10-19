// Stammblatt per Link: Link erstellen und verschicken, Eingänge prüfen und in die Kartei übernehmen.
import { useEffect, useState } from "react";
import { collection, deleteDoc, doc, onSnapshot, setDoc, Timestamp, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { useIch } from "../auth";
import { datum, heute, zeitstempel } from "../lib/format";
import { meldung } from "../lib/fehler";
import type { Hund, Kunde } from "../lib/pension";
import { bereinigen, einladung, GUELTIG_TAGE, KUNDE_FELDER, neuerToken, uebernahme, vorlageAus, waNummer, type Antwort, type HundAngaben } from "../lib/selbstauskunft";
import { speichern } from "../ui";
import { usePension } from "./daten";

type Link = { id: string; kundeId: string; kundeName: string; ablauf: Timestamp; status: string; person: string };
type Eingang = Antwort & { id: string; eingegangen?: Timestamp };

const linkUrl = (token: string) => `${window.location.origin}/stammblatt/${token}`;

const HUND_TITEL: [keyof HundAngaben, string][] = [
  ["rasse", "Rasse"], ["geburtsdatum", "Geburtsdatum"], ["geschlecht", "Geschlecht"], ["chipnummer", "Chip Nr."], ["farbe", "Besondere Merkmale"],
  ["gewicht", "Gewicht kg"], ["laeufigkeit", "Letzte Läufigkeit"], ["tierarzt", "Tierarzt"], ["tierarztTelefon", "Telefon Tierarzt"],
  ["allergien", "Allergien"], ["gesundheit", "Gesundheitliche Probleme"], ["medikamente", "Medikamente"], ["futter", "Futter"], ["menge", "Menge"],
  ["fuetterungszeiten", "Fütterungszeiten"], ["leckerli", "Leckerli"], ["verhalten", "Besondere Verhaltensweise"], ["sozialverhalten", "Sozialverhalten"],
  ["freilauf", "Freilauf"], ["schlafplatz", "Schlafplatz"], ["kommandos", "Kommandos"], ["aengste", "Ängste"], ["spielverhalten", "Spielverhalten"], ["notiz", "Sonst noch"],
];

/** Link, Kopieren und Teilen; WhatsApp und E-Mail, wenn die Nummer oder Adresse bekannt ist. */
function Teilen({ token, name, telefon, email, zeigen }: { token: string; name?: string; telefon?: string; email?: string; zeigen: (t: string) => void }) {
  const url = linkUrl(token);
  const text = einladung(url, name);
  return (
    <div className="stammblatt-teilen">
      <input readOnly value={url} aria-label="Link zum Stammblatt" onFocus={(e) => e.target.select()} />
      <div className="actions">
        <button type="button" className="btn small" onClick={() => navigator.clipboard.writeText(url).then(() => zeigen("Link kopiert"), () => zeigen("Bitte den Link von Hand kopieren"))}>Kopieren</button>
        {"share" in navigator && <button type="button" className="btn ghost small" onClick={() => navigator.share({ title: "Stammblatt Hundepension NeLuna", text }).catch(() => {})}>Teilen</button>}
        <a className="btn ghost small" href={`https://wa.me/${telefon ? waNummer(telefon) : ""}?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">WhatsApp</a>
        <a className="btn ghost small" href={`mailto:${email ?? ""}?subject=${encodeURIComponent("Stammblatt Hundepension NeLuna")}&body=${encodeURIComponent(text)}`}>E-Mail</a>
      </div>
    </div>
  );
}

/** Knopf «Stammblatt-Link»: für bestehende Kundschaft mit den Angaben aus der Kartei als Vorlage. */
export function LinkSenden({ kunde, hunde, zeigen }: { kunde?: Kunde; hunde?: Hund[]; zeigen: (t: string) => void }) {
  const ich = useIch();
  const [token, setToken] = useState("");

  async function erstellen() {
    const t = neuerToken();
    const ok = await speichern(zeigen, () => setDoc(doc(db, "stammblatt_links", t), {
      kundeId: kunde?.id ?? "", kundeName: kunde?.name ?? "", vorlage: kunde ? vorlageAus(kunde, hunde ?? []) : null,
      ablauf: Timestamp.fromMillis(Date.now() + GUELTIG_TAGE * 864e5), status: "offen", erstellt: zeitstempel(), person: ich.name, uid: ich.uid,
    }), `Link erstellt, ${GUELTIG_TAGE} Tage gültig`);
    if (ok) setToken(t);
  }

  if (token) return <Teilen token={token} name={kunde ? [kunde.vorname, kunde.nachname].filter(Boolean).join(" ") || kunde.name : undefined} telefon={kunde?.telefon} email={kunde?.email} zeigen={zeigen} />;
  return <button type="button" className="btn ghost small" onClick={erstellen}>{kunde ? "Stammblatt-Link senden" : "Stammblatt-Link für neue Kundschaft"}</button>;
}

function Angaben({ a }: { a: Antwort }) {
  return (
    <div className="grid">
      <div>
        <div className="lbl">Halter/in</div>
        <dl className="stammblatt-angaben">
          {KUNDE_FELDER.filter(([k]) => a.kunde[k]).map(([k, titel]) => <div key={k}><dt>{titel}</dt><dd>{k === "geburtsdatum" ? datum(a.kunde[k]) : a.kunde[k]}</dd></div>)}
        </dl>
      </div>
      {a.hunde.map((h, i) => (
        <div key={i}>
          <div className="lbl">{h.name}{h.id ? "" : " (neu)"}</div>
          <dl className="stammblatt-angaben">
            {HUND_TITEL.filter(([k]) => h[k]).map(([k, titel]) => <div key={k}><dt>{titel}</dt><dd>{k === "geburtsdatum" ? datum(String(h[k])) : String(h[k])}</dd></div>)}
            <div><dt>Kastriert/Sterilisiert</dt><dd>{h.kastriert ? "Ja" : "Nein"}</dd></div>
            <div><dt>Verträglich</dt><dd>{h.vertraeglich ? "Ja" : "Nein"}</dd></div>
            {h.impfungen.length > 0 && <div><dt>Impfungen</dt><dd>{h.impfungen.map((x) => `${x.art}${x.gueltigBis ? ` bis ${datum(x.gueltigBis)}` : ""}`).join(", ")}</dd></div>}
          </dl>
        </div>
      ))}
    </div>
  );
}

/** Eingegangene Stammblätter und offene Links; nur für alle, die die Kartei bearbeiten. */
export function StammblattEingang({ zeigen }: { zeigen: (t: string) => void }) {
  const ich = useIch();
  const d = usePension();
  const [eingaenge, setEingaenge] = useState<Eingang[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [offen, setOffen] = useState("");

  useEffect(() => {
    const fehler = (e: unknown) => zeigen(meldung(e));
    const a = onSnapshot(collection(db, "stammblatt_antworten"), (s) => setEingaenge(s.docs.map((x) => ({ ...bereinigen(x.data()), id: x.id, eingegangen: x.data().eingegangen }))), fehler);
    const b = onSnapshot(collection(db, "stammblatt_links"), (s) => setLinks(s.docs.map((x) => ({ id: x.id, ...x.data() }) as Link)), fehler);
    return () => { a(); b(); };
  }, [zeigen]);

  const wartend = links.filter((l) => l.status === "offen").sort((x, y) => x.ablauf.toMillis() - y.ablauf.toMillis());
  if (!eingaenge.length && !wartend.length) return null;

  function uebernehmen(e: Eingang) {
    const link = links.find((l) => l.id === e.id);
    const kunde = d.kunden.find((k) => k.id === link?.kundeId);
    const u = uebernahme(e, kunde, d.hunde);
    const wer = { erstellt: zeitstempel(), person: ich.name, uid: ich.uid };
    return speichern(zeigen, async () => {
      const b = writeBatch(db);
      const kRef = u.kunde.id ? doc(db, "pension_kunden", u.kunde.id) : doc(collection(db, "pension_kunden"));
      if (u.kunde.id) b.update(kRef, u.kunde.felder);
      else b.set(kRef, { ...u.kunde.felder, team: false, ...wer });
      for (const h of u.hunde) {
        if (h.id) b.update(doc(db, "pension_hunde", h.id), { ...h.felder, kundeId: kRef.id });
        else b.set(doc(collection(db, "pension_hunde")), { ...h.felder, kundeId: kRef.id, ...wer });
      }
      b.delete(doc(db, "stammblatt_antworten", e.id));
      if (link) b.delete(doc(db, "stammblatt_links", e.id));
      await b.commit();
    }, `${u.kunde.felder.name} in die Kartei übernommen`);
  }

  return (
    <section className="panel" aria-labelledby="h-sl">
      <h2 id="h-sl">Stammblätter von der Kundschaft</h2>
      {eingaenge.length > 0 && (
        <div className="list">
          {eingaenge.map((e) => {
            const link = links.find((l) => l.id === e.id);
            const bestehend = link?.kundeId && d.kunden.some((k) => k.id === link.kundeId);
            return (
              <article key={e.id} className="item">
                <div className="item-row">
                  <strong>{[e.kunde.nachname, e.kunde.vorname].filter(Boolean).join(" ")} · {e.hunde.map((h) => h.name).join(", ")}</strong>
                  <span className={`pill ${bestehend ? "" : "acc"}`}>{bestehend ? "Ergänzung" : "Neu"}</span>
                </div>
                <div className="meta">
                  {e.eingegangen && <span>eingegangen {datum(heute(e.eingegangen.toDate()))}</span>}
                  {e.kunde.telefon && <span>{e.kunde.telefon}</span>}
                </div>
                {offen === e.id && <Angaben a={e} />}
                <div className="actions">
                  <button type="button" className="btn ghost small" onClick={() => setOffen(offen === e.id ? "" : e.id)}>{offen === e.id ? "Zuklappen" : "Prüfen"}</button>
                  <button type="button" className="btn small" onClick={() => uebernehmen(e)}>In die Kartei übernehmen</button>
                  <button type="button" className="btn danger small" onClick={() => speichern(zeigen, async () => {
                    const b = writeBatch(db);
                    b.delete(doc(db, "stammblatt_antworten", e.id));
                    if (link) b.delete(doc(db, "stammblatt_links", e.id));
                    await b.commit();
                  }, "Verworfen")}>Verwerfen</button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      {wartend.length > 0 && (
        <details>
          <summary>Verschickte Links, noch nicht ausgefüllt ({wartend.length})</summary>
          <div className="list">
            {wartend.map((l) => {
              const abgelaufen = l.ablauf.toMillis() < Date.now();
              return (
                <div key={l.id} className="item-row">
                  <span>{l.kundeName || "Neue Kundschaft"} · {abgelaufen ? <span className="pill warn">abgelaufen</span> : `gültig bis ${datum(heute(l.ablauf.toDate()))}`} · von {l.person}</span>
                  <span className="actions">
                    {!abgelaufen && <button type="button" className="btn ghost small" onClick={() => navigator.clipboard.writeText(linkUrl(l.id)).then(() => zeigen("Link kopiert"), () => {})}>Link kopieren</button>}
                    <button type="button" className="btn danger small" onClick={() => speichern(zeigen, () => deleteDoc(doc(db, "stammblatt_links", l.id)), "Link gelöscht")}>Löschen</button>
                  </span>
                </div>
              );
            })}
          </div>
        </details>
      )}
    </section>
  );
}
