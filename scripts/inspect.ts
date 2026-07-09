/**
 * Ferramenta de inspeção de arquivos .PES.
 *
 * Uso:  npm run inspect -- caminho/para/arquivo.pes
 *
 * Imprime o que o app lê do arquivo (versão, dimensões, pontos e — o mais
 * importante para investigar "miniaturas pretas" — as CORES lidas por bloco) e
 * gera a miniatura PNG ao lado do arquivo (mesmo nome, sufixo ".thumb.png").
 * Assim dá para comparar a cor lida com a cor esperada e ver a imagem gerada.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { parsePesHeader, hexdump, PesFormatError } from "../src/main/embroidery/pes-header.ts";
import { readPes } from "../src/main/embroidery/reader.ts";
import { renderThumbnailPng } from "../src/main/thumbnails/render.ts";

const path = process.argv[2];
if (!path) {
  console.error("Uso: npm run inspect -- caminho/para/arquivo.pes");
  process.exit(1);
}

let buf: Buffer;
try {
  buf = readFileSync(path);
} catch (e) {
  console.error(`Não consegui abrir o arquivo: ${(e as Error).message}`);
  process.exit(1);
}

console.log(`Arquivo    : ${basename(path)}`);
console.log(`Tamanho    : ${buf.length} bytes`);

try {
  const h = parsePesHeader(buf);
  console.log(`Assinatura : ${h.signature}`);
  console.log(`Versão     : ${h.version}  (${h.versionLabel})`);
  console.log(`PEC offset : ${h.pecBlockOffset} (0x${h.pecBlockOffset.toString(16)})`);
} catch (e) {
  if (e instanceof PesFormatError) {
    console.error(`\n⚠ Não é um PES válido: ${e.message}`);
  } else {
    console.error(`\nErro inesperado: ${(e as Error).message}`);
  }
  console.log("\n--- Primeiros 96 bytes ---");
  console.log(hexdump(buf, 0, 96));
  process.exit(2);
}

// Leitura completa (o que o app usa para gerar a miniatura)
try {
  const d = readPes(buf);
  console.log(`\n--- Leitura completa ---`);
  console.log(`Versão lida : ${d.versao}`);
  console.log(`Tamanho     : ${d.larguraMm} × ${d.alturaMm} mm`);
  console.log(`Pontos      : ${d.numPontos}`);
  console.log(`Blocos cor  : ${d.numCores}`);
  console.log(`Cores/bloco : ${d.blocosCores.join("  ")}`);
  console.log(`Cores únicas: ${d.cores.join("  ")}`);

  // Diagnóstico: cores muito escuras costumam gerar "miniatura preta".
  const escura = (hex: string) => {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
    return 0.299 * r + 0.587 * g + 0.114 * b < 40; // luminância baixa
  };
  const escuras = d.blocosCores.filter(escura).length;
  if (d.blocosCores.length && escuras === d.blocosCores.length) {
    console.log(`\n⚠ TODAS as ${escuras} cores são muito escuras → a miniatura sai praticamente preta.`);
    console.log(`  Se o desenho REAL é colorido, é falha de leitura de paleta nesta versão.`);
  } else if (escuras) {
    console.log(`\nℹ ${escuras} de ${d.blocosCores.length} cores são escuras (pode ser normal p/ contornos).`);
  }

  const saida = join(dirname(path), basename(path).replace(/\.[^.]+$/, "") + ".thumb.png");
  const png = await renderThumbnailPng(d, 256);
  writeFileSync(saida, png);
  console.log(`\n🖼  Miniatura gerada em: ${saida}`);
} catch (e) {
  console.error(`\nFalha na leitura completa: ${(e as Error).message}`);
  console.log("\n--- Início do bloco PEC ---");
  const h = parsePesHeader(buf);
  console.log(hexdump(buf, h.pecBlockOffset, 128));
  process.exit(2);
}
