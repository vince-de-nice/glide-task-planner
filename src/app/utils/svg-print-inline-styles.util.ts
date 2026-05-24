/** Couleurs explicites pour l’export (svg2pdf ne résout pas les variables CSS). */
export const SVG_PRINT_COLORS = {
  axisLabel: '#64748b',
  axisTitle: '#334155',
  labelInk: '#0f172a',
  labelHalo: '#ffffff',
  surface: '#ffffff'
} as const;

const PRESENTATION_PROPS = [
  'fill',
  'stroke',
  'stroke-width',
  'stroke-dasharray',
  'stroke-linecap',
  'stroke-linejoin',
  'opacity',
  'fill-opacity',
  'stroke-opacity',
  'font-size',
  'font-weight',
  'font-family',
  'text-anchor',
  'dominant-baseline',
  'paint-order',
  'vector-effect'
] as const;

const STROKE_ONLY_TAGS = new Set([
  'path',
  'line',
  'polyline',
  'polygon'
]);

/**
 * Recopie les styles calculés du SVG source vers le clone (même structure d’arbre).
 * Attributs explicites obligatoires pour svg2pdf (pas de feuilles &lt;style&gt; ni var()).
 */
export function inlineSvgPresentationTree(
  sourceRoot: Element,
  targetRoot: Element
): void {
  if (sourceRoot instanceof SVGElement && targetRoot instanceof SVGElement) {
    inlineElementPresentation(sourceRoot, targetRoot);
  }
  const sourceChildren = Array.from(sourceRoot.children);
  const targetChildren = Array.from(targetRoot.children);
  const count = Math.min(sourceChildren.length, targetChildren.length);
  for (let i = 0; i < count; i++) {
    inlineSvgPresentationTree(sourceChildren[i], targetChildren[i]);
  }
}

function inlineElementPresentation(
  source: SVGElement,
  target: SVGElement
): void {
  const computed = getComputedStyle(source);
  const tag = source.tagName.toLowerCase();

  if (tag === 'text' || tag === 'tspan') {
    inlineTextPresentation(source, target, computed);
    return;
  }

  for (const prop of PRESENTATION_PROPS) {
    const value = computed.getPropertyValue(prop);
    if (!value || value === 'none' || value === 'normal') continue;
    if (
      prop === 'fill' &&
      (value === 'rgba(0, 0, 0, 0)' || value === 'transparent')
    ) {
      continue;
    }
    target.style.setProperty(prop, value);
  }

  const fill = computed.fill;
  if (tag === 'circle' || tag === 'rect') {
    if (source.hasAttribute('fill')) {
      target.setAttribute('fill', source.getAttribute('fill')!);
    } else if (fill && fill !== 'none' && !isTransparent(fill)) {
      target.setAttribute('fill', fill);
    }
    if (source.hasAttribute('stroke')) {
      target.setAttribute('stroke', source.getAttribute('stroke')!);
    } else {
      const stroke = computed.stroke;
      if (stroke && stroke !== 'none') target.setAttribute('stroke', stroke);
    }
    copyNumericPresentationAttrs(source, target, computed);
    return;
  }

  if (STROKE_ONLY_TAGS.has(tag)) {
    if (fill && fill !== 'none' && !isTransparent(fill) && fill !== 'rgb(0, 0, 0)') {
      target.setAttribute('fill', fill);
    } else {
      target.setAttribute('fill', 'none');
    }
    const stroke = computed.stroke;
    if (stroke && stroke !== 'none') {
      target.setAttribute('stroke', stroke);
    }
    const sw = computed.getPropertyValue('stroke-width');
    if (sw) target.setAttribute('stroke-width', sw);
    const dash = computed.getPropertyValue('stroke-dasharray');
    if (dash && dash !== 'none') target.setAttribute('stroke-dasharray', dash);
    const op = computed.opacity;
    if (op && op !== '1') target.setAttribute('opacity', op);
    return;
  }

  if (source.hasAttribute('fill')) {
    target.setAttribute('fill', source.getAttribute('fill')!);
  }
  if (source.hasAttribute('stroke')) {
    target.setAttribute('stroke', source.getAttribute('stroke')!);
  }
}

