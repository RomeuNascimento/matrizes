/**
 * Valida o leitor de PES em TypeScript contra a verdade de referência gerada
 * pelo oráculo (PyEmbroidery), arquivo a arquivo.
 *
 * Uso: npm run validate
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readPes } from "../src/main/embroidery/reader.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const refPath = join(root, "docs/amostras/metadata-alfabeto-floral.json");
const fixturesDir = join(root, "tests/fixtures/pes/alfabeto-floral");

interface Ref {
  arquivo: string;
  status?: string;
  versao: number;
  largura_mm: number;
  altura_mm: number;
  num_pontos: number;
  num_cores: number;
  cores_hex: string[];
}

const refs: Ref[] = JSON.parse(readFileSync(refPath, "utf8"));
const oks = refs.filter((r) => r.status === "ok");

let pass = 0;
const problemas: string[] = [];

console.log(
  "arquivo".padEnd(22) + "  dim   pontos  cores  cores(hex)",
);
for (const ref of oks) {
  const buf = readFileSync(join(fixturesDir, ref.arquivo));
  const d = readPes(buf);

  const dimOk =
    Math.abs(d.larguraMm - ref.largura_mm) < 0.05 &&
    Math.abs(d.alturaMm - ref.altura_mm) < 0.05;
  const pontosOk = d.numPontos === ref.num_pontos;
  const coresOk = d.numCores === ref.num_cores;
  const hexOk = JSON.stringify(d.cores) === JSON.stringify(ref.cores_hex);

  const ok = dimOk && pontosOk && coresOk && hexOk;
  if (ok) pass++;
  else {
    const parts: string[] = [];
    if (!dimOk) parts.push(`dim ${d.larguraMm}x${d.alturaMm} != ${ref.largura_mm}x${ref.altura_mm}`);
    if (!pontosOk) parts.push(`pontos ${d.numPontos} != ${ref.num_pontos}`);
    if (!coresOk) parts.push(`cores ${d.numCores} != ${ref.num_cores}`);
    if (!hexOk) parts.push(`hex ${JSON.stringify(d.cores)} != ${JSON.stringify(ref.cores_hex)}`);
    problemas.push(`${ref.arquivo}: ${parts.join("; ")}`);
  }

  const mark = ok ? "ok " : "XX ";
  console.log(
    mark +
      ref.arquivo.padEnd(22) +
      `${d.larguraMm}x${d.alturaMm}`.padEnd(6) +
      `  ${d.numPontos}`.padEnd(8) +
      `  ${d.numCores}`.padEnd(6) +
      `  ${d.cores.join(" ")}`,
  );
}

console.log(`\n${pass}/${oks.length} arquivos batem exatamente com o oráculo.`);
if (problemas.length) {
  console.log("\nDivergências:");
  for (const p of problemas) console.log("  - " + p);
  process.exit(1);
}
