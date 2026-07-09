/**
 * Converte os pontos de um desenho (DesignData) em um SVG, agrupando os pontos
 * em polilinhas por bloco de cor. Puro (sem I/O) — a rasterização para PNG fica
 * em render.ts.
 */
import type { DesignData } from "../embroidery/reader.ts";
import { STITCH, COLOR_CHANGE } from "../embroidery/pec.ts";

export interface SvgOptions {
  /** Lado do quadrado do SVG, em px. */
  size?: number;
  /** Margem interna, em px. */
  padding?: number;
  /** Espessura da linha, em px. */
  strokeWidth?: number;
  /** Cor de fundo; `null` = transparente. */
  background?: string | null;
}

const DEFAULTS: Required<SvgOptions> = {
  size: 512,
  padding: 24,
  strokeWidth: 3,
  background: null,
};

interface Polyline {
  color: string;
  points: [number, number][];
}

/** Segmenta os pontos em polilinhas contínuas, por bloco de cor. */
function buildPolylines(design: DesignData): Polyline[] {
  const lines: Polyline[] = [];
  let colorIndex = 0;
  let current: Polyline | null = null;

  const colorAt = (i: number) =>
    design.blocosCores[Math.min(i, design.blocosCores.length - 1)] ?? "#333333";

  for (const p of design.pontos) {
    if (p.cmd === COLOR_CHANGE) {
      colorIndex++;
      current = null;
      continue;
    }
    if (p.cmd === STITCH) {
      if (current === null) {
        current = { color: colorAt(colorIndex), points: [] };
        lines.push(current);
      }
      current.points.push([p.x, p.y]);
    } else {
      // JUMP / TRIM / END: levanta a agulha (quebra a linha)
      current = null;
    }
  }
  return lines.filter((l) => l.points.length >= 2);
}

/** Gera o SVG do desenho. Coordenadas de entrada em 0,1 mm; Y é invertido. */
export function designToSvg(design: DesignData, options: SvgOptions = {}): string {
  const o = { ...DEFAULTS, ...options };
  const { minX, minY, maxX, maxY } = design.bounds;
  const spanX = Math.max(maxX - minX, 1);
  const spanY = Math.max(maxY - minY, 1);
  const scale = Math.min((o.size - 2 * o.padding) / spanX, (o.size - 2 * o.padding) / spanY);
  const offX = (o.size - spanX * scale) / 2;
  const offY = (o.size - spanY * scale) / 2;

  const tx = (x: number) => (offX + (x - minX) * scale).toFixed(2);
  const ty = (y: number) => (offY + (maxY - y) * scale).toFixed(2); // inverte Y

  const polylines = buildPolylines(design);
  const paths = polylines
    .map((l) => {
      const pts = l.points.map(([x, y]) => `${tx(x)},${ty(y)}`).join(" ");
      return `<polyline points="${pts}" stroke="${l.color}" />`;
    })
    .join("");

  const bg =
    o.background === null
      ? ""
      : `<rect width="${o.size}" height="${o.size}" fill="${o.background}" />`;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${o.size}" height="${o.size}" ` +
    `viewBox="0 0 ${o.size} ${o.size}">` +
    bg +
    `<g fill="none" stroke-width="${o.strokeWidth}" stroke-linecap="round" ` +
    `stroke-linejoin="round">${paths}</g>` +
    `</svg>`
  );
}
