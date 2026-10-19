import { describe, expect, it } from "vitest";
import {
  abwesendAm, abwesenheitBereich, artFuer, darfFreigeben, dienstplanBearbeiten, ferientage, stunden, ueberschneidungen, vorwocheUebernehmen, werktage,
  type Abwesenheit, type Dienst,
} from "./personal";

const abw = (w: Partial<Abwesenheit>): Abwesenheit => ({
  id: "a", mitarbeiterUid: "rahel", mitarbeiterName: "Rahel Winet", bereich: "laden", art: "Ferien", von: "2026-10-19", bis: "2026-10-23",
  notiz: "", status: "Bewilligt", entscheidUid: "", entscheidName: "", entscheidAm: "", antwort: "", ...w,
});

const dienst = (w: Partial<Dienst>): Dienst => ({
  id: "d", datum: "2026-10-12", bereich: "laden", mitarbeiterUid: "rahel", mitarbeiterName: "Rahel Winet", von: "08:30", bis: "12:00", notiz: "", ...w,
});

describe("Dienstplan", () => {
  it("Leitung Laden plant den Laden, Leitung Pension Pension und Fahrdienst", () => {
    expect(dienstplanBearbeiten(["leitung_laden"], "laden")).toBe(true);
    expect(dienstplanBearbeiten(["leitung_laden"], "pension")).toBe(false);
    expect(dienstplanBearbeiten(["leitung_pension"], "fahrdienst")).toBe(true);
    expect(dienstplanBearbeiten(["geschaeftsfuehrung"], "laden")).toBe(true);
    expect(dienstplanBearbeiten(["verkauf"], "laden")).toBe(false);
  });

  it("Stunden eines Dienstes", () => {
    expect(stunden("08:30", "12:00")).toBe(3.5);
    expect(stunden("13:00", "12:00")).toBe(0);
    expect(stunden("", "12:00")).toBe(0);
  });

  it("Vorwoche übernehmen: eine Woche später, ohne Doppelte und ohne Abwesende", () => {
    const liste = [
      dienst({ id: "1", datum: "2026-10-12" }),
      dienst({ id: "2", datum: "2026-10-13", mitarbeiterUid: "claudia", mitarbeiterName: "Claudia Binder" }),
      dienst({ id: "3", datum: "2026-10-14", von: "13:30", bis: "18:30" }),
      dienst({ id: "4", datum: "2026-10-21", von: "13:30", bis: "18:30" }),
      dienst({ id: "5", datum: "2026-10-12", bereich: "pension" }),
    ];
    const neu = vorwocheUebernehmen(liste, [abw({ mitarbeiterUid: "claudia", von: "2026-10-20", bis: "2026-10-20" })], "laden", "2026-10-19");
    expect(neu).toEqual([{ datum: "2026-10-19", bereich: "laden", mitarbeiterUid: "rahel", mitarbeiterName: "Rahel Winet", von: "08:30", bis: "12:00", notiz: "" }]);
  });
});

describe("Abwesenheiten", () => {
  it("Bereich für die Freigabe aus den Rollen", () => {
    expect(abwesenheitBereich(["verkauf"])).toBe("laden");
    expect(abwesenheitBereich(["fahrdienst"])).toBe("pension");
    expect(abwesenheitBereich(["mitarbeit_pension"])).toBe("pension");
    expect(abwesenheitBereich(["admin", "geschaeftsfuehrung"])).toBe("firma");
  });

  it("Wer freigeben darf", () => {
    expect(darfFreigeben(["leitung_laden"], "morena", { bereich: "laden", mitarbeiterUid: "rahel" })).toBe(true);
    expect(darfFreigeben(["leitung_laden"], "morena", { bereich: "laden", mitarbeiterUid: "morena" })).toBe(false);
    expect(darfFreigeben(["leitung_laden"], "morena", { bereich: "pension", mitarbeiterUid: "laura" })).toBe(false);
    expect(darfFreigeben(["leitung_pension"], "cristina", { bereich: "pension", mitarbeiterUid: "laura" })).toBe(true);
    expect(darfFreigeben(["geschaeftsfuehrung"], "nalan", { bereich: "firma", mitarbeiterUid: "patrick" })).toBe(true);
    expect(darfFreigeben(["verkauf"], "rahel", { bereich: "laden", mitarbeiterUid: "claudia" })).toBe(false);
  });

  it("Krankheit sehen nur die Person selbst und wer freigibt", () => {
    const a = abw({ art: "Krank" });
    expect(artFuer(a, ["verkauf"], "claudia")).toBe("Abwesend");
    expect(artFuer(a, ["verkauf"], "rahel")).toBe("Krank");
    expect(artFuer(a, ["leitung_laden"], "morena")).toBe("Krank");
    expect(artFuer(a, ["leitung_pension"], "cristina")).toBe("Abwesend");
    expect(artFuer(a, ["geschaeftsfuehrung"], "nalan")).toBe("Krank");
    expect(artFuer(abw({}), ["verkauf"], "claudia")).toBe("Ferien");
  });

  it("Arbeitstage und Ferientage im Jahr", () => {
    expect(werktage("2026-10-19", "2026-10-25")).toBe(5);
    expect(werktage("2026-10-24", "2026-10-25")).toBe(0);
    const liste = [
      abw({}),
      abw({ id: "b", von: "2026-12-28", bis: "2027-01-08" }),
      abw({ id: "c", status: "Beantragt", von: "2026-11-02", bis: "2026-11-06" }),
      abw({ id: "d", art: "Krank", von: "2026-11-09", bis: "2026-11-09" }),
    ];
    expect(ferientage(liste, "rahel", "2026")).toBe(5 + 4);
    expect(ferientage(liste, "rahel", "2027")).toBe(6);
  });

  it("Bewilligte Abwesenheit an einem Tag", () => {
    const liste = [abw({}), abw({ id: "b", status: "Beantragt", von: "2026-11-02", bis: "2026-11-02" })];
    expect(abwesendAm(liste, "rahel", "2026-10-21")?.id).toBe("a");
    expect(abwesendAm(liste, "rahel", "2026-11-02")).toBeUndefined();
  });

  it("Überschneidungen im selben Bereich", () => {
    const liste = [abw({}), abw({ id: "b", mitarbeiterUid: "claudia", von: "2026-10-22", bis: "2026-10-30" }), abw({ id: "c", mitarbeiterUid: "laura", bereich: "pension" })];
    expect(ueberschneidungen(liste, abw({ id: "neu", mitarbeiterUid: "morena", von: "2026-10-23", bis: "2026-10-23" })).map((x) => x.id)).toEqual(["a", "b"]);
    expect(ueberschneidungen(liste, liste[0]).map((x) => x.id)).toEqual(["b"]);
  });
});
