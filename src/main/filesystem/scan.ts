/**
 * Varredura recursiva de pastas em busca de arquivos de bordado.
 *
 * Usa uma fila iterativa (não recursão) para não estourar a pilha em árvores
 * muito profundas, e é tolerante a pastas sem permissão (registra e segue).
 */
import { opendir, stat } from "node:fs/promises";
import { join, relative, extname, basename } from "node:path";
import { toLongPath, normalizePath } from "./paths.ts";

export interface ArquivoEncontrado {
  caminhoAbsoluto: string;
  caminhoRelativo: string;
  nomeOriginal: string;
  extensao: string;
  tamanhoBytes: number;
  criadoEmFs: string | null;
  modificadoEmFs: string | null;
}

export interface ScanOptions {
  /** Extensões aceitas, sem ponto e em minúsculas. Padrão: ["pes"]. */
  extensoes?: string[];
  /** Chamado quando uma pasta não pode ser lida. */
  onErro?: (caminho: string, erro: Error) => void;
  /** Chamado periodicamente com a contagem parcial de arquivos encontrados. */
  onProgresso?: (encontrados: number) => void;
  /** Permite cancelar a varredura. */
  cancelado?: () => boolean;
}

/**
 * Varre `raiz` recursivamente e devolve os arquivos compatíveis.
 * `caminhoRelativo` é relativo a `raiz`.
 */
export async function scanFolder(
  raiz: string,
  options: ScanOptions = {},
): Promise<ArquivoEncontrado[]> {
  const exts = new Set((options.extensoes ?? ["pes"]).map((e) => e.replace(/^\./, "").toLowerCase()));
  const encontrados: ArquivoEncontrado[] = [];
  const pilha: string[] = [raiz];

  while (pilha.length > 0) {
    if (options.cancelado?.()) break;
    const dir = pilha.pop()!;
    let handle;
    try {
      handle = await opendir(toLongPath(dir));
    } catch (e) {
      options.onErro?.(dir, e as Error);
      continue;
    }
    try {
      for await (const entry of handle) {
        if (options.cancelado?.()) break;
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          pilha.push(full);
        } else if (entry.isFile()) {
          const ext = extname(entry.name).replace(/^\./, "").toLowerCase();
          if (!exts.has(ext)) continue;
          try {
            const st = await stat(toLongPath(full));
            encontrados.push({
              caminhoAbsoluto: normalizePath(full),
              // caminho relativo sempre com "/" (independente do SO) para a
              // navegação por subpastas funcionar igual no Windows e demais.
              caminhoRelativo: normalizePath(relative(raiz, full)).replaceAll("\\", "/"),
              nomeOriginal: basename(full),
              extensao: ext,
              tamanhoBytes: st.size,
              criadoEmFs: st.birthtime ? st.birthtime.toISOString() : null,
              modificadoEmFs: st.mtime ? st.mtime.toISOString() : null,
            });
            if (encontrados.length % 200 === 0) options.onProgresso?.(encontrados.length);
          } catch (e) {
            options.onErro?.(full, e as Error);
          }
        }
      }
    } catch (e) {
      options.onErro?.(dir, e as Error);
    }
  }

  options.onProgresso?.(encontrados.length);
  return encontrados;
}
