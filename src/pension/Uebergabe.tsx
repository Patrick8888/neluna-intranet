import { useIch } from "../auth";
import { darf, STUFE } from "../lib/rollen";
import { UebergabeBuch } from "../uebergabe";
import { usePension } from "./daten";

const THEMEN = ["Info", "Hund", "Kundschaft", "Futter / Medikamente", "Reinigung", "Technik"];

export function PensionUebergabe() {
  const ich = useIch();
  const d = usePension();
  const leitung = darf(ich.rollen, "pension", STUFE.verwalten);
  return (
    <UebergabeBuch
      sammlung="pension_uebergabe"
      eintraege={d.uebergabe}
      themen={THEMEN}
      darfLoeschen={(x) => leitung || x.uid === ich.uid}
      beispiel="z. B. Rex hat heute Abend nur die Hälfte gefressen, morgen früh beobachten."
    />
  );
}
