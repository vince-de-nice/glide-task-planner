import { describe, it, expect, beforeEach } from 'vitest';
import { MapFocusService } from './map-focus.service';

describe('MapFocusService', () => {
  let service: MapFocusService;

  beforeEach(() => {
    service = new MapFocusService();
  });

  it('sets and clears focus', () => {
    service.setFocus('wp-1', 2);
    expect(service.focusedWaypointId()).toBe('wp-1');
    expect(service.focusedLegIndex()).toBe(2);
    service.clearFocus();
    expect(service.focusedWaypointId()).toBeNull();
    expect(service.focusedLegIndex()).toBeNull();
  });
});
