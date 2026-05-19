import { describe, it, expect } from 'vitest';
import {
  FlarmConfigService,
  formatFlarmLatitude,
  defaultTaskName
} from './flarm-config.service';
import { FlarmDeclaration } from '../models/flarm-profile.model';
import { Waypoint } from '../models/waypoint.model';

const sampleDeclaration: FlarmDeclaration = {
  pilotName: 'John Doe',
  gliderType: 'Ka-6',
  gliderId: 'F-CINE',
  compId: 'ZX',
  compClass: 'Standard',
  logInterval: 4,
  taskName: 'Circuit_500K'
};

describe('formatFlarmLatitude', () => {
  it('converts 47.17138°N to 4710283N', () => {
    expect(formatFlarmLatitude(47.17138)).toBe('4710283N');
  });
});

describe('FlarmConfigService', () => {
  const service = new FlarmConfigService();

  const sampleWaypoints: Waypoint[] = [
    {
      id: '1',
      name: 'LFMF',
      latitude: 43.60805,
      longitude: 6.70167,
      type: 'airfield'
    },
    {
      id: '2',
      name: 'banegon',
      latitude: 43.62945,
      longitude: 6.677,
      type: 'turnpoint'
    }
  ];

  it('generates full declaration with profile and waypoints', () => {
    const txt = service.generateFlarmCfgTxt(sampleWaypoints, sampleDeclaration);
    expect(txt).toContain('$PFLAC,S,PILOT,John Doe');
    expect(txt).toContain('$PFLAC,S,GLIDERTYPE,Ka-6');
    expect(txt).toContain('$PFLAC,S,GLIDERID,F-CINE');
    expect(txt).toContain('$PFLAC,S,COMPID,ZX');
    expect(txt).toContain('$PFLAC,S,COMPCLASS,Standard');
    expect(txt).toContain('$PFLAC,S,LOGINT,4');
    expect(txt).toContain('$PFLAC,S,NEWTASK,Circuit_500K');
    expect(txt).toContain('$PFLAC,S,ADDWP,');
    expect(txt).toContain(',LFMF');
  });

  it('omits empty profile fields but keeps LOGINT', () => {
    const txt = service.generateFlarmCfgTxt([], {
      ...sampleDeclaration,
      pilotName: '',
      gliderType: '',
      gliderId: '',
      compId: '',
      compClass: ''
    });
    expect(txt).not.toContain('PILOT');
    expect(txt).toContain('$PFLAC,S,LOGINT,4');
    expect(txt).toContain('$PFLAC,S,NEWTASK,Circuit_500K');
  });
});

describe('defaultTaskName', () => {
  it('returns a non-empty label', () => {
    expect(defaultTaskName()).toMatch(/^Tache_\d{8}$/);
  });
});
