import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "../../src/main/db/database.ts";
import { LibraryRepository } from "../../src/main/db/repository.ts";
import { importarPasta } from "../../src/main/services/importer.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const fixtures = join(root, "tests/fixtures/pes/alfabeto-floral");

describe("importarPasta — pipeline completo (37 arquivos reais)", () => {
  let cacheDir: string;

  beforeAll(() => {
    cacheDir = mkdtempSync(join(tmpdir(), "matrizes-cache-"));
  });
  afterAll(() => {
    rmSync(cacheDir, { recursive: true, force: true });
  });

  it("importa, extrai metadados e gera miniaturas", async () => {
    const db = openDatabase(":memory:");
    const repo = new LibraryRepository(db);

    const progressos: string[] = [];
    const resultado = await importarPasta({ repo, cacheDir }, fixtures, {
      onProgresso: (p) => progressos.push(p.fase),
    });

    expect(resultado.total).toBe(37);
    expect(resultado.novos).toBe(37);
    expect(resultado.erros).toBe(0);
    expect(progressos).toContain("processando");

    // Todas listadas com metadados
    const { total, itens } = repo.listarMatrizes(
      {},
      { campo: "nome", direcao: "asc" },
      { offset: 0, limite: 500 },
    );
    expect(total).toBe(37);
    for (const it of itens) {
      expect(it.larguraMm).toBeGreaterThan(0);
      expect(it.numPontos).toBeGreaterThan(0);
      expect(it.miniatura256).toBeTruthy();
    }

    // Miniaturas geradas em disco (256 + 512 por conteúdo único)
    const pngs = readdirSync(cacheDir).filter((f) => f.endsWith(".png"));
    expect(pngs.length).toBeGreaterThanOrEqual(37 * 2);

    // Busca por nome funciona
    expect(repo.listarMatrizes({ busca: "arco" }).total).toBeGreaterThan(0);

    db.close();
  });

  it("segunda importação é incremental (nada reprocessado)", async () => {
    const db = openDatabase(":memory:");
    const repo = new LibraryRepository(db);
    await importarPasta({ repo, cacheDir }, fixtures);
    const r2 = await importarPasta({ repo, cacheDir }, fixtures);
    expect(r2.novos).toBe(0);
    expect(r2.atualizados).toBe(0);
    expect(r2.inalterados).toBe(37);
    db.close();
  });
});
