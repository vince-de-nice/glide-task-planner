import { jsPDF } from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';
import { PDFDocument, type PDFPage } from 'pdf-lib';

/** Parse une chaîne SVG exportée (DOMParser). */
export function parseSvgMarkup(svgMarkup: string): SVGSVGElement {
  const doc = new DOMParser().parseFromString(svgMarkup, 'image/svg+xml');
  const root = doc.documentElement;
  if (!(root instanceof SVGSVGElement)) {
    const err = doc.querySelector('parsererror');
    throw new Error(err?.textContent ?? 'Invalid profile chart SVG');
  }
  return root;
}

/**
 * Convertit le SVG de coupe en page PDF vectorielle (jsPDF + svg2pdf),
 * puis l’incruste dans une page pdf-lib (plein cadre).
 */
export async function drawProfileSvgInBox(
  page: PDFPage,
  svgMarkup: string,
  box: { x: number; y: number; width: number; height: number }
): Promise<void> {
  if (box.width <= 0 || box.height <= 0) return;

  const svgEl = parseSvgMarkup(svgMarkup);
  const viewBox = svgEl.viewBox.baseVal;
  const vbW = viewBox.width > 0 ? viewBox.width : box.width;
  const vbH = viewBox.height > 0 ? viewBox.height : box.height;
  svgEl.setAttribute('width', String(vbW));
  svgEl.setAttribute('height', String(vbH));
  svgEl.setAttribute('viewBox', `0 0 ${vbW} ${vbH}`);
  svgEl.setAttribute('preserveAspectRatio', 'none');

  const doc = new jsPDF({
    orientation: box.width >= box.height ? 'landscape' : 'portrait',
    unit: 'pt',
    format: [box.width, box.height],
    compress: true,
    putOnlyUsedFonts: true
  });

  await svg2pdf(svgEl, doc, {
    x: 0,
    y: 0,
    width: box.width,
    height: box.height
  });

  const bytes = doc.output('arraybuffer') as ArrayBuffer;
  const svgPdf = await PDFDocument.load(bytes);
  const sourcePage = svgPdf.getPage(0);
  const embedded = await page.doc.embedPage(sourcePage);
  page.drawPage(embedded, {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height
  });
}
