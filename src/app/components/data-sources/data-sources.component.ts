import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
  viewChild,
  ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { CupDatabaseService } from '../../services/cup-database.service';
import { CupSourcesConfigService } from '../../services/cup-sources-config.service';
import { CupLoaderService } from '../../services/cup-loader.service';
import { TaskStateService } from '../../services/task-state.service';
import { WaypointService } from '../../services/waypoint.service';
import { UiFeedbackService } from '../../services/ui-feedback.service';
import { TranslateService } from '../../i18n/translate.service';
import { TranslatePipe } from '../../i18n/translate.pipe';
import { CupSourceEntry } from '../../models/cup-sources.model';
import { AirspaceDataSourceService } from '../../services/airspace-data-source.service';
import { AirspaceMapDisplayService } from '../../services/airspace-map-display.service';
import { CupImportedSourceService } from '../../services/cup-imported-source.service';

@Component({
  selector: 'app-data-sources',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Button,
    InputText,
    TranslatePipe
  ],
  templateUrl: './data-sources.component.html',
  styleUrl: './data-sources.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class DataSourcesComponent implements OnInit {
  private cupDatabase = inject(CupDatabaseService);
  private cupSourcesConfig = inject(CupSourcesConfigService);
  private cupLoader = inject(CupLoaderService);
  private taskState = inject(TaskStateService);
  private waypointService = inject(WaypointService);
  private uiFeedback = inject(UiFeedbackService);
  private i18n = inject(TranslateService);
  readonly airspaceSources = inject(AirspaceDataSourceService);
  readonly cupImported = inject(CupImportedSourceService);
  private readonly airspaceMapDisplay = inject(AirspaceMapDisplayService);

  private readonly cupFileInput = viewChild<ElementRef<HTMLInputElement>>('cupFileInput');
  private readonly geoJsonInput = viewChild<ElementRef<HTMLInputElement>>('geoJsonInput');

  cupMeta = this.cupDatabase.meta;
  waypoints = this.waypointService.waypoints;
  selectedWaypointIds = this.taskState.selectedWaypointIds;

  configSources = signal<CupSourceEntry[]>([]);
  configError = signal<string | null>(null);
  cupDisclaimer = signal('');
  loadingSource = signal(false);
  cupImporting = signal(false);
  airspaceImporting = signal(false);
  cupUrlInput = signal('');

  readonly activeAirspaceLabel = computed(() => this.airspaceSources.activeLabel());

  readonly loadedAtLabel = computed(() => {
    const at = this.cupMeta().loadedAt;
    if (!at) return null;
    try {
      return new Date(at).toLocaleString(this.i18n.locale() === 'fr' ? 'fr-FR' : 'en-GB', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
    } catch {
      return at;
    }
  });

  ngOnInit(): void {
    void this.refreshLists();
  }

  refreshLists(): void {
    void this.cupSourcesConfig.loadConfig().then(
      config => {
        this.configSources.set(config.sources);
        this.cupDisclaimer.set(config.disclaimer);
        this.configError.set(null);
      },
      () => this.configError.set(this.i18n.t('cup.configError'))
    );
  }

  isActiveCupSource(url: string): boolean {
    return this.cupDatabase.isFromUrl(url);
  }

  isActiveCupImport(importId: string): boolean {
    return this.cupImported.isActiveImport(importId);
  }

  isActiveAirspaceSource(sourceId: string): boolean {
    return this.airspaceSources.activeSourceId() === sourceId;
  }

  triggerCupImport(): void {
    this.cupFileInput()?.nativeElement.click();
  }

  async onCupFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    if (this.waypoints().length > 0) {
      const ok = await this.uiFeedback.confirm({
        header: this.i18n.t('cup.replaceHeader'),
        message: this.i18n.t('cup.replaceFileMessage', { name: file.name })
      });
      if (!ok) return;
    }

    this.cupImporting.set(true);
    try {
      await this.runCupLoad(async () => {
        const id = await this.cupImported.importFile(file);
        if (!id) return 0;
        this.taskState.clearSelection();
        this.taskState.resetTaskNameToToday();
        return this.waypoints().length;
      });
    } finally {
      this.cupImporting.set(false);
    }
  }

  exportCup(): void {
    const content = this.cupDatabase.exportCup();
    const label =
      this.cupDatabase.getSourceLabel().replace(/[^\w.-]+/g, '_') || 'circuit-export';
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${label}.cup`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  async loadFromUrlInput(): Promise<void> {
    const url = this.cupUrlInput().trim();
    if (!url) return;
    await this.loadUrl(url);
  }

  async loadSource(entry: CupSourceEntry): Promise<void> {
    await this.loadUrl(entry.url, entry.label);
  }

  async activateCupImport(importId: string): Promise<void> {
    if (this.isActiveCupImport(importId)) return;
    if (this.waypoints().length > 0) {
      const meta = this.cupImported.imports().find(m => m.id === importId);
      const ok = await this.uiFeedback.confirm({
        header: this.i18n.t('cup.replaceHeader'),
        message: this.i18n.t('cup.replaceFileMessage', {
          name: meta?.label ?? 'CUP'
        })
      });
      if (!ok) return;
    }
    await this.runCupLoad(async () => {
      const count = await this.cupImported.activateImport(importId);
      if (count > 0) {
        this.taskState.clearSelection();
        this.taskState.resetTaskNameToToday();
      }
      return count;
    });
  }

  async removeCupImport(importId: string): Promise<void> {
    const meta = this.cupImported.imports().find(m => m.id === importId);
    if (!meta) return;
    const ok = await this.uiFeedback.confirm({
      header: this.i18n.t('dataSources.cup.removeImportedHeader'),
      message: this.i18n.t('dataSources.cup.removeImportedMessage', { label: meta.label }),
      acceptButtonStyleClass: 'p-button-danger'
    });
    if (!ok) return;
    await this.cupImported.removeImport(importId);
  }

  async activateAirspaceSource(sourceId: string): Promise<void> {
    if (this.isActiveAirspaceSource(sourceId)) return;
    await this.airspaceSources.setActiveSource(sourceId);
    this.airspaceMapDisplay.invalidateActiveSourceCache();
  }

  triggerAirspaceImport(): void {
    this.geoJsonInput()?.nativeElement.click();
  }

  async onAirspaceFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    this.airspaceImporting.set(true);
    try {
      const id = await this.airspaceSources.importGeoJsonFile(file);
      if (!id) {
        this.uiFeedback.error(this.i18n.t('dataSources.airspace.importFailed'));
        return;
      }
      this.airspaceMapDisplay.invalidateActiveSourceCache();
      const meta = this.airspaceSources.customSources().find(s => s.id === id);
      this.uiFeedback.success(
        this.i18n.t('dataSources.airspace.imported'),
        this.i18n.t('dataSources.airspace.importedDetail', {
          count: meta?.featureCount ?? 0
        })
      );
    } finally {
      this.airspaceImporting.set(false);
    }
  }

  async removeCustomAirspace(sourceId: string): Promise<void> {
    const meta = this.airspaceSources.customSources().find(s => s.id === sourceId);
    if (!meta) return;
    const ok = await this.uiFeedback.confirm({
      header: this.i18n.t('dataSources.airspace.removeCustomHeader'),
      message: this.i18n.t('dataSources.airspace.removeCustomMessage', {
        label: meta.label
      }),
      acceptButtonStyleClass: 'p-button-danger'
    });
    if (!ok) return;
    await this.airspaceSources.removeCustomSource(sourceId);
    this.airspaceMapDisplay.invalidateActiveSourceCache();
  }

  async clearDatabase(): Promise<void> {
    if (this.waypoints().length === 0) return;
    const ok = await this.uiFeedback.confirm({
      header: this.i18n.t('dataSources.cup.clearDbHeader'),
      message: this.i18n.t('dataSources.cup.clearDbMessage'),
      acceptLabel: this.i18n.t('dataSources.cup.clearDbAccept'),
      acceptButtonStyleClass: 'p-button-danger'
    });
    if (!ok) return;
    this.waypointService.clearWaypoints();
    this.taskState.clearSelection();
    this.refreshLists();
    this.uiFeedback.success(this.i18n.t('dataSources.cup.cleared'));
  }

  private async loadUrl(url: string, label?: string): Promise<void> {
    if (this.waypoints().length > 0) {
      const ok = await this.uiFeedback.confirm({
        header: this.i18n.t('cup.replaceHeader'),
        message: this.i18n.t('cup.replaceUrlMessage', { count: this.waypoints().length })
      });
      if (!ok) return;
    }
    await this.runCupLoad(() => this.cupLoader.loadFromUrl(url, label, true));
    this.cupUrlInput.set(url);
  }

  private async runCupLoad(loader: () => Promise<number>): Promise<void> {
    this.loadingSource.set(true);
    try {
      const count = await loader();
      if (count === 0) {
        this.uiFeedback.warn(this.i18n.t('cup.noWaypoints'));
      } else {
        this.uiFeedback.success(
          this.i18n.t('cup.loaded'),
          this.i18n.t('cup.loadedDetail', { count })
        );
      }
      this.refreshLists();
    } catch (e) {
      this.uiFeedback.error(
        e instanceof Error ? e.message : this.i18n.t('cup.loadFailed')
      );
    } finally {
      this.loadingSource.set(false);
    }
  }

}
