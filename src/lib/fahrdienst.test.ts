import { describe, expect, it } from "vitest";
import {
  faelligeTermine, fahrtenAusBuchungen, fahrtId, fahrtPruefen, naechsterTermin, plusMonate, tagesRoute,
  type Fahrt, type Fahrzeug, type FahrzeugTermin,
} from "./fahrdienst";
import type { Buchung, Kunde } from "./pension";

const buchung = (id: string, w: Partial<Buchung> = {}): Buchung => ({
  id, kundeId: "k1", kundeName: "Meier", hunde: [{ id: "rex", name: "Rex" }], zimmerId: "zimmer-1", von: "2026-10-20", bis: "2026-10-23",
  status: "Bestätigt", leistungen: ["Fahrdienst Hinweg", "Fahrdienst Rückweg"], preis: 150, bemerkung: "", bezahlt: false, zahlungsart: "", betrag: 0, bezahltAm: "", ...w,
});

const kunden: Kunde[] = [{ id: "k1", name: "Meier", telefon: "079 111 22 33", email: "", adresse: "Dorfstrasse 1, 8253 Willisdorf", notfallkontakt: "", tierarzt: "", notiz: "" }];

const fahrt = (id: string, w: Partial<Fahrt> = {}): Fahrt => ({
  id, datum: "2026-10-20", zeit: "", richtung: "Hinweg", buchungId: "", kundeName: "Meier", telefon: "", adresse: "Dorfstrasse 1",
  hunde: [], fahrerUid: "", fahrerName: "", fahrzeugId: "", fahrzeugName: "", status: "Geplant", notiz: "", ...w,
});

const caddy: Fahrzeug = { id: "caddy", name: "VW Caddy", kennzeichen: "SH 12345", kmStand: 48_500, aktiv: true, notiz: "" };

const termin = (id: string, w: Partial<FahrzeugTermin> = {}): FahrzeugTermin => ({
  id, fahrzeugId: "caddy", art: "Reifenwechsel", datum: "2026-10-25", zeit: "", garage: "Garage Huber", kosten: 0, kmStand: 0, faelligKm: 0,
  blockiert: false, wiederholungMonate: 6, wiederholungKm: 0, notiz: "", erledigt: false, erledigtAm: "", ...w,
});

describe("Fahrten aus Buchungen", () => {
  it("schlägt Hin- und Rückweg mit Adresse und Telefon vor", () => {
    const { fehlend } = fahrtenAusBuchungen([buchung("b1")], [], kunden, "2026-10-18");
    expect(fehlend.map((f) => [f.id, f.datum, f.richtung])).toEqual([
      ["b_b1_hin", "2026-10-20", "Hinweg"],
      ["b_b1_rueck", "2026-10-23", "Rückweg"],
    ]);
    expect(fehlend[0]).toMatchObject({ telefon: "079 111 22 33", adresse: "Dorfstrasse 1, 8253 Willisdorf" });
  });

  it("nur gebuchte Richtungen, keine Anfragen, nichts aus der Vergangenheit", () => {
    const b = [buchung("b1", { leistungen: ["Fahrdienst Rückweg"] }), buchung("b2", { status: "Anfrage" }), buchung("b3", { von: "2026-10-01", bis: "2026-10-05" })];
    expect(fahrtenAusBuchungen(b, [], kunden, "2026-10-18").fehlend.map((f) => f.id)).toEqual(["b_b1_rueck"]);
  });

  it("eingeplante Fahrten werden nicht doppelt vorgeschlagen", () => {
    const { fehlend } = fahrtenAusBuchungen([buchung("b1")], [fahrt(fahrtId("b1", "Hinweg"))], kunden, "2026-10-18");
    expect(fehlend.map((f) => f.id)).toEqual(["b_b1_rueck"]);
  });

  it("meldet Fahrten, deren Buchung geändert oder storniert wurde", () => {
    const f = [fahrt("b_b1_hin", { buchungId: "b1" }), fahrt("b_b2_rueck", { richtung: "Rückweg", datum: "2026-10-23" })];
    const { abweichend } = fahrtenAusBuchungen([buchung("b1", { von: "2026-10-21" }), buchung("b2", { status: "Storniert" })], f, kunden, "2026-10-18");
    expect(abweichend.map((a) => [a.fahrt.id, a.datum ?? a.grund])).toEqual([["b_b1_hin", "2026-10-21"], ["b_b2_rueck", "Buchung storniert"]]);
  });
});

