import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { Dialog } from 'primeng/dialog';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import { ToggleSwitch } from 'primeng/toggleswitch';
import { TranslatePipe } from '../../../i18n/translate.pipe';
import { TranslateService } from '../../../i18n/translate.service';
import {
  DEFAULT_SAFETY_PRINT_OPTIONS,
  SAFETY_PRINT_OPTIONS_STORAGE_KEY,
  type SafetyPrintOptions
} from '../../../models/safety-print-options.model';
import type { SafetyLegRender } from '../../../services/safety-profile-terrain.facade';
import type { Waypoint } from '../../../models/waypoint.model';
import type { CircuitLeg } from '../../../models/circuit.model';
import type { SafetyParams } from '../../../models/safety-params.model';
import {
  BASEMAP_PRESETS,
  DEFAULT_BASEMAP_ID,
  isBasemapId,
  type BasemapId
} from '../../map-view/map-style.constants';
import { SafetyPrintService } from '../../../services/safety-print.service';
import {
  LegProfileChartComponent,
  type LegChartLabels
} from '../leg-profile-chart.component';
import { defaultLegYMaxM } from '../../../utils/safety-profile-chart.util';
import type { LegAirspaceProfileBand } from '../../../utils/leg-airspace-profile-cross-section.util';

@Component({
  selector: 'app-safety-print-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    Dialog,
    Button,
    Select,
    ToggleSwitch,
    TranslatePipe,
    LegProfileChartComponent
  ],
  templateUrl: './safety-print-dialog.component.html',
  styleUrl: './safety-print-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SafetyPrintDialogComponent {
  private readonly printService = inject(SafetyPrintService);
  private readonly i18n = inject(TranslateService);
  private readonly sanitizer = inject(DomSanitizer);

  visible = input(false);
  visibleChange = output<boolean>();

  legRenders = input.required<SafetyLegRender[]>();
  legPairs = input.required<{ from: Waypoint; to: Waypoint }[]>();
  circuitLegs = input.required<CircuitLeg[]>();
  taskName = input.required<string>();
  safetyParams = input.required<SafetyParams>();
  basemapId = input<BasemapId>(DEFAULT_BASEMAP_ID);
  chartLabels = input.required<LegChartLabels>();
  glideRatio = input.required<number>();
  arrivalMarginM = input.required<number>();
  groundMarginM = input.required<number>();
  noLandables = input(false);
  getWaypoint = input.required<(id: string) => Waypoint | undefined>();
  enabledAirspaceKeysForLeg = input.required<(legIndex: number) => Set<string>>();
  airspaceBandsForLeg = input.required<(leg: SafetyLegRender) => LegAirspaceProfileBand[]>();
  effectiveYMaxForLeg = input.required<(leg: SafetyLegRender) => number>();
  landableColorsForLeg = input.required<(leg: SafetyLegRender) => Record<string, string>>();

  private readonly chartRef = viewChild(LegProfileChartComponent);

  readonly options = signal<SafetyPrintOptions>(this.loadStoredOptions());
  readonly generating = signal(false);
  readonly progressLabel = signal('');
  readonly previewPages = signal<{ label: string; orientation: string }[]>([]);
  readonly chartLeg = signal<SafetyLegRender | null>(null);
  readonly lastPdfBlob = signal<Blob | null>(null);
  readonly lastPdfFilename = signal('profil_securite.pdf');
  /** URL blob pour l’iframe d’aperçu (révoquée à la fermeture). */
  readonly previewPdfUrl = signal<string | null>(null);

  readonly previewPageCount = computed(() => this.previewPages().length);

  /** URL blob marquée sûre pour [src] de l’iframe (NG0904). */
  readonly previewPdfSafeUrl = computed(() => {
    const url = this.previewPdfUrl();
    if (!url) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  readonly layoutModeOptions = computed(() => {
    this.i18n.locale();
    return [
      { label: this.i18n.t('safetyProfile.print.modeFullCircuit'), value: 'fullCircuit' as const },
      { label: this.i18n.t('safetyProfile.print.modePerBranch'), value: 'perBranch' as const }
    ];
  });

  readonly basemapOptions = computed(() => {
    this.i18n.locale();
    return BASEMAP_PRESETS.map(p => ({
      value: p.id,
      label: this.i18n.t(p.labelKey)
    }));
  });

  onShow(): void {
    const stored = this.loadStoredOptions();
    this.options.set({ ...stored, basemapId: this.basemapId() });
    this.refreshPreview();
    this.revokePreviewUrl();
    this.lastPdfBlob.set(null);
  }

  onHide(): void {
    this.revokePreviewUrl();
    this.chartLeg.set(null);
    if (this.generating()) return;
  }

  close(): void {
    this.visibleChange.emit(false);
  }

  refreshPreview(): void {
    const summary = this.printService.buildPreviewSummary(
      this.options(),
      this.legRenders(),
      this.legPairs(),
      this.getWaypoint()
    );
    this.previewPages.set(summary.pages);
  }

  patchOptions(patch: Partial<SafetyPrintOptions>): void {
    this.options.update(o => {
      const next = { ...o, ...patch };
      this.persistOptions(next);
      return next;
    });
    this.refreshPreview();
  }

  async generatePreview(): Promise<void> {
    if (this.generating()) return;
    if (this.lastPdfBlob()) {
      this.attachPreviewFromBlob(this.lastPdfBlob()!);
      return;
    }
    await this.runGenerate({ download: false });
  }

  async downloadPdf(): Promise<void> {
    if (this.generating()) return;
    let blob = this.lastPdfBlob();
    if (!blob) {
      await this.runGenerate({ download: false });
      blob = this.lastPdfBlob();
    }
    if (!blob) return;
    this.triggerDownload(blob, this.lastPdfFilename());
  }

  async printPdf(): Promise<void> {
    if (this.generating()) return;
    let blob = this.lastPdfBlob();
    if (!blob) {
      await this.runGenerate({ download: false });
      blob = this.lastPdfBlob();
    }
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const w = window.open(url, '_blank');
    if (w) {
      w.addEventListener('load', () => {
        w.print();
      });
    }
  }

  private async runGenerate(runOpts: { download: boolean }): Promise<void> {
    if (this.generating()) return;
    this.generating.set(true);
    this.progressLabel.set(this.i18n.t('safetyProfile.print.progressStart'));
    try {
      const printOptions = this.options();
      const result = await this.printService.generatePdf({
        options: printOptions,
        legRenders: this.legRenders(),
        legPairs: this.legPairs(),
        circuitLegs: this.circuitLegs(),
        glideRatio: this.glideRatio(),
        metadata: {
          taskName: this.taskName(),
          dateLabel: new Date().toLocaleDateString(),
          glideRatio: this.safetyParams().glideRatio,
          arrivalMarginM: this.safetyParams().arrivalMarginM,
          groundMarginM: this.safetyParams().groundMarginM
        },
        getWaypoint: this.getWaypoint(),
        enabledAirspaceKeysForLeg: this.enabledAirspaceKeysForLeg(),
        renderProfilePng: legIndex => this.renderProfilePngForLeg(legIndex),
        onProgress: p => {
          this.progressLabel.set(
            `${this.i18n.t('safetyProfile.print.progressPage')} ${p.current}/${p.total}`
          );
        }
      });
      const blob = new Blob([result.bytes.slice()], { type: 'application/pdf' });
      this.lastPdfBlob.set(blob);
      this.lastPdfFilename.set(result.filename);
      this.attachPreviewFromBlob(blob);
      if (runOpts.download) {
        this.triggerDownload(blob, result.filename);
      }
    } catch (e) {
      console.error('[safety-print]', e);
      this.progressLabel.set(this.i18n.t('safetyProfile.print.progressError'));
    } finally {
      this.generating.set(false);
      this.chartLeg.set(null);
    }
  }

  private async renderProfilePngForLeg(legIndex: number): Promise<string | null> {
    const leg = this.legRenders().find(l => l.index === legIndex);
    if (!leg) return null;
    this.chartLeg.set(leg);
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    const chart = this.chartRef();
    if (!chart) return null;
    chart.setChartSizeForPrint();
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
    return chart.rasterizeSvgForPrint();
  }

  private attachPreviewFromBlob(blob: Blob): void {
    this.revokePreviewUrl();
    this.previewPdfUrl.set(URL.createObjectURL(blob));
  }

  private revokePreviewUrl(): void {
    const url = this.previewPdfUrl();
    if (url) URL.revokeObjectURL(url);
    this.previewPdfUrl.set(null);
  }

  private triggerDownload(blob: Blob, filename = 'profil_securite.pdf'): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  private loadStoredOptions(): SafetyPrintOptions {
    try {
      const raw = localStorage.getItem(SAFETY_PRINT_OPTIONS_STORAGE_KEY);
      if (!raw) return { ...DEFAULT_SAFETY_PRINT_OPTIONS };
      const parsed = JSON.parse(raw) as Partial<SafetyPrintOptions>;
      return {
        ...DEFAULT_SAFETY_PRINT_OPTIONS,
        ...parsed,
        basemapId:
          parsed.basemapId != null && isBasemapId(parsed.basemapId)
            ? parsed.basemapId
            : DEFAULT_SAFETY_PRINT_OPTIONS.basemapId
      };
    } catch {
      return { ...DEFAULT_SAFETY_PRINT_OPTIONS };
    }
  }

  private persistOptions(opts: SafetyPrintOptions): void {
    try {
      localStorage.setItem(SAFETY_PRINT_OPTIONS_STORAGE_KEY, JSON.stringify(opts));
    } catch {
      /* quota */
    }
  }

  effectiveYMax(leg: SafetyLegRender): number {
    return this.effectiveYMaxForLeg()(leg);
  }

  defaultYMax(leg: SafetyLegRender): number {
    return defaultLegYMaxM(leg.envelope.samples);
  }
}
