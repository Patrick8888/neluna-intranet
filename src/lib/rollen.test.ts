import { describe, expect, it } from "vitest";
import { darf, stufe, STUFE } from "./rollen";

describe("Berechtigungen", () => {
  it("Verkauf darf im Laden bearbeiten, aber nicht verwalten", () => {
    expect(darf(["verkauf"], "laden", STUFE.bearbeiten)).toBe(true);
    expect(darf(["verkauf"], "laden", STUFE.verwalten)).toBe(false);
  });

  it("Verkauf sieht die Kader-Sitzungen nicht", () => {
    expect(darf(["verkauf"], "sitzungen_kader")).toBe(false);
  });

  it("Leitung Pension hat keinen Zugriff auf das Kassenbuch", () => {
    expect(stufe(["leitung_pension"], "laden")).toBe(STUFE.keine);
    expect(stufe(["leitung_pension"], "pension")).toBe(STUFE.verwalten);
  });

  it("Admin allein gibt nur Zugriff auf die Verwaltung", () => {
    expect(darf(["admin"], "admin", STUFE.verwalten)).toBe(true);
    expect(darf(["admin"], "laden")).toBe(false);
  });

  it("Geschäftsführung ohne Admin-Rolle verwaltet keine Benutzer", () => {
    expect(darf(["geschaeftsfuehrung"], "admin")).toBe(false);
    expect(darf(["geschaeftsfuehrung"], "laden", STUFE.verwalten)).toBe(true);
  });

  it("mehrere Rollen ergeben die höchste Stufe", () => {
    expect(stufe(["verkauf", "fahrdienst"], "fahrdienst")).toBe(STUFE.bearbeiten);
    expect(stufe(["verkauf", "fahrdienst"], "laden")).toBe(STUFE.bearbeiten);
  });

  it("ohne Rolle gibt es keinen Zugriff", () => {
    expect(darf([], "start")).toBe(false);
  });
});
