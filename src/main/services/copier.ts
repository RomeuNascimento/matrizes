/**
 * Cópia segura de matrizes selecionadas para um destino (ex.: pendrive).
 *
 * Regras de segurança (críticas):
 *  - só ESCREVE no destino escolhido; nunca toca nos arquivos originais;
 *  - nunca sobrescreve sem opção explícita ("substituir");
 *  - conflito de nome → cria "nome (2).ext" por padrão;
 *  - duplicado exato (mesmo conteúdo já no destino) → pula;
 *  - copia para arquivo temporário ".part" e só então renomeia + confere
 *    tamanho, de modo que a remoção do pendrive no meio não deixa arquivo
 *    parcial com nome final;
 *  - valida espaço livre antes de começar.
 */
import { copyFile, rename, stat, unlink, mkdir, statfs } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, extname, basename } from "node:path";
import type { LibraryRepository } from "../db/repository.ts";
import { hashFile } from "../filesystem/hash.ts";
import { toLongPath } from "../filesystem/paths.ts";

export type ModoConflito = "renomear" | "pular" | "substituir";

export interface CopiaOptions {
  conflito?: ModoConflito;
  /** Margem de segurança de espaço livre, em bytes (padrão 5%). */
  margemBytes?: number;
  onProgresso?: (p: { total: number; copiados: number; arquivoAtual: string }) => void;
  cancelado?: () => boolean;
}

export interface ItemCopia {
  matrizId: number;
  origem: string;
  destino: string | null;
  resultado: "copiado" | "renomeado" | "pulado_duplicado" | "pulado_existente" | "erro";
  mensagem?: string;
}

export interface ResultadoCopia {
  total: number;
  copiados: number;
  renomeados: number;
  pulados: number;
  erros: number;
  itens: ItemCopia[];
}

export class EspacoInsuficienteError extends Error {}

function nomeAlternativo(dir: string, nome: string): string {
  const ext = extname(nome);
  const base = basename(nome, ext);
  let i = 2;
  let candidato = join(dir, `${base} (${i})${ext}`);
  while (existsSync(toLongPath(candidato))) {
    i++;
    candidato = join(dir, `${base} (${i})${ext}`);
  }
  return candidato;
}

async function espacoLivre(dir: string): Promise<number | null> {
  try {
    const s = await statfs(toLongPath(dir));
    return s.bsize * s.bavail;
  } catch {
    return null; // sem checagem se o SO não suportar
  }
}

export async function copiarParaDestino(
  repo: LibraryRepository,
  matrizIds: number[],
  destino: string,
  options: CopiaOptions = {},
): Promise<ResultadoCopia> {
  const conflito = options.conflito ?? "renomear";
  const arquivos = repo.obterArquivosPorMatrizes(matrizIds);

  await mkdir(toLongPath(destino), { recursive: true });

  // Validação de espaço.
  const totalBytes = arquivos.reduce((s, a) => s + a.tamanhoBytes, 0);
  const margem = options.margemBytes ?? Math.ceil(totalBytes * 0.05);
  const livre = await espacoLivre(destino);
  if (livre != null && livre < totalBytes + margem) {
    throw new EspacoInsuficienteError(
      `Espaço insuficiente no destino: precisa de ~${Math.ceil(
        (totalBytes + margem) / 1e6,
      )} MB, há ${Math.floor(livre / 1e6)} MB livres.`,
    );
  }

  const res: ResultadoCopia = {
    total: arquivos.length, copiados: 0, renomeados: 0, pulados: 0, erros: 0, itens: [],
  };

  for (const a of arquivos) {
    if (options.cancelado?.()) break;
    options.onProgresso?.({ total: arquivos.length, copiados: res.copiados, arquivoAtual: a.nomeOriginal });

    let alvo = join(destino, a.nomeOriginal);
    try {
      if (existsSync(toLongPath(alvo))) {
        // Já existe algo com esse nome no destino.
        const existenteHash = await hashFile(alvo);
        if (existenteHash === a.hash) {
          res.pulados++;
          res.itens.push({ matrizId: a.matrizId, origem: a.caminhoAbsoluto, destino: alvo, resultado: "pulado_duplicado" });
          continue;
        }
        if (conflito === "pular") {
          res.pulados++;
          res.itens.push({ matrizId: a.matrizId, origem: a.caminhoAbsoluto, destino: alvo, resultado: "pulado_existente" });
          continue;
        }
        if (conflito === "renomear") {
          alvo = nomeAlternativo(destino, a.nomeOriginal);
        }
        // "substituir" mantém o mesmo alvo (opt-in explícito).
      }

      const parcial = alvo + ".part";
      await copyFile(toLongPath(a.caminhoAbsoluto), toLongPath(parcial));
      const st = await stat(toLongPath(parcial));
      if (st.size !== a.tamanhoBytes) {
        await unlink(toLongPath(parcial)).catch(() => {});
        throw new Error("cópia incompleta (tamanho divergente)");
      }
      await rename(toLongPath(parcial), toLongPath(alvo));

      const renomeado = basename(alvo) !== a.nomeOriginal;
      if (renomeado) res.renomeados++;
      else res.copiados++;
      res.itens.push({
        matrizId: a.matrizId, origem: a.caminhoAbsoluto, destino: alvo,
        resultado: renomeado ? "renomeado" : "copiado",
      });
    } catch (e) {
      res.erros++;
      res.itens.push({
        matrizId: a.matrizId, origem: a.caminhoAbsoluto, destino: null,
        resultado: "erro", mensagem: (e as Error).message,
      });
    }
  }

  return res;
}
