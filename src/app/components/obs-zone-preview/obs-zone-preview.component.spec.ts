import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { ObsZonePreviewComponent } from './obs-zone-preview.component';
import { buildObsZonePreview } from '../../utils/obs-zone-preview.util';
import { CircuitLeg } from '../../models/circuit.model';
import { Waypoint } from '../../models/waypoint.model';

describe('ObsZonePreviewComponent', () => {
  const wp: Waypoint = {
    id: 't',
    name: 'TP',
    latitude: 45,
    longitude: 6,
    type: 'turnpoint'
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ObsZonePreviewComponent]
    }).compileComponents();
  });

  function faiLeg(a1Deg: number, a2Deg: number, a12Deg: number): CircuitLeg {
    return {
      waypointId: 't',
      role: 'turnpoint',
      obsZone: {
        cupStyle: 0,
        r1M: 30000,
        a1Deg,
        r2M: 12000,
        a2Deg,
        a12Deg,
        presetId: 'sector_fai'
      }
    };
  }

  it('renders a single FAI keyhole path (A2 < A1)', () => {
    const view = buildObsZonePreview({
      legIndex: 0,
      leg: faiLeg(45, 12, 123.4),
      waypoint: wp,
      prev: null,
      next: null,
      departure: null,
      defaultRadiusM: 400
    });
    const fixture = TestBed.createComponent(ObsZonePreviewComponent);
    fixture.componentRef.setInput('previewView', view);
    fixture.componentRef.setInput('role', 'turnpoint');
    fixture.detectChanges();

    const paths = fixture.nativeElement.querySelectorAll('path');
    expect(paths.length).toBe(1);
    const d = paths[0].getAttribute('d') ?? '';
    expect(d.match(/\bA\b/g)?.length).toBe(3);
    const arcs = d.match(/A [\d.]+ [\d.]+ 0 \d \d/g)!;
    expect(arcs[0]).toMatch(/0 0 0/);
    expect(arcs[2]).toMatch(/0 0 0/);
  });

  it('renders FAI keyhole with CW gap arcs when A2 > A1', () => {
    const view = buildObsZonePreview({
      legIndex: 0,
      leg: faiLeg(90, 180, 130),
      waypoint: wp,
      prev: null,
      next: null,
      departure: null,
      defaultRadiusM: 400
    });
    const fixture = TestBed.createComponent(ObsZonePreviewComponent);
    fixture.componentRef.setInput('previewView', view);
    fixture.detectChanges();

    const d = fixture.nativeElement.querySelector('path')?.getAttribute('d') ?? '';
    const arcs = d.match(/A [\d.]+ [\d.]+ 0 \d \d/g)!;
    expect(arcs[0]).toMatch(/0 0 1/);
    expect(arcs[2]).toMatch(/0 0 1/);
  });
});
