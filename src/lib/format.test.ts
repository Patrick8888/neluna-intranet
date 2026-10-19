import { describe, expect, it } from "vitest";
import { chf, datum, heute, kalenderwoche, montagVon, namensTeile, plusTage, vollerName, stunde, wochenLabel, zahl, zeitstempel } from "./format";

describe("Datum", () => {
  it("heute gilt in Zürich, auch kurz nach Mitternacht", () => {
    expect(heute(new Date("2026-10-18T22:30:00Z"))).toBe("2026-10-19");
    expect(stunde(new Date("2026-10-18T22:30:00Z"))).toBe(0);
    expect(zeitstempel(new Date("2026-10-18T22:30:05Z"))).toBe("2026-10-19T00:30:05");
  });

  it("Montag und Kalenderwoche", () => {
    expect(montagVon("2026-10-18")).toBe("2026-10-12"); // Sonntag
    expect(montagVon("2026-10-12")).toBe("2026-10-12");
    expect(kalenderwoche("2026-10-12")).toBe(42);
    expect(kalenderwoche("2027-01-01")).toBe(53);
    expect(plusTage("2026-12-31", 1)).toBe("2027-01-01");
    expect(wochenLabel("2026-10-12")).toBe("KW 42 · 12.10.–17.10.2026");
    expect(datum("2026-10-05")).toBe("05.10.2026");
  });
});

describe("Beträge", () => {
  it("liest Schweizer Schreibweisen", () => {
    expect(zahl("1'234,50")).toBe(1234.5);
    expect(zahl("12.345")).toBe(12.35);
    expect(zahl("")).toBe(0);
    expect(zahl("abc")).toBe(0);
  });

  it("formatiert mit zwei Stellen", () => {
    expect(chf(1234.5)).toMatch(/^1.234\.50$/);
    expect(chf(undefined)).toBe("0.00");
  });
});

describe("Namen", () => {
  it("setzt Vorname und Name zusammen und teilt alte Einträge auf", () => {
    expect(vollerName(" Rahel ", "Winet")).toBe("Rahel Winet");
    expect(namensTeile("Cristina de Oliveira")).toEqual({ vorname: "Cristina", nachname: "de Oliveira" });
    expect(namensTeile("Patrick")).toEqual({ vorname: "Patrick", nachname: "" });
  });
});
