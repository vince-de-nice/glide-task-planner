import { Injectable, inject } from '@angular/core';
import { TranslateService } from '../i18n/translate.service';
import { PDFDocument, rgb, StandardFonts, type PDFPage } from 'pdf-lib';
import type {
  SafetyPrintOptions,
  SafetyPrintMetadata,
  SafetyPrintProgress,
  SafetyPrintProfileSubPhase
} from '../models/safety-print-options.model';
import type { SafetyLegRender } from './safety-profile-terrain.facade';
import type { Waypoint } from '../models/waypoint.model';
import type { CircuitLeg } from '../models/circuit.model';
import {
  SafetyPrintMapRendererService,
  type PrintMapRenderContext
} from './safety-print-map-renderer.service';
import {
  buildPrintJobPages,
  countPrintWorkSteps,
  type PrintJobPage
} from '../utils/safety-print-layout.util';
import { formatPdfInteger, sanitizePdfText } from '../utils/print-pdf-text.util';
import { buildAirspacePrintSummarySections } from '../utils/leg-airspace-print-summary.util';
import {
  appendAirspaceSummaryPages,
  countAirspaceSummaryPages,
  type AirspaceSummaryPdfLabels
} from '../utils/safety-print-airspace-summary-pdf.util';
import { drawProfileSvgInBox } from '../utils/profile-chart-pdf-svg.util';
import {
  clampProfileChartHeightPercent,
  pickScaleBarMeters,
  PRINT_MARGIN_MM,
  PRINT_HEADER_MM,
  PRINT_SCALE_DENOMINATOR,
  PROFILE_COMBINED_GAP_MM,
  PROFILE_COMBINED_LABEL_MM,
  scaleBarWidthMm,
  type PrintPageOrientation,
  type ProfileChartPrintLayout
} from '../utils/print-scale.util';

const MM_TO_PT = 2.834645669;
const A4_PORTRAIT_PT = { w: 595.28, h: 841.89 };

export interface SafetyPrintPreviewSummary {
  pageCount: number;
  pages: { label: string; orientation: PrintPageOrientation }[];
}

export interface SafetyPrintPdfResult {
  bytes: Uint8Array;
  filename: string;
}

@Injectable({ providedIn: 'root' })
export class SafetyPrintService {
  private readonly mapRenderer = inject(SafetyPrintMapRendererService);
  private readonly i18n = inject(TranslateService);

  buildPreviewSummary(
    options: SafetyPrintOptions,
    legRenders: SafetyLegRender[],
    legPairs: { from: Waypoint; to: Waypoint }[],
    getWaypoint: (id: string) => Waypoint | undefined,
    params?: {
      circuitLegs: CircuitLeg[];
      enabledAirspaceKeysForLeg: (legIndex: number) => Set<string>;
    }
  ): SafetyPrintPreviewSummary {
    const jobPages = buildPrintJobPages({
      layoutMode: options.layoutMode,
      legRenders,
      legPairs,
      includeHeader: options.includeMetadata,
      includeProfileChart:
        options.layoutMode === 'perBranch' && options.includeProfileChart,
      profileChartPlacement: options.profileChartPlacement,
      cones3d: options.coneVolumes3d,
      getWaypoint
    });
    const summaryLabels = this.airspaceSummaryLabels();
    const summarySections =
      options.includeAirspaceZonesSummary && params
        ? buildAirspacePrintSummarySections({
            circuitLegs: params.circuitLegs,
            legRenders,
            enabledAirspaceKeysForLeg: params.enabledAirspaceKeysForLeg
          })
        : [];
    const summaryPageCount = countAirspaceSummaryPages(
      summarySections,
      summaryLabels
    );
    const mapPages = jobPages.map((p, i) => ({
      label: pageLabel(p, legRenders, i),
      orientation:
        (p.kind === 'map'
          ? p.pageSpec.orientation
          : p.kind === 'profilesCombined'
            ? 'landscape'
            : (p.mapPageSpec?.orientation ??
              (!p.mapPageSpec ? 'landscape' : 'portrait'))) as PrintPageOrientation
    }));
    const summaryPages = Array.from({ length: summaryPageCount }, (_, i) => ({
      label:
        summaryPageCount > 1
          ? `${summaryLabels.documentTitle} (${i + 1}/${summaryPageCount})`
          : summaryLabels.documentTitle,
      orientation: 'portrait' as const
    }));
    return {
      pageCount: mapPages.length + summaryPages.length,
      pages: [...mapPages, ...summaryPages]
    };
  }

