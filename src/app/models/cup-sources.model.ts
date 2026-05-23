export interface CupSourceEntry {
  id: string;
  label: string;
  url: string;
}

/** Manifeste généré par `npm run cup:manifest` depuis public/assets/cup/*.cup */
export interface CupIntegratedManifest {
  generatedAt: string;
  cupDir: string;
  defaultUrl: string | null;
  defaultLabel: string | null;
  sources: CupSourceEntry[];
}

export interface CupSourcesConfig {
  disclaimer: string;
  sources: CupSourceEntry[];
  defaultUrl: string | null;
  defaultLabel: string | null;
}
