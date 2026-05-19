/**
 * Décode le contenu binaire d'un fichier SeeYou `.cup`.
 *
 * Les CUP sont souvent en **Windows-1252** (Notepad++, SeeYou sous Windows FR)
 * ou en **UTF-8**. `fetch()` / `File.text()` supposent UTF-8 et corrompent les accents sinon.
 *
 * Ordre : UTF-8 strict (sans BOM ou avec BOM) → Windows-1252 → ISO-8859-1.
 * Résultat normalisé en **NFC** pour un affichage cohérent (é vs e + combinant).
 */
export function decodeCupFileBytes(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let offset = 0;
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    offset = 3;
  }
  const slice = offset > 0 ? buffer.slice(offset) : buffer;

  try {
    const utf8 = new TextDecoder('utf-8', { fatal: true }).decode(slice);
    return utf8.normalize('NFC');
  } catch {
    /* séquences UTF-8 invalides → encodage 8 bits probable */
  }

  try {
    return new TextDecoder('windows-1252').decode(slice).normalize('NFC');
  } catch {
    /* navigateurs très anciens */
  }

  return new TextDecoder('iso-8859-1').decode(slice).normalize('NFC');
}