  async generatePdf(params: {
    options: SafetyPrintOptions;
    legRenders: SafetyLegRender[];
    legPairs: { from: Waypoint; to: Waypoint }[];
    circuitLegs: CircuitLeg[];
    glideRatio: number;
    metadata: SafetyPrintMetadata;
    getWaypoint: (id: string) => Waypoint | undefined;
    enabledAirspaceKeysForLeg: (legIndex: number) => Set<string>;
    renderProfileSvg: (
      legIndex: number,
      layout: ProfileChartPrintLayout,
      printContext?: {
        combinedProfileCount?: number;
        pageOrientation: PrintPageOrientation;
      },
      onSubProgress?: (sub: SafetyPrintProfileSubPhase) => void
    ) => Promise<string | null>;
    onProgress?: (p: SafetyPrintProgress) => void;
  }): Promise<SafetyPrintPdfResult> {
    const jobPages = buildPrintJobPages({
      layoutMode: params.options.layoutMode,
      legRenders: params.legRenders,
      legPairs: params.legPairs,
      includeHeader: params.options.includeMetadata,
      includeProfileChart:
        params.options.layoutMode === 'perBranch' && params.options.includeProfileChart,
      profileChartPlacement: params.options.profileChartPlacement,
      cones3d: params.options.coneVolumes3d,
      getWaypoint: params.getWaypoint
    });

    const summarySections = params.options.includeAirspaceZonesSummary
      ? buildAirspacePrintSummarySections({
          circuitLegs: params.circuitLegs,
          legRenders: params.legRenders,
          enabledAirspaceKeysForLeg: params.enabledAirspaceKeysForLeg
        })
      : [];
    const summaryLabels = this.airspaceSummaryLabels();
    const summaryPageCount = countAirspaceSummaryPages(
      summarySections,
      summaryLabels
    );
    const stepTotal =
      countPrintWorkSteps(jobPages) + (summaryPageCount > 0 ? summaryPageCount : 0);
    const pageTotal = jobPages.length + summaryPageCount;
    let step = 0;
    let pdfPageIndex = 0;

    const emit = (
      partial: Omit<SafetyPrintProgress, 'step' | 'stepTotal'>
    ): void => {
      params.onProgress?.({
        step,
        stepTotal,
        ...partial
      });
    };

    const advance = (
      partial: Omit<SafetyPrintProgress, 'step' | 'stepTotal'>
    ): void => {
      step++;
      emit(partial);
    };

    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const ctx: PrintMapRenderContext = {
      options: params.options,
      legRenders: params.legRenders,
      legPairs: params.legPairs,
      circuitLegs: params.circuitLegs,
      glideRatio: params.glideRatio,
      focusLegIndex: null,
      getWaypoint: params.getWaypoint,
      enabledAirspaceKeysForLeg: params.enabledAirspaceKeysForLeg
    };

    advance({ phase: 'init' });

    try {
      for (const jobPage of jobPages) {
        pdfPageIndex++;
        const pageLabel = pageLabelForJob(jobPage, params.legRenders, pdfPageIndex);

        if (jobPage.kind === 'map') {
          advance({
            phase: 'map',
            pageIndex: pdfPageIndex,
            pageTotal,
            pageLabel
          });
          ctx.focusLegIndex = jobPage.focusLegIndex;
          const png = await this.mapRenderer.renderPage(jobPage.pageSpec, ctx);
          await pauseMs(80);
          advance({
            phase: 'layout',
            pageIndex: pdfPageIndex,
            pageTotal,
            pageLabel
          });
          const orientation = jobPage.pageSpec.orientation;
          const page = pdf.addPage(pageSizePt(orientation));
          await this.drawMapPage(page, {
            mapPng: png,
            orientation,
            metadata: {
              ...params.metadata,
              pageLabel: `Page ${jobPage.pageSpec.pageIndex + 1}/${jobPage.pageSpec.totalPages}`,
              branchLabel: branchLabelFor(ctx, jobPage.focusLegIndex)
            },
            options: params.options,
            pageSpec: jobPage.pageSpec,
            font,
            fontBold
          });
        } else if (jobPage.kind === 'profilesCombined') {
          const combinedLabel = combinedProfilesPageLabel(jobPage.legIndices.length);
          const profileRows: {
            legIndex: number;
            svg: string;
            branchLabel: string;
          }[] = [];

          for (const legIndex of jobPage.legIndices) {
            const leg = params.legRenders.find(l => l.index === legIndex);
            const branchLabel = leg
              ? sanitizePdfText(`${leg.fromWaypoint.name} - ${leg.toWaypoint.name}`)
              : `Branche ${legIndex + 1}`;
            advance({
              phase: 'profile',
              pageIndex: pdfPageIndex,
              pageTotal,
              pageLabel: branchLabel,
              profileSubPhase: 'prepare'
            });
            const svg = await params.renderProfileSvg(
              legIndex,
              'profilesCombined',
              {
                combinedProfileCount: jobPage.legIndices.length,
                pageOrientation: 'landscape'
              },
              sub => {
                emit({
                  phase: 'profile',
                  pageIndex: pdfPageIndex,
                  pageTotal,
                  pageLabel: branchLabel,
                  profileSubPhase: sub
                });
              }
            );
            if (svg) {
              profileRows.push({ legIndex, svg, branchLabel });
            }
          }

          advance({
            phase: 'layout',
            pageIndex: pdfPageIndex,
            pageTotal,
            pageLabel: combinedLabel
          });
          const page = pdf.addPage(pageSizePt('landscape'));
          await this.drawProfilesCombinedPage(page, {
            profiles: profileRows,
            metadata: {
              ...params.metadata,
              pageLabel: combinedLabel,
              branchLabel: undefined
            },
            options: params.options,
            font,
            fontBold
          });
        } else {
          let mapPng: string | null = null;
          const profileOnly = jobPage.mapPageSpec == null;
          let orientation: PrintPageOrientation = profileOnly
            ? 'landscape'
            : 'portrait';
          const profileLayout: ProfileChartPrintLayout = profileOnly
            ? 'profileOnly'
            : 'withMap';
          const leg = params.legRenders.find(l => l.index === jobPage.legIndex);
          const branchLabel = leg
            ? sanitizePdfText(`${leg.fromWaypoint.name} - ${leg.toWaypoint.name}`)
            : pageLabel;

          if (jobPage.mapPageSpec) {
            advance({
              phase: 'map',
              pageIndex: pdfPageIndex,
              pageTotal,
              pageLabel: branchLabel
            });
            ctx.focusLegIndex = jobPage.legIndex;
            mapPng = await this.mapRenderer.renderPage(jobPage.mapPageSpec, ctx);
            await pauseMs(80);
            orientation = jobPage.mapPageSpec.orientation;
          }

          advance({
            phase: 'profile',
            pageIndex: pdfPageIndex,
            pageTotal,
            pageLabel: branchLabel,
            profileSubPhase: 'prepare'
          });
          const profileSvg = await params.renderProfileSvg(
            jobPage.legIndex,
            profileLayout,
            {
              pageOrientation: profileOnly
                ? 'landscape'
                : (jobPage.mapPageSpec?.orientation ?? 'portrait')
            },
            sub => {
              emit({
                phase: 'profile',
                pageIndex: pdfPageIndex,
                pageTotal,
                pageLabel: branchLabel,
                profileSubPhase: sub
              });
            }
          );
          advance({
            phase: 'layout',
            pageIndex: pdfPageIndex,
            pageTotal,
            pageLabel: branchLabel
          });
          const page = pdf.addPage(pageSizePt(orientation));
          await this.drawProfilePage(page, {
            mapPng,
            profileSvg,
            orientation,
            profileLayout,
            metadata: {
              ...params.metadata,
              branchLabel
            },
            options: params.options,
            pageSpec: jobPage.mapPageSpec,
            font,
            fontBold
          });
        }
      }
    } finally {
      this.mapRenderer.dispose();
    }

    if (summaryPageCount > 0) {
      pdfPageIndex += summaryPageCount;
      advance({
        phase: 'layout',
        pageIndex: pdfPageIndex,
        pageTotal,
        pageLabel: summaryLabels.documentTitle
      });
      appendAirspaceSummaryPages(pdf, {
        sections: summarySections,
        metadata: params.metadata,
        includeMetadata: params.options.includeMetadata,
        labels: summaryLabels,
        font,
        fontBold
      });
    }

    advance({ phase: 'save' });
    const bytes = await pdf.save();
    const safeName = params.metadata.taskName.replace(/[^\w\-]+/g, '_').slice(0, 48);
    return {
      bytes,
      filename: `${safeName || 'circuit'}_profil_securite.pdf`
    };
  }

