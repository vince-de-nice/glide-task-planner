export interface CupCatalogEntry {
  id: string;
  label: string;
  region: string;
  filename: string;
  updated: string;
  sourceUrl: string;
}

export interface CupCatalog {
  disclaimer: string;
  databases: CupCatalogEntry[];
}
