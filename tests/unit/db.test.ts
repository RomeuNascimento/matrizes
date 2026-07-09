import { describe, it, expect, beforeEach } from "vitest";
import type { Database as DB } from "better-sqlite3";
import { openDatabase } from "../../src/main/db/database.ts";
import { LibraryRepository, type DadosImportacao } from "../../src/main/db/repository.ts";

function importar(repo: LibraryRepository, pastaId: number, nome: string, hash: string): number {
  const dados: DadosImportacao = {
    pastaId,
    caminhoAbsoluto: `/lib/${nome}`,
    caminhoRelativo: nome,
    nomeOriginal: nome,
    extensao: "pes",
    hash,
    tamanhoBytes: 1000,
    criadoEmFs: null,
    modificadoEmFs: "2024-01-01T00:00:00Z",
  };
  const { matrizId, arquivoId } = repo.inserirMatrizComArquivo(dados);
  repo.gravarMetadados(arquivoId, {
    larguraMm: 50,
    alturaMm: 60,
    numPontos: 1000,
    numCores: 3,
    versaoFormato: "PES 1",
    bastidorSugerido: "100x100",
  });
  return matrizId;
}

describe("banco + repositório", () => {
  let db: DB;
  let repo: LibraryRepository;

  beforeEach(() => {
    db = openDatabase(":memory:");
    repo = new LibraryRepository(db);
  });

  it("aplica migrações e seeds", () => {
    expect(repo.listarStatus().length).toBeGreaterThanOrEqual(7);
    expect(repo.listarCategorias().length).toBeGreaterThanOrEqual(10);
    expect(repo.listarEtiquetas().some((e: any) => e.dimensao === "ocasiao")).toBe(true);
  });

  it("importa e lista matrizes", () => {
    const pasta = repo.ensurePasta("/lib");
    importar(repo, pasta, "Coração floral.pes", "hash1");
    const { total, itens } = repo.listarMatrizes();
    expect(total).toBe(1);
    expect(itens[0].nomeExibido).toBe("Coração floral");
    expect(itens[0].larguraMm).toBe(50);
  });

  it("busca por nome ignora acentos e maiúsculas", () => {
    const pasta = repo.ensurePasta("/lib");
    importar(repo, pasta, "Coração.pes", "h1");
    importar(repo, pasta, "Urso.pes", "h2");
    expect(repo.listarMatrizes({ busca: "coracao" }).total).toBe(1);
    expect(repo.listarMatrizes({ busca: "CORA" }).total).toBe(1);
    expect(repo.listarMatrizes({ busca: "urso" }).total).toBe(1);
    expect(repo.listarMatrizes({ busca: "gato" }).total).toBe(0);
  });

  it("favorita e filtra por favorita", () => {
    const pasta = repo.ensurePasta("/lib");
    const id = importar(repo, pasta, "a.pes", "h1");
    importar(repo, pasta, "b.pes", "h2");
    repo.setFavorita(id, true);
    expect(repo.listarMatrizes({ favorita: true }).total).toBe(1);
    expect(repo.listarMatrizes({ favorita: false }).total).toBe(1);
  });

  it("aplica etiquetas e filtra por elas (AND)", () => {
    const pasta = repo.ensurePasta("/lib");
    const id = importar(repo, pasta, "a.pes", "h1");
    const natal = repo.ensureEtiqueta("Natal", "ocasiao");
    const toalha = repo.ensureEtiqueta("toalha", "aplicacao");
    repo.adicionarEtiqueta(id, natal);
    repo.adicionarEtiqueta(id, toalha);
    expect(repo.listarMatrizes({ etiquetaIds: [natal] }).total).toBe(1);
    expect(repo.listarMatrizes({ etiquetaIds: [natal, toalha] }).total).toBe(1);
    const outra = repo.ensureEtiqueta("Páscoa", "ocasiao");
    expect(repo.listarMatrizes({ etiquetaIds: [natal, outra] }).total).toBe(0);
  });

  it("detecta arquivo movido pelo hash", () => {
    const pasta = repo.ensurePasta("/lib");
    importar(repo, pasta, "orig.pes", "hashX");
    const encontrado = repo.findArquivoByHash("hashX");
    expect(encontrado?.caminho_absoluto).toBe("/lib/orig.pes");
  });

  it("monta a árvore de subpastas e filtra por subpasta", () => {
    const pasta = repo.ensurePasta("/lib");
    const inserir = (rel: string) =>
      repo.inserirMatrizComArquivo({
        pastaId: pasta, caminhoAbsoluto: `/lib/${rel}`, caminhoRelativo: rel,
        nomeOriginal: rel.split("/").pop()!, extensao: "pes", hash: rel,
        tamanhoBytes: 1, criadoEmFs: null, modificadoEmFs: null,
      });
    inserir("Natal/Bola/a.pes");
    inserir("Natal/Bola/b.pes");
    inserir("Natal/Arvore/c.pes");
    inserir("Pascoa/d.pes");

    const arvore = repo.listarArvorePastas();
    const natal = arvore.find((n) => n.nome === "Natal")!;
    expect(natal.total).toBe(3); // recursivo
    expect(natal.filhos.map((f) => f.nome).sort()).toEqual(["Arvore", "Bola"]);
    expect(natal.filhos.find((f) => f.nome === "Bola")!.total).toBe(2);

    // filtro recursivo
    expect(repo.listarMatrizes({ subpasta: "Natal" }).total).toBe(3);
    expect(repo.listarMatrizes({ subpasta: "Natal/Bola" }).total).toBe(2);
    expect(repo.listarMatrizes({ subpasta: "Pascoa" }).total).toBe(1);
  });

  it("renomeia o nome exibido e continua buscável", () => {
    const pasta = repo.ensurePasta("/lib");
    const id = importar(repo, pasta, "sem-nome.pes", "hRen");
    // Exercita o caminho DELETE+INSERT da FTS (linha já existente).
    repo.editarMatriz(id, { nome_exibido: "Coração de Natal" });
    expect(repo.obterDetalhes(id).nome_exibido).toBe("Coração de Natal");
    expect(repo.listarMatrizes({ busca: "coracao" }).total).toBe(1);
    expect(repo.listarMatrizes({ busca: "natal" }).total).toBe(1);
  });

  it("move arquivo de pasta: atualiza caminho, subpasta e busca", () => {
    const pasta = repo.ensurePasta("/lib");
    const id = importar(repo, pasta, "moldura.pes", "hMove");

    const info = repo.obterArquivoParaMover(id);
    expect(info?.raiz).toBe("/lib");
    expect(info?.caminhoAbsoluto).toBe("/lib/moldura.pes");

    repo.atualizarLocalArquivo(id, "/lib/Molduras/moldura.pes", "Molduras/moldura.pes");

    const d = repo.obterDetalhes(id);
    expect(d.caminhoAbsoluto).toBe("/lib/Molduras/moldura.pes");
    // aparece na subpasta nova e some da raiz
    expect(repo.listarMatrizes({ subpasta: "Molduras" }).total).toBe(1);
    // continua encontrável pela busca (nome exibido inalterado)
    expect(repo.listarMatrizes({ busca: "moldura" }).total).toBe(1);
  });

  it("agrupa duplicados por hash", () => {
    const pasta = repo.ensurePasta("/lib");
    // dois arquivos com o mesmo conteúdo (mesmo hash), caminhos diferentes
    repo.inserirMatrizComArquivo({
      pastaId: pasta, caminhoAbsoluto: "/lib/x1.pes", caminhoRelativo: "x1.pes",
      nomeOriginal: "x1.pes", extensao: "pes", hash: "dup", tamanhoBytes: 10,
      criadoEmFs: null, modificadoEmFs: null,
    });
    repo.inserirMatrizComArquivo({
      pastaId: pasta, caminhoAbsoluto: "/lib/x2.pes", caminhoRelativo: "x2.pes",
      nomeOriginal: "x2.pes", extensao: "pes", hash: "dup", tamanhoBytes: 10,
      criadoEmFs: null, modificadoEmFs: null,
    });
    const grupos = repo.listarDuplicadosPorHash();
    expect(grupos.length).toBe(1);
    expect(grupos[0].quantidade).toBe(2);
  });
});
