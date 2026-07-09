/**
 * Registro dos handlers de IPC. Cada canal corresponde a um método do contrato
 * (src/shared/contracts.ts). O renderer nunca acessa banco ou disco direto.
 */
import { ipcMain, dialog, shell, BrowserWindow } from "electron";
import { rename, copyFile, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, dirname, relative, isAbsolute } from "node:path";
import type { LibraryRepository } from "../db/repository.ts";
import { importarPasta } from "../services/importer.ts";
import { copiarParaDestino, EspacoInsuficienteError } from "../services/copier.ts";
import { listarDrivesRemoviveis } from "../filesystem/drives.ts";

export interface IpcContext {
  repo: LibraryRepository;
  cacheDir: string;
  getWindow: () => BrowserWindow | null;
}

export function registrarIpc(ctx: IpcContext): void {
  const { repo, cacheDir } = ctx;

  ipcMain.handle("selecionarPasta", async () => {
    const win = ctx.getWindow();
    const res = await dialog.showOpenDialog(win!, {
      title: "Escolha a pasta com seus bordados",
      properties: ["openDirectory"],
    });
    return res.canceled || res.filePaths.length === 0 ? null : res.filePaths[0];
  });

  ipcMain.handle("importarPasta", async (_e, caminho: string) => {
    return importarPasta({ repo, cacheDir }, caminho, {
      onProgresso: (p) => {
        ctx.getWindow()?.webContents.send("importacao:progresso", p);
      },
    });
  });

  ipcMain.handle("listarMatrizes", (_e, filtros, ordenacao, pagina) =>
    repo.listarMatrizes(filtros, ordenacao, pagina),
  );
  ipcMain.handle("detalhes", (_e, id: number) => repo.obterDetalhes(id));
  ipcMain.handle("editarMatriz", (_e, id: number, campos) => repo.editarMatriz(id, campos));
  ipcMain.handle("favoritar", (_e, id: number, v: boolean) => repo.setFavorita(id, v));
  ipcMain.handle("marcarTestada", (_e, id: number, v: boolean) => repo.setTestada(id, v));

  ipcMain.handle("adicionarEtiqueta", (_e, matrizId: number, nome: string, dimensao: string) => {
    const etiquetaId = repo.ensureEtiqueta(nome, dimensao);
    repo.adicionarEtiqueta(matrizId, etiquetaId);
    return etiquetaId;
  });
  ipcMain.handle("removerEtiqueta", (_e, matrizId: number, etiquetaId: number) =>
    repo.removerEtiqueta(matrizId, etiquetaId),
  );

  ipcMain.handle("listarCategorias", () => repo.listarCategorias());
  ipcMain.handle("listarEtiquetas", () => repo.listarEtiquetas());
  ipcMain.handle("listarStatus", () => repo.listarStatus());
  ipcMain.handle("listarPastas", () => repo.listarPastas());
  ipcMain.handle("listarArvorePastas", () => repo.listarArvorePastas());
  ipcMain.handle("listarDuplicados", () => repo.listarDuplicadosPorHash());
  ipcMain.handle("listarErros", () => repo.listarErros());

  ipcMain.handle("abrirLocal", (_e, matrizId: number) => {
    const d = repo.obterDetalhes(matrizId);
    if (d?.caminhoAbsoluto) shell.showItemInFolder(d.caminhoAbsoluto);
  });

  ipcMain.handle("revelarCaminho", (_e, caminho: string) => {
    if (caminho) shell.showItemInFolder(caminho);
  });

  // Move o arquivo original para outra pasta (dentro da mesma pasta monitorada)
  // e atualiza o banco. É a ÚNICA operação que altera os arquivos originais —
  // sempre acionada explicitamente pela usuária, com confirmação no renderer.
  ipcMain.handle("moverArquivo", async (_e, matrizId: number) => {
    const info = repo.obterArquivoParaMover(matrizId);
    if (!info) return { status: "erro", mensagem: "Arquivo não encontrado." };

    const win = ctx.getWindow();
    const res = await dialog.showOpenDialog(win!, {
      title: "Escolha a pasta de destino (dentro da sua biblioteca)",
      defaultPath: dirname(info.caminhoAbsoluto),
      properties: ["openDirectory", "createDirectory"],
    });
    if (res.canceled || !res.filePaths.length) return { status: "cancelado" };

    const destino = res.filePaths[0];
    const novoAbs = join(destino, info.nomeOriginal);
    const rel = relative(info.raiz, novoAbs);
    // Precisa continuar dentro da biblioteca importada (senão sai da navegação).
    if (rel.startsWith("..") || isAbsolute(rel)) return { status: "fora" };
    if (novoAbs === info.caminhoAbsoluto) return { status: "mesma" };
    if (existsSync(novoAbs)) return { status: "existe" };

    try {
      try {
        await rename(info.caminhoAbsoluto, novoAbs);
      } catch (e: any) {
        // Fallback para drives/volumes diferentes (rename falha com EXDEV).
        if (e?.code === "EXDEV") {
          await copyFile(info.caminhoAbsoluto, novoAbs);
          await unlink(info.caminhoAbsoluto);
        } else {
          throw e;
        }
      }
      const novoRel = rel.replaceAll("\\", "/");
      repo.atualizarLocalArquivo(matrizId, novoAbs, novoRel);
      return { status: "ok", novoCaminho: novoAbs };
    } catch (e) {
      return { status: "erro", mensagem: (e as Error).message };
    }
  });

  ipcMain.handle("estadoInicial", () => {
    const pastas = repo.listarPastas();
    return { temBiblioteca: pastas.length > 0 };
  });

  // ---- Cópia para pendrive ----
  ipcMain.handle("listarDrives", () => listarDrivesRemoviveis());

  ipcMain.handle("escolherDestino", async () => {
    const win = ctx.getWindow();
    const res = await dialog.showOpenDialog(win!, {
      title: "Escolha onde copiar",
      properties: ["openDirectory", "createDirectory"],
    });
    return res.canceled || !res.filePaths.length ? null : res.filePaths[0];
  });

  ipcMain.handle(
    "copiarParaPendrive",
    async (_e, matrizIds: number[], destino: string, conflito) => {
      try {
        const r = await copiarParaDestino(repo, matrizIds, destino, {
          conflito,
          onProgresso: (p) => ctx.getWindow()?.webContents.send("copia:progresso", p),
        });
        return { ok: true, resultado: r };
      } catch (e) {
        if (e instanceof EspacoInsuficienteError) {
          return { ok: false, erro: { codigo: "espaco", mensagem: e.message } };
        }
        return { ok: false, erro: { codigo: "falha", mensagem: (e as Error).message } };
      }
    },
  );
}
