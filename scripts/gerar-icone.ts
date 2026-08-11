/**
 * Gera os ícones do aplicativo a partir de um desenho vetorial embutido.
 *
 *   npx tsx scripts/gerar-icone.ts
 *
 * Produz `build/icon.png` (512px, usado por Linux/macOS e pelo electron-builder
 * como fonte) e `build/icon.ico` (multi-resolução, usado pelo instalador do
 * Windows, pelo atalho e pela barra de tarefas). Os arquivos gerados ficam
 * versionados para que o instalador possa ser montado sem rodar este script.
 */
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const destino = join(raiz, "build");

/** Resoluções que o Windows escolhe conforme o contexto (lista, atalho, barra). */
const TAMANHOS_ICO = [16, 24, 32, 48, 64, 128, 256];

/**
 * Uma flor bordada: pétalas em rosa sobre fundo cor de linho, miolo claro com
 * um ponto verde no meio. Sem detalhe fino de propósito — precisa ser legível a
 * 16px, que é o tamanho que aparece na barra de tarefas do Windows.
 */
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="petala" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#d4568a"/>
      <stop offset="100%" stop-color="#a82659"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="112" fill="#efe9dc"/>
  <g transform="translate(256 256)">
    <g fill="url(#petala)">
      ${[0, 60, 120, 180, 240, 300]
        .map((a) => `<ellipse cx="0" cy="-104" rx="56" ry="94" transform="rotate(${a})"/>`)
        .join("\n      ")}
    </g>
    <circle r="50" fill="#f6f2e9"/>
    <circle r="50" fill="none" stroke="#a82659" stroke-width="11"/>
    <circle r="15" fill="#6e8b4e"/>
  </g>
</svg>`;

/** Monta um arquivo .ico com várias resoluções em PNG (formato aceito no Win Vista+). */
function montarIco(imagens: { tamanho: number; png: Buffer }[]): Buffer {
  const cabecalho = Buffer.alloc(6);
  cabecalho.writeUInt16LE(0, 0); // reservado
  cabecalho.writeUInt16LE(1, 2); // tipo 1 = ícone
  cabecalho.writeUInt16LE(imagens.length, 4);

  const entradas: Buffer[] = [];
  let offset = 6 + imagens.length * 16;
  for (const { tamanho, png } of imagens) {
    const e = Buffer.alloc(16);
    e.writeUInt8(tamanho >= 256 ? 0 : tamanho, 0); // 0 significa 256
    e.writeUInt8(tamanho >= 256 ? 0 : tamanho, 1);
    e.writeUInt8(0, 2); // cores da paleta (0 = sem paleta)
    e.writeUInt8(0, 3); // reservado
    e.writeUInt16LE(1, 4); // planos
    e.writeUInt16LE(32, 6); // bits por pixel
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    entradas.push(e);
    offset += png.length;
  }

  return Buffer.concat([cabecalho, ...entradas, ...imagens.map((i) => i.png)]);
}

async function main(): Promise<void> {
  mkdirSync(destino, { recursive: true });
  const svg = Buffer.from(SVG);

  const png512 = await sharp(svg).resize(512, 512).png().toBuffer();
  writeFileSync(join(destino, "icon.png"), png512);

  const imagens = [];
  for (const tamanho of TAMANHOS_ICO) {
    imagens.push({ tamanho, png: await sharp(svg).resize(tamanho, tamanho).png().toBuffer() });
  }
  writeFileSync(join(destino, "icon.ico"), montarIco(imagens));

  console.log(`Ícones gerados em ${destino}: icon.png (512) e icon.ico (${TAMANHOS_ICO.join(", ")}).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
