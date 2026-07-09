/**
 * Leitura do CABEÇALHO de um arquivo .PES (Brother/Bernina/Babylock).
 *
 * Esta etapa cobre apenas a parte do formato que é estável entre todas as
 * versões do PES (v1 a v6) e independe da versão:
 *   - bytes 0..3  : assinatura ASCII "#PES"
 *   - bytes 4..7  : versão em ASCII ("0001".."0060")
 *   - bytes 8..11 : offset (uint32 little-endian) onde começa o bloco PEC
 *
 * As dimensões, contagem de pontos e cores vivem dentro do bloco PEC e das
 * seções específicas de cada versão — serão implementadas na sequência,
 * validadas contra arquivos .PES REAIS (ver tests/fixtures/pes/README.md).
 */

export interface PesHeader {
  /** Sempre "#PES" em um arquivo válido. */
  signature: string;
  /** Versão do formato em ASCII, ex.: "0001", "0060". */
  version: string;
  /** Rótulo legível da versão, ex.: "PES 6". */
  versionLabel: string;
  /** Offset (bytes) do início do bloco PEC dentro do arquivo. */
  pecBlockOffset: number;
  /** Tamanho total do arquivo em bytes. */
  fileSize: number;
}

export class PesFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PesFormatError";
  }
}

/** Assinaturas de versão conhecidas do PES (o código não é um inteiro simples). */
const KNOWN_VERSIONS: Record<string, string> = {
  "0001": "PES 1",
  "0020": "PES 2",
  "0030": "PES 3",
  "0040": "PES 4",
  "0050": "PES 5",
  "0055": "PES 5.5",
  "0056": "PES 5.6",
  "0060": "PES 6",
};

function versionLabelFrom(version: string): string {
  return KNOWN_VERSIONS[version] ?? `PES (versão "${version}")`;
}

/**
 * Lê e valida o cabeçalho de um buffer de arquivo .PES.
 * Lança PesFormatError se o arquivo for curto demais ou não tiver a
 * assinatura "#PES".
 */
export function parsePesHeader(buf: Buffer): PesHeader {
  if (buf.length < 12) {
    throw new PesFormatError(
      `Arquivo pequeno demais para ser um PES válido (${buf.length} bytes).`,
    );
  }

  const signature = buf.toString("latin1", 0, 4);
  if (signature !== "#PES") {
    throw new PesFormatError(
      `Assinatura inválida: esperado "#PES", encontrado "${signature}".`,
    );
  }

  const version = buf.toString("latin1", 4, 8);
  const pecBlockOffset = buf.readUInt32LE(8);

  if (pecBlockOffset < 0 || pecBlockOffset >= buf.length) {
    throw new PesFormatError(
      `Offset do bloco PEC (${pecBlockOffset}) fora dos limites do arquivo ` +
        `(${buf.length} bytes).`,
    );
  }

  return {
    signature,
    version,
    versionLabel: versionLabelFrom(version),
    pecBlockOffset,
    fileSize: buf.length,
  };
}

/**
 * Dump hexadecimal legível de uma região do buffer — usado para inspecionar
 * a estrutura binária de arquivos reais durante o desenvolvimento do parser.
 */
export function hexdump(buf: Buffer, start = 0, length = 64): string {
  const end = Math.min(start + length, buf.length);
  const lines: string[] = [];
  for (let i = start; i < end; i += 16) {
    const slice = buf.subarray(i, Math.min(i + 16, end));
    const hex = Array.from(slice)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(" ");
    const ascii = Array.from(slice)
      .map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : "."))
      .join("");
    lines.push(`${i.toString(16).padStart(8, "0")}  ${hex.padEnd(47)}  ${ascii}`);
  }
  return lines.join("\n");
}
