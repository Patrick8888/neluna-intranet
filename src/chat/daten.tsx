// Live-Daten von Chat und Mitteilungen für die ganze App: Ungelesen-Zähler in der Navigation und im Fenstertitel.
// Hinweise bei geschlossener App kommen als Push-Nachricht (functions/, public/sw.js).
import { createContext, use, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, Timestamp } from "firebase/firestore";
import { db } from "../firebase";
import { useIch } from "../auth";
import { dmId, dmPartner, GRUPPEN, gruppenFuer, offeneMitteilungen, ungelesen, type KanalStand, type Mitteilung } from "../lib/chat";
import { darf } from "../lib/rollen";
import { useTeam, type TeamPerson } from "../ui";
import { pushAuffrischen } from "../push";

export type Kommunikation = {
  /** Stand je Kanal (Gruppen und Direktnachrichten), sofern schon geschrieben wurde. */
  staende: Record<string, KanalStand>;
  gelesen: Record<string, number>;
  /** Personen, mit denen man Direktnachrichten schreiben kann. */
  team: TeamPerson[];
  mitteilungen: Mitteilung[];
  ungeleseneChats: number;
  offeneMitteilungen: number;
  /** Den gerade offenen Kanal melden, damit er als gelesen gilt und keinen Hinweis auslöst. */
  setOffen: (kanal: string | null) => void;
  alsGelesen: (kanal: string) => void;
};

const Kontext = createContext<Kommunikation | null>(null);

const ms = (t: unknown) => (t instanceof Timestamp ? t.toMillis() : 0);

export function KommunikationProvider({ children }: { children: ReactNode }) {
  const ich = useIch();
  const mitChat = darf(ich.rollen, "chat");
  const alleImTeam = useTeam();
  const team = useMemo(() => alleImTeam.filter((p) => p.uid !== ich.uid && p.rollen.some((r) => r !== "admin")), [alleImTeam, ich.uid]);
  const [staende, setStaende] = useState<Record<string, KanalStand>>({});
  const [gelesen, setGelesen] = useState<Record<string, number>>({});
  const [mitteilungen, setMitteilungen] = useState<Mitteilung[]>([]);
  const offen = useRef<string | null>(null);

  const kanaele = useMemo(
    () => (mitChat ? [...gruppenFuer(ich.rollen).map((g) => g.id as string), ...team.map((p) => dmId(ich.uid, p.uid))] : []),
    [mitChat, ich.rollen, ich.uid, team],
  );
  const kanalSchluessel = kanaele.join(",");

  useEffect(() => {
    const stopp = kanalSchluessel.split(",").filter(Boolean).map((k) =>
      onSnapshot(doc(db, "chat", k), (snap) => {
        const d = snap.data({ serverTimestamps: "estimate" });
        if (!d) return;
        const s: KanalStand = { id: k, letzte: ms(d.letzte), letzterText: String(d.letzterText ?? ""), letztePerson: String(d.letztePerson ?? ""), letzteUid: String(d.letzteUid ?? "") };
        setStaende((alt) => ({ ...alt, [k]: s }));
      }, () => {}),
    );
    return () => stopp.forEach((s) => s());
  }, [kanalSchluessel]);

  useEffect(() => {
    if (!mitChat) return;
    return onSnapshot(doc(db, "chat_gelesen", ich.uid), (snap) => {
      const d = snap.data({ serverTimestamps: "estimate" }) ?? {};
      setGelesen(Object.fromEntries(Object.entries(d).map(([k, v]) => [k, ms(v)])));
    }, () => {});
  }, [mitChat, ich.uid]);

  useEffect(() => {
    if (!mitChat) return;
    return onSnapshot(query(collection(db, "mitteilungen"), orderBy("erstellt", "desc"), limit(100)), (snap) => {
      setMitteilungen(snap.docs.map((x) => ({ id: x.id, gelesen: {}, ...x.data() }) as Mitteilung));
    }, () => setMitteilungen([]));
  }, [mitChat]);

  const alsGelesen = (kanal: string) => {
    void setDoc(doc(db, "chat_gelesen", ich.uid), { [kanal]: serverTimestamp() }, { merge: true }).catch(() => {});
  };

  // Im offenen Kanal gilt alles als gelesen, sobald es auf dem Bildschirm ist.
  useEffect(() => {
    const k = offen.current;
    if (k && !document.hidden && ungelesen(staende[k], gelesen, ich.uid)) alsGelesen(k);
  });
  useEffect(() => {
    const sichtbar = () => {
      const k = offen.current;
      if (k && !document.hidden) alsGelesen(k);
    };
    document.addEventListener("visibilitychange", sichtbar);
    return () => document.removeEventListener("visibilitychange", sichtbar);
  });

  const ungeleseneChats = kanaele.filter((k) => ungelesen(staende[k], gelesen, ich.uid)).length;
  const offeneM = offeneMitteilungen(mitteilungen, ich.uid).length;

  // Gespeichertes Push-Gerät beim Start auffrischen (Tokens erneuern sich gelegentlich).
  useEffect(() => { void pushAuffrischen(ich.uid).catch(() => {}); }, [ich.uid]);

  useEffect(() => {
    const n = ungeleseneChats + offeneM;
    document.title = n ? `(${n}) NeLuna's Pfötli Buch` : "NeLuna's Pfötli Buch";
  }, [ungeleseneChats, offeneM]);

  const wert: Kommunikation = {
    staende, gelesen, team, mitteilungen, ungeleseneChats, offeneMitteilungen: offeneM, alsGelesen,
    setOffen: (k) => {
      offen.current = k;
      if (k && ungelesen(staende[k], gelesen, ich.uid)) alsGelesen(k);
    },
  };
  return <Kontext value={wert}>{children}</Kontext>;
}

export function useKommunikation(): Kommunikation {
  const k = use(Kontext);
  if (!k) throw new Error("useKommunikation ausserhalb von KommunikationProvider");
  return k;
}

/** Titel eines Kanals für Liste und Kopf. */
export function kanalTitel(kanal: string, ich: string, team: TeamPerson[]): string {
  const g = GRUPPEN.find((x) => x.id === kanal);
  if (g) return g.titel;
  const p = dmPartner(kanal, ich);
  return team.find((x) => x.uid === p)?.name ?? "Direktnachricht";
}
