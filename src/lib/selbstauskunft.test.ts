import { describe, expect, it } from "vitest";
import type { Hund, Kunde } from "./pension";
import { bereinigen, einladung, fehlt, leereKundeAngaben, leererHundAngaben, neuerToken, uebernahme, vorlageAus, waNummer } from "./selbstauskunft";

const kunde = { id: "k1", name: "Meier Anna", nachname: "Meier", vorname: "Anna", telefon: "079 000 00 00", notiz: "zahlt immer bar" } as Kunde;
const rex = { id: "h1", kundeId: "k1", name: "Rex", rasse: "Labrador", kastriert: true, vertraeglich: false, impfungen: [{ art: "Tollwut", gueltigBis: "2027-01-01" }], notiz: "beisst beim Bürsten", gewichtsklasse: "mittel" } as Hund;

describe("bereinigen", () => {
  it("lässt nur bekannte Felder durch und kürzt zu lange Texte", () => {
    const a = bereinigen({
      kunde: { nachname: "  Meier ", vorname: "Anna", telefon: "079", rolle: "admin", geburtsdatum: "gestern", notiz: "x".repeat(3000) },
      hunde: [{ name: "Rex", gesundheit: 5, geschlecht: "Kater", kastriert: "ja", vertraeglich: false, impfungen: [{ art: "Tollwut", gueltigBis: "2027-01-01", x: 1 }, { art: "" }], kundeId: "fremd" }, { name: "" }],
    });
    expect(a.kunde.nachname).toBe("Meier");
    expect(a.kunde).not.toHaveProperty("rolle");
    expect(a.kunde.geburtsdatum).toBe("");
    expect(a.kunde.notiz).toHaveLength(2000);
    expect(a.hunde).toHaveLength(1);
    expect(a.hunde[0]).not.toHaveProperty("kundeId");
    expect(a.hunde[0]).toMatchObject({ name: "Rex", gesundheit: "", geschlecht: "", kastriert: false, vertraeglich: false, impfungen: [{ art: "Tollwut", gueltigBis: "2027-01-01" }] });
  });

  it("verträgt Unsinn", () => {
    expect(bereinigen(null).hunde).toEqual([]);
    expect(bereinigen({ hunde: "Rex" }).hunde).toEqual([]);
  });
});

describe("fehlt", () => {
  it("verlangt Name, Vorname, Telefon und bei jedem Hund einen Namen", () => {
    const k = { ...leereKundeAngaben(), nachname: "Meier", vorname: "Anna", telefon: "079" };
    const h = { ...leererHundAngaben(), name: "Rex" };
    expect(fehlt({ kunde: k, hunde: [h] })).toBe("");
    expect(fehlt({ kunde: { ...k, vorname: " " }, hunde: [h] })).toMatch(/Vorname/);
    expect(fehlt({ kunde: { ...k, telefon: "" }, hunde: [h] })).toMatch(/Telefon/);
    expect(fehlt({ kunde: k, hunde: [] })).toMatch(/Hund/);
    expect(fehlt({ kunde: k, hunde: [h, { ...h, name: "" }] })).toMatch(/Hund/);
  });
});

describe("Vorlage und Übernahme", () => {
  it("die Vorlage zeigt der Kundschaft keine Notizen des Teams", () => {
    const v = vorlageAus(kunde, [rex]);
    expect(v.kunde.nachname).toBe("Meier");
    expect(v.kunde.notiz).toBe("");
    expect(v.hunde[0]).toMatchObject({ id: "h1", name: "Rex", notiz: "", vertraeglich: false });
  });

  it("bestehende Einträge werden aktualisiert, neue angelegt, Notizen angehängt", () => {
    const v = vorlageAus(kunde, [rex]);
    v.kunde.telefon = "079 111 11 11";
    v.kunde.notiz = "Schlüssel beim Nachbarn";
    v.hunde[0].gewicht = "47";
    v.hunde.push({ ...leererHundAngaben(), name: "Bella", id: "h-fremd", notiz: "frisst Socken" });
    const u = uebernahme(v, kunde, [rex, { ...rex, id: "h-fremd", kundeId: "k2" }]);
    expect(u.kunde).toEqual({ id: "k1", felder: expect.objectContaining({ name: "Meier Anna", telefon: "079 111 11 11", notiz: "zahlt immer bar\nVom Stammblatt: Schlüssel beim Nachbarn" }) });
    expect(u.hunde[0]).toEqual({ id: "h1", felder: expect.objectContaining({ name: "Rex", gewichtsklasse: "gross", notiz: "beisst beim Bürsten" }) });
    expect(u.hunde[1].id).toBeNull();
    expect(u.hunde[1].felder).toMatchObject({ name: "Bella", notiz: "Vom Stammblatt: frisst Socken", gewichtsklasse: "" });
    expect(u.hunde[1].felder).not.toHaveProperty("id");
  });

  it("ohne Kartei-Eintrag ist alles neu", () => {
    const a = { kunde: { ...leereKundeAngaben(), nachname: "Muster", vorname: "Max", telefon: "1" }, hunde: [{ ...leererHundAngaben(), name: "Bello", id: "h1" }] };
    const u = uebernahme(a, undefined, [rex]);
    expect(u.kunde.id).toBeNull();
    expect(u.kunde.felder.name).toBe("Muster Max");
    expect(u.hunde[0].id).toBeNull();
  });
});

describe("Link", () => {
  it("Schlüssel sind lang und zufällig", () => {
    const t = neuerToken();
    expect(t).toMatch(/^[A-Za-z0-9]{24}$/);
    expect(neuerToken()).not.toBe(t);
  });

  it("WhatsApp-Nummer und Einladungstext", () => {
    expect(waNummer("079 123 45 67")).toBe("41791234567");
    expect(waNummer("+41 79 123 45 67")).toBe("41791234567");
    expect(waNummer("0049 170 1234567")).toBe("491701234567");
    expect(einladung("https://x/stammblatt/abc", "Anna Meier")).toContain("Grüezi Anna Meier");
  });
});
