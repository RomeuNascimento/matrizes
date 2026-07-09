import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { openDatabase } from "../../src/main/db/database.ts";
import { LibraryRepository } from "../../src/main/db/repository.ts";
import { checarIntegridade, fazerBackup, rotacionarBackups } from "../../src/main/db/backup.ts";

describe("backup e integridade do banco", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "bkp-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("um banco novo passa na verificação de integridade", () => {
    const db = openDatabase(join(dir, "lib.db"));
    expect(checarIntegridade(db)).toBe(true);
    db.close();
  });

  it("faz backup e o backup contém os dados", () => {
    const dbPath = join(dir, "lib.db");
    const db = openDatabase(dbPath);
    const repo = new LibraryRepository(db);
    const pasta = repo.ensurePasta("/lib");
    repo.inserirMatrizComArquivo({
      pastaId: pasta, caminhoAbsoluto: "/lib/a.pes", caminhoRelativo: "a.pes",
      nomeOriginal: "a.pes", extensao: "pes", hash: "h", tamanhoBytes: 1,
      criadoEmFs: null, modificadoEmFs: null,
    });

    const bkpPath = fazerBackup(db, join(dir, "backups"), "2026-01-01T10-00-00Z");
    db.close();
    expect(existsSync(bkpPath)).toBe(true);

    const restaurado = new Database(bkpPath, { readonly: true });
    const n = (restaurado.prepare("SELECT COUNT(*) AS n FROM matrizes").get() as any).n;
    restaurado.close();
    expect(n).toBe(1);
  });

  it("rotaciona mantendo apenas os N mais recentes", () => {
    const db = openDatabase(join(dir, "lib.db"));
    const bdir = join(dir, "backups");
    for (let i = 0; i < 5; i++) fazerBackup(db, bdir, `2026-01-0${i + 1}T00-00-00Z`);
    rotacionarBackups(bdir, 3);
    expect(readdirSync(bdir).filter((f) => f.endsWith(".db")).length).toBe(3);
    db.close();
  });
});
