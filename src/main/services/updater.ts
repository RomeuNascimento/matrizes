/**
 * Atualização automática (electron-updater + Releases públicos do GitHub).
 *
 * Comportamento pensado para o público-alvo (pouca intimidade com PC):
 * - roda só no app INSTALADO (nunca no `npm run dev`);
 * - baixa a nova versão em segundo plano, sem atrapalhar;
 * - só instala quando a usuária clicar em "Reiniciar agora" — nada acontece
 *   sozinho no meio do uso;
 * - qualquer falha é silenciosa (apenas registrada): sem internet, sem release,
 *   etc. não podem quebrar o app.
 *
 * O repositório é público, então o download não exige token nem senha.
 */
import { app, dialog, type BrowserWindow } from "electron";
import electronUpdater from "electron-updater";

const { autoUpdater } = electronUpdater;

export function iniciarAutoUpdate(getWindow: () => BrowserWindow | null): void {
  // Em desenvolvimento não há release para comparar; não faz nada.
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-downloaded", async (info) => {
    const win = getWindow();
    if (!win) return;
    const versao = (info as { version?: string }).version ?? "";
    const { response } = await dialog.showMessageBox(win, {
      type: "info",
      buttons: ["Reiniciar agora", "Depois"],
      defaultId: 0,
      cancelId: 1,
      title: "Atualização pronta",
      message: `Uma nova versão do Matrizes${versao ? ` (${versao})` : ""} foi baixada.`,
      detail:
        "Deseja reiniciar agora para atualizar? Suas matrizes, favoritas e " +
        "configurações são preservadas — nada é apagado.",
    });
    if (response === 0) autoUpdater.quitAndInstall();
  });

  autoUpdater.on("error", (e) => {
    // Nunca deixar um erro de atualização atrapalhar o uso do app.
    console.error("Auto-update falhou:", (e as Error)?.message ?? e);
  });

  // Verifica ao abrir; se instalou "Depois", instala no próximo fechamento.
  autoUpdater.checkForUpdates().catch((e) => {
    console.error("Não foi possível verificar atualizações:", (e as Error)?.message ?? e);
  });
}
