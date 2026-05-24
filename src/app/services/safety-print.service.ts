import { Injectable, inject } from '@angular/core';
import { PDFDocument, rgb, StandardFonts, type PDFPage } from 'pdf-lib';
import type { SafetyPrintOptions, SafetyPrintMetadata, SafetyPrintProgress } from '../models/safety-print-options.model';
import type { SafetyLegRender } from './safety-profile-terrain.facade';
import type { Waypoint } from '../models/waypoint.model';
import type { CircuitLeg } from '../models/circuit.model';
import {
  SafetyPrintMapRendererService,
  type PrintMapRenderContext
} from './safety-print-map-renderer.service';
import { buildPrintJobPages, type PrintJobPage } from '../utils/safety-print-layout.util';
import { formatPdfInteger, sanitizePdfText } from '../utils/print-pdf-text.util';
import {
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
    renderProfilePng: (legIndex: number) => Promise<string | null>;
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

    let step = 0;
    const total = jobPages.length;

    try {
      for (const jobPage of jobPages) {
        step++;
        params.onProgress?.({
          phase: 'map',
          current: step,
          total
        });

        if (jobPage.kind === 'map') {
          ctx.focusLegIndex = jobPage.focusLegIndex;
          const png = await this.mapRenderer.renderPage(jobPage.pageSpec, ctx);
          await pauseMs(80);
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
          if (jobPage.mapPageSpec) {
            ctx.focusLegIndex = jobPage.legIndex;
            mapPng = await this.mapRenderer.renderPage(jobPage.mapPageSpec, ctx);
            await pauseMs(80);
            orientation = jobPage.mapPageSpec.orientation;
          }
          const profilePng = await params.renderProfilePng(jobPage.legIndex);
          const leg = params.legRenders.find(l => l.index === jobPage.legIndex);
          const page = pdf.addPage(pageSizePt(orientation));
          await this.drawProfilePage(page, {
            mapPng,
            profilePng,
            orientation,
            metadata: {
              ...params.metadata,
              branchLabel: leg
                ? sanitizePdfText(`${leg.fromWaypoint.name} - ${leg.toWaypoint.name}`)
                : undefined
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
    const innerH = contentTop - margin * 0.25 - bottom;
    const innerW = width - 2 * margin;

    const gap = margin * 0.35;
    const chartH = params.profilePng ? innerH * 0.38 : 0;
    const mapH = params.mapPng ? (params.profilePng ? innerH * 0.55 : innerH) : 0;

    if (params.profilePng) {
      const pngBytes = dataUrlToBytes(params.profilePng);
      const img = await page.doc.embedPng(pngBytes);
      page.drawImage(img, {
        x: margin,
        y: bottom,
        width: innerW,
        height: chartH
      });
    }

    if (params.mapPng) {
      const mapY = bottom + chartH + (params.profilePng ? gap : 0);
      const pngBytes = dataUrlToBytes(params.mapPng);
      const img = await page.doc.embedPng(pngBytes);
      page.drawImage(img, {
        x: margin,
        y: mapY,
        width: innerW,
        height: mapH
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
  if (page.kind === 'map') {
    return `Carte ${page.pageSpec.pageIndex + 1}/${page.pageSpec.totalPages}`;
  }
  const leg = legs.find(l => l.index === page.legIndex);
  const name = leg ? `${leg.fromWaypoint.name} → ${leg.toWaypoint.name}` : `Branche ${page.legIndex + 1}`;
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
