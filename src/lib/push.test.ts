import { describe, expect, it } from "vitest";
import { abwesenheitPush, aufgabePush, chatEmpfaenger, chatPush, fahrtPush, mitteilungEmpfaenger, pushErlaubt } from "./push";

const team = [
  { uid: "patrick", rollen: ["admin", "geschaeftsfuehrung"] },
  { uid: "cristina", rollen: ["leitung_pension"] },
  { uid: "laura", rollen: ["fahrdienst"] },
  { uid: "rahel", rollen: ["verkauf"] },
  { uid: "it", rollen: ["admin"] },
];

describe("Push-Empfänger", () => {
  it("Gruppen nach Rolle, ohne Absender und ohne reine Admins", () => {
    expect(chatEmpfaenger("pension", "laura", team)).toEqual({ art: "gruppen", uids: ["patrick", "cristina"] });
    expect(chatEmpfaenger("alle", "patrick", team).uids).toEqual(["cristina", "laura", "rahel"]);
    expect(chatEmpfaenger("laden", "rahel", team).uids).toEqual(["patrick"]);
  });

  it("Direktnachricht nur an die andere Person", () => {
    expect(chatEmpfaenger("dm_cristina_laura", "laura", team)).toEqual({ art: "direkt", uids: ["cristina"] });
    expect(chatEmpfaenger("dm_cristina_weg", "cristina", team).uids).toEqual([]);
  });

  it("Text der Push-Nachricht", () => {
    expect(chatPush("pension", "Laura", "Bin   unterwegs", false)).toEqual({ titel: "Laura in Pension", text: "Bin unterwegs", link: "/chat?k=pension", tag: "pension" });
    expect(chatPush("dm_a_b", "Laura", "", true).text).toBe("Foto");
  });

  it("Mitteilungen an alle im Team", () => {
    expect(mitteilungEmpfaenger("patrick", team)).toEqual(["cristina", "laura", "rahel"]);
  });

  it("abgeschaltete Arten", () => {
    expect(pushErlaubt(undefined, "gruppen")).toBe(true);
    expect(pushErlaubt({ gruppen: false }, "gruppen")).toBe(false);
    expect(pushErlaubt({ gruppen: false }, "direkt")).toBe(true);
  });
});

describe("Fahrten", () => {
  const f = { fahrerUid: "laura", datum: "2026-10-20", zeit: "08:30", status: "Geplant", richtung: "Hinweg", kundeName: "Meier", hunde: [{ name: "Rex" }], geaendertVon: "cristina" };
  it("neu zugeteilt, verschoben, abgesagt", () => {
    expect(fahrtPush("f1", undefined, f, "2026-10-18")?.nachricht).toMatchObject({ titel: "Neue Fahrt für dich", text: "20.10.2026 um 08:30 · Abholen: Rex" });
    expect(fahrtPush("f1", f, { ...f, zeit: "09:00" }, "2026-10-18")?.nachricht.titel).toBe("Fahrt verschoben");
    expect(fahrtPush("f1", f, { ...f, status: "Abgesagt" }, "2026-10-18")?.nachricht.titel).toBe("Fahrt abgesagt");
    expect(fahrtPush("f1", f, { ...f, fahrerUid: "nic" }, "2026-10-18")?.uid).toBe("nic");
  });

  it("nichts bei eigener Änderung, Statuswechsel oder vergangenen Fahrten", () => {
    expect(fahrtPush("f1", f, { ...f, status: "Unterwegs", geaendertVon: "laura" }, "2026-10-18")).toBeNull();
    expect(fahrtPush("f1", f, { ...f, status: "Erledigt" }, "2026-10-18")).toBeNull();
    expect(fahrtPush("f1", undefined, f, "2026-10-21")).toBeNull();
    expect(fahrtPush("f1", f, undefined, "2026-10-18")).toBeNull();
    expect(fahrtPush("f1", undefined, { ...f, fahrerUid: "" }, "2026-10-18")).toBeNull();
  });
});

describe("Push für Personal und Aufgaben", () => {
  const voll = [...team, { uid: "morena", rollen: ["leitung_laden"] }, { uid: "nalan", rollen: ["geschaeftsfuehrung"] }];
  const antrag = { mitarbeiterUid: "rahel", mitarbeiterName: "Rahel Winet", bereich: "laden" as const, art: "Ferien" as const, von: "2026-10-19", bis: "2026-10-23", status: "Beantragt" as const };

  it("neuer Antrag an alle, die freigeben dürfen", () => {
    const m = abwesenheitPush(undefined, antrag, voll);
    expect(m?.uids).toEqual(["patrick", "morena", "nalan"]);
    expect(m?.nachricht.titel).toBe("Antrag Ferien: Rahel Winet");
    expect(m?.nachricht.text).toBe("19.10.–23.10.2026 (5 Arbeitstage)");
  });

  it("Entscheid an die Person; Krankheit bleibt vertraulich", () => {
    const m = abwesenheitPush(antrag, { ...antrag, status: "Bewilligt", entscheidUid: "morena", antwort: "Schöne Ferien" }, voll);
    expect(m).toEqual({ uids: ["rahel"], nachricht: { titel: "Ferien bewilligt", text: "19.10.–23.10.2026 (5 Arbeitstage) · Schöne Ferien", link: "/personal/abwesenheiten", tag: "abwesenheit-entscheid" } });
    expect(abwesenheitPush(undefined, { ...antrag, art: "Krank" }, voll)?.nachricht.titel).toBe("Antrag Abwesenheit: Rahel Winet");
    expect(abwesenheitPush(undefined, { ...antrag, status: "Bewilligt" }, voll)).toBeNull();
    expect(abwesenheitPush(antrag, { ...antrag, notiz: "x" } as typeof antrag, voll)).toBeNull();
  });

  it("Aufgabe nur bei neuer Zuteilung durch jemand anderen", () => {
    const a = { titel: "Inventur", zustaendigUid: "rahel", faellig: "2026-10-25", person: "Morena Riccardi", uid: "morena", erledigt: false };
    expect(aufgabePush("x", undefined, a)).toEqual({ uid: "rahel", nachricht: { titel: "Aufgabe: Inventur", text: "fällig 25.10.2026 · von Morena Riccardi", link: "/aufgaben", tag: "aufgabe_x" } });
    expect(aufgabePush("x", a, { ...a, faellig: "2026-11-01" })).toBeNull();
    expect(aufgabePush("x", undefined, { ...a, zustaendigUid: "morena" })).toBeNull();
    expect(aufgabePush("x", undefined, { ...a, zustaendigUid: "" })).toBeNull();
  });
});
