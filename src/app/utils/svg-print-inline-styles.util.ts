/** Propriétés CSS utiles à figer pour l'export SVG → PNG (hors feuille de composant). */
const SVG_INLINE_STYLE_PROPS = [
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
  'filter',
  'vector-effect'
] as const;

/**
 * Recopie les styles calculés du SVG source vers le clone sérialisé
 * (évite le rendu tout noir sans les styles encapsulés Angular).
 */
export function inlineSvgComputedStyles(
  sourceRoot: SVGSVGElement,
  targetRoot: SVGSVGElement
): void {
  inlineElementComputedStyles(sourceRoot, targetRoot);
  const sourceNodes = sourceRoot.querySelectorAll('*');
  const targetNodes = targetRoot.querySelectorAll('*');
  const count = Math.min(sourceNodes.length, targetNodes.length);
  for (let i = 0; i < count; i++) {
    inlineElementComputedStyles(
      sourceNodes[i] as SVGElement,
      targetNodes[i] as SVGElement
    );
  }
}

function inlineElementComputedStyles(
  source: SVGElement,
  target: SVGElement
): void {
  const computed = getComputedStyle(source);
  for (const prop of SVG_INLINE_STYLE_PROPS) {
    const value = computed.getPropertyValue(prop);
    if (!value || value === 'none' || value === 'normal') continue;
    if (prop === 'fill' && (value === 'rgba(0, 0, 0, 0)' || value === 'transparent')) {
      continue;
    }
    target.style.setProperty(prop, value);
  }
  if (source.hasAttribute('fill')) {
    target.setAttribute('fill', source.getAttribute('fill')!);
  }
  if (source.hasAttribute('stroke')) {
    target.setAttribute('stroke', source.getAttribute('stroke')!);
  }
}
