/**
 * Repositório de acesso ao banco. Concentra toda a lógica de leitura/escrita
 * sobre o SQLite, deixando os serviços (importação, cópia) e o IPC agnósticos
 * ao SQL.
 */
import type { Database as DB } from "better-sqlite3";

export interface ArquivoRow {
  id: number;
  matriz_id: number;
  caminho_absoluto: string;
  hash_sha256: string;
  tamanho_bytes: number;
  modificado_em_fs: string | null;
  status_processamento: string;
}

export interface DadosImportacao {
  pastaId: number;
  caminhoAbsoluto: string;
  caminhoRelativo: string;
  nomeOriginal: string;
  extensao: string;
  hash: string;
  tamanhoBytes: number;
  criadoEmFs: string | null;
  modificadoEmFs: string | null;
}

export interface MetadadosDesenho {
  larguraMm: number | null;
  alturaMm: number | null;
  numPontos: number | null;
  numCores: number | null;
  versaoFormato: string | null;
  bastidorSugerido: string | null;
}

export interface FiltrosBusca {
  busca?: string;
  categoriaId?: number | null;
  etiquetaIds?: number[];
  statusId?: number | null;
  favorita?: boolean | null;
  testada?: boolean | null;
  pastaId?: number | null;
  /** Prefixo de subpasta (relativo), ex.: "Natal/Frames". Filtra recursivamente. */
  subpasta?: string | null;
  formato?: string | null;
  maxLarguraMm?: number | null;
  maxAlturaMm?: number | null;
}

/**
 * Status de um arquivo cujo original não está mais no lugar. A linha é mantida
 * (preserva favoritas, etiquetas e nome dado pela usuária) mas sai da galeria;
 * aparece na tela "Sumidos", de onde pode ser removida do catálogo.
 */
export const STATUS_AUSENTE = "ausente";

export interface PastaNode {
  nome: string;
  caminho: string;
  total: number;
  filhos: PastaNode[];
}

export interface Ordenacao {
  campo: "nome" | "data" | "tamanho" | "pontos";
  direcao: "asc" | "desc";
}

const SORT_COLUMNS: Record<Ordenacao["campo"], string> = {
  nome: "m.nome_exibido",
  data: "m.criada_em",
  tamanho: "(a.largura_mm * a.altura_mm)",
  pontos: "a.num_pontos",
};

export class LibraryRepository {
  constructor(private db: DB) {}

  // ---- Formatos / pastas -------------------------------------------------

  getFormatoId(extensao: string): number {
    const ext = extensao.replace(/^\./, "").toLowerCase();
    const row = this.db.prepare("SELECT id FROM formatos WHERE extensao = ?").get(ext) as
      | { id: number }
      | undefined;
    if (row) return row.id;
    const info = this.db
      .prepare("INSERT INTO formatos(extensao, nome, suportado) VALUES (?, ?, 0)")
      .run(ext, ext.toUpperCase());
    return Number(info.lastInsertRowid);
  }

  ensurePasta(caminho: string, apelido?: string): number {
    const existing = this.db
      .prepare("SELECT id FROM pastas_monitoradas WHERE caminho = ?")
      .get(caminho) as { id: number } | undefined;
    if (existing) return existing.id;
    const info = this.db
      .prepare(
        "INSERT INTO pastas_monitoradas(caminho, apelido, criada_em) VALUES (?, ?, ?)",
      )
      .run(caminho, apelido ?? null, new Date().toISOString());
    return Number(info.lastInsertRowid);
  }

  // ---- Consulta de estado durante a varredura ----------------------------

  findArquivoByPath(caminho: string): ArquivoRow | undefined {
    return this.db
      .prepare(
        `SELECT id, matriz_id, caminho_absoluto, hash_sha256, tamanho_bytes,
                modificado_em_fs, status_processamento
         FROM arquivos WHERE caminho_absoluto = ?`,
      )
      .get(caminho) as ArquivoRow | undefined;
  }

