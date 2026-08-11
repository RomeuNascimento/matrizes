/**
 * Sincronização da biblioteca com o disco: arquivos que a usuária moveu,
 * renomeou ou apagou. A regra de ouro é que o trabalho dela (nome dado,
 * favorita, etiquetas) nunca se perde por causa de uma mexida na pasta.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, copyFileSync, renameSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "../../src/main/db/database.ts";
import { LibraryRepository } from "../../src/main/db/repository.ts";
import { importarPasta } from "../../src/main/services/importer.ts";
import type { Database as DB } from "better-sqlite3";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const fixtures = join(root, "tests/fixtures/pes/alfabeto-floral");

describe("biblioteca em sincronia com o disco", () => {
  let cacheDir: string;
  let biblioteca: string;
  let db: DB;
  let repo: LibraryRepository;

  const ordem = { campo: "nome", direcao: "asc" } as const;

  beforeEach(() => {
    cacheDir = mkdtempSync(join(tmpdir(), "matrizes-cache-"));
    biblioteca = mkdtempSync(join(tmpdir(), "matrizes-lib-"));
    copyFileSync(join(fixtures, "FLOR.pes"), join(biblioteca, "FLOR.pes"));
    copyFileSync(join(fixtures, "AFLORAL.pes"), join(biblioteca, "AFLORAL.pes"));
    db = openDatabase(":memory:");
    repo = new LibraryRepository(db);
  });

  afterEach(() => {
    db.close();
    rmSync(cacheDir, { recursive: true, force: true });
    rmSync(biblioteca, { recursive: true, force: true });
  });

  it("religa arquivo movido de pasta, preservando nome, favorita e etiqueta", async () => {
    await importarPasta({ repo, cacheDir }, biblioteca);

    // A usuária personaliza o desenho
    const { itens } = repo.listarMatrizes({ busca: "FLOR" }, ordem);
    const flor = itens.find((i: any) => i.nomeExibido === "FLOR")!;
    repo.editarMatriz(flor.id, { nome_exibido: "Minha flor favorita" });
    repo.setFavorita(flor.id, true);
    repo.adicionarEtiqueta(flor.id, repo.ensureEtiqueta("natal"));

    // ...e depois arruma a pasta: move o arquivo para uma subpasta, com outro nome
    mkdirSync(join(biblioteca, "Flores"));
    renameSync(join(biblioteca, "FLOR.pes"), join(biblioteca, "Flores", "flor-grande.pes"));

    const r = await importarPasta({ repo, cacheDir }, biblioteca);
    expect(r.movidos).toBe(1);
    expect(r.novos).toBe(0);
    expect(r.sumidos).toBe(0);

    // Mesma matriz, com tudo que ela tinha personalizado
    const d = repo.obterDetalhes(flor.id);
    expect(d.nome_exibido).toBe("Minha flor favorita");
    expect(d.favorita).toBe(1);
    expect(d.etiquetas.map((e: any) => e.nome)).toContain("natal");
    expect(d.caminhoAbsoluto).toContain("flor-grande.pes");

    // E a biblioteca continua com dois desenhos (não duplicou)
    expect(repo.listarMatrizes({}, ordem).total).toBe(2);
    // A subpasta nova aparece na navegação
    expect(repo.listarArvorePastas().map((n) => n.nome)).toContain("Flores");
  });

  it("marca como sumido o arquivo apagado, sem tirar nada do catálogo sozinho", async () => {
    await importarPasta({ repo, cacheDir }, biblioteca);
    rmSync(join(biblioteca, "AFLORAL.pes"));

    const r = await importarPasta({ repo, cacheDir }, biblioteca);
    expect(r.sumidos).toBe(1);

    // Sai da galeria e da árvore de pastas, mas continua guardado
    expect(repo.listarMatrizes({}, ordem).total).toBe(1);
    const sumidos = repo.listarAusentes();
    expect(sumidos).toHaveLength(1);
    expect(sumidos[0].nomeExibido).toBe("AFLORAL");

    // Só sai do catálogo quando a usuária manda
    expect(repo.removerDoCatalogo()).toBe(1);
    expect(repo.listarAusentes()).toHaveLength(0);
    expect(repo.listarMatrizes({}, ordem).total).toBe(1);
  });

  it("um arquivo sumido que volta ao lugar reaparece na galeria", async () => {
    await importarPasta({ repo, cacheDir }, biblioteca);
    copyFileSync(join(biblioteca, "AFLORAL.pes"), join(tmpdir(), "afloral-guardado.pes"));
    rmSync(join(biblioteca, "AFLORAL.pes"));
    await importarPasta({ repo, cacheDir }, biblioteca);
    expect(repo.listarMatrizes({}, ordem).total).toBe(1);

    copyFileSync(join(tmpdir(), "afloral-guardado.pes"), join(biblioteca, "AFLORAL.pes"));
    const r = await importarPasta({ repo, cacheDir }, biblioteca);
    expect(r.sumidos).toBe(0);
    expect(repo.listarMatrizes({}, ordem).total).toBe(2);
    expect(repo.listarAusentes()).toHaveLength(0);
    rmSync(join(tmpdir(), "afloral-guardado.pes"), { force: true });
  });

  it("importação cancelada não marca nada como sumido", async () => {
    await importarPasta({ repo, cacheDir }, biblioteca);
    const r = await importarPasta({ repo, cacheDir }, biblioteca, { cancelado: () => true });
    expect(r.status).toBe("cancelada");
    expect(r.sumidos).toBe(0);
    expect(repo.listarAusentes()).toHaveLength(0);
    expect(repo.listarMatrizes({}, ordem).total).toBe(2);
  });

  it("parar de acompanhar uma pasta tira os desenhos dela do catálogo", async () => {
    await importarPasta({ repo, cacheDir }, biblioteca);
    const pasta = repo.listarPastas()[0];
    expect(pasta.total).toBe(2);

    expect(repo.removerPasta(pasta.id)).toBe(2);
    expect(repo.listarMatrizes({}, ordem).total).toBe(0);
    expect(repo.listarPastas()).toHaveLength(0);
    // A busca (FTS) também some junto — nada de resultado fantasma
    expect(repo.listarMatrizes({ busca: "flor" }, ordem).total).toBe(0);
  });
});

describe("paginação da galeria", () => {
  it("percorre a biblioteca inteira em levas, sem repetir nem pular", async () => {
    const cacheDir = mkdtempSync(join(tmpdir(), "matrizes-cache-"));
    const db = openDatabase(":memory:");
    const repo = new LibraryRepository(db);
    await importarPasta({ repo, cacheDir }, fixtures);

    const ordem = { campo: "nome", direcao: "asc" } as const;
    const vistos: number[] = [];
    let total = 0;
    for (let offset = 0; ; offset += 10) {
      const pagina = repo.listarMatrizes({}, ordem, { offset, limite: 10 });
      total = pagina.total;
      if (!pagina.itens.length) break;
      vistos.push(...pagina.itens.map((i: any) => i.id));
    }

    expect(total).toBe(37);
    expect(vistos).toHaveLength(37);
    expect(new Set(vistos).size).toBe(37);

    db.close();
    rmSync(cacheDir, { recursive: true, force: true });
  });
});
