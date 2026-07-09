import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import type { Database as DB } from "better-sqlite3";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDatabase } from "../../src/main/db/database.ts";
import { LibraryRepository } from "../../src/main/db/repository.ts";
import { copiarParaDestino } from "../../src/main/services/copier.ts";

describe("copiarParaDestino — cópia segura", () => {
  let src: string, dest: string, db: DB, repo: LibraryRepository, pastaId: number;

  beforeEach(() => {
    src = mkdtempSync(join(tmpdir(), "src-"));
    dest = mkdtempSync(join(tmpdir(), "pendrive-"));
    db = openDatabase(":memory:");
    repo = new LibraryRepository(db);
    pastaId = repo.ensurePasta(src);
  });
  afterEach(() => {
    rmSync(src, { recursive: true, force: true });
    rmSync(dest, { recursive: true, force: true });
    db.close();
  });

  async function importarComHashReal(nome: string, conteudo: string) {
    const { hashFile } = await import("../../src/main/filesystem/hash.ts");
    const caminho = join(src, nome);
    writeFileSync(caminho, conteudo);
    const hash = await hashFile(caminho);
    const { arquivoId, matrizId } = repo.inserirMatrizComArquivo({
      pastaId, caminhoAbsoluto: caminho, caminhoRelativo: nome, nomeOriginal: nome,
      extensao: "pes", hash, tamanhoBytes: Buffer.byteLength(conteudo),
      criadoEmFs: null, modificadoEmFs: null,
    });
    return matrizId;
  }

  it("copia os arquivos selecionados", async () => {
    const a = await importarComHashReal("rosa.pes", "AAAA");
    const b = await importarComHashReal("flor.pes", "BBBB");
    const r = await copiarParaDestino(repo, [a, b], dest);
    expect(r.copiados).toBe(2);
    expect(r.erros).toBe(0);
    expect(existsSync(join(dest, "rosa.pes"))).toBe(true);
    expect(readFileSync(join(dest, "flor.pes"), "utf8")).toBe("BBBB");
    // originais preservados
    expect(readFileSync(join(src, "rosa.pes"), "utf8")).toBe("AAAA");
    // sem sobras .part
    expect(readdirSync(dest).some((f) => f.endsWith(".part"))).toBe(false);
  });

  it("pula duplicado exato já presente no destino", async () => {
    const a = await importarComHashReal("rosa.pes", "MESMO");
    writeFileSync(join(dest, "rosa.pes"), "MESMO"); // já existe idêntico
    const r = await copiarParaDestino(repo, [a], dest);
    expect(r.pulados).toBe(1);
    expect(r.copiados).toBe(0);
  });

  it("renomeia quando há conflito de nome com conteúdo diferente", async () => {
    const a = await importarComHashReal("rosa.pes", "NOVO");
    writeFileSync(join(dest, "rosa.pes"), "ANTIGO"); // mesmo nome, conteúdo diferente
    const r = await copiarParaDestino(repo, [a], dest, { conflito: "renomear" });
    expect(r.renomeados).toBe(1);
    // o arquivo existente NÃO foi sobrescrito
    expect(readFileSync(join(dest, "rosa.pes"), "utf8")).toBe("ANTIGO");
    expect(existsSync(join(dest, "rosa (2).pes"))).toBe(true);
    expect(readFileSync(join(dest, "rosa (2).pes"), "utf8")).toBe("NOVO");
  });

  it("modo 'pular' não sobrescreve nem renomeia", async () => {
    const a = await importarComHashReal("rosa.pes", "NOVO");
    writeFileSync(join(dest, "rosa.pes"), "ANTIGO");
    const r = await copiarParaDestino(repo, [a], dest, { conflito: "pular" });
    expect(r.pulados).toBe(1);
    expect(readFileSync(join(dest, "rosa.pes"), "utf8")).toBe("ANTIGO");
  });
});
