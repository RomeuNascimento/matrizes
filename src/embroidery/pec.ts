/**
 * Decodificação do bloco PEC de um arquivo de bordado Brother.
 *
 * O bloco PEC é comum a todas as versões do PES e carrega a geometria real do
 * desenho (pontos e trocas de cor). Portado fielmente de pyembroidery
 * (PecReader.read_pec / read_pec_stitches), que é nossa referência.
 *
 * Layout relevante (offsets relativos ao início do bloco PEC):
 *   +0x30            : (número de cores − 1)
 *   +0x31            : lista de índices de cor (uma por cor)
 *   +0x210 (fixo)    : início do fluxo de pontos
 * O offset do fluxo é fixo porque o "seek(0x1D0 − color_changes)" do formato
 * cancela exatamente o tamanho da lista de cores (color_changes + 1).
 */
export const STITCH = 0;
export const JUMP = 1;
export const TRIM = 2;
export const COLOR_CHANGE = 3;
export const END = 4;

const FLAG_LONG = 0x80;
const JUMP_CODE = 0x10;
const TRIM_CODE = 0x20;
const STITCH_STREAM_OFFSET = 0x210;

export interface Ponto {
  x: number; // posição absoluta em unidades de 0,1 mm
  y: number;
  cmd: number;
}

export interface PecData {
  colorCount: number;
  /** Índices de cor brutos (um por bloco), a serem mapeados em cores pelo leitor. */
  colorBytes: number[];
  stitches: Ponto[];
  stitchCount: number; // apenas comandos STITCH
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

function signed12(b: number): number {
  b &= 0xfff;
  return b > 0x7ff ? b - 0x1000 : b;
}

function signed7(b: number): number {
  return b > 63 ? b - 128 : b;
}

/**
 * Lê o bloco PEC começando em `pecStart` dentro de `buf`.
 * Lança Error se os offsets extrapolarem o buffer.
 */
export function readPecBlock(buf: Buffer, pecStart: number): PecData {
  const colorByteOffset = pecStart + 0x30;
  if (colorByteOffset >= buf.length) {
    throw new Error("Bloco PEC truncado (cabeçalho de cores fora do arquivo).");
  }
  const colorChanges = buf[colorByteOffset];
  const colorCount = colorChanges + 1;

  const colorListStart = pecStart + 0x31;
  const colorBytes: number[] = [];
  for (let i = 0; i < colorCount; i++) {
    const off = colorListStart + i;
    if (off >= buf.length) break;
    colorBytes.push(buf[off]);
  }

  const stitches = readPecStitches(buf, pecStart + STITCH_STREAM_OFFSET);

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  let stitchCount = 0;
  for (const p of stitches) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
    if (p.cmd === STITCH) stitchCount++;
  }
  if (!Number.isFinite(minX)) {
    minX = minY = maxX = maxY = 0;
  }

  return {
    colorCount,
    colorBytes,
    stitches,
    stitchCount,
    bounds: { minX, minY, maxX, maxY },
  };
}

/**
 * Decodifica o fluxo de pontos do PEC a partir de `start`, acumulando posição
 * absoluta. Réplica de read_pec_stitches do pyembroidery, incluindo o
 * comportamento de "trim" (marca no ponto atual e então move).
 */
export function readPecStitches(buf: Buffer, start: number): Ponto[] {
  const stitches: Ponto[] = [];
  let pos = start;
  let x = 0;
  let y = 0;

  while (pos + 1 < buf.length) {
    const val1 = buf[pos++];
    let val2: number = buf[pos++];

    if (val1 === 0xff && val2 === 0x00) break;

    if (val1 === 0xfe && val2 === 0xb0) {
      pos++; // pula 1 byte (índice de cor de referência)
      stitches.push({ x, y, cmd: COLOR_CHANGE });
      continue;
    }

    let jump = false;
    let trim = false;
    let dx: number;
    let dy: number;

    if (val1 & FLAG_LONG) {
      if (val1 & TRIM_CODE) trim = true;
      if (val1 & JUMP_CODE) jump = true;
      dx = signed12((val1 << 8) | val2);
      if (pos >= buf.length) break;
      val2 = buf[pos++]; // próximo byte passa a ser o primeiro de Y
    } else {
      dx = signed7(val1);
    }

    if (val2 & FLAG_LONG) {
      if (val2 & TRIM_CODE) trim = true;
      if (val2 & JUMP_CODE) jump = true;
      if (pos >= buf.length) break;
      const val3 = buf[pos++];
      dy = signed12((val2 << 8) | val3);
    } else {
      dy = signed7(val2);
    }

    if (jump) {
      x += dx;
      y += dy;
      stitches.push({ x, y, cmd: JUMP });
    } else if (trim) {
      stitches.push({ x, y, cmd: TRIM }); // marca no ponto atual...
      x += dx;
      y += dy;
      stitches.push({ x, y, cmd: JUMP }); // ...e então move
    } else {
      x += dx;
      y += dy;
      stitches.push({ x, y, cmd: STITCH });
    }
  }

  stitches.push({ x, y, cmd: END });
  return stitches;
}
