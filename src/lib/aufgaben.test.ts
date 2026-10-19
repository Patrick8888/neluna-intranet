import { describe, expect, it } from "vitest";
import { meineFaelligen, nachFaelligkeit, naechsteFaelligkeit, type Aufgabe } from "./aufgaben";

const aufgabe = (w: Partial<Aufgabe>): Aufgabe => ({
  id: "a", titel: "Inventur", beschreibung: "", bereich: "Laden", zustaendigUid: "rahel", zustaendigName: "Rahel Winet", faellig: "",
  wiederholung: "", erledigt: false, erledigtVon: "", erledigtAm: "", ...w,
});

describe("Wiederkehrende Aufgaben", () => {
  it("rücken im Takt vor, bis nach heute", () => {
    expect(naechsteFaelligkeit("2026-10-19", "t1", "2026-10-19")).toBe("2026-10-20");
    expect(naechsteFaelligkeit("2026-10-12", "w1", "2026-10-19")).toBe("2026-10-26");
    expect(naechsteFaelligkeit("2026-10-26", "w1", "2026-10-24")).toBe("2026-11-02");
    expect(naechsteFaelligkeit("2026-01-31", "m1", "2026-02-01")).toBe("2026-02-28");
    expect(naechsteFaelligkeit("2026-10-19", "m12", "2026-10-19")).toBe("2027-10-19");
    expect(naechsteFaelligkeit("2026-10-19", "", "2026-10-19")).toBe("");
  });
});

describe("Übersicht", () => {
  it("gruppiert nach Fälligkeit", () => {
    const g = nachFaelligkeit([
      aufgabe({ id: "1", faellig: "2026-10-18" }), aufgabe({ id: "2", faellig: "2026-10-19" }), aufgabe({ id: "3", faellig: "2026-10-25" }),
      aufgabe({ id: "4", faellig: "2026-12-01" }), aufgabe({ id: "5" }),
    ], "2026-10-19");
    expect(g.map((x) => [x.titel, x.aufgaben.map((a) => a.id)])).toEqual([
      ["Überfällig", ["1"]], ["Heute", ["2"]], ["Nächste 7 Tage", ["3"]], ["Später", ["4"]], ["Ohne Datum", ["5"]],
    ]);
  });

  it("die eigenen, bis heute fälligen", () => {
    const liste = [aufgabe({ id: "1", faellig: "2026-10-19" }), aufgabe({ id: "2", faellig: "2026-10-20" }), aufgabe({ id: "3", faellig: "2026-10-10", erledigt: true }), aufgabe({ id: "4", faellig: "2026-10-01", zustaendigUid: "" })];
    expect(meineFaelligen(liste, "rahel", "2026-10-19").map((a) => a.id)).toEqual(["1"]);
  });
});
