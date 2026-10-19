import { describe, expect, it } from "vitest";
import { chatEmpfaenger, chatPush, fahrtPush, mitteilungEmpfaenger, pushErlaubt } from "./push";

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
