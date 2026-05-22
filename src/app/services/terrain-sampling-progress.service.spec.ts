import { TestBed } from '@angular/core/testing';
import { TerrainSamplingProgressService } from './terrain-sampling-progress.service';

describe('TerrainSamplingProgressService', () => {
  let service: TerrainSamplingProgressService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TerrainSamplingProgressService);
  });

  it('tracks per-leg DEM chunk progress without decreasing', () => {
    service.begin(2);
    service.setDemChunk(0, 2, 0, 4, 'A → B');
    expect(service.legAt(0)?.percent).toBe(19);
    expect(service.legAt(0)?.phase).toBe('dem');

    service.setDemChunk(0, 2, 3, 4, 'A → B');
    expect(service.legAt(0)?.percent).toBe(75);

    service.setComputeLeg(0, 2, 'A → B');
    expect(service.legAt(0)?.percent).toBe(90);
    expect(service.legAt(0)?.phase).toBe('compute');

    service.completeLeg(0);
    expect(service.legAt(0)?.phase).toBe('done');
    expect(service.legAt(0)?.percent).toBe(100);
  });

  it('does not rewind after compute when extended DEM chunks run', () => {
    service.begin(1);
    service.setComputeLeg(0, 1, 'A → B');
    expect(service.legAt(0)?.percent).toBe(90);

    service.setDemChunk(0, 1, 0, 4, 'A → B');
    expect(service.legAt(0)?.percent).toBeGreaterThanOrEqual(90);
    expect(service.legAt(0)?.phase).toBe('dem');
  });

  it('markTerrainReady reaches DEM cap without chunks', () => {
    service.begin(1);
    service.markTerrainReady(0);
    expect(service.legAt(0)?.percent).toBe(75);
    expect(service.legAt(0)?.phase).toBe('dem');
  });
});
