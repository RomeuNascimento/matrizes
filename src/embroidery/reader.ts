/**
 * Leitor de alto nível de arquivos de bordado.
 *
 * No MVP suporta .PES (todas as versões — a geometria vem sempre do bloco PEC).
 * A interface `readPes` é o ponto único que o resto do app usa, deixando o
 * caminho aberto para outros formatos (.DST, .JEF, ...) no futuro.
 */
import { parsePesHeader, PesFormatError } from "./pes-header.ts";
import { readPecBlock, type Ponto } from "./pec.ts";
import { pecThreadHex } from "./pec-palette.ts";
import { readEmbeddedThreads } from "./pes-versions.ts";

export interface DesignData {
  /** Versão numérica do PES (1, 2, 4, 5, 5.5, 6, ...) ou null se desconhecida. */
  versao: number | null;
  larguraMm: number;
  alturaMm: number;
  numPontos: number;
  /** Número de blocos de cor (trocas de cor + 1). */
  numCores: number;
  /** Cor de cada bloco, em ordem (hex "#RRGGBB"); comprimento = numCores. */
  blocosCores: string[];
  /** Cores distintas usadas (para exibição/etiquetas de cor). */
  cores: string[];
  /** Pontos em posição absoluta (unidade 0,1 mm). */
  pontos: Ponto[];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

const VERSION_BY_CODE: Record<string, number> = {
  "0001": 1,
  "0020": 2,
  "0022": 2.2,
  "0030": 3,
  "0040": 4,
  "0050": 5,
  "0055": 5.5,
  "0056": 5.6,
  "0060": 6,
  "0070": 7,
  "0080": 8,
  "0090": 9,
  "0100": 10,
};

function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/**
 * Mapeia os índices de cor do PEC em cores concretas, replicando
 * map_pec_colors do pyembroidery:
 *  - sem paleta embutida  → paleta fixa do PEC;
 *  - paleta cobre todos os blocos (>=) → usa a paleta embutida em ordem (1:1);
 *  - paleta menor → modo "tabelado": cada índice mapeia para uma thread da
 *    paleta na ordem de primeira aparição.
 */
function mapColors(colorBytes: number[], chart: string[]): string[] {
  if (chart.length === 0) {
    return colorBytes.map((b) => pecThreadHex(b));
  }
  if (chart.length >= colorBytes.length) {
    return chart.slice();
  }
  const map = new Map<number, string>();
  const remaining = chart.slice();
  const out: string[] = [];
  for (const b of colorBytes) {
    let color = map.get(b);
    if (color === undefined) {
      color = remaining.length > 0 ? remaining.shift()! : pecThreadHex(b);
      map.set(b, color);
    }
    out.push(color);
  }
  return out;
}

/** Lê um arquivo .PES (buffer completo) e devolve os dados do desenho. */
export function readPes(buf: Buffer): DesignData {
  const header = parsePesHeader(buf);
  const versao = VERSION_BY_CODE[header.version] ?? null;
  const pec = readPecBlock(buf, header.pecBlockOffset);

  const chart = readEmbeddedThreads(buf, versao);
  const threadlist = mapColors(pec.colorBytes, chart);
  const blocosCores = threadlist.slice(0, pec.colorCount);

  // Cores distintas preservando a ordem de aparição (para exibição).
  const cores: string[] = [];
  for (const c of threadlist) {
    if (!cores.includes(c)) cores.push(c);
  }

  return {
    versao,
    larguraMm: round1((pec.bounds.maxX - pec.bounds.minX) / 10),
    alturaMm: round1((pec.bounds.maxY - pec.bounds.minY) / 10),
    numPontos: pec.stitchCount,
    numCores: pec.colorCount,
    blocosCores,
    cores,
    pontos: pec.stitches,
    bounds: pec.bounds,
  };
}

export { PesFormatError };
