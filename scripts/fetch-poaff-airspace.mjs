#!/usr/bin/env node
/**
 * Télécharge les GeoJSON POAFF dans public/assets/airspace/
 * (évite CORS en production — voir npm run airspace:fetch)
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public', 'assets', 'airspace');

const FILES = [
  '20250417_ff-French.geojson',
  '20250417_ff-FrenchAlps.geojson',
  '20250417_ff-FrenchPyrenees.geojson',
  '20250417_ff-FrenchNorth.geojson',
  '20250417_ff-FrenchSouth.geojson'
];

const REMOTE_BASE =
  'http://pascal.bazile.free.fr/paraglidingFolder/divers/GPS/OpenAir-Format/download.php?file=files';

await mkdir(OUT_DIR, { recursive: true });

for (const name of FILES) {
  const url = `${REMOTE_BASE}/${name}`;
  process.stdout.write(`→ ${name}… `);
  const response = await fetch(url);
  if (!response.ok) {
    console.log(`échec HTTP ${response.status}`);
    process.exitCode = 1;
    continue;
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(join(OUT_DIR, name), buffer);
  console.log(`${(buffer.length / 1024 / 1024).toFixed(1)} Mo`);
}

console.log(`\nFichiers dans ${OUT_DIR}`);
