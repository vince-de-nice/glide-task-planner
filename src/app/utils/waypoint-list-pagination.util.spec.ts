import { describe, expect, it } from 'vitest';
import { paginateItems, pageRange } from './waypoint-list-pagination.util';

describe('waypoint-list-pagination', () => {
  it('paginateItems returns correct slice', () => {
    const items = [1, 2, 3, 4, 5];
    const { page, totalPages, items: slice } = paginateItems(items, 2, 2);
    expect(page).toBe(2);
    expect(totalPages).toBe(3);
    expect(slice).toEqual([3, 4]);
  });

  it('pageRange centers on current page', () => {
    expect(pageRange(10, 5)).toEqual([3, 4, 5, 6, 7]);
  });
});
