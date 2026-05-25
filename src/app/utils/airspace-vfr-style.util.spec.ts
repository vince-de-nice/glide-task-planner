import { describe, expect, it } from 'vitest';
import {
  resolveAirspaceVfrFamily,
  resolveAirspaceVfrPaint,
  vfrStylePropsFromPoaff,
  wireframeColorFromProps
} from './airspace-vfr-style.util';

describe('resolveAirspaceVfrFamily', () => {
  it('classifies TMA as controlled (blue family)', () => {
    expect(resolveAirspaceVfrFamily({ class: 'D', type: 'TMA' })).toBe(
      'controlled'
    );
    expect(resolveAirspaceVfrPaint({ class: 'D', type: 'TMA' }).stroke).toBe(
      '#1e40af'
    );
  });

  it('classifies CTR as controlled', () => {
    expect(resolveAirspaceVfrFamily({ class: 'D', type: 'CTR' })).toBe(
      'controlled'
    );
  });

  it('classifies class C as controlled', () => {
    expect(resolveAirspaceVfrFamily({ class: 'C', type: 'TMA' })).toBe(
      'controlled'
    );
  });

  it('classifies R zones as restricted (red, not POAFF purple)', () => {
    expect(resolveAirspaceVfrFamily({ class: 'R', type: 'R' })).toBe(
      'restricted'
    );
    expect(resolveAirspaceVfrPaint({ class: 'R', type: 'R' }).stroke).toBe(
      '#dc2626'
    );
  });

  it('classifies danger D without controlled type as restricted', () => {
    expect(resolveAirspaceVfrFamily({ class: 'D', type: 'R' })).toBe(
      'restricted'
    );
  });

  it('classifies P as prohibited', () => {
    expect(resolveAirspaceVfrFamily({ class: 'P', type: 'P' })).toBe(
      'prohibited'
    );
  });

  it('classifies GP PROTECT as protect', () => {
    expect(resolveAirspaceVfrFamily({ class: 'GP', type: 'PROTECT' })).toBe(
      'protect'
    );
    expect(resolveAirspaceVfrPaint({ class: 'GP', type: 'PROTECT' }).stroke).toBe(
      '#c2410c'
    );
  });

  it('classifies ZSM separately from GP', () => {
    expect(resolveAirspaceVfrFamily({ class: 'ZSM', type: 'PROTECT' })).toBe(
      'zsm'
    );
  });

  it('classifies FFVL protocol zones', () => {
    expect(resolveAirspaceVfrFamily({ class: 'FFVL', type: 'FFVL-Prot' })).toBe(
      'ffvl'
    );
  });
});

describe('vfrStylePropsFromPoaff', () => {
  it('exposes vfr* properties for MapLibre', () => {
    const props = vfrStylePropsFromPoaff({ class: 'D', type: 'TMA' });
    expect(props.vfrStroke).toBe('#1e40af');
    expect(props.vfrFill).toBe('#93c5fd');
    expect(props.vfrFillOpacity).toBeGreaterThan(0);
    expect(props.vfrStrokeWidth).toBe(2.5);
    expect(props.vfrFamily).toBe('controlled');
  });
});

describe('wireframeColorFromProps', () => {
  it('matches VFR stroke for wireframe', () => {
    expect(wireframeColorFromProps({ class: 'R', type: 'R' })).toBe('#dc2626');
  });
});
