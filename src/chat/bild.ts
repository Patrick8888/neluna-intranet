// Fotos für den Chat: im Browser verkleinern, damit sie als Text in Firestore passen (ohne Cloud Storage).

/** Grösstes erlaubtes Foto als Data-URL (Firestore erlaubt 1 MB pro Eintrag). */
export const MAX_BILD = 900_000;

function laden(datei: File): Promise<HTMLImageElement> {
  return new Promise((ok, fehler) => {
    const url = URL.createObjectURL(datei);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); ok(img); };
    img.onerror = () => { URL.revokeObjectURL(url); fehler(new Error("Dieses Bild kann nicht gelesen werden.")); };
    img.src = url;
  });
}

/** Verkleinert ein Foto auf höchstens 1600 px und speichert es als JPEG; wird bei Bedarf kleiner, bis es passt. */
export async function bildVerkleinern(datei: File): Promise<string> {
  if (!datei.type.startsWith("image/")) throw new Error("Bitte ein Foto wählen.");
  const img = await laden(datei);
  for (const [kante, qualitaet] of [[1600, 0.8], [1280, 0.72], [1024, 0.65], [800, 0.6]] as const) {
    const f = Math.min(1, kante / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * f);
    c.height = Math.round(img.naturalHeight * f);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    const url = c.toDataURL("image/jpeg", qualitaet);
    if (url.length <= MAX_BILD) return url;
  }
  throw new Error("Das Foto ist zu gross.");
}
