/**
 * Couleurs explicites pour l’export PDF (svg2pdf ne gère pas color-mix ni var()).
 */
export const PROFILE_CHART_PRINT_PAINT = {
  terrainArea: 'rgba(146, 64, 14, 0.24)',
  terrainAreaLow: 'rgba(99, 102, 241, 0.2)',
  terrainAreaEst: 'rgba(245, 158, 11, 0.22)',
  terrainLine: '#92400e',
  terrainLineLow: '#4f46e5',
  terrainLineEst: '#b45309',
  groundLine: '#c2410c',
  safetyCone: '#15803d',
  safetyTerrain: '#b91c1c',
  coneEnvelope: '#64748b',
  landableCone: 'rgba(220, 38, 38, 0.35)',
  grid: '#e2e8f0',
  axis: '#475569',
  axisTitle: '#1e293b',
  labelInk: '#0f172a',
  labelHalo: '#ffffff',
  airspaceCap: '#5b21b6',
  gap: '#dc2626'
} as const;

function chartFontSizes(chartHeight: number): {
  axis: string;
  mark: string;
  title: string;
} {
  return {
    axis: `${Math.max(11, Math.round(chartHeight * 0.022))}`,
    mark: `${Math.max(10, Math.round(chartHeight * 0.019))}`,
    title: `${Math.max(12, Math.round(chartHeight * 0.024))}`
  };
}

function hasClass(el: Element, name: string): boolean {
  return (el.getAttribute('class') ?? '').split(/\s+/).includes(name);
}

function setPathPaint(
  el: SVGElement,
  paint: {
    fill?: string;
    stroke?: string;
    strokeWidth?: string;
    strokeDasharray?: string;
    opacity?: string;
  }
): void {
  if (paint.fill != null) el.setAttribute('fill', paint.fill);
  if (paint.stroke != null) el.setAttribute('stroke', paint.stroke);
  if (paint.strokeWidth != null) {
    el.setAttribute('stroke-width', paint.strokeWidth);
  }
  if (paint.strokeDasharray != null) {
    el.setAttribute('stroke-dasharray', paint.strokeDasharray);
  }
  if (paint.opacity != null) el.setAttribute('opacity', paint.opacity);
}

function setLabelPaint(
  el: SVGElement,
  paint: {
    fill: string;
    fontSize: string;
    fontWeight?: string;
    stroke?: string | null;
    strokeWidth?: string;
  }
): void {
  el.setAttribute('fill', paint.fill);
  el.setAttribute('font-size', paint.fontSize);
  if (paint.fontWeight) {
    el.setAttribute('font-weight', paint.fontWeight);
  }
  if (paint.stroke) {
    el.setAttribute('stroke', paint.stroke);
    el.setAttribute('stroke-width', paint.strokeWidth ?? '2.5');
    el.setAttribute('paint-order', 'stroke fill');
    el.setAttribute('stroke-linejoin', 'round');
  } else {
    el.removeAttribute('stroke');
    el.removeAttribute('stroke-width');
    el.removeAttribute('paint-order');
    el.removeAttribute('stroke-linejoin');
  }
}

