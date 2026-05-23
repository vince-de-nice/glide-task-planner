import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CupDatabaseService } from './cup-database.service';
import { CupParserService } from './cup-parser.service';
import { CupWriterService } from './cup-writer.service';

const SAMPLE_CUP = `name,code,country,lat,lon,elev,style,rwdir,rwlen,rwwidth,freq,desc,userdata,pics
"Test",TST,FR,4344.167N,00547.000E,380m,1,,,,,"TP",,
`;

describe('CupDatabaseService', () => {
  let service: CupDatabaseService;
  const store = new Map<string, string>();

  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear()
    });
    TestBed.configureTestingModule({
      providers: [CupParserService, CupWriterService, CupDatabaseService]
    });
    service = TestBed.inject(CupDatabaseService);
    service.clearWaypoints();
  });

  it('applyCupContent stores waypoints and source', () => {
    const count = service.applyCupContent(SAMPLE_CUP, {
      sourceUrl: 'https://example.com/task.cup',
      sourceLabel: 'Test'
    });
    expect(count).toBe(1);
    expect(service.isFromUrl('https://example.com/task.cup')).toBe(true);
    expect(service.waypoints()[0].name).toBe('Test');
  });

  it('isFromUrl normalizes trailing slash', () => {
    service.applyCupContent(SAMPLE_CUP, {
      sourceUrl: 'https://example.com/task.cup/',
      sourceLabel: 'Test'
    });
    expect(service.isFromUrl('https://example.com/task.cup')).toBe(true);
  });

  it('fetchAndApply rejects javascript: URLs', async () => {
    await expect(
      service.fetchAndApply('javascript:alert(1)')
    ).rejects.toThrow(/non autorisée/i);
  });

  it('fetchAndApply allows same-origin relative paths', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => new TextEncoder().encode(SAMPLE_CUP).buffer
      })
    );
    const count = await service.fetchAndApply(
      '/assets/cup/aapca%20waypoints%2011%20juin%202025.cup'
    );
    expect(count).toBe(1);
  });
});
