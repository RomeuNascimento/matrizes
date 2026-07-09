/**
 * Rasterização das miniaturas: SVG (svg.ts) → PNG via sharp.
 */
import sharp from "sharp";
import type { DesignData } from "../embroidery/reader.ts";
import { designToSvg, type SvgOptions } from "./svg.ts";

/** Tamanhos padrão de miniatura usados pelo app. */
export const THUMB_SIZES = { grade: 256, detalhe: 512 } as const;

/** Renderiza um desenho em PNG (Buffer) no tamanho dado. */
export async function renderThumbnailPng(
  design: DesignData,
  size: number,
  options: SvgOptions = {},
): Promise<Buffer> {
  const svg = designToSvg(design, { ...options, size });
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}
