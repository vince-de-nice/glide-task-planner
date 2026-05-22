import { TestBed } from '@angular/core/testing';
import { TerrainSamplingProgressService } from './terrain-sampling-progress.service';

describe('TerrainSamplingProgressService', () => {
  let service: TerrainSamplingProgressService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TerrainSamplingProgressService);
  });

  it('tracks DEM chunk progress across legs', () => {
    service.begin(2);
    service.setDemChunk(0, 2, 0, 4, 'A → B');
    expect(service.state()?.percent).toBe(13);
    expect(service.state()?.chunkIndex).toBe(0);
    service.setDemChunk(0, 2, 3, 4, 'A → B');
    expect(service.state()?.percent).toBe(50);
    service.setDemChunk(1, 2, 1, 2, 'B → C');
    expect(service.state()?.percent).toBe(100);
    service.end();
    expect(service.active()).toBe(false);
  });
});