  findArquivoByHash(hash: string): ArquivoRow | undefined {
    return this.db
      .prepare(
        `SELECT id, matriz_id, caminho_absoluto, hash_sha256, tamanho_bytes,
                modificado_em_fs, status_processamento
         FROM arquivos WHERE hash_sha256 = ? LIMIT 1`,
      )
      .get(hash) as ArquivoRow | undefined;
  }

  /**
   * Insere uma matriz + arquivo novos (status 'pendente'). Devolve os ids.
   * O nome exibido inicial é o nome do arquivo sem extensão.
   */
  inserirMatrizComArquivo(dados: DadosImportacao): { matrizId: number; arquivoId: number } {
    const now = new Date().toISOString();
    const nomeExibido = dados.nomeOriginal.replace(/\.[^.]+$/, "");
    const tx = this.db.transaction(() => {
      const m = this.db
        .prepare(
          "INSERT INTO matrizes(nome_exibido, criada_em, atualizada_em) VALUES (?, ?, ?)",
        )
        .run(nomeExibido, now, now);
      const matrizId = Number(m.lastInsertRowid);
      this.atualizarFts(matrizId, nomeExibido, `${dados.nomeOriginal} ${dados.caminhoRelativo}`);
      const a = this.db
        .prepare(
          `INSERT INTO arquivos(
             matriz_id, pasta_monitorada_id, formato_id, nome_original,
             caminho_absoluto, caminho_relativo, extensao, hash_sha256,
             tamanho_bytes, criado_em_fs, modificado_em_fs)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          matrizId,
          dados.pastaId,
          this.getFormatoId(dados.extensao),
          dados.nomeOriginal,
          dados.caminhoAbsoluto,
          dados.caminhoRelativo,
          dados.extensao.replace(/^\./, "").toLowerCase(),
          dados.hash,
          dados.tamanhoBytes,
          dados.criadoEmFs,
          dados.modificadoEmFs,
        );
      return { matrizId, arquivoId: Number(a.lastInsertRowid) };
    });
    return tx();
  }

  /** Religa um arquivo existente (movido/renomeado) ao novo caminho. */
  religarArquivoMovido(arquivoId: number, dados: DadosImportacao): void {
    this.db
      .prepare(
        `UPDATE arquivos SET caminho_absoluto = ?, caminho_relativo = ?,
           nome_original = ?, pasta_monitorada_id = ?, modificado_em_fs = ?
         WHERE id = ?`,
      )
      .run(
        dados.caminhoAbsoluto,
        dados.caminhoRelativo,
        dados.nomeOriginal,
        dados.pastaId,
        dados.modificadoEmFs,
        arquivoId,
      );
  }

  /** Atualiza hash/tamanho/mtime de um arquivo cujo conteúdo mudou. */
  atualizarConteudoArquivo(
    arquivoId: number,
    hash: string,
    tamanhoBytes: number,
    modificadoEmFs: string | null,
  ): void {
    this.db
      .prepare(
        `UPDATE arquivos SET hash_sha256 = ?, tamanho_bytes = ?, modificado_em_fs = ?,
           status_processamento = 'pendente' WHERE id = ?`,
      )
      .run(hash, tamanhoBytes, modificadoEmFs, arquivoId);
  }

  /** Grava os metadados analisados e marca o arquivo como 'ok'. */
  gravarMetadados(arquivoId: number, meta: MetadadosDesenho): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE arquivos SET largura_mm = ?, altura_mm = ?, num_pontos = ?,
           num_cores = ?, versao_formato = ?, status_processamento = 'ok',
           analisado_em = ? WHERE id = ?`,
      )
      .run(
        meta.larguraMm,
        meta.alturaMm,
        meta.numPontos,
        meta.numCores,
        meta.versaoFormato,
        now,
        arquivoId,
      );
    if (meta.bastidorSugerido) {
      const row = this.db
        .prepare("SELECT matriz_id FROM arquivos WHERE id = ?")
        .get(arquivoId) as { matriz_id: number } | undefined;
      if (row) {
        this.db
          .prepare("UPDATE matrizes SET bastidor_sugerido = ? WHERE id = ?")
          .run(meta.bastidorSugerido, row.matriz_id);
      }
    }
  }

  marcarErro(arquivoId: number): void {
    this.db
      .prepare("UPDATE arquivos SET status_processamento = 'erro' WHERE id = ?")
      .run(arquivoId);
  }

  registrarMiniatura(hash: string, tamanhoPx: number, caminhoCache: string): void {
    this.db
      .prepare(
        `INSERT INTO miniaturas(hash_sha256, tamanho_px, caminho_cache, gerada_em)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(hash_sha256, tamanho_px) DO UPDATE SET caminho_cache = excluded.caminho_cache,
           gerada_em = excluded.gerada_em`,
      )
      .run(hash, tamanhoPx, caminhoCache, new Date().toISOString());
  }

  temMiniatura(hash: string, tamanhoPx: number): boolean {
    return !!this.db
      .prepare("SELECT 1 FROM miniaturas WHERE hash_sha256 = ? AND tamanho_px = ?")
      .get(hash, tamanhoPx);
  }

  // ---- FTS ---------------------------------------------------------------

  private atualizarFts(matrizId: number, nome: string, extra: string): void {
    this.db.prepare("DELETE FROM matrizes_fts WHERE rowid = ?").run(matrizId);
    this.db
      .prepare("INSERT INTO matrizes_fts(rowid, nome, extra) VALUES (?, ?, ?)")
      .run(matrizId, nome, extra);
  }

  // ---- Listagem / busca --------------------------------------------------

  listarMatrizes(
    filtros: FiltrosBusca = {},
    ordenacao: Ordenacao = { campo: "nome", direcao: "asc" },
    pagina: { offset: number; limite: number } = { offset: 0, limite: 200 },
  ): { total: number; itens: any[] } {
    // Arquivos sumidos ficam guardados no catálogo, mas fora da galeria: mostrar
    // um card cujo original não existe mais só geraria miniatura quebrada.
    const where: string[] = ["a.status_processamento <> ?"];
    const params: any[] = [STATUS_AUSENTE];

    if (filtros.busca && filtros.busca.trim()) {
      const match = filtros.busca
        .trim()
        .split(/\s+/)
        .map((t) => `"${t.replace(/"/g, '""')}"*`)
        .join(" ");
      where.push("m.id IN (SELECT rowid FROM matrizes_fts WHERE matrizes_fts MATCH ?)");
      params.push(match);
    }
    if (filtros.categoriaId != null) {
      where.push("m.categoria_id = ?");
      params.push(filtros.categoriaId);
    }
    if (filtros.statusId != null) {
      where.push("m.status_id = ?");
      params.push(filtros.statusId);
    }
    if (filtros.favorita != null) {
      where.push("m.favorita = ?");
      params.push(filtros.favorita ? 1 : 0);
    }
    if (filtros.testada != null) {
      where.push("m.testada = ?");
      params.push(filtros.testada ? 1 : 0);
    }
    if (filtros.pastaId != null) {
      where.push("a.pasta_monitorada_id = ?");
      params.push(filtros.pastaId);
    }
    if (filtros.subpasta) {
      // recursivo: tudo que está dentro da subpasta (e subníveis)
      where.push("a.caminho_relativo LIKE ? ESCAPE '\\'");
      const esc = filtros.subpasta.replace(/[%_\\]/g, (c) => "\\" + c);
      params.push(`${esc}/%`);
    }
    if (filtros.formato) {
      where.push("a.extensao = ?");
      params.push(filtros.formato.replace(/^\./, "").toLowerCase());
    }
    if (filtros.maxLarguraMm != null) {
      where.push("a.largura_mm IS NOT NULL AND a.largura_mm <= ?");
      params.push(filtros.maxLarguraMm);
    }
    if (filtros.maxAlturaMm != null) {
      where.push("a.altura_mm IS NOT NULL AND a.altura_mm <= ?");
      params.push(filtros.maxAlturaMm);
    }
    if (filtros.etiquetaIds && filtros.etiquetaIds.length) {
      where.push(
        `m.id IN (SELECT matriz_id FROM matriz_etiquetas WHERE etiqueta_id IN (${filtros.etiquetaIds
          .map(() => "?")
          .join(",")}) GROUP BY matriz_id HAVING COUNT(DISTINCT etiqueta_id) = ?)`,
      );
      params.push(...filtros.etiquetaIds, filtros.etiquetaIds.length);
    }

    const whereSql = `WHERE ${where.join(" AND ")}`;
    const total = (
      this.db
        .prepare(
          `SELECT COUNT(*) AS n FROM matrizes m JOIN arquivos a ON a.matriz_id = m.id ${whereSql}`,
        )
        .get(...params) as { n: number }
    ).n;

    const orderCol = SORT_COLUMNS[ordenacao.campo] ?? SORT_COLUMNS.nome;
    const dir = ordenacao.direcao === "desc" ? "DESC" : "ASC";
    const itens = this.db
      .prepare(
        `SELECT m.id, m.nome_exibido AS nomeExibido, m.favorita, m.testada,
                m.categoria_id AS categoriaId, m.status_id AS statusId,
                a.largura_mm AS larguraMm, a.altura_mm AS alturaMm,
                a.num_pontos AS numPontos, a.num_cores AS numCores,
                a.hash_sha256 AS hash, a.extensao AS formato,
                a.status_processamento AS statusProcessamento,
                (SELECT caminho_cache FROM miniaturas
                   WHERE hash_sha256 = a.hash_sha256 AND tamanho_px = 256 LIMIT 1) AS miniatura256
         FROM matrizes m JOIN arquivos a ON a.matriz_id = m.id
         ${whereSql}
         ORDER BY ${orderCol} ${dir}
         LIMIT ? OFFSET ?`,
      )
      .all(...params, pagina.limite, pagina.offset);

    return { total, itens };
  }

  obterDetalhes(matrizId: number): any | undefined {
    const m = this.db
      .prepare(
        `SELECT m.*, a.caminho_absoluto AS caminhoAbsoluto, a.nome_original AS nomeOriginal,
                a.largura_mm AS larguraMm, a.altura_mm AS alturaMm, a.num_pontos AS numPontos,
                a.num_cores AS numCores, a.versao_formato AS versaoFormato,
                a.hash_sha256 AS hash, a.tamanho_bytes AS tamanhoBytes, a.extensao AS formato,
                a.status_processamento AS statusProcessamento
         FROM matrizes m JOIN arquivos a ON a.matriz_id = m.id WHERE m.id = ?`,
      )
      .get(matrizId);
    if (!m) return undefined;
    const etiquetas = this.db
      .prepare(
        `SELECT e.id, e.nome, e.dimensao FROM etiquetas e
         JOIN matriz_etiquetas me ON me.etiqueta_id = e.id WHERE me.matriz_id = ?`,
      )
      .all(matrizId);
    return { ...m, etiquetas };
  }

  // ---- Edição / organização ----------------------------------------------

  editarMatriz(matrizId: number, campos: Record<string, unknown>): void {
    const permitidos = ["nome_exibido", "categoria_id", "fornecedor_id", "colecao_id",
      "status_id", "observacoes"];
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const [k, v] of Object.entries(campos)) {
      if (permitidos.includes(k)) {
        sets.push(`${k} = ?`);
        params.push(v);
      }
    }
    if (!sets.length) return;
    sets.push("atualizada_em = ?");
    params.push(new Date().toISOString(), matrizId);
    this.db.prepare(`UPDATE matrizes SET ${sets.join(", ")} WHERE id = ?`).run(...params);

    if ("nome_exibido" in campos) {
      const row = this.db
        .prepare(
          `SELECT m.nome_exibido AS nome, a.nome_original AS orig, a.caminho_relativo AS rel
           FROM matrizes m JOIN arquivos a ON a.matriz_id = m.id WHERE m.id = ?`,
        )
        .get(matrizId) as { nome: string; orig: string; rel: string } | undefined;
      if (row) this.atualizarFts(matrizId, row.nome, `${row.orig} ${row.rel}`);
    }
  }

  setFavorita(matrizId: number, favorita: boolean): void {
    this.db
      .prepare("UPDATE matrizes SET favorita = ?, atualizada_em = ? WHERE id = ?")
      .run(favorita ? 1 : 0, new Date().toISOString(), matrizId);
  }

  setTestada(matrizId: number, testada: boolean): void {
    this.db
      .prepare("UPDATE matrizes SET testada = ?, atualizada_em = ? WHERE id = ?")
      .run(testada ? 1 : 0, new Date().toISOString(), matrizId);
  }

  ensureEtiqueta(nome: string, dimensao = "geral"): number {
    const row = this.db
      .prepare("SELECT id FROM etiquetas WHERE nome = ? AND dimensao = ?")
      .get(nome, dimensao) as { id: number } | undefined;
    if (row) return row.id;
    const info = this.db
      .prepare("INSERT INTO etiquetas(nome, dimensao) VALUES (?, ?)")
      .run(nome, dimensao);
    return Number(info.lastInsertRowid);
  }

  adicionarEtiqueta(matrizId: number, etiquetaId: number): void {
    this.db
      .prepare(
        "INSERT OR IGNORE INTO matriz_etiquetas(matriz_id, etiqueta_id) VALUES (?, ?)",
      )
      .run(matrizId, etiquetaId);
  }

  removerEtiqueta(matrizId: number, etiquetaId: number): void {
    this.db
      .prepare("DELETE FROM matriz_etiquetas WHERE matriz_id = ? AND etiqueta_id = ?")
      .run(matrizId, etiquetaId);
  }

  listarCategorias(): any[] {
    return this.db
      .prepare(
        `SELECT c.id, c.nome, c.pai_id AS paiId,
                (SELECT COUNT(*) FROM matrizes m WHERE m.categoria_id = c.id) AS total
         FROM categorias c ORDER BY c.ordem, c.nome`,
      )
      .all();
  }

  listarEtiquetas(): any[] {
    return this.db
      .prepare(
        `SELECT e.id, e.nome, e.dimensao, e.cor,
                (SELECT COUNT(*) FROM matriz_etiquetas me WHERE me.etiqueta_id = e.id) AS total
         FROM etiquetas e ORDER BY e.dimensao, e.nome`,
      )
      .all();
  }

  listarStatus(): any[] {
    return this.db.prepare("SELECT id, nome, cor, sistema FROM status ORDER BY id").all();
  }

  /** Monta a árvore de subpastas (a partir dos caminhos relativos), com contagens recursivas. */
  listarArvorePastas(): PastaNode[] {
    const rows = this.db
      .prepare("SELECT caminho_relativo AS rel FROM arquivos WHERE status_processamento <> ?")
      .all(STATUS_AUSENTE) as Array<{ rel: string }>;

    interface N { nome: string; caminho: string; total: number; filhos: Map<string, N> }
    const raiz = new Map<string, N>();

    for (const { rel } of rows) {
      const partes = rel.split("/");
      partes.pop(); // remove o nome do arquivo
      let nivel = raiz;
      let acum = "";
      for (const parte of partes) {
        if (!parte) continue;
        acum = acum ? `${acum}/${parte}` : parte;
        let node = nivel.get(parte);
        if (!node) {
          node = { nome: parte, caminho: acum, total: 0, filhos: new Map() };
          nivel.set(parte, node);
        }
        node.total++;
        nivel = node.filhos;
      }
    }

    const converter = (m: Map<string, N>): PastaNode[] =>
      [...m.values()]
        .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
        .map((n) => ({ nome: n.nome, caminho: n.caminho, total: n.total, filhos: converter(n.filhos) }));

    return converter(raiz);
  }

  listarPastas(): any[] {
    return this.db
      .prepare(
        `SELECT p.id, p.caminho, p.apelido, p.ativa,
                (SELECT COUNT(*) FROM arquivos a WHERE a.pasta_monitorada_id = p.id) AS total
         FROM pastas_monitoradas p ORDER BY p.criada_em`,
      )
      .all();
  }

  // ---- Cópia --------------------------------------------------------------

  obterArquivosPorMatrizes(ids: number[]): Array<{
    matrizId: number;
    caminhoAbsoluto: string;
    nomeOriginal: string;
    hash: string;
    tamanhoBytes: number;
    larguraMm: number | null;
    alturaMm: number | null;
  }> {
    if (!ids.length) return [];
    const placeholders = ids.map(() => "?").join(",");
    return this.db
      .prepare(
        `SELECT m.id AS matrizId, a.caminho_absoluto AS caminhoAbsoluto,
                a.nome_original AS nomeOriginal, a.hash_sha256 AS hash,
                a.tamanho_bytes AS tamanhoBytes, a.largura_mm AS larguraMm,
                a.altura_mm AS alturaMm
         FROM matrizes m JOIN arquivos a ON a.matriz_id = m.id
         WHERE m.id IN (${placeholders})`,
      )
      .all(...ids) as any;
  }

  /** Caminho absoluto de um arquivo pelo hash do conteúdo (para regenerar miniatura). */
  obterCaminhoPorHash(hash: string): string | undefined {
    const row = this.db
      .prepare("SELECT caminho_absoluto AS c FROM arquivos WHERE hash_sha256 = ? LIMIT 1")
      .get(hash) as { c: string } | undefined;
    return row?.c;
  }

  // ---- Duplicados / erros ------------------------------------------------

  listarDuplicadosPorHash(): any[] {
    return this.db
      .prepare(
        `SELECT hash_sha256 AS hash, COUNT(*) AS quantidade,
                GROUP_CONCAT(caminho_absoluto, '|') AS caminhos
         FROM arquivos WHERE status_processamento <> ?
         GROUP BY hash_sha256 HAVING COUNT(*) > 1
         ORDER BY quantidade DESC`,
      )
      .all(STATUS_AUSENTE);
  }

  // ---- Arquivos sumidos (original não está mais no lugar) -----------------

  /** Todos os arquivos catalogados de uma pasta monitorada (para achar sumidos). */
  listarArquivosDaPasta(pastaId: number): Array<{
    id: number;
    caminhoAbsoluto: string;
    hash: string;
    status: string;
  }> {
    return this.db
      .prepare(
        `SELECT id, caminho_absoluto AS caminhoAbsoluto, hash_sha256 AS hash,
                status_processamento AS status
         FROM arquivos WHERE pasta_monitorada_id = ?`,
      )
      .all(pastaId) as any;
  }

  marcarAusente(arquivoId: number): void {
    this.db
      .prepare("UPDATE arquivos SET status_processamento = ? WHERE id = ?")
      .run(STATUS_AUSENTE, arquivoId);
  }

  listarAusentes(): any[] {
    return this.db
      .prepare(
        `SELECT m.id AS matrizId, m.nome_exibido AS nomeExibido,
                a.caminho_absoluto AS caminho, a.hash_sha256 AS hash
         FROM matrizes m JOIN arquivos a ON a.matriz_id = m.id
         WHERE a.status_processamento = ?
         ORDER BY m.nome_exibido COLLATE NOCASE`,
      )
      .all(STATUS_AUSENTE);
  }

  /**
   * Apaga do catálogo as matrizes indicadas (linhas do banco apenas — os
   * arquivos de bordado nunca são tocados; no caso dos sumidos eles já não
   * existem mais no disco). Sem ids, remove todos os sumidos.
   */
  removerDoCatalogo(matrizIds?: number[]): number {
    if (matrizIds && !matrizIds.length) return 0;
    const tx = this.db.transaction(() => {
      const alvos: number[] = matrizIds
        ? matrizIds
        : (
            this.db
              .prepare(
                `SELECT m.id AS id FROM matrizes m JOIN arquivos a ON a.matriz_id = m.id
                 WHERE a.status_processamento = ?`,
              )
              .all(STATUS_AUSENTE) as Array<{ id: number }>
          ).map((r) => r.id);
      if (!alvos.length) return 0;
      const ph = alvos.map(() => "?").join(",");
      // arquivos/etiquetas saem por ON DELETE CASCADE; a FTS não tem gatilho.
      this.db.prepare(`DELETE FROM matrizes_fts WHERE rowid IN (${ph})`).run(...alvos);
      this.db.prepare(`DELETE FROM matrizes WHERE id IN (${ph})`).run(...alvos);
      return alvos.length;
    });
    return tx();
  }

  /** Marca como resolvidos os erros registrados (antes de tentar de novo). */
  limparErros(): void {
    this.db.prepare("UPDATE erros_processamento SET resolvido = 1 WHERE resolvido = 0").run();
  }

  /** Remove uma pasta monitorada e tudo que veio dela (só linhas do banco). */
  removerPasta(pastaId: number): number {
    const tx = this.db.transaction(() => {
      const ids = (
        this.db
          .prepare("SELECT DISTINCT matriz_id AS id FROM arquivos WHERE pasta_monitorada_id = ?")
          .all(pastaId) as Array<{ id: number }>
      ).map((r) => r.id);
      if (ids.length) {
        const ph = ids.map(() => "?").join(",");
        this.db.prepare(`DELETE FROM matrizes_fts WHERE rowid IN (${ph})`).run(...ids);
        this.db.prepare(`DELETE FROM matrizes WHERE id IN (${ph})`).run(...ids);
      }
      this.db.prepare("DELETE FROM pastas_monitoradas WHERE id = ?").run(pastaId);
      return ids.length;
    });
    return tx();
  }

  // ---- Histórico de importação -------------------------------------------

  iniciarImportacao(pastaId: number): number {
    const info = this.db
      .prepare(
        "INSERT INTO historico_importacao(pasta_monitorada_id, iniciada_em) VALUES (?, ?)",
      )
      .run(pastaId, new Date().toISOString());
    return Number(info.lastInsertRowid);
  }

  finalizarImportacao(
    importacaoId: number,
    resumo: { status: string; total: number; novos: number; atualizados: number; removidos: number; erros: number; duracaoMs: number },
  ): void {
    this.db
      .prepare(
        `UPDATE historico_importacao SET finalizada_em = ?, status = ?,
           total_encontrados = ?, novos = ?, atualizados = ?, removidos = ?,
           erros = ?, duracao_ms = ? WHERE id = ?`,
      )
      .run(
        new Date().toISOString(),
        resumo.status,
        resumo.total,
        resumo.novos,
        resumo.atualizados,
        resumo.removidos,
        resumo.erros,
        resumo.duracaoMs,
        importacaoId,
      );
  }

  registrarErro(
    importacaoId: number | null,
    caminho: string,
    etapa: string,
    mensagem: string,
  ): void {
    this.db
      .prepare(
        `INSERT INTO erros_processamento(importacao_id, caminho_absoluto, etapa, mensagem, ocorrido_em)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(importacaoId, caminho, etapa, mensagem, new Date().toISOString());
  }

  listarErros(pagina = { offset: 0, limite: 100 }): any[] {
    return this.db
      .prepare(
        `SELECT id, caminho_absoluto AS caminho, etapa, mensagem, ocorrido_em AS ocorridoEm
         FROM erros_processamento WHERE resolvido = 0 ORDER BY ocorrido_em DESC
         LIMIT ? OFFSET ?`,
      )
      .all(pagina.limite, pagina.offset);
  }
}