  private async drawMapPage(
    page: PDFPage,
    params: {
      mapPng: string;
      orientation: PrintPageOrientation;
      metadata: SafetyPrintMetadata;
      options: SafetyPrintOptions;
      pageSpec: { groundWidthM: number };
      font: Awaited<ReturnType<PDFDocument['embedFont']>>;
      fontBold: Awaited<ReturnType<PDFDocument['embedFont']>>;
    }
  ): Promise<void> {
    const { width, height } = page.getSize();
    const margin = PRINT_MARGIN_MM * MM_TO_PT;
    const headerBottom = this.drawPageHeaderIfNeeded(page, {
      width,
      height,
      margin,
      metadata: params.metadata,
      options: params.options,
      font: params.font,
      fontBold: params.fontBold
    });

    const gap = 4 * MM_TO_PT;
    const mapW = width - 2 * margin;
    const mapBottom = margin;
    const mapTop = headerBottom - gap;
    const mapH = Math.max(0, mapTop - mapBottom);

    await this.drawPngInBox(page, params.mapPng, {
      x: margin,
      y: mapBottom,
      width: mapW,
      height: mapH,
      fit: 'fill'
    });

    this.drawScaleBar(page, {
      x: margin + mapW - 80 * MM_TO_PT,
      y: mapBottom + 6 * MM_TO_PT,
      groundWidthM: params.pageSpec.groundWidthM
    });
  }

