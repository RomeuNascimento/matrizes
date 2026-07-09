import { describe, it, expect } from "vitest";
import { parsePesHeader, PesFormatError, hexdump } from "../../src/main/embroidery/pes-header.ts";

/** Monta um cabeçalho PES sintético só para testar o parser do cabeçalho. */
function craftPesHeader(version: string, pecOffset: number, totalSize = 128): Buffer {
  const buf = Buffer.alloc(totalSize);
  buf.write("#PES", 0, "latin1");
  buf.write(version, 4, "latin1");
  buf.writeUInt32LE(pecOffset, 8);
  return buf;
}

describe("parsePesHeader", () => {
  it("lê assinatura, versão e offset do bloco PEC", () => {
    const buf = craftPesHeader("0060", 90);
    const h = parsePesHeader(buf);
    expect(h.signature).toBe("#PES");
    expect(h.version).toBe("0060");
    expect(h.versionLabel).toBe("PES 6");
    expect(h.pecBlockOffset).toBe(90);
    expect(h.fileSize).toBe(128);
  });

  it("rejeita assinatura inválida", () => {
    const bad = Buffer.alloc(64);
    bad.write("#XYZ", 0, "latin1");
    expect(() => parsePesHeader(bad)).toThrow(PesFormatError);
    expect(() => parsePesHeader(bad)).toThrow(/Assinatura inválida/);
  });

  it("rejeita arquivo curto demais", () => {
    expect(() => parsePesHeader(Buffer.alloc(4))).toThrow(/pequeno demais/);
  });

  it("rejeita offset de PEC fora dos limites", () => {
    const buf = craftPesHeader("0001", 9999, 128);
    expect(() => parsePesHeader(buf)).toThrow(/fora dos limites/);
  });
});

describe("hexdump", () => {
  it("formata bytes em hex + ascii", () => {
    const buf = Buffer.from("#PES0001", "latin1");
    const out = hexdump(buf, 0, 8);
    expect(out).toContain("23 50 45 53"); // "#PES"
    expect(out).toContain("#PES0001");
  });
});