/** Applique couleurs et tailles de police lisibles à l’impression. */
export function applyProfileChartPrintPaints(
  svg: SVGSVGElement,
  chartHeight: number
): void {
  const fonts = chartFontSizes(chartHeight);

  for (const el of svg.querySelectorAll<SVGElement>('*')) {
    const tag = el.tagName.toLowerCase();

    if (tag === 'line' && hasClass(el, 'leg-chart__grid')) {
      el.setAttribute('stroke', PROFILE_CHART_PRINT_PAINT.grid);
      el.setAttribute('stroke-width', '1');
      continue;
    }

    if (tag === 'path') {
      if (hasClass(el, 'leg-chart__terrain-area')) {
        const fill = hasClass(el, 'leg-chart__terrain-area--lowfidelity')
          ? PROFILE_CHART_PRINT_PAINT.terrainAreaLow
          : hasClass(el, 'leg-chart__terrain-area--estimated')
            ? PROFILE_CHART_PRINT_PAINT.terrainAreaEst
            : PROFILE_CHART_PRINT_PAINT.terrainArea;
        setPathPaint(el, { fill, stroke: 'none' });
      } else if (hasClass(el, 'leg-chart__terrain-line')) {
        const stroke = hasClass(el, 'leg-chart__terrain-line--lowfidelity')
          ? PROFILE_CHART_PRINT_PAINT.terrainLineLow
          : hasClass(el, 'leg-chart__terrain-line--estimated')
            ? PROFILE_CHART_PRINT_PAINT.terrainLineEst
            : PROFILE_CHART_PRINT_PAINT.terrainLine;
        setPathPaint(el, {
          fill: 'none',
          stroke,
          strokeWidth: '1.5',
          strokeDasharray: hasClass(el, 'leg-chart__terrain-line--estimated')
            ? '6 4'
            : hasClass(el, 'leg-chart__terrain-line--lowfidelity')
              ? '5 3'
              : undefined
        });
      } else if (hasClass(el, 'leg-chart__ground-line')) {
        setPathPaint(el, {
          fill: 'none',
          stroke: PROFILE_CHART_PRINT_PAINT.groundLine,
          strokeWidth: '1.25',
          strokeDasharray: '4 3',
          opacity: '0.9'
        });
      } else if (hasClass(el, 'leg-chart__safety-line')) {
        setPathPaint(el, {
          fill: 'none',
          stroke: hasClass(el, 'leg-chart__safety-line--terrain')
            ? PROFILE_CHART_PRINT_PAINT.safetyTerrain
            : PROFILE_CHART_PRINT_PAINT.safetyCone,
          strokeWidth: '2.25'
        });
      } else if (hasClass(el, 'leg-chart__cone-envelope')) {
        setPathPaint(el, {
          fill: 'none',
          stroke: PROFILE_CHART_PRINT_PAINT.coneEnvelope,
          strokeWidth: '1.5',
          strokeDasharray: '3 2',
          opacity: '0.85'
        });
      } else if (hasClass(el, 'leg-chart__landable-cone')) {
        setPathPaint(el, {
          fill: 'none',
          stroke: '#dc2626',
          strokeWidth: hasClass(el, 'leg-chart__landable-cone--binding')
            ? '1.5'
            : '1',
          opacity: '0.28',
          strokeDasharray: hasClass(el, 'leg-chart__landable-cone--below-min')
            ? '5 4'
            : undefined
        });
      }
      continue;
    }

    if (tag === 'rect') {
      if (hasClass(el, 'leg-chart__terrain-lowfidelity-band')) {
        el.setAttribute('fill', PROFILE_CHART_PRINT_PAINT.terrainAreaLow);
        el.setAttribute('stroke', '#4f46e5');
      } else if (hasClass(el, 'leg-chart__terrain-estimated-band')) {
        el.setAttribute('fill', PROFILE_CHART_PRINT_PAINT.terrainAreaEst);
        el.setAttribute('stroke', '#d97706');
      } else if (hasClass(el, 'leg-chart__terrain-gap-band')) {
        el.setAttribute('fill', 'rgba(220, 38, 38, 0.18)');
        el.setAttribute('stroke', PROFILE_CHART_PRINT_PAINT.gap);
      }
      continue;
    }

    if (tag === 'line' && hasClass(el, 'leg-chart__axis')) {
      el.setAttribute('stroke', PROFILE_CHART_PRINT_PAINT.axis);
      el.setAttribute('stroke-width', '1');
      continue;
    }

    if (tag === 'text') {
      if (hasClass(el, 'leg-chart__axis-label')) {
        setLabelPaint(el, {
          fill: PROFILE_CHART_PRINT_PAINT.axis,
          fontSize: fonts.axis
        });
      } else if (hasClass(el, 'leg-chart__axis-title')) {
        setLabelPaint(el, {
          fill: PROFILE_CHART_PRINT_PAINT.axisTitle,
          fontSize: fonts.title
        });
      } else if (hasClass(el, 'leg-chart__intersection-label')) {
        setLabelPaint(el, {
          fill: PROFILE_CHART_PRINT_PAINT.labelInk,
          fontSize: fonts.mark,
          fontWeight: '700',
          stroke: null
        });
      } else if (hasClass(el, 'leg-chart__landable-label')) {
        // Pas de contour blanc : sur texte court, svg2pdf ne laisse que le halo.
        setLabelPaint(el, {
          fill: PROFILE_CHART_PRINT_PAINT.labelInk,
          fontSize: fonts.mark,
          fontWeight: hasClass(el, 'leg-chart__landable-label--binding')
            ? '700'
            : '600',
          stroke: null
        });
      } else if (hasClass(el, 'leg-chart__airspace-cap-label')) {
        setLabelPaint(el, {
          fill: PROFILE_CHART_PRINT_PAINT.airspaceCap,
          fontSize: fonts.mark,
          fontWeight: '600',
          stroke: null
        });
      } else if (hasClass(el, 'leg-chart__gap-label')) {
        setLabelPaint(el, {
          fill: PROFILE_CHART_PRINT_PAINT.gap,
          fontSize: fonts.mark,
          fontWeight: '800',
          stroke: null
        });
      }
    }
  }

  forceLegibleProfileChartLabels(svg);
}

/** Filet de sécurité : svg2pdf masque parfois le fill si un contour clair subsiste. */
function forceLegibleProfileChartLabels(svg: SVGSVGElement): void {
  for (const el of svg.querySelectorAll<SVGTextElement>('text')) {
    if (
      hasClass(el, 'leg-chart__axis-label') ||
      hasClass(el, 'leg-chart__axis-title')
    ) {
      continue;
    }

    const fill = (el.getAttribute('fill') ?? '').trim().toLowerCase();
    const fillIsLight =
      fill === '' ||
      fill === '#fff' ||
      fill === '#ffffff' ||
      fill === 'white' ||
      fill.startsWith('rgb(255');

    if (fillIsLight) {
      if (hasClass(el, 'leg-chart__gap-label')) {
        el.setAttribute('fill', PROFILE_CHART_PRINT_PAINT.gap);
      } else if (hasClass(el, 'leg-chart__airspace-cap-label')) {
        el.setAttribute('fill', PROFILE_CHART_PRINT_PAINT.airspaceCap);
      } else {
        el.setAttribute('fill', PROFILE_CHART_PRINT_PAINT.labelInk);
      }
    }

    if (
      hasClass(el, 'leg-chart__intersection-label') ||
      hasClass(el, 'leg-chart__landable-label') ||
      hasClass(el, 'leg-chart__airspace-cap-label') ||
      hasClass(el, 'leg-chart__gap-label')
    ) {
      el.removeAttribute('stroke');
      el.removeAttribute('stroke-width');
      el.removeAttribute('paint-order');
      el.removeAttribute('stroke-linejoin');
    }
  }
}