describe("Fahrzeuge", () => {
  it("ein Garagentermin blockiert das Fahrzeug an diesem Tag", () => {
    const termine = [termin("t1", { blockiert: true })];
    expect(fahrtPruefen({ datum: "2026-10-25", fahrzeugId: "caddy", adresse: "x", status: "Geplant" }, [caddy], termine)).toMatch(/in der Garage/);
    expect(fahrtPruefen({ datum: "2026-10-26", fahrzeugId: "caddy", adresse: "x", status: "Geplant" }, [caddy], termine)).toBeNull();
    expect(fahrtPruefen({ datum: "2026-10-26", fahrzeugId: "caddy", adresse: " ", status: "Geplant" }, [caddy], termine)).toMatch(/Adresse/);
  });

  it("Monate addieren bleibt im Monat", () => {
    expect(plusMonate("2026-10-15", 6)).toBe("2027-04-15");
    expect(plusMonate("2027-01-31", 1)).toBe("2027-02-28");
  });

  it("wiederkehrende Termine erzeugen den nächsten", () => {
    expect(naechsterTermin(termin("t1", { kosten: 120, erledigt: true }), 48_500)).toMatchObject({ datum: "2027-04-25", kosten: 0, erledigt: false });
    expect(naechsterTermin(termin("t2", { art: "Service", wiederholungMonate: 0, wiederholungKm: 15_000, kmStand: 48_600 }), 48_500)).toMatchObject({ faelligKm: 63_600 });
    expect(naechsterTermin(termin("t3", { wiederholungMonate: 0 }), 0)).toBeNull();
  });

  it("zeigt fällige Termine nach Datum und nach Kilometern", () => {
    const termine = [
      termin("bald"),
      termin("spaeter", { datum: "2027-03-01" }),
      termin("vorbei", { datum: "2026-10-01" }),
      termin("km", { art: "Service", wiederholungMonate: 0, faelligKm: 49_000 }),
      termin("fertig", { datum: "2026-10-01", erledigt: true }),
    ];
    const f = faelligeTermine(termine, [caddy], "2026-10-18");
    expect(f.map((x) => [x.termin.id, x.ueberfaellig])).toEqual([["vorbei", true], ["bald", false], ["km", false]]);
  });
});

describe("Probleme", () => {
  it("ein Problem «nicht fahrbereit» blockiert, bis es erledigt ist, und bleibt in der Liste", () => {
    const p = termin("p", { art: "Problem", datum: "2026-10-10", notiz: "Bremsen quietschen", blockiert: true, wiederholungMonate: 0 });
    expect(fahrtPruefen({ datum: "2026-10-20", fahrzeugId: "caddy", adresse: "x", status: "Geplant" }, [caddy], [p])).toMatch(/VW Caddy ist nicht fahrbereit \(Bremsen quietschen\)/);
    expect(fahrtPruefen({ datum: "2026-10-20", fahrzeugId: "caddy", adresse: "x", status: "Geplant" }, [caddy], [{ ...p, erledigt: true }])).toBeNull();
    const f = faelligeTermine([p], [caddy], "2026-12-01");
    expect(f[0]).toMatchObject({ ueberfaellig: true, grund: "Bremsen quietschen (seit 10.10.2026, nicht fahrbereit)" });
  });
});

describe("Fahreransicht", () => {
  it("eigene Fahrten des Tages, mit Uhrzeit zuerst", () => {
    const f = [fahrt("a", { zeit: "14:00", fahrerUid: "laura" }), fahrt("b", { zeit: "08:30", fahrerUid: "laura" }), fahrt("c", { fahrerUid: "laura" }), fahrt("d", { fahrerUid: "nic" }), fahrt("e", { fahrerUid: "laura", status: "Abgesagt" })];
    expect(tagesRoute(f, "2026-10-20", "laura").map((x) => x.id)).toEqual(["b", "a", "c"]);
  });
});
