/**
 * Ferramenta de inspeção de arquivos .PES.
 *
 * Uso:  npm run inspect -- caminho/para/arquivo.pes
 *
 * Imprime o que já sabemos ler com segurança (assinatura, versão, offset do
 * bloco PEC) e faz um dump hexadecimal do cabeçalho e do início do bloco PEC.
 * Esse dump é a base para implementarmos a leitura das dimensões, pontos e
 * cores a partir de arquivos REAIS.
 */
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { parsePesHeader, hexdump, PesFormatError } from "../src/main/embroidery/pes-header.ts";

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
  console.log("\n--- Cabeçalho PES (bytes 0..96) ---");
  console.log(hexdump(buf, 0, 96));
  console.log("\n--- Início do bloco PEC (bytes .. +128) ---");
  console.log(hexdump(buf, h.pecBlockOffset, 128));
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
