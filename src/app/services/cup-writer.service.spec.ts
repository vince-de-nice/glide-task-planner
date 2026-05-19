import { describe, it, expect } from 'vitest';
import { CupWriterService } from './cup-writer.service';
import { Waypoint } from '../models/waypoint.model';

describe('CupWriterService', () => {
  const service = new CupWriterService();

  const wp: Waypoint = {
    id: '1',
    name: 'Vinon',
    code: 'Vinon',
    country: 'FR',
    latitude: 43.7361,
    longitude: 5.7833,
    elevation: 380,
    type: 'airfield',
    description: 'LFNV',
    cupFields: { style: '5' }
  };

  it('generates header and waypoint line', () => {
    const out = service.generateCupFile(
      'name,code,country,lat,lon,elev,style,rwdir,rwlen,rwwidth,freq,desc,userdata,pics',
      [wp]
    );
    expect(out).toContain('name,code,country');
    expect(out).toContain('Vinon');
    expect(out).toMatch(/4344\.\d{3}N/);
    expect(out).toMatch(/0054[67]\.\d{3}E/);
  });
});
