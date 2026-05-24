import { Injectable, inject } from '@angular/core';
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
import {
  clampProfileChartHeightPercent,
  pickScaleBarMeters,
  PRINT_MARGIN_MM,
  PRINT_HEADER_MM,
  PRINT_SCALE_DENOMINATOR,
  scaleBarWidthMm,
  type PrintPageOrientation
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

  buildPreviewSummary(
    options: SafetyPrintOptions,
    legRenders: SafetyLegRender[],
    legPairs: { from: Waypoint; to: Waypoint }[],
    getWaypoint: (id: string) => Waypoint | undefined
  ): SafetyPrintPreviewSummary {
    const jobPages = buildPrintJobPages({
      layoutMode: options.layoutMode,
      legRenders,
      legPairs,
      includeHeader: options.includeMetadata,
      includeProfileChart:
        options.layoutMode === 'perBranch' && options.includeProfileChart,
      cones3d: options.coneVolumes3d,
      getWaypoint
    });
    return {
      pageCount: jobPages.length,
      pages: jobPages.map((p, i) => ({
        label: pageLabel(p, legRenders, i),
        orientation:
          p.kind === 'map'
            ? p.pageSpec.orientation
            : p.mapPageSpec?.orientation ?? 'portrait'
      }))
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
    renderProfilePng: (
      legIndex: number,
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
      cones3d: params.options.coneVolumes3d,
      getWaypoint: params.getWaypoint
    });

    const stepTotal = countPrintWorkSteps(jobPages);
    const pageTotal = jobPages.length;
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
        } else {
          let mapPng: string | null = null;
          let orientation: PrintPageOrientation = 'portrait';
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
          const profilePng = await params.renderProfilePng(
            jobPage.legIndex,
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
            profilePng,
            orientation,
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
    const headerH = params.options.includeMetadata ? PRINT_HEADER_MM * MM_TO_PT : 0;
    const margin = PRINT_MARGIN_MM * MM_TO_PT;
    let y = height - margin;

    if (params.options.includeMetadata) {
      y = this.drawMetadataBlock(page, params.metadata, params.options, params.font, params.fontBold, {
        x: margin,
        y: height - margin,
        width: width - 2 * margin,
        height: headerH
      });
    }

    const mapTop = y - margin * 0.25;
    const mapBottom = margin;
    const mapH = mapTop - mapBottom;
    const mapW = width - 2 * margin;

    const pngBytes = dataUrlToBytes(params.mapPng);
    const img = await page.doc.embedPng(pngBytes);
    page.drawImage(img, {
      x: margin,
      y: mapBottom,
      width: mapW,
      height: mapH
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
      profilePng: string | null;
      orientation: PrintPageOrientation;
      metadata: SafetyPrintMetadata;
      options: SafetyPrintOptions;
      pageSpec: { groundWidthM: number } | null;
      font: Awaited<ReturnType<PDFDocument['embedFont']>>;
      fontBold: Awaited<ReturnType<PDFDocument['embedFont']>>;
    }
  ): Promise<void> {
    const { width, height } = page.getSize();
    const headerH = params.options.includeMetadata ? PRINT_HEADER_MM * MM_TO_PT : 0;
    const margin = PRINT_MARGIN_MM * MM_TO_PT;
    let contentTop = height - margin;

    if (params.options.includeMetadata) {
      contentTop = this.drawMetadataBlock(
        page,
        params.metadata,
        params.options,
        params.font,
        params.fontBold,
        {
          x: margin,
          y: height - margin,
          width: width - 2 * margin,
          height: headerH
        }
      );
    }

    const bottom = margin;
    const gap = 3 * MM_TO_PT;
    const innerW = width - 2 * margin;
    const innerH = contentTop - gap - bottom;

    const hasMap = params.mapPng != null;
    const hasProfile = params.profilePng != null;
    const chartFrac =
      clampProfileChartHeightPercent(params.options.profileChartHeightPercent) / 100;

    let chartH = 0;
    let mapH = 0;
    if (hasProfile && hasMap) {
      chartH = innerH * chartFrac;
      mapH = Math.max(0, innerH - chartH - gap);
    } else if (hasProfile) {
      chartH = innerH * chartFrac;
    } else if (hasMap) {
      mapH = innerH;
    }

    let yCursor = contentTop - gap;

    if (hasMap && params.mapPng) {
      yCursor -= mapH;
      await this.drawPngInBox(page, params.mapPng, {
        x: margin,
        y: yCursor,
        width: innerW,
        height: mapH,
        fit: 'fill'
      });
      if (params.pageSpec) {
        this.drawScaleBar(page, {
          x: margin + innerW - 80 * MM_TO_PT,
          y: yCursor + 4 * MM_TO_PT,
          groundWidthM: params.pageSpec.groundWidthM
        });
      }
      yCursor -= gap;
    }

    if (hasProfile && params.profilePng) {
      yCursor -= chartH;
      await this.drawPngInBox(page, params.profilePng, {
        x: margin,
        y: yCursor,
        width: innerW,
        height: chartH,
        fit: 'contain'
      });
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
    }
  ): Promise<void> {
    const pngBytes = dataUrlToBytes(dataUrl);
    const img = await page.doc.embedPng(pngBytes);
    if (box.fit === 'fill' || box.width <= 0 || box.height <= 0) {
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
      ...(options.airspace3d
        ? [sanitizePdfText('Espace aérien : POAFF (non certifié pour navigation)')]
        : [])
    ];

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
    return box.y - box.height;
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

function pageLabelForJob(
  page: PrintJobPage,
  legs: SafetyLegRender[],
  index: number
): string {
  if (page.kind === 'map') {
    return `Carte ${page.pageSpec.pageIndex + 1}/${page.pageSpec.totalPages}`;
  }
  const leg = legs.find(l => l.index === page.legIndex);
  const name = leg
    ? `${leg.fromWaypoint.name} → ${leg.toWaypoint.name}`
    : `Branche ${page.legIndex + 1}`;
  return page.mapPageSpec ? `${name} (carte + coupe)` : `${name} (coupe)`;
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
