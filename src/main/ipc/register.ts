/**
 * Registro dos handlers de IPC. Cada canal corresponde a um método do contrato
 * (src/shared/contracts.ts). O renderer nunca acessa banco ou disco direto.
 */
import { app, ipcMain, dialog, shell, BrowserWindow } from "electron";
import type { LibraryRepository } from "../db/repository.ts";
import { importarPasta, type ResultadoImportacao } from "../services/importer.ts";
import { copiarParaDestino, EspacoInsuficienteError } from "../services/copier.ts";
import { listarDrivesRemoviveis } from "../filesystem/drives.ts";

export interface IpcContext {
  repo: LibraryRepository;
  cacheDir: string;
  dirBackups: string;
  getWindow: () => BrowserWindow | null;
}

export function registrarIpc(ctx: IpcContext): void {
  const { repo, cacheDir } = ctx;

  // Cancelamento: a importação em curso consulta esta bandeira entre arquivos.
  let cancelarPedido = false;

  const rodarImportacao = async (caminhos: string[]): Promise<ResultadoImportacao> => {
    cancelarPedido = false;
    const soma: ResultadoImportacao = {
      status: "concluida", total: 0, novos: 0, atualizados: 0, inalterados: 0,
      movidos: 0, sumidos: 0, erros: 0, duracaoMs: 0, importacaoId: 0,
    };
    for (const caminho of caminhos) {
      const r = await importarPasta({ repo, cacheDir }, caminho, {
        cancelado: () => cancelarPedido,
        onProgresso: (p) => ctx.getWindow()?.webContents.send("importacao:progresso", p),
      });
      soma.total += r.total;
      soma.novos += r.novos;
      soma.atualizados += r.atualizados;
      soma.inalterados += r.inalterados;
      soma.movidos += r.movidos;
      soma.sumidos += r.sumidos;
      soma.erros += r.erros;
      soma.duracaoMs += r.duracaoMs;
      soma.importacaoId = r.importacaoId;
      if (r.status === "cancelada") {
        soma.status = "cancelada";
        break;
      }
    }
    return soma;
  };

  ipcMain.handle("selecionarPasta", async () => {
    const win = ctx.getWindow();
    const res = await dialog.showOpenDialog(win!, {
      title: "Escolha a pasta com seus bordados",
      properties: ["openDirectory"],
    });
    return res.canceled || res.filePaths.length === 0 ? null : res.filePaths[0];
  });

  ipcMain.handle("importarPasta", (_e, caminho: string) => rodarImportacao([caminho]));

  ipcMain.handle("atualizarBiblioteca", () =>
    rodarImportacao(repo.listarPastas().filter((p: any) => p.ativa).map((p: any) => p.caminho)),
  );

  // "Tentar de novo": zera a lista de problemas e revarre. Quem falhar de novo
  // volta para a lista; quem tiver sido consertado sai dela.
  ipcMain.handle("reprocessarErros", () => {
    repo.limparErros();
    return rodarImportacao(
      repo.listarPastas().filter((p: any) => p.ativa).map((p: any) => p.caminho),
    );
  });

  ipcMain.handle("cancelarImportacao", () => {
    cancelarPedido = true;
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
  ipcMain.handle("listarSumidos", () => repo.listarAusentes());
  ipcMain.handle("removerDoCatalogo", (_e, matrizIds?: number[]) =>
    repo.removerDoCatalogo(matrizIds),
  );
  ipcMain.handle("removerPasta", (_e, pastaId: number) => repo.removerPasta(pastaId));

  ipcMain.handle("infoApp", () => ({
    versao: app.getVersion(),
    pastaDados: app.getPath("userData"),
    pastaBackups: ctx.dirBackups,
  }));

  ipcMain.handle("abrirLocal", (_e, matrizId: number) => {
    const d = repo.obterDetalhes(matrizId);
    if (d?.caminhoAbsoluto) shell.showItemInFolder(d.caminhoAbsoluto);
  });

  ipcMain.handle("revelarCaminho", (_e, caminho: string) => {
    if (caminho) shell.showItemInFolder(caminho);
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
