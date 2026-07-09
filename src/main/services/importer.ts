/**
 * Orquestrador de importação: varre uma pasta, processa cada arquivo novo ou
 * alterado (hash → leitura → miniatura → banco) e reporta progresso. Preserva
 * totalmente os arquivos originais (somente leitura) e a organização da usuária
 * (só os metadados técnicos do arquivo são reescritos).
 */
import { readFile } from "node:fs/promises";
import type { LibraryRepository, DadosImportacao } from "../db/repository.ts";
import { scanFolder, type ArquivoEncontrado } from "../filesystem/scan.ts";
import { hashFile } from "../filesystem/hash.ts";
import { readPes } from "../embroidery/reader.ts";
import { ensureThumbnail } from "../thumbnails/cache.ts";
import { THUMB_SIZES } from "../thumbnails/render.ts";
import { sugerirBastidor } from "./bastidores.ts";

export interface ProgressoImportacao {
  fase: "varrendo" | "processando" | "gravando";
  total: number;
  processados: number;
  novos: number;
  atualizados: number;
  erros: number;
  arquivoAtual: string | null;
}

export interface ResultadoImportacao {
  status: "concluida" | "cancelada";
  total: number;
  novos: number;
  atualizados: number;
  inalterados: number;
  erros: number;
  duracaoMs: number;
  importacaoId: number;
}

export interface ImporterDeps {
  repo: LibraryRepository;
  cacheDir: string;
}

export interface ImportOptions {
  extensoes?: string[];
  concorrencia?: number;
  onProgresso?: (p: ProgressoImportacao) => void;
  cancelado?: () => boolean;
}

/** Executa uma tarefa por item respeitando um limite de concorrência. */
async function comLimite<T>(
  itens: T[],
  limite: number,
  tarefa: (item: T, index: number) => Promise<void>,
  cancelado?: () => boolean,
): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, limite) }, async () => {
    while (cursor < itens.length) {
      if (cancelado?.()) return;
      const i = cursor++;
      await tarefa(itens[i], i);
    }
  });
  await Promise.all(workers);
}

export async function importarPasta(
  deps: ImporterDeps,
  raiz: string,
  options: ImportOptions = {},
): Promise<ResultadoImportacao> {
  const { repo, cacheDir } = deps;
  const inicio = Date.now();
  const pastaId = repo.ensurePasta(raiz);
  const importacaoId = repo.iniciarImportacao(pastaId);

  const contadores = { novos: 0, atualizados: 0, inalterados: 0, erros: 0, processados: 0 };
  let arquivoAtual: string | null = null;

  const emitir = (fase: ProgressoImportacao["fase"], total: number) =>
    options.onProgresso?.({
      fase,
      total,
      processados: contadores.processados,
      novos: contadores.novos,
      atualizados: contadores.atualizados,
      erros: contadores.erros,
      arquivoAtual,
    });

  // 1. Varredura
  emitir("varrendo", 0);
  const encontrados = await scanFolder(raiz, {
    extensoes: options.extensoes,
    onErro: (caminho, erro) => repo.registrarErro(importacaoId, caminho, "scan", erro.message),
    onProgresso: () => emitir("varrendo", 0),
    cancelado: options.cancelado,
  });
  const total = encontrados.length;
  emitir("processando", total);

  // 2. Processamento com limite de concorrência
  const processarUm = async (f: ArquivoEncontrado) => {
    arquivoAtual = f.nomeOriginal;
    try {
      const existente = repo.findArquivoByPath(f.caminhoAbsoluto);
      if (
        existente &&
        existente.status_processamento === "ok" &&
        existente.tamanho_bytes === f.tamanhoBytes &&
        existente.modificado_em_fs === f.modificadoEmFs
      ) {
        contadores.inalterados++;
        return; // inalterado → não reprocessa nem re-hasheia
      }

      const hash = await hashFile(f.caminhoAbsoluto);

      let arquivoId: number;
      if (!existente) {
        const dados: DadosImportacao = {
          pastaId,
          caminhoAbsoluto: f.caminhoAbsoluto,
          caminhoRelativo: f.caminhoRelativo,
          nomeOriginal: f.nomeOriginal,
          extensao: f.extensao,
          hash,
          tamanhoBytes: f.tamanhoBytes,
          criadoEmFs: f.criadoEmFs,
          modificadoEmFs: f.modificadoEmFs,
        };
        arquivoId = repo.inserirMatrizComArquivo(dados).arquivoId;
        contadores.novos++;
      } else {
        repo.atualizarConteudoArquivo(existente.id, hash, f.tamanhoBytes, f.modificadoEmFs);
        arquivoId = existente.id;
        contadores.atualizados++;
      }

      // Leitura + metadados
      const buf = await readFile(f.caminhoAbsoluto);
      const design = readPes(buf);
      repo.gravarMetadados(arquivoId, {
        larguraMm: design.larguraMm,
        alturaMm: design.alturaMm,
        numPontos: design.numPontos,
        numCores: design.numCores,
        versaoFormato: design.versao != null ? `PES ${design.versao}` : null,
        bastidorSugerido: sugerirBastidor(design.larguraMm, design.alturaMm),
      });

      // Miniaturas (com cache por hash)
      for (const size of [THUMB_SIZES.grade, THUMB_SIZES.detalhe]) {
        const caminho = await ensureThumbnail(cacheDir, hash, size, design);
        repo.registrarMiniatura(hash, size, caminho);
      }
    } catch (e) {
      contadores.erros++;
      const existente = repo.findArquivoByPath(f.caminhoAbsoluto);
      if (existente) repo.marcarErro(existente.id);
      repo.registrarErro(importacaoId, f.caminhoAbsoluto, "parse", (e as Error).message);
    } finally {
      contadores.processados++;
      if (contadores.processados % 10 === 0 || contadores.processados === total) {
        emitir("processando", total);
      }
    }
  };

  await comLimite(encontrados, options.concorrencia ?? 4, processarUm, options.cancelado);

  const cancelada = options.cancelado?.() ?? false;
  const duracaoMs = Date.now() - inicio;
  repo.finalizarImportacao(importacaoId, {
    status: cancelada ? "cancelada" : "concluida",
    total,
    novos: contadores.novos,
    atualizados: contadores.atualizados,
    removidos: 0,
    erros: contadores.erros,
    duracaoMs,
  });
  emitir("processando", total);

  return {
    status: cancelada ? "cancelada" : "concluida",
    total,
    novos: contadores.novos,
    atualizados: contadores.atualizados,
    inalterados: contadores.inalterados,
    erros: contadores.erros,
    duracaoMs,
    importacaoId,
  };
}
