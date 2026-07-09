/**
 * Preload: expõe uma superfície mínima e segura (window.api) para o renderer,
 * via contextBridge. Nenhum acesso direto a Node/fs/banco vaza para a página.
 */
import { contextBridge, ipcRenderer } from "electron";
import type { AppApi } from "../shared/contracts.ts";

const api: AppApi = {
  selecionarPasta: () => ipcRenderer.invoke("selecionarPasta"),
  importarPasta: (caminho) => ipcRenderer.invoke("importarPasta", caminho),
  listarMatrizes: (filtros, ordenacao, pagina) =>
    ipcRenderer.invoke("listarMatrizes", filtros, ordenacao, pagina),
  detalhes: (id) => ipcRenderer.invoke("detalhes", id),
  editarMatriz: (id, campos) => ipcRenderer.invoke("editarMatriz", id, campos),
  favoritar: (id, favorita) => ipcRenderer.invoke("favoritar", id, favorita),
  marcarTestada: (id, testada) => ipcRenderer.invoke("marcarTestada", id, testada),
  adicionarEtiqueta: (matrizId, nome, dimensao) =>
    ipcRenderer.invoke("adicionarEtiqueta", matrizId, nome, dimensao),
  removerEtiqueta: (matrizId, etiquetaId) =>
    ipcRenderer.invoke("removerEtiqueta", matrizId, etiquetaId),
  listarCategorias: () => ipcRenderer.invoke("listarCategorias"),
  listarEtiquetas: () => ipcRenderer.invoke("listarEtiquetas"),
  listarStatus: () => ipcRenderer.invoke("listarStatus"),
  listarPastas: () => ipcRenderer.invoke("listarPastas"),
  listarDuplicados: () => ipcRenderer.invoke("listarDuplicados"),
  listarErros: () => ipcRenderer.invoke("listarErros"),
  abrirLocal: (matrizId) => ipcRenderer.invoke("abrirLocal", matrizId),
  estadoInicial: () => ipcRenderer.invoke("estadoInicial"),
  onProgresso: (cb) => {
    const listener = (_e: unknown, p: any) => cb(p);
    ipcRenderer.on("importacao:progresso", listener);
    return () => ipcRenderer.removeListener("importacao:progresso", listener);
  },
};

contextBridge.exposeInMainWorld("api", api);