  private async drawProfilePage(
    page: PDFPage,
    params: {
      mapPng: string | null;
      profileSvg: string | null;
      orientation: PrintPageOrientation;
      profileLayout: ProfileChartPrintLayout;
      metadata: SafetyPrintMetadata;
      options: SafetyPrintOptions;
      pageSpec: { groundWidthM: number } | null;
      font: Awaited<ReturnType<PDFDocument['embedFont']>>;
      fontBold: Awaited<ReturnType<PDFDocument['embedFont']>>;
    }
  ): Promise<void> {
    const { width, height } = page.getSize();
    const margin = PRINT_MARGIN_MM * MM_TO_PT;
    const headerBottom = this.drawPageHeaderIfNeeded(page, {
      width,
      height,
      margin,
      metadata: params.metadata,
      options: params.options,
      font: params.font,
      fontBold: params.fontBold
    });

    const bottom = margin;
    const gap = 4 * MM_TO_PT;
    const contentTop = headerBottom - gap;
    const innerW = width - 2 * margin;
    const innerH = contentTop - gap - bottom;

    const hasMap = params.mapPng != null;
    const hasProfile = params.profileSvg != null;
    const profileOnly =
      params.profileLayout === 'profileOnly' && hasProfile && !hasMap;
    const chartFrac =
      clampProfileChartHeightPercent(params.options.profileChartHeightPercent) / 100;

    const chartH = hasProfile
      ? profileOnly
        ? innerH
        : innerH * chartFrac
      : 0;
    const mapH =
      hasMap && hasProfile
        ? Math.max(0, innerH - chartH - gap)
        : hasMap
          ? innerH
          : 0;

    const chartY = bottom;
    const mapY = bottom + chartH + (hasProfile && hasMap ? gap : 0);

    if (hasProfile && params.profileSvg) {
      await drawProfileSvgInBox(page, params.profileSvg, {
        x: margin,
        y: chartY,
        width: innerW,
        height: chartH
      });
    }

    if (hasMap && params.mapPng) {
      await this.drawPngInBox(page, params.mapPng, {
        x: margin,
        y: mapY,
        width: innerW,
        height: mapH,
        fit: 'fill'
      });
      if (params.pageSpec) {
        this.drawScaleBar(page, {
          x: margin + innerW - 80 * MM_TO_PT,
          y: mapY + 4 * MM_TO_PT,
          groundWidthM: params.pageSpec.groundWidthM
        });
      }
    }
  }

