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
 * Les feuilles &lt;style&gt; ne sont pas prises en charge par SVG→canvas : attributs obligatoires.
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
  if (tag === 'text' || tag === 'tspan') {
    if (fill && fill !== 'none') target.setAttribute('fill', fill);
    return;
  }

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
  bg.setAttribute('fill', '#ffffff');
  bg.setAttribute('x', '0');
  bg.setAttribute('y', '0');
  svg.insertBefore(bg, svg.firstChild);
}
