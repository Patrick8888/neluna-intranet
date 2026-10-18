import { describe, expect, it } from "vitest";
import { kasseCsv, kasseRechnen, letztesWechselgeld, wochenzahlen, type Kasse } from "./laden";

const tag = (datum: string, w: Partial<Kasse> = {}): Kasse => ({
  id: `laden_${datum}`, standort: "laden", datum, person: "Rahel Winet", anfang: 200, bar: 0, karte: 0, twint: 0, ausgaben: 0, gezaehlt: 0,
  safebagBetrag: 0, safebagNr: "", notiz: "", total: 0, soll: 0, differenz: 0, wechselgeldNeu: 0, abgeholt: false, abgeholtAm: "", ...w,
});

describe("Tagesabschluss", () => {
  it("rechnet wie das Ladenbuch", () => {
    const r = kasseRechnen({ anfang: 200, bar: 512.4, karte: 830.1, twint: 45, ausgaben: 8.5, gezaehlt: 703.4, safebag: 500 });
    expect(r.soll).toBe(703.9);
    expect(r.differenz).toBe(-0.5);
    expect(r.wechselgeldNeu).toBe(203.4);
    expect(r.total).toBe(1387.5);
  });

  it("übernimmt das Wechselgeld vom letzten Abschluss davor", () => {
    const k = [tag("2026-10-14", { wechselgeldNeu: 180 }), tag("2026-10-16", { wechselgeldNeu: 210 }), tag("2026-10-17", { wechselgeldNeu: 999 })];
    expect(letztesWechselgeld(k, "2026-10-17")).toBe(210);
    expect(letztesWechselgeld(k, "2026-10-14")).toBeNull();
  });
});

describe("Wochenzahlen", () => {
  it("zählen nur Montag bis Sonntag der Woche", () => {
    const z = wochenzahlen("2026-10-12", {
      kasse: [tag("2026-10-11", { total: 999 }), tag("2026-10-12", { total: 100, bar: 60, safebagBetrag: 50 }), tag("2026-10-17", { total: 50.5, differenz: -1, safebagBetrag: 20, abgeholt: true })],
      uebergabe: [],
      reklamationen: [],
      bestellungen: [],
    });
    expect(z.tage).toBe(2);
    expect(z.total).toBe(150.5);
    expect(z.differenz).toBe(-1);
    expect(z.safebagsOffen).toBe(1);
  });
});

describe("CSV", () => {
  it("setzt Texte mit Semikolon in Anführungszeichen", () => {
    const csv = kasseCsv([tag("2026-10-12", { notiz: 'Porto; "A-Post"', bar: 10 })]);
    expect(csv.startsWith("﻿Datum;")).toBe(true);
    expect(csv).toContain('12.10.2026;Rahel Winet;200.00;10.00;');
    expect(csv).toContain('"Porto; ""A-Post"""');
  });
});
