/**
 * Cache de miniaturas em disco, indexado pelo hash do conteúdo. Como o nome do
 * arquivo de cache é o hash, ele é imune a renomeações e compartilhado entre
 * duplicados; muda naturalmente quando o conteúdo muda.
 */
import { join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import type { DesignData } from "../embroidery/reader.ts";
import { renderThumbnailPng } from "./render.ts";

export function thumbPath(cacheDir: string, hash: string, sizePx: number): string {
  return join(cacheDir, `${hash}_${sizePx}.png`);
}

/**
 * Garante que a miniatura exista no cache (gera se faltar) e devolve o caminho.
 */
export async function ensureThumbnail(
  cacheDir: string,
  hash: string,
  sizePx: number,
  design: DesignData,
): Promise<string> {
  await mkdir(cacheDir, { recursive: true });
  const p = thumbPath(cacheDir, hash, sizePx);
  if (existsSync(p)) return p;
  const png = await renderThumbnailPng(design, sizePx);
  await writeFile(p, png);
  return p;
}
