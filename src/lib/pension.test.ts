import { describe, expect, it } from "vitest";
import {
  abrechnungBetrag, abrechnungCsv, abrechnungTage, auslastung, klasseAusGewicht, mwstAufteilen, preiseAus, preisProHund, STANDARD_PREISE,
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
  it("ergänzt die Standardzimmer mit gespeicherten Einstellungen", () => {
    expect(zimmer).toHaveLength(10);
    expect(zimmer.map((z) => z.name).slice(5, 8)).toEqual(["Zimmer 6", "Hundezimmer Hunde Mitarbeiter", "Zimmer Erika"]);
    expect(zimmer[1]).toMatchObject({ id: "zimmer-2", maxHunde: 2 });
    expect(zimmer[0].maxHunde).toBe(STANDARD_ZIMMER[0].maxHunde);
  });
});

describe("Belegung", () => {
  it("der Abholtag ist wieder frei", () => {
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

  it("Ankunft am Abholtag des Vorgängers ist erlaubt", () => {
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

describe("Gewichtsklassen", () => {
  const z = zimmerListe([{ id: "zimmer-4", name: "Zimmer 4", maxHunde: 3, plaetze: { klein: 3, mittel: 2, gross: 1 }, aktiv: true, notiz: "" }]);
  const h = [hund("mini", { gewichtsklasse: "klein" }), hund("mini2", { gewichtsklasse: "klein" }), hund("mittel", { gewichtsklasse: "mittel" }), hund("riese", { gewichtsklasse: "gross" })];

  it("ordnet das Gewicht einer Klasse zu", () => {
    expect([klasseAusGewicht("12"), klasseAusGewicht("25"), klasseAusGewicht("45"), klasseAusGewicht("45,5"), klasseAusGewicht("")]).toEqual(["klein", "mittel", "mittel", "gross", ""]);
  });

  it("ein grosser Hund füllt das Zimmer, kleine teilen es", () => {
    const zi = z.find((x) => x.id === "zimmer-4")!;
    expect(auslastung(zi, ["klein", "klein", "klein"])).toBeCloseTo(1);
    const d = { buchungen: [buchung("a", { zimmerId: "zimmer-4", hunde: [{ id: "riese", name: "riese" }] })], zimmer: z, hunde: h };
    expect(belegungPruefen(d, { zimmerId: "zimmer-4", von: "2026-10-21", bis: "2026-10-22", hundIds: ["mini"] })).toMatch(/zu wenig Platz für diese Grösse/);
    const d2 = { buchungen: [buchung("a", { zimmerId: "zimmer-4", hunde: [{ id: "mini", name: "mini" }] })], zimmer: z, hunde: h };
    expect(belegungPruefen(d2, { zimmerId: "zimmer-4", von: "2026-10-21", bis: "2026-10-22", hundIds: ["mini2", "mittel"] })).toMatch(/zu wenig Platz/);
    expect(belegungPruefen(d2, { zimmerId: "zimmer-4", von: "2026-10-21", bis: "2026-10-22", hundIds: ["mittel"] })).toBeNull();
  });

  it("eine Klasse mit 0 Plätzen passt nicht ins Zimmer", () => {
    const z0 = zimmerListe([{ id: "zimmer-5", name: "Zimmer 5", maxHunde: 2, plaetze: { klein: 2, mittel: 1, gross: 0 }, aktiv: true, notiz: "" }]);
    expect(belegungPruefen({ buchungen: [], zimmer: z0, hunde: h }, { zimmerId: "zimmer-5", von: "2026-10-21", bis: "2026-10-22", hundIds: ["riese"] })).toMatch(/«riese» \(ab 45 kg\) passt nicht/);
  });
});

describe("Abrechnung", () => {
  it("zählt Nächte, Tage und Tagesbetreuung pro Hund im Monat", () => {
    const b = [
      buchung("a", { von: "2026-10-30", bis: "2026-11-02" }),
      buchung("b", { von: "2026-10-05", bis: "2026-10-05" }),
      buchung("c", { von: "2026-10-10", bis: "2026-10-12", status: "Storniert" }),
      buchung("t", { kundeId: "team", von: "2026-10-01", bis: "2026-10-31" }),
    ];
    const kunden = [{ id: "team", name: "Team", telefon: "", email: "", adresse: "", notfallkontakt: "", tierarzt: "", notiz: "", team: true }];
    expect(abrechnungTage(b, kunden, "2026-10")).toEqual([{ kunde: "Meier", hund: "rex", naechte: 2, tage: 2, tagesbetreuung: 1, aufenthalte: 2 }]);
    expect(abrechnungTage(b, kunden, "2026-11")).toEqual([{ kunde: "Meier", hund: "rex", naechte: 1, tage: 2, tagesbetreuung: 0, aufenthalte: 1 }]);
  });
});

describe("Preise und MWST", () => {
  it("Ferien: jeder Tag Tagesbetreuung plus jede Nacht; Tagesgast ein Tag", () => {
    expect(preisProHund({ von: "2026-10-23", bis: "2026-10-25" }, STANDARD_PREISE)).toBe(235);
    expect(preisProHund({ von: "2026-10-23", bis: "2026-10-23" }, STANDARD_PREISE)).toBe(65);
    expect(abrechnungBetrag({ tage: 3, naechte: 2, tagesbetreuung: 1 }, STANDARD_PREISE)).toBe(300);
  });

  it("CSV mit Betrag und MWST-Anteil", () => {
    const csv = abrechnungCsv([{ kunde: "Meier", hund: "Rex", naechte: 2, tage: 3, tagesbetreuung: 0, aufenthalte: 1 }], STANDARD_PREISE);
    expect(csv.split("\r\n")[1]).toBe("Meier;Rex;2;3;0;1;235.00;17.61");
  });

  it("gespeicherte Preise, fehlende Werte aus dem Standard", () => {
    expect(preiseAus(undefined)).toEqual(STANDARD_PREISE);
    expect(preiseAus({ tagesbetreuung: 70, uebernachtung: "x" })).toEqual({ tagesbetreuung: 70, uebernachtung: 20 });
  });

  it("Tagesumsatz nach Satz: Hofladen-Futter 2.6 %, Zubehör und Pension 8.1 %", () => {
    expect(mwstAufteilen(500, 102.6, 50)).toEqual({ pension: 347.4, umsatz81: 397.4, umsatz26: 102.6, mwst81: 29.78, mwst26: 2.6 });
    expect(mwstAufteilen(108.1, 0, 0)).toMatchObject({ umsatz81: 108.1, mwst81: 8.1, mwst26: 0 });
  });
});
