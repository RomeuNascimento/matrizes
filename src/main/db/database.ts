/**
 * Abertura e preparação do banco SQLite local.
 */
import Database from "better-sqlite3";
import type { Database as DB } from "better-sqlite3";
import { runMigrations } from "./migrations.ts";

/** Status padrão (semeados). "sistema=1" não pode ser removido pela usuária. */
const STATUS_SEED: [string, number][] = [
  ["não testada", 1],
  ["testada", 1],
  ["deu problema", 0],
  ["precisa editar", 0],
  ["já utilizada", 0],
  ["uso pessoal", 0],
  ["uso comercial", 0],
];

/** Etiquetas iniciais por dimensão (todas editáveis). */
const ETIQUETAS_SEED: [string, string][] = [
  ...["Natal", "Páscoa", "Dia das Mães", "Dia dos Pais", "casamento", "batizado", "aniversário"].map(
    (n) => [n, "ocasiao"] as [string, string],
  ),
  ...["toalha", "camiseta", "uniforme", "boné", "fralda", "bolsa", "almofada", "patch", "enxoval"].map(
    (n) => [n, "aplicacao"] as [string, string],
  ),
  ...["aplique", "preenchimento", "redwork", "ponto corrido", "ITH", "quilting", "FSL"].map(
    (n) => [n, "tecnica"] as [string, string],
  ),
];

const CATEGORIAS_SEED = [
  "floral", "infantil", "religioso", "animais", "profissões",
  "casamento", "maternidade", "personagens", "monogramas", "frases",
];

const FORMATOS_SEED: [string, string, number][] = [
  ["pes", "Brother PES", 1],
  ["dst", "Tajima DST", 0],
  ["jef", "Janome JEF", 0],
  ["exp", "Melco EXP", 0],
  ["vp3", "Husqvarna VP3", 0],
  ["pec", "Brother PEC", 0],
  ["xxx", "Singer XXX", 0],
];

function seed(db: DB): void {
  const now = new Date().toISOString();

  const insFormato = db.prepare(
    "INSERT OR IGNORE INTO formatos(extensao, nome, suportado) VALUES (?, ?, ?)",
  );
  for (const [ext, nome, sup] of FORMATOS_SEED) insFormato.run(ext, nome, sup);

  const insStatus = db.prepare("INSERT OR IGNORE INTO status(nome, sistema) VALUES (?, ?)");
  for (const [nome, sis] of STATUS_SEED) insStatus.run(nome, sis);

  const insCat = db.prepare("INSERT OR IGNORE INTO categorias(nome, ordem) VALUES (?, ?)");
  CATEGORIAS_SEED.forEach((n, i) => insCat.run(n, i));

  const insTag = db.prepare("INSERT OR IGNORE INTO etiquetas(nome, dimensao) VALUES (?, ?)");
  for (const [nome, dim] of ETIQUETAS_SEED) insTag.run(nome, dim);

  db.prepare("INSERT OR IGNORE INTO configuracoes(chave, valor) VALUES ('criado_em', ?)").run(
    JSON.stringify(now),
  );
}

export interface OpenOptions {
  /** Se true, não roda os seeds (útil em alguns testes). */
  skipSeed?: boolean;
}

/** Abre (ou cria) o banco no caminho dado, aplica pragmas, migrações e seeds. */
export function openDatabase(path: string, options: OpenOptions = {}): DB {
  const db = new Database(path);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  runMigrations(db);
  if (!options.skipSeed) seed(db);
  return db;
}
