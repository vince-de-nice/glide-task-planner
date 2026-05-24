/** Feuille de styles figée pour l’export SVG (sans encapsulation Angular ni color-mix). */
export const LEG_PROFILE_CHART_PRINT_CSS = `
.leg-chart__svg { background: #ffffff; }
.leg-chart__grid { stroke: #cbd5e1; stroke-width: 1; stroke-dasharray: 2 4; fill: none; }
.leg-chart__axis-label { font-size: 10px; fill: #64748b; font-family: system-ui, sans-serif; }
.leg-chart__axis-title { font-size: 11px; fill: #475569; font-family: system-ui, sans-serif; font-weight: 600; }
.leg-chart__terrain-area { fill: rgba(120, 53, 15, 0.3); stroke: none; }
.leg-chart__terrain-area--lowfidelity { fill: rgba(99, 102, 241, 0.28); }
.leg-chart__terrain-area--estimated { fill: rgba(245, 158, 11, 0.35); }
.leg-chart__terrain-lowfidelity-band { fill: rgba(99, 102, 241, 0.2); stroke: rgba(79, 70, 229, 0.45); stroke-width: 1; stroke-dasharray: 4 3; }
.leg-chart__terrain-estimated-band { fill: rgba(245, 158, 11, 0.22); stroke: rgba(217, 119, 6, 0.5); stroke-width: 1; stroke-dasharray: 5 4; }
.leg-chart__terrain-gap-band { fill: rgba(220, 38, 38, 0.22); stroke: rgba(220, 38, 38, 0.6); stroke-width: 1; stroke-dasharray: 4 3; }
.leg-chart__gap-label { font-size: 11px; font-weight: 800; fill: #dc2626; font-family: system-ui, sans-serif; }
.leg-chart__terrain-line { stroke: #78350f; stroke-width: 1.5; fill: none; }
.leg-chart__terrain-line--lowfidelity { stroke: #4f46e5; stroke-width: 1.4; stroke-dasharray: 5 3; opacity: 0.92; fill: none; }
.leg-chart__terrain-line--estimated { stroke: #b45309; stroke-width: 1.35; stroke-dasharray: 6 4; opacity: 0.9; fill: none; }
.leg-chart__lowfidelity-stem { stroke: #6366f1; stroke-width: 1; stroke-dasharray: 2 3; opacity: 0.5; fill: none; }
.leg-chart__lowfidelity-dot { fill: #818cf8; stroke: #ffffff; stroke-width: 1.25; }
.leg-chart__estimated-stem { stroke: #b45309; stroke-width: 1; stroke-dasharray: 2 3; opacity: 0.45; fill: none; }
.leg-chart__estimated-dot { fill: #f59e0b; stroke: #ffffff; stroke-width: 1.25; }
.leg-chart__ground-line { stroke: #b45309; stroke-width: 1.25; stroke-dasharray: 4 3; fill: none; opacity: 0.85; }
.leg-chart__landable-cone { fill: none; stroke: #dc2626; stroke-width: 1.15; opacity: 0.35; }
.leg-chart__landable-cone--binding { stroke-width: 1.75; }
.leg-chart__landable-cone--below-min { stroke-dasharray: 5 4; stroke-width: 1; }
.leg-chart__landable-stem { stroke-width: 1; stroke-dasharray: 2 3; opacity: 0.55; fill: none; }
.leg-chart__landable-stem--binding { stroke-width: 1.35; opacity: 0.8; }
.leg-chart__landable-marker { stroke-width: 1.5; opacity: 0.95; }
.leg-chart__landable-label { font-size: 8px; font-weight: 600; font-family: system-ui, sans-serif; }
.leg-chart__landable-label--binding { font-size: 9px; font-weight: 700; }
.leg-chart__cone-envelope { stroke: #64748b; stroke-width: 1.5; stroke-dasharray: 3 2; fill: none; opacity: 0.75; }
.leg-chart__safety-line { stroke-width: 2.25; fill: none; }
.leg-chart__safety-line--cone { stroke: #16a34a; fill: none; }
.leg-chart__safety-line--terrain { stroke: #dc2626; fill: none; }
.leg-chart__safety-margin-label { font-size: 9px; font-weight: 700; font-family: system-ui, sans-serif; paint-order: stroke fill; stroke: #ffffff; stroke-width: 2.5px; }
.leg-chart__intersection-dot { stroke: #ffffff; stroke-width: 1.25; }
.leg-chart__intersection-label { font-size: 8px; font-weight: 700; font-family: system-ui, sans-serif; paint-order: stroke fill; stroke: #ffffff; stroke-width: 2.5px; }
.leg-chart__leg-bound { stroke: rgba(37, 99, 235, 0.45); stroke-width: 1; stroke-dasharray: 6 4; fill: none; }
.leg-chart__endpoint-stick { stroke: #475569; stroke-width: 1.25; stroke-dasharray: 3 3; fill: none; }
.leg-chart__endpoint-dot { fill: #2563eb; stroke: #ffffff; stroke-width: 1.5; }
.leg-chart__endpoint-reserve { fill: #fbbf24; stroke: #ffffff; stroke-width: 1.5; }
.leg-chart__airspace-band { stroke: rgba(124, 58, 237, 0.45); stroke-width: 1; }
text { fill: #0f172a; }
`.trim();

export function injectLegProfileChartPrintStyles(svg: SVGSVGElement): void {
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.setAttribute('type', 'text/css');
  style.textContent = LEG_PROFILE_CHART_PRINT_CSS;
  svg.insertBefore(style, svg.firstChild);
}
