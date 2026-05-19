export interface CupSourceEntry {
  id: string;
  label: string;
  url: string;
}

export interface CupSourcesConfig {
  disclaimer: string;
  sources: CupSourceEntry[];
}
