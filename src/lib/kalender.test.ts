import { describe, expect, it } from "vitest";
import { kalenderEintraege, monatPlus, monatsRaster, type Quellen, type Termin } from "./kalender";
import type { Buchung } from "./pension";

const leer: Quellen = { termine: [], buchungen: [], fahrten: [], fahrzeugTermine: [], fahrzeuge: [], sitzungen: [] };

const termin = (id: string, w: Partial<Termin> = {}): Termin => ({
  id, titel: "Inventur", datum: "2026-10-20", bis: "2026-10-20", zeit: "", zeitBis: "", ebene: "Laden", ort: "", beschreibung: "", ...w,
});

const buchung = (id: string, w: Partial<Buchung> = {}): Buchung => ({
  id, kundeId: "k1", kundeName: "Meier", hunde: [{ id: "rex", name: "Rex" }], zimmerId: "zimmer-1", von: "2026-10-20", bis: "2026-10-23",
  status: "Bestätigt", leistungen: [], preis: 0, bemerkung: "", bezahlt: false, zahlungsart: "", betrag: 0, bezahltAm: "", ...w,
});

describe("Kalender", () => {
  it("mehrtägige Termine erscheinen an jedem Tag im Zeitraum", () => {
    const e = kalenderEintraege({ ...leer, termine: [termin("ferien", { titel: "Ferien Rahel", ebene: "Personal", datum: "2026-10-18", bis: "2026-10-22" })] }, "2026-10-20", "2026-10-31");
    expect(e.map((x) => x.datum)).toEqual(["2026-10-20", "2026-10-21", "2026-10-22"]);
  });

  it("Pension: Ankunft und Abholung, ohne Anfragen und Stornos", () => {
    const b = [buchung("b1"), buchung("b2", { status: "Anfrage" }), buchung("b3", { status: "Storniert" })];
    const e = kalenderEintraege({ ...leer, buchungen: b }, "2026-10-01", "2026-10-31");
    expect(e.map((x) => [x.datum, x.titel])).toEqual([["2026-10-20", "Ankunft Rex"], ["2026-10-23", "Abholung Rex"]]);
  });

  it("sortiert ganztägige Einträge vor solchen mit Uhrzeit", () => {
    const e = kalenderEintraege({
      ...leer,
      termine: [termin("a", { titel: "Lieferung", zeit: "10:00" }), termin("b", { titel: "Aktion" })],
      sitzungen: [{ id: "s", art: "Teamsitzung", datum: "2026-10-20", zeit: "18:30", ort: "Laden" }],
    }, "2026-10-20", "2026-10-20");
    expect(e.map((x) => x.titel)).toEqual(["Aktion", "Lieferung", "Teamsitzung"]);
  });

  it("Monatsraster beginnt am Montag und endet am Sonntag", () => {
    const r = monatsRaster("2026-10");
    expect(r[0]).toBe("2026-09-28");
    expect(r.at(-1)).toBe("2026-11-01");
    expect(r.length % 7).toBe(0);
    expect(monatPlus("2026-12", 1)).toBe("2027-01");
  });
});
