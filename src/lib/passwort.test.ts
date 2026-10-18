import { describe, expect, it } from "vitest";
import { passwortFehler, zufallsPasswort } from "./passwort";

describe("Passwort", () => {
  it("verlangt Länge sowie Buchstaben und Zahlen", () => {
    expect(passwortFehler("kurz1")).not.toBeNull();
    expect(passwortFehler("nurbuchstabenhier")).not.toBeNull();
    expect(passwortFehler("12345678901")).not.toBeNull();
    expect(passwortFehler("Pfote-4827-Napf")).toBeNull();
  });

  it("Zufallspasswörter genügen den Regeln und sind verschieden", () => {
    const a = zufallsPasswort();
    expect(passwortFehler(a)).toBeNull();
    expect(a).not.toBe(zufallsPasswort());
  });
});
