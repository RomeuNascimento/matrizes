import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readPes } from "../../src/main/embroidery/reader.ts";

/**
 * Validação de paridade: o leitor de PES em TypeScript deve reproduzir
 * EXATAMENTE a verdade de referência gerada pelo oráculo (PyEmbroidery) para
 * todos os arquivos .PES reais da amostra. Se algum arquivo divergir, o parser
 * regrediu.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
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

const refs: Ref[] = JSON.parse(
  readFileSync(join(root, "docs/amostras/metadata-alfabeto-floral.json"), "utf8"),
);
const oks = refs.filter((r) => r.status === "ok");

describe("readPes — paridade com o oráculo (amostra Alfabeto Floral)", () => {
  it("tem amostra suficiente", () => {
    expect(oks.length).toBe(37);
  });

  for (const ref of oks) {
    it(`${ref.arquivo} bate com a referência`, () => {
      const buf = readFileSync(join(fixturesDir, ref.arquivo));
      const d = readPes(buf);

      expect(d.versao).toBe(ref.versao);
      expect(d.larguraMm).toBeCloseTo(ref.largura_mm, 1);
      expect(d.alturaMm).toBeCloseTo(ref.altura_mm, 1);
      expect(d.numPontos).toBe(ref.num_pontos);
      expect(d.numCores).toBe(ref.num_cores);
      expect(d.cores).toEqual(ref.cores_hex);
      expect(d.blocosCores.length).toBe(d.numCores);
    });
  }
});
