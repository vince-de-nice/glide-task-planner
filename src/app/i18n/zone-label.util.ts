import { ObservationZoneConfig } from '../models/observation-zone.model';
import { TranslateService } from './translate.service';

export function observationZoneShortLabelI18n(
  zone: ObservationZoneConfig,
  i18n: TranslateService
): string {
  if (zone.line) {
    return i18n.t('zone.line', { meters: zone.r1M });
  }
  if (zone.r2M && zone.r2M > 1000) {
    return i18n.t('zone.sectorKm', { km: (zone.r1M / 1000).toFixed(0) });
  }
  if (zone.a1Deg != null && zone.a1Deg > 0 && zone.a1Deg < 360) {
    return i18n.t('zone.sectorDeg', { deg: zone.a1Deg, meters: zone.r1M });
  }
  if (zone.cupStyle === 1) {
    return i18n.t('zone.cylSym', { meters: zone.r1M });
  }
  return i18n.t('zone.cyl', { meters: zone.r1M });
}