  /** Empile toutes les coupes sur une page paysage (une rangée par branche). */
  private async drawProfilesCombinedPage(
    page: PDFPage,
    params: {
      profiles: { legIndex: number; svg: string; branchLabel: string }[];
      metadata: SafetyPrintMetadata;
      options: SafetyPrintOptions;
      font: Awaited<ReturnType<PDFDocument['embedFont']>>;
      fontBold: Awaited<ReturnType<PDFDocument['embedFont']>>;
    }
  ): Promise<void> {
    const { width, height } = page.getSize();
    const margin = PRINT_MARGIN_MM * MM_TO_PT;
    const headerBottom = this.drawPageHeaderIfNeeded(page, {
      width,
      height,
      margin,
      metadata: params.metadata,
      options: params.options,
      font: params.font,
      fontBold: params.fontBold
    });

    const gap = PROFILE_COMBINED_GAP_MM * MM_TO_PT;
    const labelH = PROFILE_COMBINED_LABEL_MM * MM_TO_PT;
    const contentTop = headerBottom - 4 * MM_TO_PT;
    const bottom = margin;
    const innerW = width - 2 * margin;
    const innerH = Math.max(0, contentTop - bottom);
    const n = params.profiles.length;
    if (n === 0) return;

    const slotH = Math.max(0, (innerH - n * labelH - Math.max(0, n - 1) * gap) / n);
    let yTop = contentTop;

    for (const row of params.profiles) {
      yTop -= labelH;
      page.drawText(row.branchLabel, {
        x: margin,
        y: yTop + 2,
        size: 8,
        font: params.fontBold,
        color: rgb(0.15, 0.15, 0.15)
      });
      yTop -= slotH;
      await drawProfileSvgInBox(page, row.svg, {
        x: margin,
        y: yTop,
        width: innerW,
        height: slotH
      });
      yTop -= gap;
    }
  }

  private async drawPngInBox(
    page: PDFPage,
    dataUrl: string,
    box: {
      x: number;
      y: number;
      width: number;
      height: number;
      fit: 'fill' | 'contain';
      background?: string;
    }
  ): Promise<void> {
    const pngBytes = dataUrlToBytes(dataUrl);
    const img = await page.doc.embedPng(pngBytes);
    if (box.width <= 0 || box.height <= 0) return;

    if (box.background) {
      page.drawRectangle({
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        color: rgb(1, 1, 1),
        borderWidth: 0
      });
    }

    if (box.fit === 'fill') {
      page.drawImage(img, {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height
      });
      return;
    }

    const scale = Math.min(box.width / img.width, box.height / img.height);
    const drawW = img.width * scale;
    const drawH = img.height * scale;
    page.drawImage(img, {
      x: box.x + (box.width - drawW) / 2,
      y: box.y + (box.height - drawH) / 2,
      width: drawW,
      height: drawH
    });
  }

