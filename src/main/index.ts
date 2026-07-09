/**
 * Processo principal do Electron: inicializa banco e cache, registra o
 * protocolo de miniaturas, cria a janela e liga o IPC.
 */
import { app, BrowserWindow, protocol, net } from "electron";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { openDatabase } from "./db/database.ts";
import { LibraryRepository } from "./db/repository.ts";
import { registrarIpc } from "./ipc/register.ts";
import { thumbPath, ensureThumbnail } from "./thumbnails/cache.ts";
import { readPes } from "./embroidery/reader.ts";
import { checarIntegridade, fazerBackup, rotacionarBackups } from "./db/backup.ts";
import type { Database as DB } from "better-sqlite3";

let mainWindow: BrowserWindow | null = null;
let bancoAtual: DB | null = null;
let dirBackups = "";

// O protocolo precisa ser declarado como privilegiado antes de app.ready.
protocol.registerSchemesAsPrivileged([
  { scheme: "thumb", privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function criarJanela(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: "Matrizes",
    backgroundColor: "#e7e2d6",
    webPreferences: {
      preload: join(__dirname, "../preload/index.mjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // preload usa require('electron'); serviços rodam no main
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  const userData = app.getPath("userData");
  const dbPath = join(userData, "library.db");
  const cacheDir = join(userData, "cache", "thumbs");
  dirBackups = join(userData, "backups");

  const db = openDatabase(dbPath);
  if (!checarIntegridade(db)) {
    console.error("Banco falhou na verificação de integridade — verifique backups em", dirBackups);
  }
  bancoAtual = db;
  const repo = new LibraryRepository(db);

  // Protocolo thumb://img/<hash>/<size> → arquivo de cache correspondente.
  protocol.handle("thumb", async (request) => {
    const url = new URL(request.url);
    const [, hash, size] = url.pathname.split("/");
    const sizePx = Number(size);
    const file = thumbPath(cacheDir, hash, sizePx);
    try {
      const bytes = await readFile(file);
      return new Response(bytes, { headers: { "content-type": "image/png" } });
    } catch {
      // Cache ausente: tenta regenerar a partir do arquivo original (auto-cura).
      // Cobre casos em que o PNG foi apagado ou não chegou a ser gravado.
      try {
        const caminho = repo.obterCaminhoPorHash(hash);
        if (!caminho) return new Response("thumbnail não encontrada", { status: 404 });
        const design = readPes(await readFile(caminho));
        await ensureThumbnail(cacheDir, hash, sizePx, design);
        return new Response(await readFile(file), { headers: { "content-type": "image/png" } });
      } catch {
        return new Response("thumbnail não encontrada", { status: 404 });
      }
    }
  });

  registrarIpc({ repo, cacheDir, getWindow: () => mainWindow });

  criarJanela();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) criarJanela();
  });
});

app.on("before-quit", () => {
  // Backup do catálogo ao sair (nunca toca nos arquivos de bordado originais).
  if (bancoAtual && dirBackups) {
    try {
      fazerBackup(bancoAtual, dirBackups, new Date().toISOString());
      rotacionarBackups(dirBackups, 8);
    } catch (e) {
      console.error("Falha ao fazer backup do banco:", (e as Error).message);
    }
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
