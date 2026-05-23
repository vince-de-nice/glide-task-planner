export const CUP_IMPORTED_CATALOG_KEY = 'gc-cup-imported-catalog';
export const CUP_IMPORTED_IDB_NAME = 'gc-cup-imported';
export const CUP_IMPORTED_IDB_STORE = 'files';
export const CUP_IMPORT_SOURCE_PREFIX = 'cup-import:';

export function cupImportSourceKey(importId: string): string {
  return `${CUP_IMPORT_SOURCE_PREFIX}${importId}`;
}

export function parseCupImportId(sourceUrl: string | null): string | null {
  if (!sourceUrl?.startsWith(CUP_IMPORT_SOURCE_PREFIX)) return null;
  const id = sourceUrl.slice(CUP_IMPORT_SOURCE_PREFIX.length);
  return id.length > 0 ? id : null;
}
