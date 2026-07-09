/**
 * Migrações do banco SQLite. Cada entrada roda uma vez, em ordem de `version`,
 * registrada em `schema_migrations`. Nunca edite uma migração já publicada —
 * adicione uma nova.
 */
import type { Database } from "better-sqlite3";

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: "init",
    sql: `
    CREATE TABLE formatos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      extensao TEXT NOT NULL UNIQUE COLLATE NOCASE,
      nome TEXT,
      suportado INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE pastas_monitoradas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      caminho TEXT NOT NULL UNIQUE,
      apelido TEXT,
      ativa INTEGER NOT NULL DEFAULT 1,
      criada_em TEXT NOT NULL,
      ultima_varredura_em TEXT
    );

    CREATE TABLE categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL COLLATE NOCASE,
      pai_id INTEGER REFERENCES categorias(id) ON DELETE CASCADE,
      icone TEXT,
      ordem INTEGER NOT NULL DEFAULT 0,
      UNIQUE(nome, pai_id)
    );

    CREATE TABLE etiquetas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL COLLATE NOCASE,
      dimensao TEXT NOT NULL DEFAULT 'geral',
      cor TEXT,
      UNIQUE(nome, dimensao)
    );

    CREATE TABLE colecoes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE COLLATE NOCASE,
      descricao TEXT
    );

    CREATE TABLE fornecedores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE COLLATE NOCASE,
      site TEXT,
      observacoes TEXT
    );

    CREATE TABLE status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE COLLATE NOCASE,
      cor TEXT,
      sistema INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE matrizes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome_exibido TEXT NOT NULL,
      categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
      fornecedor_id INTEGER REFERENCES fornecedores(id) ON DELETE SET NULL,
      colecao_id INTEGER REFERENCES colecoes(id) ON DELETE SET NULL,
      status_id INTEGER REFERENCES status(id) ON DELETE SET NULL,
      favorita INTEGER NOT NULL DEFAULT 0,
      testada INTEGER NOT NULL DEFAULT 0,
      observacoes TEXT,
      bastidor_sugerido TEXT,
      criada_em TEXT NOT NULL,
      atualizada_em TEXT NOT NULL
    );

    CREATE TABLE arquivos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      matriz_id INTEGER NOT NULL REFERENCES matrizes(id) ON DELETE CASCADE,
      pasta_monitorada_id INTEGER NOT NULL REFERENCES pastas_monitoradas(id) ON DELETE CASCADE,
      formato_id INTEGER NOT NULL REFERENCES formatos(id),
      nome_original TEXT NOT NULL,
      caminho_absoluto TEXT NOT NULL UNIQUE,
      caminho_relativo TEXT NOT NULL,
      extensao TEXT NOT NULL,
      hash_sha256 TEXT NOT NULL,
      tamanho_bytes INTEGER NOT NULL,
      criado_em_fs TEXT,
      modificado_em_fs TEXT,
      largura_mm REAL,
      altura_mm REAL,
      unidade TEXT NOT NULL DEFAULT 'mm',
      num_pontos INTEGER,
      num_cores INTEGER,
      versao_formato TEXT,
      status_processamento TEXT NOT NULL DEFAULT 'pendente',
      analisado_em TEXT
    );

    CREATE TABLE matriz_etiquetas (
      matriz_id INTEGER NOT NULL REFERENCES matrizes(id) ON DELETE CASCADE,
      etiqueta_id INTEGER NOT NULL REFERENCES etiquetas(id) ON DELETE CASCADE,
      PRIMARY KEY (matriz_id, etiqueta_id)
    );

    CREATE TABLE miniaturas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hash_sha256 TEXT NOT NULL,
      tamanho_px INTEGER NOT NULL,
      caminho_cache TEXT NOT NULL,
      gerada_em TEXT,
      UNIQUE(hash_sha256, tamanho_px)
    );

    CREATE TABLE configuracoes (
      chave TEXT PRIMARY KEY,
      valor TEXT
    );

    CREATE TABLE historico_importacao (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pasta_monitorada_id INTEGER REFERENCES pastas_monitoradas(id) ON DELETE SET NULL,
      iniciada_em TEXT NOT NULL,
      finalizada_em TEXT,
      status TEXT NOT NULL DEFAULT 'em_andamento',
      total_encontrados INTEGER NOT NULL DEFAULT 0,
      novos INTEGER NOT NULL DEFAULT 0,
      atualizados INTEGER NOT NULL DEFAULT 0,
      removidos INTEGER NOT NULL DEFAULT 0,
      erros INTEGER NOT NULL DEFAULT 0,
      duracao_ms INTEGER
    );

    CREATE TABLE erros_processamento (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      importacao_id INTEGER REFERENCES historico_importacao(id) ON DELETE SET NULL,
      caminho_absoluto TEXT NOT NULL,
      etapa TEXT,
      mensagem TEXT,
      ocorrido_em TEXT NOT NULL,
      resolvido INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX idx_arquivos_hash ON arquivos(hash_sha256);
    CREATE INDEX idx_arquivos_matriz ON arquivos(matriz_id);
    CREATE INDEX idx_arquivos_pasta ON arquivos(pasta_monitorada_id);
    CREATE INDEX idx_arquivos_status ON arquivos(status_processamento);
    CREATE INDEX idx_matrizes_categoria ON matrizes(categoria_id);
    CREATE INDEX idx_matrizes_status ON matrizes(status_id);
    CREATE INDEX idx_matrizes_flags ON matrizes(favorita, testada);
    CREATE INDEX idx_me_etiqueta ON matriz_etiquetas(etiqueta_id);

    CREATE VIRTUAL TABLE matrizes_fts USING fts5(
      nome, extra, content='', tokenize='unicode61 remove_diacritics 2'
    );
    `,
  },
  {
    version: 2,
    name: "normalizar_separador_caminho_relativo",
    // Padroniza os caminhos relativos já gravados para usar "/" (importações
    // feitas no Windows guardaram "\"), habilitando a navegação por subpastas.
    sql: `UPDATE arquivos SET caminho_relativo = REPLACE(caminho_relativo, char(92), '/');`,
  },
];

/** Aplica as migrações pendentes. Idempotente. */
export function runMigrations(db: Database): number {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    aplicada_em TEXT NOT NULL
  );`);

  const applied = new Set<number>(
    db.prepare("SELECT version FROM schema_migrations").all().map((r: any) => r.version),
  );

  let count = 0;
  const stamp = new Date().toISOString();
  const record = db.prepare(
    "INSERT INTO schema_migrations(version, name, aplicada_em) VALUES (?, ?, ?)",
  );

  for (const m of MIGRATIONS) {
    if (applied.has(m.version)) continue;
    const tx = db.transaction(() => {
      db.exec(m.sql);
      record.run(m.version, m.name, stamp);
    });
    tx();
    count++;
  }
  return count;
}
