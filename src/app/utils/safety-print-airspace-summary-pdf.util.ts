import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { LegAirspaceZoneCatalogEntry } from '../models/leg-airspace-zone.model';
import type { SafetyPrintMetadata } from '../models/safety-print-options.model';
import {
  formatAirspaceVerticalRange,
  formatAirspaceVerticalRangeForPdf
} from './airspace-altitude.util';
import type { AirspacePrintSummarySection } from './leg-airspace-print-summary.util';
import { formatPdfInteger, sanitizePdfText, wrapPdfTextLines } from './print-pdf-text.util';
import { PRINT_HEADER_MM, PRINT_MARGIN_MM, PRINT_SCALE_DENOMINATOR } from './print-scale.util';

const MM_TO_PT = 2.834645669;
const A4_PORTRAIT_PT = { w: 595.28, h: 841.89 };

const BODY_SIZE = 8;
const ZONE_NAME_SIZE = 9;
const SECTION_TITLE_SIZE = 11;
const LINE_LEADING = 11;
const SECTION_GAP = 14;
const ZONE_GAP = 10;

export interface AirspaceSummaryPdfLabels {
  documentTitle: string;
  bidirectionalNote: string;
  noZonesInSection: string;
}

type SummaryBlock =
  | {
      kind: 'section';
      title: string;
      subtitle?: string;
      height: number;
    }
  | {
      kind: 'zone';
      zone: LegAirspaceZoneCatalogEntry;
      lines: string[];
      height: number;
    }
  | {
      kind: 'empty';
      text: string;
      height: number;
    };

export function countAirspaceSummaryPages(
  sections: AirspacePrintSummarySection[],
  labels: AirspaceSummaryPdfLabels
): number {
  if (sections.length === 0) return 0;
  return paginateSummaryBlocks(buildSummaryBlocks(sections, labels)).length;
}

export function appendAirspaceSummaryPages(
  pdf: PDFDocument,
  params: {
    sections: AirspacePrintSummarySection[];
    metadata: SafetyPrintMetadata;
    includeMetadata: boolean;
    labels: AirspaceSummaryPdfLabels;
    font: PDFFont;
    fontBold: PDFFont;
  }
): number {
  if (params.sections.length === 0) return 0;

  const pages = paginateSummaryBlocks(
    buildSummaryBlocks(params.sections, params.labels)
  );
  const contentWidth =
    A4_PORTRAIT_PT.w - 2 * PRINT_MARGIN_MM * MM_TO_PT;

  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const page = pdf.addPage([A4_PORTRAIT_PT.w, A4_PORTRAIT_PT.h]);
    const margin = PRINT_MARGIN_MM * MM_TO_PT;
    const { height } = page.getSize();
    let cursorY = drawSummaryPageHeader(page, {
      margin,
      height,
      contentWidth,
      metadata: {
        ...params.metadata,
        pageLabel:
          pages.length > 1
            ? `${params.labels.documentTitle} (${pageIndex + 1}/${pages.length})`
            : params.labels.documentTitle
      },
      includeMetadata: params.includeMetadata,
      font: params.font,
      fontBold: params.fontBold
    });

    for (const block of pages[pageIndex]) {
      cursorY = drawSummaryBlock(page, block, {
        x: margin,
        cursorY,
        contentWidth,
        font: params.font,
        fontBold: params.fontBold
      });
    }
  }

  return pages.length;
}

function buildSummaryBlocks(
  sections: AirspacePrintSummarySection[],
  labels: AirspaceSummaryPdfLabels
): SummaryBlock[] {
  const blocks: SummaryBlock[] = [];

  for (const section of sections) {
    const subtitle = section.bidirectional ? labels.bidirectionalNote : undefined;
    blocks.push({
      kind: 'section',
      title: section.title,
      subtitle,
      height: LINE_LEADING * (subtitle ? 2.2 : 1.4) + SECTION_GAP
    });

    if (section.zones.length === 0) {
      blocks.push({
        kind: 'empty',
        text: labels.noZonesInSection,
        height: LINE_LEADING + ZONE_GAP
      });
      continue;
    }

    for (const zone of section.zones) {
      blocks.push({
        kind: 'zone',
        zone,
        lines: buildZoneTextLines(zone, A4_PORTRAIT_PT.w - 2 * PRINT_MARGIN_MM * MM_TO_PT),
        height: estimateZoneBlockHeight(zone, A4_PORTRAIT_PT.w - 2 * PRINT_MARGIN_MM * MM_TO_PT)
      });
    }
  }

  return blocks;
}

function buildZoneTextLines(
  zone: LegAirspaceZoneCatalogEntry,
  contentWidth: number
): string[] {
  const measure = (line: string) => line.length * 4.2;
  const lines: string[] = [];
  const meta = [zone.class, zone.type].filter(Boolean).join(' - ');
  const vertical = formatAirspaceVerticalRangeForPdf(
    zone.lower,
    zone.upper
  );
  if (meta || vertical) {
    lines.push(sanitizePdfText([meta, vertical].filter(Boolean).join(' — ')));
  }
  for (const radio of zone.radioLines ?? []) {
    lines.push(sanitizePdfText(radio));
  }
  if (zone.activation) {
    lines.push(sanitizePdfText(zone.activation));
  }
  if (zone.desc) {
    lines.push(
      ...wrapPdfTextLines(zone.desc, contentWidth - 8, measure)
    );
  }
  return lines;
}

