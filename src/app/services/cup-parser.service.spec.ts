import { describe, it, expect, beforeEach } from 'vitest';
import { CupParserService } from './cup-parser.service';

describe('CupParserService', () => {
  let parser: CupParserService;

  beforeEach(() => {
    parser = new CupParserService();
  });

  it('parse Vinon CUP sample (lat DDMM, lon DDDMM)', () => {
    const sample = `name,code,country,lat,lon,elev,style,rwdir,rwlen,rwwidth,freq,desc,userdata,pics
"Vinon",Vinon,FR,4344.167N,00547.000E,380m,5,120,800m,30m,,"LFNV",,
"Rians",Rians,FR,4336.500N,00545.500E,350m,1,,,,,"#1",,`;

    const wps = parser.parseCupFile(sample);
    expect(wps).toHaveLength(2);

    const vinon = wps.find(w => w.name === 'Vinon')!;
    expect(vinon.latitude).toBeCloseTo(43.7361, 3);
    expect(vinon.longitude).toBeCloseTo(5.7833, 3);

    const rians = wps.find(w => w.name === 'Rians')!;
    expect(rians.latitude).toBeCloseTo(43.6083, 3);
    expect(rians.longitude).toBeCloseTo(5.7583, 3);
  });

  it('parse longitude with leading zeros (Aups)', () => {
    const sample = `name,code,country,lat,lon,elev,style,rwdir,rwlen,rwwidth,freq,desc,userdata,pics
"Aups",Aups,FR,4338.000N,00613.500E,830m,1,,,,,,,`;

    const [aups] = parser.parseCupFile(sample);
    expect(aups.latitude).toBeCloseTo(43.6333, 3);
    expect(aups.longitude).toBeCloseTo(6.225, 3);
  });
});