  private drawMetadataBlock(
    page: PDFPage,
    meta: SafetyPrintMetadata,
    options: SafetyPrintOptions,
    font: Awaited<ReturnType<PDFDocument['embedFont']>>,
    fontBold: Awaited<ReturnType<PDFDocument['embedFont']>>,
    box: { x: number; y: number; width: number; height: number }
  ): number {
    const lines: string[] = [
      sanitizePdfText(meta.taskName),
      ...(meta.branchLabel ? [sanitizePdfText(meta.branchLabel)] : []),
      sanitizePdfText(
        `1:${formatPdfInteger(PRINT_SCALE_DENOMINATOR)} - ${meta.dateLabel}`
      ),
      sanitizePdfText(
        `L/D ${meta.glideRatio} - Sol +${meta.groundMarginM} m - Arrivée +${meta.arrivalMarginM} m`
      ),
      ...(meta.pageLabel ? [sanitizePdfText(meta.pageLabel)] : []),
      ...(options.airspace2d
        ? [
            sanitizePdfText(
              'Espace aérien 2D : POAFF (non certifié pour navigation)'
            )
          ]
        : [])
    ];

    page.drawRectangle({
      x: box.x,
      y: box.y - box.height,
      width: box.width,
      height: box.height + 2,
      color: rgb(1, 1, 1),
      borderWidth: 0
    });

    let y = box.y - 2;
    page.drawText(lines[0], {
      x: box.x,
      y: y - 11,
      size: 11,
      font: fontBold,
      color: rgb(0.1, 0.1, 0.1)
    });
    y -= 14;
    for (let i = 1; i < lines.length; i++) {
      page.drawText(lines[i], {
        x: box.x,
        y: y - 9,
        size: 8,
        font,
        color: rgb(0.25, 0.25, 0.25)
      });
      y -= 11;
    }

    this.drawNorthArrow(page, box.x + box.width - 28, box.y - 8);
    return y - 6;
  }

  /** Y (baseline PDF) sous lequel le contenu carte / coupe peut commencer. */
  private drawPageHeaderIfNeeded(
    page: PDFPage,
    params: {
      width: number;
      height: number;
      margin: number;
      metadata: SafetyPrintMetadata;
      options: SafetyPrintOptions;
      font: Awaited<ReturnType<PDFDocument['embedFont']>>;
      fontBold: Awaited<ReturnType<PDFDocument['embedFont']>>;
    }
  ): number {
    if (!params.options.includeMetadata) {
      return params.height - params.margin;
    }
    const headerH = PRINT_HEADER_MM * MM_TO_PT;
    return this.drawMetadataBlock(
      page,
      params.metadata,
      params.options,
      params.font,
      params.fontBold,
      {
        x: params.margin,
        y: params.height - params.margin,
        width: params.width - 2 * params.margin,
        height: headerH
      }
    );
  }

  private airspaceSummaryLabels(): AirspaceSummaryPdfLabels {
    return {
      documentTitle: this.i18n.t('safetyProfile.print.airspaceSummaryTitle'),
      bidirectionalNote: this.i18n.t(
        'safetyProfile.print.airspaceSummaryBidirectional'
      ),
      noZonesInSection: this.i18n.t(
        'safetyProfile.print.airspaceSummaryNoZones'
      )
    };
  }