function estimateZoneBlockHeight(
  zone: LegAirspaceZoneCatalogEntry,
  contentWidth: number
): number {
  const bodyLines = buildZoneTextLines(zone, contentWidth).length;
  return ZONE_NAME_SIZE + 4 + bodyLines * (LINE_LEADING - 1) + ZONE_GAP;
}

function paginateSummaryBlocks(blocks: SummaryBlock[]): SummaryBlock[][] {
  const margin = PRINT_MARGIN_MM * MM_TO_PT;
  const headerReserve = PRINT_HEADER_MM * MM_TO_PT + 24;
  const pageHeight = A4_PORTRAIT_PT.h - margin - headerReserve - margin;
  const pages: SummaryBlock[][] = [];
  let current: SummaryBlock[] = [];
  let used = 0;

  for (const block of blocks) {
    if (used + block.height > pageHeight && current.length > 0) {
      pages.push(current);
      current = [];
      used = 0;
    }
    current.push(block);
    used += block.height;
  }
  if (current.length > 0) pages.push(current);
  return pages;
}

function drawSummaryPageHeader(
  page: PDFPage,
  params: {
    margin: number;
    height: number;
    contentWidth: number;
    metadata: SafetyPrintMetadata;
    includeMetadata: boolean;
    font: PDFFont;
    fontBold: PDFFont;
  }
): number {
  if (!params.includeMetadata) {
    page.drawText(sanitizePdfText(params.metadata.pageLabel ?? ''), {
      x: params.margin,
      y: params.height - params.margin - SECTION_TITLE_SIZE,
      size: SECTION_TITLE_SIZE,
      font: params.fontBold,
      color: rgb(0.1, 0.1, 0.1)
    });
    return params.height - params.margin - SECTION_TITLE_SIZE - 8;
  }

  const lines: string[] = [
    sanitizePdfText(params.metadata.taskName),
    sanitizePdfText(params.metadata.pageLabel ?? ''),
    sanitizePdfText(
      `1:${formatPdfInteger(PRINT_SCALE_DENOMINATOR)} - ${params.metadata.dateLabel}`
    ),
    sanitizePdfText(
      `L/D ${params.metadata.glideRatio} - Sol +${params.metadata.groundMarginM} m - Arrivée +${params.metadata.arrivalMarginM} m`
    )
  ];

  let y = params.height - params.margin;
  page.drawText(lines[0], {
    x: params.margin,
    y: y - 11,
    size: 11,
    font: params.fontBold,
    color: rgb(0.1, 0.1, 0.1)
  });
  y -= 14;
  for (let i = 1; i < lines.length; i++) {
    page.drawText(lines[i], {
      x: params.margin,
      y: y - 8,
      size: 8,
      font: params.font,
      color: rgb(0.25, 0.25, 0.25)
    });
    y -= 10;
  }
  return y - 8;
}

function drawSummaryBlock(
  page: PDFPage,
  block: SummaryBlock,
  params: {
    x: number;
    cursorY: number;
    contentWidth: number;
    font: PDFFont;
    fontBold: PDFFont;
  }
): number {
  let y = params.cursorY;

  if (block.kind === 'section') {
    page.drawText(sanitizePdfText(block.title), {
      x: params.x,
      y: y - SECTION_TITLE_SIZE,
      size: SECTION_TITLE_SIZE,
      font: params.fontBold,
      color: rgb(0.12, 0.12, 0.12)
    });
    y -= SECTION_TITLE_SIZE + 4;
    if (block.subtitle) {
      page.drawText(sanitizePdfText(block.subtitle), {
        x: params.x,
        y: y - BODY_SIZE,
        size: BODY_SIZE,
        font: params.font,
        color: rgb(0.35, 0.35, 0.35)
      });
      y -= LINE_LEADING;
    }
    return y - SECTION_GAP;
  }

  if (block.kind === 'empty') {
    page.drawText(sanitizePdfText(block.text), {
      x: params.x + 6,
      y: y - BODY_SIZE,
      size: BODY_SIZE,
      font: params.font,
      color: rgb(0.4, 0.4, 0.4)
    });
    return y - LINE_LEADING - ZONE_GAP;
  }

  page.drawText(sanitizePdfText(block.zone.name), {
    x: params.x + 4,
    y: y - ZONE_NAME_SIZE,
    size: ZONE_NAME_SIZE,
    font: params.fontBold,
    color: rgb(0.1, 0.1, 0.1)
  });
  y -= ZONE_NAME_SIZE + 3;

  for (const line of block.lines) {
    page.drawText(line, {
      x: params.x + 8,
      y: y - BODY_SIZE,
      size: BODY_SIZE,
      font: params.font,
      color: rgb(0.2, 0.2, 0.2)
    });
    y -= LINE_LEADING - 1;
  }

  return y - ZONE_GAP;
}
