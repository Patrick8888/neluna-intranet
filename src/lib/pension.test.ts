import { describe, expect, it } from "vitest";
import {
  aufgabenFuer, bargeldSumme, belegteTage, belegungPruefen, impfWarnungen, istDa, kassenVorschlag, naechte, zimmerListe,
  STANDARD_ZIMMER, type Buchung, type Hund,
} from "./pension";

const hund = (id: string, w: Partial<Hund> = {}): Hund => ({
  id, kundeId: "k1", name: id, rasse: "", geburtsdatum: "", geschlecht: "", kastriert: false, futter: "", menge: "",
  medikamente: "", allergien: "", verhalten: "", vertraeglich: true, notiz: "", impfungen: [], ...w,
});

const buchung = (id: string, w: Partial<Buchung> = {}): Buchung => ({
  id, kundeId: "k1", kundeName: "Meier", hunde: [{ id: "rex", name: "rex" }], zimmerId: "zimmer-1", von: "2026-10-20", bis: "2026-10-23",
  status: "Bestätigt", leistungen: [], preis: 150, bemerkung: "", bezahlt: false, zahlungsart: "", betrag: 0, bezahltAm: "", ...w,
});

const zimmer = zimmerListe([{ id: "zimmer-2", name: "Zimmer 2", maxHunde: 2, aktiv: true, notiz: "" }]);
const hunde = [hund("rex"), hund("bello"), hund("luna"), hund("wild", { vertraeglich: false })];

describe("Zimmer", () => {
  it("ergänzt die sechs Standardzimmer mit gespeicherten Einstellungen", () => {
    expect(zimmer).toHaveLength(6);
    expect(zimmer[1]).toMatchObject({ id: "zimmer-2", maxHunde: 2 });
    expect(zimmer[0].maxHunde).toBe(STANDARD_ZIMMER[0].maxHunde);
  });
});

