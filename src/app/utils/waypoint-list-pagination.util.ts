/** Pagination partagée (gestionnaire waypoints + tiroir sélection). */
export function paginateItems<T>(
  items: readonly T[],
  page: number,
  pageSize: number
): { page: number; totalPages: number; items: T[] } {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    page: safePage,
    totalPages,
    items: items.slice(start, start + pageSize)
  };
}

export function pageRange(totalPages: number, currentPage: number): number[] {
  const pages: number[] = [];
  const window = 2;
  const start = Math.max(1, currentPage - window);
  const end = Math.min(totalPages, currentPage + window);
  for (let p = start; p <= end; p++) {
    pages.push(p);
  }
  return pages;
}