function inlineTextPresentation(
  source: SVGElement,
  target: SVGElement,
  computed: CSSStyleDeclaration
): void {
  const classes = source.getAttribute('class') ?? '';
  let fill =
    source.getAttribute('fill') ??
    (computed.fill && computed.fill !== 'none' ? computed.fill : '');
  if (!fill || fill.includes('var(')) {
    if (classes.includes('axis-label')) {
      fill = SVG_PRINT_COLORS.axisLabel;
    } else if (classes.includes('axis-title')) {
      fill = SVG_PRINT_COLORS.axisTitle;
    } else if (classes.includes('gap-label')) {
      fill = '#dc2626';
    } else {
      fill = SVG_PRINT_COLORS.axisLabel;
    }
  }
  target.setAttribute('fill', fill);

  const fontSize = computed.fontSize;
  if (fontSize) target.setAttribute('font-size', fontSize);

  const fontFamily = computed.fontFamily;
  if (fontFamily) target.setAttribute('font-family', fontFamily);

  const fontWeight = computed.fontWeight;
  if (fontWeight && fontWeight !== 'normal') {
    target.setAttribute('font-weight', fontWeight);
  }

  const anchor = source.getAttribute('text-anchor') ?? computed.textAnchor;
  if (anchor && anchor !== 'start') {
    target.setAttribute('text-anchor', anchor);
  }

  const baseline = source.getAttribute('dominant-baseline');
  if (baseline) target.setAttribute('dominant-baseline', baseline);

  if (classes.includes('landable-label') || classes.includes('intersection-label')) {
    target.setAttribute('fill', SVG_PRINT_COLORS.labelInk);
    target.removeAttribute('stroke');
    target.removeAttribute('stroke-width');
    target.removeAttribute('paint-order');
    return;
  }

  if (classes.includes('airspace-cap-label')) {
    target.setAttribute('fill', '#5b21b6');
    target.removeAttribute('stroke');
    return;
  }

  if (classes.includes('gap-label')) {
    target.setAttribute('fill', '#dc2626');
    target.removeAttribute('stroke');
    return;
  }

  if (classes.includes('label-text')) {
    const stroke = computed.stroke;
    const strokeColor =
      stroke && stroke !== 'none' && !stroke.includes('var(')
        ? stroke
        : SVG_PRINT_COLORS.labelHalo;
    target.setAttribute('stroke', strokeColor);
    const sw = computed.getPropertyValue('stroke-width');
    target.setAttribute('stroke-width', sw && sw !== '0px' ? sw : '3px');
    target.setAttribute('paint-order', 'stroke fill');
    target.setAttribute('stroke-linejoin', 'round');
  }
}

function copyNumericPresentationAttrs(
  source: SVGElement,
  target: SVGElement,
  computed: CSSStyleDeclaration
): void {
  const op = computed.opacity;
  if (op && op !== '1') target.setAttribute('opacity', op);
  const fo = computed.getPropertyValue('fill-opacity');
  if (fo && fo !== '1') target.setAttribute('fill-opacity', fo);
}

function isTransparent(color: string): boolean {
  return color === 'transparent' || color === 'rgba(0, 0, 0, 0)';
}

export function prependSvgPrintBackground(
  svg: SVGSVGElement,
  width: number,
  height: number
): void {
  const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  bg.setAttribute('width', String(width));
  bg.setAttribute('height', String(height));
  bg.setAttribute('fill', SVG_PRINT_COLORS.surface);
  bg.setAttribute('x', '0');
  bg.setAttribute('y', '0');
  svg.insertBefore(bg, svg.firstChild);
}

/** Retire les éléments interactifs / hors tracé avant export. */
export function stripSvgNonPrintElements(svg: SVGSVGElement): void {
  svg.querySelectorAll('.leg-chart__hover-line').forEach(el => el.remove());
}