  private drawNorthArrow(page: PDFPage, x: number, y: number): void {
    const s = 10;
    page.drawLine({
      start: { x, y: y - s },
      end: { x, y: y + s },
      thickness: 1.2,
      color: rgb(0.15, 0.15, 0.15)
    });
    page.drawLine({
      start: { x: x - 4, y: y + s - 4 },
      end: { x, y: y + s },
      thickness: 1.2,
      color: rgb(0.15, 0.15, 0.15)
    });
    page.drawLine({
      start: { x: x + 4, y: y + s - 4 },
      end: { x, y: y + s },
      thickness: 1.2,
      color: rgb(0.15, 0.15, 0.15)
    });
    page.drawText('N', {
      x: x - 4,
      y: y + s + 2,
      size: 8,
      color: rgb(0.15, 0.15, 0.15)
    });
  }

  private drawScaleBar(
    page: PDFPage,
    params: { x: number; y: number; groundWidthM: number }
  ): void {
    const barM = pickScaleBarMeters(params.groundWidthM);
    const barMm = scaleBarWidthMm(barM);
    const barPt = barMm * MM_TO_PT;
    const y = params.y;
    const x0 = params.x;
    page.drawLine({
      start: { x: x0, y },
      end: { x: x0 + barPt, y },
      thickness: 2,
      color: rgb(0.1, 0.1, 0.1)
    });
    page.drawLine({
      start: { x: x0, y: y - 3 },
      end: { x: x0, y: y + 3 },
      thickness: 1.5,
      color: rgb(0.1, 0.1, 0.1)
    });
    page.drawLine({
      start: { x: x0 + barPt, y: y - 3 },
      end: { x: x0 + barPt, y: y + 3 },
      thickness: 1.5,
      color: rgb(0.1, 0.1, 0.1)
    });
    const label = sanitizePdfText(
      barM >= 1000 ? `${barM / 1000} km` : `${barM} m`
    );
    page.drawText(label, {
      x: x0,
      y: y + 5,
      size: 7,
      color: rgb(0.15, 0.15, 0.15)
    });
  }
}

function pageSizePt(orientation: PrintPageOrientation): [number, number] {
  if (orientation === 'landscape') {
    return [A4_PORTRAIT_PT.h, A4_PORTRAIT_PT.w];
  }
  return [A4_PORTRAIT_PT.w, A4_PORTRAIT_PT.h];
}

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] ?? '';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function pageLabel(
  page: PrintJobPage,
  legs: SafetyLegRender[],
  index: number
): string {
  return pageLabelForJob(page, legs, index);
}

function combinedProfilesPageLabel(legCount: number): string {
  return sanitizePdfText(
    legCount <= 1 ? 'Coupe profil' : `Coupes profil (${legCount} branches)`
  );
}

function pageLabelForJob(
  page: PrintJobPage,
  legs: SafetyLegRender[],
  index: number
): string {
  if (page.kind === 'profilesCombined') {
    return combinedProfilesPageLabel(page.legIndices.length);
  }
  if (page.kind === 'map') {
    return `Carte ${page.pageSpec.pageIndex + 1}/${page.pageSpec.totalPages}`;
  }
  const leg = legs.find(l => l.index === page.legIndex);
  const name = leg
    ? `${leg.fromWaypoint.name} → ${leg.toWaypoint.name}`
    : `Branche ${page.legIndex + 1}`;
  if (!page.mapPageSpec) {
    return `${name} (coupe)`;
  }
  const mapPart =
    page.mapPageSpec.totalPages > 1
      ? `carte ${page.mapPageSpec.pageIndex + 1}/${page.mapPageSpec.totalPages} + coupe`
      : 'carte + coupe';
  return `${name} (${mapPart})`;
}

function branchLabelFor(ctx: PrintMapRenderContext, legIndex: number | null): string | undefined {
  if (legIndex == null) return undefined;
  const leg = ctx.legRenders.find(l => l.index === legIndex);
  return leg
    ? sanitizePdfText(`${leg.fromWaypoint.name} - ${leg.toWaypoint.name}`)
    : undefined;
}

function pauseMs(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
