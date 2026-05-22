/** Raison d'échec ou de dégradation lors de l'échantillonnage DEM. */
export type DemFailureReason = 'network' | 'tiles-missing' | 'partial-profile';

export type DemSamplingStatus = 'ok' | 'partial' | 'failed';

export interface DemSamplingResult<T> {
  status: DemSamplingStatus;
  reason?: DemFailureReason;
  value?: T;
  error?: unknown;
}
