import { describe, expect, it } from "vitest";
import { arbeitsMinuten, mindestPause, monatsGrenzen, pausenHinweis, stdMin, zeitCsv, type Zeiteintrag } from "./zeit";

const e = (w: Partial<Zeiteintrag>): Zeiteintrag => ({
  id: "z", mitarbeiterUid: "rahel", mitarbeiterName: "Rahel Winet", bereich: "laden", datum: "2026-10-19", von: "08:00", bis: "17:00", pause: 30, notiz: "", ...w,
});

describe("Zeiterfassung", () => {
  it("Arbeitszeit ohne Pause; offene zählen nicht", () => {
    expect(arbeitsMinuten(e({}))).toBe(510);
    expect(arbeitsMinuten(e({ bis: "" }))).toBe(0);
    expect(stdMin(510)).toBe("8:30");
    expect(stdMin(-45)).toBe("−0:45");
  });

  it("Mindestpause nach Arbeitsgesetz", () => {
    expect(mindestPause(5 * 60)).toBe(0);
    expect(mindestPause(6 * 60)).toBe(15);
    expect(mindestPause(8 * 60)).toBe(30);
    expect(mindestPause(10 * 60)).toBe(60);
    // Massgebend ist die Arbeitszeit: 9:30 Präsenz mit 30 Min. Pause = 9:00 Arbeit.
    expect(mindestPause(9 * 60 + 30)).toBe(30);
    expect(mindestPause(9 * 60 + 31)).toBe(60);
    expect(pausenHinweis(e({ bis: "17:30", pause: 30 }))).toBe("");
    expect(pausenHinweis(e({ pause: 15 }))).toBe("Mindestens 30 Minuten Pause vorgeschrieben");
    expect(pausenHinweis(e({}))).toBe("");
  });

  it("Monatsgrenzen", () => {
    expect(monatsGrenzen("2026-02")).toEqual(["2026-02-01", "2026-02-28"]);
    expect(monatsGrenzen("2026-10")).toEqual(["2026-10-01", "2026-10-31"]);
  });

  it("CSV mit Total je Person", () => {
    const csv = zeitCsv([e({}), e({ id: "2", datum: "2026-10-20", von: "13:00", bis: "18:00", pause: 0, notiz: "Inventur; Lager" })]);
    const zeilen = csv.replace("﻿", "").split("\r\n");
    expect(zeilen[0]).toBe("Person;Datum;Beginn;Ende;Pause (Min.);Stunden;Notiz");
    expect(zeilen[2]).toBe('Rahel Winet;20.10.2026;13:00;18:00;0;5.00;"Inventur; Lager"');
    expect(zeilen[3]).toBe("Total Rahel Winet;;;;;13.50;");
  });
});
