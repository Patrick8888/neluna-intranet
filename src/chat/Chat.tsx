// Chat: Gruppen nach Rolle und Direktnachrichten, mit Fotos. Ersetzt die WhatsApp-Gruppen des Teams.
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useSearchParams } from "react-router";
import { collection, deleteDoc, doc, getDoc, limit, onSnapshot, orderBy, query, serverTimestamp, Timestamp, writeBatch } from "firebase/firestore";
import { db } from "../firebase";
import { useIch } from "../auth";
import { datum, heute, vorname } from "../lib/format";
import { dmId, gruppenFuer, nachTagen, ungelesen, vorschau, type Nachricht } from "../lib/chat";
import { meldung } from "../lib/fehler";
import { darf, STUFE } from "../lib/rollen";
import { speichern, useToast } from "../ui";
import { bildVerkleinern } from "./bild";
import { kanalTitel, useKommunikation } from "./daten";
import { PushSchalter } from "./Push";

const uhrzeit = (ms: number) => new Date(ms).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" });
const tagVon = (ms: number) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Zurich" }).format(new Date(ms));
const tagText = (t: string) => (t === heute() ? "Heute" : datum(t));

/** Geladene Fotos merken, damit sie beim Zurückblättern nicht neu geladen werden. */
const bilder = new Map<string, string>();

function Bild({ kanal, id, oeffnen }: { kanal: string; id: string; oeffnen: (url: string) => void }) {
  const [url, setUrl] = useState(bilder.get(id) ?? "");
  useEffect(() => {
    if (bilder.has(id)) return;
    let aktiv = true;
    getDoc(doc(db, "chat", kanal, "bilder", id)).then((snap) => {
      const d = String(snap.data()?.daten ?? "");
      if (d) bilder.set(id, d);
      if (aktiv) setUrl(d);
    }, () => {});
    return () => { aktiv = false; };
  }, [kanal, id]);
  if (!url) return <div className="chat-bild leer">Foto lädt …</div>;
  return (
    <button type="button" className="chat-bild" onClick={() => oeffnen(url)} aria-label="Foto gross anzeigen">
      <img src={url} alt="Foto" loading="lazy" />
    </button>
  );
}

/** Kleiner Löschknopf in der Nachricht: erster Tipp fragt nach, zweiter löscht. */
function Loeschen({ onLoeschen }: { onLoeschen: () => void }) {
  const [scharf, setScharf] = useState(false);
  useEffect(() => {
    if (!scharf) return;
    const t = setTimeout(() => setScharf(false), 4000);
    return () => clearTimeout(t);
  }, [scharf]);
  return (
    <button type="button" className={`chat-loeschen${scharf ? " scharf" : ""}`} onClick={() => (scharf ? onLoeschen() : setScharf(true))}>
      {scharf ? "Wirklich löschen?" : "Löschen"}
    </button>
  );
}

