import { describe, it, expect } from "vitest";
import { designToSvg } from "../../src/thumbnails/svg.ts";
import { STITCH, JUMP, COLOR_CHANGE, END } from "../../src/embroidery/pec.ts";
import type { DesignData } from "../../src/embroidery/reader.ts";

function design(pontos: DesignData["pontos"], blocosCores: string[]): DesignData {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pontos) {
    minX = Math.min(minX, p.x); minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x); maxY = Math.max(maxY, p.y);
  }
  return {
    versao: 1, larguraMm: 0, alturaMm: 0, numPontos: 0,
    numCores: blocosCores.length, blocosCores, cores: blocosCores,
    pontos, bounds: { minX, minY, maxX, maxY },
  };
}

describe("designToSvg", () => {
  it("gera uma polilinha por bloco de cor contínuo", () => {
    const d = design(
      [
        { x: 0, y: 0, cmd: STITCH },
        { x: 100, y: 0, cmd: STITCH },
        { x: 100, y: 100, cmd: STITCH },
        { x: 100, y: 100, cmd: COLOR_CHANGE },
        { x: 200, y: 100, cmd: STITCH },
        { x: 200, y: 200, cmd: STITCH },
        { x: 200, y: 200, cmd: END },
      ],
      ["#AA0000", "#00BB00"],
    );
    const svg = designToSvg(d, { size: 256 });
    expect(svg.startsWith("<svg")).toBe(true);
    expect((svg.match(/<polyline/g) ?? []).length).toBe(2);
    expect(svg).toContain('stroke="#AA0000"');
    expect(svg).toContain('stroke="#00BB00"');
  });

  it("quebra a linha em JUMP", () => {
    const d = design(
      [
        { x: 0, y: 0, cmd: STITCH },
        { x: 100, y: 0, cmd: STITCH },
        { x: 500, y: 0, cmd: JUMP },
        { x: 600, y: 0, cmd: STITCH },
        { x: 700, y: 0, cmd: STITCH },
      ],
      ["#123456"],
    );
    const svg = designToSvg(d);
    expect((svg.match(/<polyline/g) ?? []).length).toBe(2);
  });

  it("respeita fundo transparente por padrão", () => {
    const d = design(
      [
        { x: 0, y: 0, cmd: STITCH },
        { x: 10, y: 10, cmd: STITCH },
      ],
      ["#000000"],
    );
    expect(designToSvg(d)).not.toContain("<rect");
    expect(designToSvg(d, { background: "#FFFFFF" })).toContain("<rect");
  });
});
