import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { SelectButton } from 'primeng/selectbutton';
import { Slider } from 'primeng/slider';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { TranslateService } from '../../i18n/translate.service';
import {
  AIRSPACE_ALT_FILTER_STEP_M,
  countActiveAirspaceFilterCriteria,
  DEFAULT_AIRSPACE_ZONE_FILTERS,
  formatAltitudeMslLabel,
  inactiveBandForExtent,
  type AirspaceCriterionFilterPrefs,
  type AirspaceFilterFieldOptions,
  type AirspaceFilterMode,
  type AirspaceVolumeDisplayFilter,
  type AirspaceZoneFiltersPrefs
} from '../../utils/airspace-zone-filter.util';

type CriterionKey = 'class' | 'type' | 'name';

type FilterTabId = 'zones' | 'vertical' | 'name';

interface CriterionSection {
  key: CriterionKey;
  label: string;
  values: string[];
}

@Component({
  selector: 'app-airspace-zone-filters',
  standalone: true,
  imports: [FormsModule, Dialog, Button, SelectButton, Slider, TranslatePipe],
  templateUrl: './airspace-zone-filters.component.html',
  styleUrl: './airspace-zone-filters.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AirspaceZoneFiltersComponent {
  private readonly i18n = inject(TranslateService);

  readonly visible = input(false);
  readonly visibleChange = output<boolean>();
  readonly options = input<AirspaceFilterFieldOptions | null>(null);
  readonly filters = input<AirspaceZoneFiltersPrefs>(DEFAULT_AIRSPACE_ZONE_FILTERS);
  readonly filtersChange = output<AirspaceZoneFiltersPrefs>();

  readonly activeTab = signal<FilterTabId>('zones');
  readonly sectionSearch = signal<Partial<Record<CriterionKey, string>>>({});

  nameDraft = '';

  readonly formatAltitudeMslLabel = formatAltitudeMslLabel;
  readonly altStepM = AIRSPACE_ALT_FILTER_STEP_M;

  readonly altitudeExtents = computed(() => this.options()?.altitude ?? null);

  readonly tabOptions = computed(() => {
    this.i18n.locale();
    return [
      { label: this.i18n.t('airspaceFilters.tabZones'), value: 'zones' as const },
      { label: this.i18n.t('airspaceFilters.tabVertical'), value: 'vertical' as const },
      { label: this.i18n.t('airspaceFilters.tabName'), value: 'name' as const }
    ];
  });

  readonly volumeOptions = computed(() => {
    this.i18n.locale();
    return [
      { label: this.i18n.t('airspaceFilters.volumeAll'), value: 'all' as const },
      {
        label: this.i18n.t('airspaceFilters.volumeVolumetric'),
        value: 'volumetric' as const
      },
      { label: this.i18n.t('airspaceFilters.volumeFlat'), value: 'flat' as const }
    ];
  });

  readonly activeCriteriaCount = computed(() =>
    countActiveAirspaceFilterCriteria(this.filters())
  );

  readonly zoneSections = computed((): CriterionSection[] => {
    this.i18n.locale();
    const opts = this.options();
    if (!opts) return [];
    return [
      { key: 'class', label: this.i18n.t('airspaceFilters.class'), values: opts.class },
      { key: 'type', label: this.i18n.t('airspaceFilters.type'), values: opts.type }
    ];
  });

  readonly sectionsForActiveTab = computed((): CriterionSection[] => {
    if (this.activeTab() === 'zones') return this.zoneSections();
    return [];
  });

  floorSliderModel(): number[] {
    const f = this.filters().floorMsl;
    return [f.minM, f.maxM];
  }

  ceilingSliderModel(): number[] {
    const c = this.filters().ceilingMsl;
    return [c.minM, c.maxM];
  }

  onDialogVisibleChange(open: boolean): void {
    this.visibleChange.emit(open);
  }

  setTab(tab: FilterTabId): void {
    this.activeTab.set(tab);
  }

  criterionMode(key: CriterionKey): AirspaceFilterMode {
    return this.filters()[key].mode;
  }

  selectedCount(key: CriterionKey): number {
    return this.filters()[key].values.length;
  }

  isValueSelected(key: CriterionKey, value: string): boolean {
    return this.filters()[key].values.includes(value);
  }

  filteredValues(section: CriterionSection): string[] {
    const q = (this.sectionSearch()[section.key] ?? '').trim().toLowerCase();
    if (!q) return section.values;
    return section.values.filter(v => v.toLowerCase().includes(q));
  }

  sectionModeHint(key: CriterionKey): string {
    const n = this.selectedCount(key);
    if (n === 0) return this.i18n.t('airspaceFilters.sectionIdle');
    return this.criterionMode(key) === 'include'
      ? this.i18n.t('airspaceFilters.sectionInclude', { count: n })
      : this.i18n.t('airspaceFilters.sectionExclude', { count: n });
  }

  setCriterionMode(key: CriterionKey, mode: AirspaceFilterMode): void {
    this.emitPatch({
      [key]: { ...this.filters()[key], mode }
    } as Partial<AirspaceZoneFiltersPrefs>);
  }

  toggleValue(key: CriterionKey, value: string): void {
    const on = !this.isValueSelected(key, value);
    const prev = this.filters()[key].values;
    const values = on ? [...prev, value] : prev.filter(v => v !== value);
    this.emitPatch({
      [key]: { ...this.filters()[key], values }
    } as Partial<AirspaceZoneFiltersPrefs>);
  }

  selectAllInSection(section: CriterionSection): void {
    this.emitPatch({
      [section.key]: {
        ...this.filters()[section.key],
        values: [...section.values]
      }
    } as Partial<AirspaceZoneFiltersPrefs>);
  }

  clearSection(key: CriterionKey): void {
    this.emitPatch({
      [key]: { ...this.filters()[key], values: [] }
    } as Partial<AirspaceZoneFiltersPrefs>);
  }

  patchSectionSearch(key: CriterionKey, query: string): void {
    this.sectionSearch.update(prev => ({ ...prev, [key]: query }));
  }

  onVolumeChange(volume: AirspaceVolumeDisplayFilter): void {
    this.emitPatch({ volume });
  }

  onFloorSliderChange(values: number[]): void {
    const ext = this.altitudeExtents();
    if (!ext || values.length < 2) return;
    const minM = Math.min(values[0], values[1]);
    const maxM = Math.max(values[0], values[1]);
    const active = minM > ext.floorMinM || maxM < ext.floorMaxM;
    this.emitPatch({ floorMsl: { active, minM, maxM } });
  }

  onCeilingSliderChange(values: number[]): void {
    const ext = this.altitudeExtents();
    if (!ext || values.length < 2) return;
    const minM = Math.min(values[0], values[1]);
    const maxM = Math.max(values[0], values[1]);
    const active = minM > ext.ceilingMinM || maxM < ext.ceilingMaxM;
    this.emitPatch({ ceilingMsl: { active, minM, maxM } });
  }

  clearFloorFilter(): void {
    const ext = this.altitudeExtents();
    if (!ext) return;
    this.emitPatch({
      floorMsl: inactiveBandForExtent(ext.floorMinM, ext.floorMaxM)
    });
  }

  clearCeilingFilter(): void {
    const ext = this.altitudeExtents();
    if (!ext) return;
    this.emitPatch({
      ceilingMsl: inactiveBandForExtent(ext.ceilingMinM, ext.ceilingMaxM)
    });
  }

  addNameTerm(): void {
    const term = this.nameDraft.trim();
    if (!term) return;
    const prev = this.filters().name.values;
    if (prev.includes(term)) {
      this.nameDraft = '';
      return;
    }
    this.emitPatch({
      name: { ...this.filters().name, values: [...prev, term] }
    });
    this.nameDraft = '';
  }

  removeNameTerm(term: string): void {
    this.emitPatch({
      name: {
        ...this.filters().name,
        values: this.filters().name.values.filter(v => v !== term)
      }
    });
  }

  resetFilters(): void {
    const ext = this.altitudeExtents();
    this.sectionSearch.set({});
    this.nameDraft = '';
    const next = structuredClone(DEFAULT_AIRSPACE_ZONE_FILTERS);
    if (ext) {
      next.floorMsl = inactiveBandForExtent(ext.floorMinM, ext.floorMaxM);
      next.ceilingMsl = inactiveBandForExtent(ext.ceilingMinM, ext.ceilingMaxM);
    }
    this.filtersChange.emit(next);
  }

  private emitPatch(patch: Partial<AirspaceZoneFiltersPrefs>): void {
    const next = { ...this.filters(), ...patch } as AirspaceZoneFiltersPrefs;
    for (const key of ['class', 'type', 'name'] as const) {
      if (patch[key]) {
        next[key] = patch[key] as AirspaceCriterionFilterPrefs;
      }
    }
    if (patch.floorMsl) next.floorMsl = patch.floorMsl;
    if (patch.ceilingMsl) next.ceilingMsl = patch.ceilingMsl;
    this.filtersChange.emit(next);
  }
}