function Verlauf({ kanal }: { kanal: string }) {
  const ich = useIch();
  const k = useKommunikation();
  const { zeigen, element } = useToast();
  const [nachrichten, setNachrichten] = useState<Nachricht[] | null>(null);
  const [text, setText] = useState("");
  const [foto, setFoto] = useState("");
  const [gross, setGross] = useState("");
  const ende = useRef<HTMLDivElement>(null);
  const dateiFeld = useRef<HTMLInputElement>(null);
  const leitung = darf(ich.rollen, "chat", STUFE.verwalten);
  // Ab hier gilt «neu»: was seit dem letzten Lesen kam, bevor der Kanal geöffnet wurde.
  const [neuAb] = useState(() => (ungelesen(k.staende[kanal], k.gelesen, ich.uid) ? k.gelesen[kanal] ?? 0 : Infinity));

  useEffect(() => {
    k.setOffen(kanal);
    return () => k.setOffen(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kanal]);

  useEffect(
    () =>
      onSnapshot(
        query(collection(db, "chat", kanal, "nachrichten"), orderBy("zeit", "desc"), limit(200)),
        (snap) => {
          setNachrichten(
            snap.docs
              .map((x) => {
                const d = x.data({ serverTimestamps: "estimate" });
                return { id: x.id, text: String(d.text ?? ""), uid: String(d.uid ?? ""), person: String(d.person ?? ""), zeit: d.zeit instanceof Timestamp ? d.zeit.toMillis() : Date.now(), bildId: d.bildId as string | undefined };
              })
              .reverse(),
          );
        },
        (e) => zeigen(meldung(e)),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kanal],
  );

  const anzahl = nachrichten?.length ?? 0;
  useEffect(() => ende.current?.scrollIntoView({ block: "end" }), [anzahl]);

  async function fotoWaehlen(datei?: File) {
    if (!datei) return;
    try {
      setFoto(await bildVerkleinern(datei));
    } catch (e) {
      zeigen(e instanceof Error && !("code" in e) ? e.message : meldung(e));
    } finally {
      if (dateiFeld.current) dateiFeld.current.value = "";
    }
  }

  async function senden(e?: FormEvent) {
    e?.preventDefault();
    const t = text.trim();
    if (!t && !foto) return;
    const batch = writeBatch(db);
    const ref = doc(collection(db, "chat", kanal, "nachrichten"));
    const n: Record<string, unknown> = { text: t, uid: ich.uid, person: ich.name, zeit: serverTimestamp() };
    if (foto) {
      batch.set(doc(db, "chat", kanal, "bilder", ref.id), { daten: foto, uid: ich.uid });
      n.bildId = ref.id;
    }
    batch.set(ref, n);
    batch.set(doc(db, "chat", kanal), { letzte: serverTimestamp(), letzterText: vorschau(t, !!foto), letztePerson: ich.name, letzteUid: ich.uid });
    // Sofort leeren (die Nachricht erscheint gleich im Verlauf); bei einem Fehler kommt der Text zurück.
    setText("");
    setFoto("");
    if (!(await speichern(zeigen, () => batch.commit(), ""))) {
      setText(t);
      setFoto(foto);
    }
  }

  // Enter sendet, Shift+Enter macht eine neue Zeile (am Computer).
  const taste = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(pointer: fine)").matches) {
      e.preventDefault();
      void senden();
    }
  };

  return (
    <section className="panel chat-verlauf" aria-labelledby="h-kanal">
      <div className="panel-head">
        <h2 id="h-kanal">{kanalTitel(kanal, ich.uid, k.team)}</h2>
        <Link className="btn ghost small chat-zurueck" to="/chat">Alle Chats</Link>
      </div>
      <div className="chat-nachrichten" aria-live="polite">
        {nachrichten === null ? <p className="hint">Lädt …</p> : !nachrichten.length ? (
          <div className="empty">Noch keine Nachrichten. Schreib die erste.</div>
        ) : nachTagen(nachrichten, tagVon).map((g) => (
          <div key={g.tag} className="chat-tag">
            <div className="chat-datum"><span>{tagText(g.tag)}</span></div>
            {g.nachrichten.map((m, i) => {
              const meine = m.uid === ich.uid;
              const gleich = i > 0 && g.nachrichten[i - 1].uid === m.uid;
              const neu = !meine && m.zeit > neuAb && (i === 0 || g.nachrichten[i - 1].zeit <= neuAb);
              return (
                <div key={m.id}>
                  {neu && <div className="chat-datum neu"><span>Neu</span></div>}
                  <div className={`chat-msg${meine ? " meine" : ""}`}>
                    {!meine && !gleich && <div className="chat-wer">{m.person}</div>}
                    {m.bildId && <Bild kanal={kanal} id={m.bildId} oeffnen={setGross} />}
                    {m.text && <p>{m.text}</p>}
                    <div className="chat-zeit">
                      {uhrzeit(m.zeit)}
                      {(meine || leitung) && <Loeschen onLoeschen={() => void speichern(zeigen, () => deleteDoc(doc(db, "chat", kanal, "nachrichten", m.id)), "Gelöscht")} />}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={ende} />
      </div>
      {foto && (
        <div className="chat-vorschau">
          <img src={foto} alt="Foto zum Senden" />
          <button type="button" className="btn ghost small" onClick={() => setFoto("")}>Foto entfernen</button>
        </div>
      )}
      <form className="chat-eingabe" onSubmit={senden}>
        <input ref={dateiFeld} type="file" accept="image/*" hidden onChange={(e) => void fotoWaehlen(e.target.files?.[0])} aria-label="Foto wählen" />
        <button type="button" className="btn ghost small" onClick={() => dateiFeld.current?.click()}>Foto</button>
        <textarea aria-label="Nachricht" rows={1} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={taste} placeholder="Nachricht schreiben" maxLength={4000} />
        <button className="btn small" disabled={!text.trim() && !foto}>Senden</button>
      </form>
      {gross && (
        <div className="lightbox" role="dialog" aria-label="Foto" onClick={() => setGross("")}>
          <img src={gross} alt="Foto" />
        </div>
      )}
      {element}
    </section>
  );
}

function Liste({ aktiv }: { aktiv: string | null }) {
  const ich = useIch();
  const k = useKommunikation();
  const eintrag = (kanal: string, titel: string) => {
    const s = k.staende[kanal];
    const neu = ungelesen(s, k.gelesen, ich.uid);
    return (
      <Link key={kanal} to={`/chat?k=${kanal}`} className={`chat-kanal${aktiv === kanal ? " aktiv" : ""}${neu ? " neu" : ""}`} aria-current={aktiv === kanal ? "page" : undefined}>
        <span className="item-row">
          <strong>{titel}</strong>
          {neu && <span className="badge">neu</span>}
        </span>
        <span className="hint">{s ? `${s.letzteUid === ich.uid ? "Du" : vorname(s.letztePerson)}: ${s.letzterText}` : "Noch keine Nachrichten"}</span>
      </Link>
    );
  };
  // Direktnachrichten: zuletzt aktive zuerst, dann alphabetisch.
  const personen = [...k.team].sort((a, b) => (k.staende[dmId(ich.uid, b.uid)]?.letzte ?? 0) - (k.staende[dmId(ich.uid, a.uid)]?.letzte ?? 0) || a.name.localeCompare(b.name, "de"));
  return (
    <section className="panel chat-liste" aria-labelledby="h-chats">
      <h2 id="h-chats">Chat</h2>
      <div className="lbl">Gruppen</div>
      <div className="list">{gruppenFuer(ich.rollen).map((g) => eintrag(g.id, g.titel))}</div>
      <div className="lbl">Direkt</div>
      <div className="list">{personen.map((p) => eintrag(dmId(ich.uid, p.uid), p.name))}</div>
      <PushSchalter kurz />
    </section>
  );
}

export function Chat() {
  const ich = useIch();
  const [params] = useSearchParams();
  const kanal = params.get("k");
  const erlaubt = kanal && (gruppenFuer(ich.rollen).some((g) => g.id === kanal) || kanal.split("_").includes(ich.uid));
  return (
    <div className={`chat${erlaubt ? " mit-verlauf" : ""}`}>
      <Liste aktiv={erlaubt ? kanal : null} />
      {erlaubt ? <Verlauf key={kanal} kanal={kanal} /> : (
        <section className={`panel chat-leer${kanal ? " ungueltig" : ""}`}>
          <p className="hint">{kanal ? "Diesen Chat gibt es nicht oder er ist nicht für dich." : "Wähle links eine Gruppe oder eine Person."}</p>
        </section>
      )}
    </div>
  );
}