describe("Belegung", () => {
  it("der Abreisetag ist wieder frei", () => {
    expect(belegteTage({ von: "2026-10-20", bis: "2026-10-23" })).toEqual(["2026-10-20", "2026-10-22"]);
    expect(belegteTage({ von: "2026-10-20", bis: "2026-10-20" })).toEqual(["2026-10-20", "2026-10-20"]);
    expect(naechte({ von: "2026-10-20", bis: "2026-10-23" })).toBe(3);
  });

  it("ein freies Zimmer passt", () => {
    const d = { buchungen: [buchung("a")], zimmer, hunde };
    expect(belegungPruefen(d, { zimmerId: "zimmer-3", von: "2026-10-21", bis: "2026-10-22", hundIds: ["bello"] })).toBeNull();
  });

  it("verhindert Doppelbelegung eines Einzelzimmers", () => {
    const d = { buchungen: [buchung("a")], zimmer, hunde };
    expect(belegungPruefen(d, { zimmerId: "zimmer-1", von: "2026-10-22", bis: "2026-10-25", hundIds: ["bello"] })).toMatch(/Zimmer 1 ist am 22\.10\.2026 voll/);
  });

  it("Anreise am Abreisetag des Vorgängers ist erlaubt", () => {
    const d = { buchungen: [buchung("a")], zimmer, hunde };
    expect(belegungPruefen(d, { zimmerId: "zimmer-1", von: "2026-10-23", bis: "2026-10-25", hundIds: ["bello"] })).toBeNull();
  });

  it("stornierte Buchungen und die eigene Buchung zählen nicht", () => {
    const d = { buchungen: [buchung("a", { status: "Storniert" }), buchung("b", { hunde: [{ id: "bello", name: "bello" }] })], zimmer, hunde };
    expect(belegungPruefen(d, { id: "b", zimmerId: "zimmer-1", von: "2026-10-20", bis: "2026-10-23", hundIds: ["bello"] })).toBeNull();
  });

  it("verträgliche Hunde teilen ein Doppelzimmer, unverträgliche nicht", () => {
    const d = { buchungen: [buchung("a", { zimmerId: "zimmer-2" })], zimmer, hunde };
    expect(belegungPruefen(d, { zimmerId: "zimmer-2", von: "2026-10-21", bis: "2026-10-22", hundIds: ["bello"] })).toBeNull();
    expect(belegungPruefen(d, { zimmerId: "zimmer-2", von: "2026-10-21", bis: "2026-10-22", hundIds: ["wild"] })).toMatch(/«wild» ist nicht als verträglich/);
    expect(belegungPruefen(d, { zimmerId: "zimmer-2", von: "2026-10-21", bis: "2026-10-22", hundIds: ["bello", "luna"] })).toMatch(/voll/);
  });

  it("Hunde derselben Familie dürfen auch unverträglich zusammen", () => {
    const d = { buchungen: [], zimmer, hunde };
    expect(belegungPruefen(d, { zimmerId: "zimmer-2", von: "2026-10-21", bis: "2026-10-22", hundIds: ["wild", "rex"] })).toBeNull();
  });

  it("ein Hund kann nicht gleichzeitig in zwei Zimmern sein", () => {
    const d = { buchungen: [buchung("a")], zimmer, hunde };
    expect(belegungPruefen(d, { zimmerId: "zimmer-3", von: "2026-10-21", bis: "2026-10-22", hundIds: ["rex"] })).toMatch(/schon gebucht \(Zimmer 1/);
  });

  it("prüft Eingaben", () => {
    const d = { buchungen: [], zimmer, hunde };
    expect(belegungPruefen(d, { zimmerId: "zimmer-1", von: "2026-10-22", bis: "2026-10-21", hundIds: ["rex"] })).toMatch(/vor der Ankunft/);
    expect(belegungPruefen(d, { zimmerId: "zimmer-1", von: "2026-10-21", bis: "2026-10-22", hundIds: [] })).toMatch(/mindestens einen Hund/);
    expect(belegungPruefen(d, { zimmerId: "zimmer-1", von: "2026-10-21", bis: "2026-10-22", hundIds: ["rex", "bello"] })).toMatch(/Platz für 1 Hund/);
  });

  it("Anfragen und Stornos sind nicht im Haus", () => {
    expect(istDa(buchung("a"), "2026-10-23")).toBe(true);
    expect(istDa(buchung("a", { status: "Anfrage" }), "2026-10-21")).toBe(false);
    expect(istDa(buchung("a"), "2026-10-24")).toBe(false);
  });
});

describe("Hunde", () => {
  it("warnt bei fehlenden oder ablaufenden Impfungen", () => {
    expect(impfWarnungen(hund("rex"), "2026-10-23", "2026-10-18")).toEqual(["rex: keine Impfung erfasst"]);
    const h = hund("rex", { impfungen: [{ art: "Tollwut", gueltigBis: "2026-10-21" }, { art: "Kombi", gueltigBis: "2027-05-01" }] });
    expect(impfWarnungen(h, "2026-10-23", "2026-10-18")).toEqual(["rex: Tollwut läuft ab am 21.10.2026"]);
  });

  it("Medikamente erscheinen nur, wenn welche erfasst sind", () => {
    expect(aufgabenFuer({ medikamente: "" }).map(([k]) => k)).not.toContain("medikament");
    expect(aufgabenFuer({ medikamente: "Apoquel 1×" }).map(([k]) => k)).toContain("medikament");
  });
});

describe("Kasse Pension", () => {
  it("übernimmt bezahlte Check-outs des Tages nach Zahlungsart", () => {
    const v = kassenVorschlag([
      buchung("a", { bezahlt: true, bezahltAm: "2026-10-23", zahlungsart: "Bar", betrag: 150 }),
      buchung("b", { bezahlt: true, bezahltAm: "2026-10-23", zahlungsart: "TWINT", betrag: 90.5 }),
      buchung("c", { bezahlt: true, bezahltAm: "2026-10-23", zahlungsart: "Rechnung", betrag: 300 }),
      buchung("d", { bezahlt: true, bezahltAm: "2026-10-22", zahlungsart: "Bar", betrag: 999 }),
    ], "2026-10-23");
    expect(v).toEqual({ bar: 150, karte: 0, twint: 90.5, rechnung: 300, anzahl: 3 });
  });

  it("zählt Noten und Münzen", () => {
    expect(bargeldSumme({ "100": 2, "20": "3", "0.5": 1, "0.05": 3 })).toBe(260.65);
    expect(bargeldSumme({ "10": -2, "5": "abc" })).toBe(0);
  });
});
