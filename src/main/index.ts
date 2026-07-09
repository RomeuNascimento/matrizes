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
import { thumbPath } from "./thumbnails/cache.ts";

let mainWindow: BrowserWindow | null = null;

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

  const db = openDatabase(dbPath);
  const repo = new LibraryRepository(db);

  // Protocolo thumb://img/<hash>/<size> → arquivo de cache correspondente.
  protocol.handle("thumb", async (request) => {
    try {
      const url = new URL(request.url);
      const [, hash, size] = url.pathname.split("/");
      const file = thumbPath(cacheDir, hash, Number(size));
      const bytes = await readFile(file);
      return new Response(bytes, { headers: { "content-type": "image/png" } });
    } catch {
      return new Response("thumbnail não encontrada", { status: 404 });
    }
  });

  registrarIpc({ repo, cacheDir, getWindow: () => mainWindow });

  criarJanela();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) criarJanela();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
