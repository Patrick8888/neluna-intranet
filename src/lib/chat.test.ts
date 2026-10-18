import { describe, expect, it } from "vitest";
import { dmId, dmPartner, gruppenFuer, nachTagen, nochNichtGelesen, offeneMitteilungen, ungelesen, vorschau, type Mitteilung } from "./chat";

describe("Chat", () => {
  it("Gruppen nach Rolle", () => {
    expect(gruppenFuer(["fahrdienst"]).map((g) => g.id)).toEqual(["alle", "pension"]);
    expect(gruppenFuer(["verkauf"]).map((g) => g.id)).toEqual(["alle", "laden"]);
    expect(gruppenFuer(["leitung_laden"]).map((g) => g.id)).toEqual(["alle", "laden", "leitung"]);
    expect(gruppenFuer(["admin"])).toEqual([]);
  });

  it("Direktnachricht: gleiche ID von beiden Seiten", () => {
    expect(dmId("zora", "anna")).toBe("dm_anna_zora");
    expect(dmId("anna", "zora")).toBe("dm_anna_zora");
    expect(dmPartner("dm_anna_zora", "zora")).toBe("anna");
    expect(dmPartner("dm_anna_zora", "beat")).toBeNull();
    expect(dmPartner("pension", "anna")).toBeNull();
  });

  it("ungelesen nur, wenn jemand anderes nach dem letzten Lesen schrieb", () => {
    const k = { id: "alle", letzte: 2000, letzterText: "Hallo", letztePerson: "Nic", letzteUid: "nic" };
    expect(ungelesen(k, {}, "laura")).toBe(true);
    expect(ungelesen(k, { alle: 2500 }, "laura")).toBe(false);
    expect(ungelesen({ ...k, letzteUid: "laura" }, {}, "laura")).toBe(false);
    expect(ungelesen(undefined, {}, "laura")).toBe(false);
  });

  it("Vorschau und Tage", () => {
    expect(vorschau("  Hallo\n  zusammen ", false)).toBe("Hallo zusammen");
    expect(vorschau("", true)).toBe("Foto");
    expect(vorschau("x".repeat(100), false, 10)).toBe("xxxxxxxxx…");
    const tag = (ms: number) => (ms < 100 ? "a" : "b");
    expect(nachTagen([{ zeit: 1 }, { zeit: 2 }, { zeit: 200 }], tag).map((g) => [g.tag, g.nachrichten.length])).toEqual([["a", 2], ["b", 1]]);
  });
});

describe("Mitteilungen", () => {
  const m = (id: string, w: Partial<Mitteilung> = {}): Mitteilung => ({ id, titel: "Info", text: "Text", wichtig: false, erstellt: "2026-10-18T10:00:00", person: "Patrick", uid: "patrick", gelesen: {}, ...w });
  it("offen sind fremde, noch nicht bestätigte Mitteilungen", () => {
    const liste = [m("a"), m("b", { gelesen: { laura: "2026-10-18T11:00:00" } }), m("c", { uid: "laura" })];
    expect(offeneMitteilungen(liste, "laura").map((x) => x.id)).toEqual(["a"]);
    expect(nochNichtGelesen(liste[1], [{ uid: "patrick" }, { uid: "laura" }, { uid: "nic" }]).map((p) => p.uid)).toEqual(["nic"]);
  });
});
