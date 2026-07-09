/**
 * Backup e verificação de integridade do banco. Requisito de segurança: nunca
 * perder a organização da usuária. O backup usa VACUUM INTO (seguro com WAL) e
 * mantém apenas os N mais recentes.
 */
import type { Database as DB } from "better-sqlite3";
import { join } from "node:path";
import { mkdirSync, readdirSync, statSync, unlinkSync } from "node:fs";

/** Retorna true se o banco passa no PRAGMA integrity_check. */
export function checarIntegridade(db: DB): boolean {
  const linhas = db.pragma("integrity_check") as Array<{ integrity_check: string }>;
  return linhas.length === 1 && linhas[0].integrity_check === "ok";
}

/**
 * Gera um backup do banco em `dir` com carimbo de tempo e devolve o caminho.
 * `timestamp` é injetado (ISO) para manter a função determinística/testável.
 */
export function fazerBackup(db: DB, dir: string, timestamp: string): string {
  mkdirSync(dir, { recursive: true });
  const nome = `library-${timestamp.replace(/[:.]/g, "-")}.db`;
  const destino = join(dir, nome);
  db.exec(`VACUUM INTO '${destino.replace(/'/g, "''")}'`);
  return destino;
}

/** Mantém apenas os `manter` backups mais recentes; apaga o resto. */
export function rotacionarBackups(dir: string, manter = 8): void {
  let arquivos: string[];
  try {
    arquivos = readdirSync(dir).filter((f) => f.startsWith("library-") && f.endsWith(".db"));
  } catch {
    return;
  }
  const ordenados = arquivos
    .map((f) => ({ f, m: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m);
  for (const { f } of ordenados.slice(manter)) {
    try {
      unlinkSync(join(dir, f));
    } catch {
      /* ignora */
    }
  }
}
