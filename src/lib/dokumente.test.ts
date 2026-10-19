import { describe, expect, it } from "vitest";
import { bloecke, dateiGroesse, inTeile, linkOk, suchen, type Dokument } from "./dokumente";

const dok = (w: Partial<Dokument>): Dokument => ({
  id: "d", titel: "Reinigungsplan", kategorie: "Anleitungen", inhalt: "", link: "", fuer: "alle", erstellt: "", geaendert: "", person: "", uid: "", ...w,
});

describe("Dokumente", () => {
  it("Datei in Teile zerlegen und wieder zusammensetzen", () => {
    const t = inTeile("abcdefg", 3);
    expect(t).toEqual(["abc", "def", "g"]);
    expect(t.join("")).toBe("abcdefg");
  });

  it("Grösse lesbar", () => {
    expect(dateiGroesse(900)).toBe("900 B");
    expect(dateiGroesse(2048)).toBe("2 KB");
    expect(dateiGroesse(1.5 * 1024 * 1024)).toBe("1.5 MB");
  });

  it("nur Web-Links", () => {
    expect(linkOk("https://claude.ai/artifact/x")).toBe(true);
    expect(linkOk("")).toBe(true);
    expect(linkOk("javascript:alert(1)")).toBe(false);
  });

  it("Suche über Titel und Text, alle Wörter", () => {
    const liste = [dok({ id: "1", inhalt: "Boden feucht aufnehmen" }), dok({ id: "2", titel: "Kassenabschluss", kategorie: "Anleitungen" })];
    expect(suchen(liste, "boden reinigung").map((d) => d.id)).toEqual(["1"]);
    expect(suchen(liste, "  ").length).toBe(2);
  });

  it("einfache Formatierung", () => {
    expect(bloecke("# Morgen\nHunde raus\nFüttern\n\n- Wasser\n- Napf\nEnde")).toEqual([
      { art: "titel", zeilen: ["Morgen"] },
      { art: "absatz", zeilen: ["Hunde raus", "Füttern"] },
      { art: "liste", zeilen: ["Wasser", "Napf"] },
      { art: "absatz", zeilen: ["Ende"] },
    ]);
  });
});
