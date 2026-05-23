#!/usr/bin/env node
/**
 * Scanne public/assets/cup/*.cup et génère public/config/cup-integrated.json.
 * Premier fichier (tri locale fr) = base par défaut au premier chargement.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const cupDir = path.join(root, 'public', 'assets', 'cup');
const outFile = path.join(root, 'public', 'config', 'cup-integrated.json');

/** Copie de secours / ancien bootstrap — non listé comme source intégrée. */
const EXCLUDED_FILES = new Set(['default.cup']);

function cupAssetUrl(fileName) {
  return `/assets/cup/${fileName.split('/').map(encodeURIComponent).join('/')}`;
}

function slugId(fileName) {
  const base = fileName.replace(/\.cup$/i, '');
  const slug = base
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'cup';
}

function main() {
  if (!fs.existsSync(cupDir)) {
    console.error(`[cup:manifest] Dossier introuvable : ${cupDir}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(cupDir, { withFileTypes: true })
    .filter(e => e.isFile() && e.name.toLowerCase().endsWith('.cup'))
    .map(e => e.name)
    .filter(name => !EXCLUDED_FILES.has(name))
    .sort((a, b) => a.localeCompare(b, 'fr', { sensitivity: 'base' }));

  const sources = files.map(fileName => ({
    id: slugId(fileName),
    label: fileName.replace(/\.cup$/i, ''),
    url: cupAssetUrl(fileName)
  }));

  const manifest = {
    generatedAt: new Date().toISOString(),
    cupDir: '/assets/cup',
    defaultUrl: sources[0]?.url ?? null,
    defaultLabel: sources[0]?.label ?? null,
    sources
  };

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log(
    `[cup:manifest] ${sources.length} fichier(s) → ${path.relative(root, outFile)}` +
      (manifest.defaultUrl ? ` (défaut : ${manifest.defaultLabel})` : '')
  );
}

main();
