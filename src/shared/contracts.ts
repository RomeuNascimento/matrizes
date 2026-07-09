/**
 * Contratos entre o processo principal (backend) e a interface (renderer).
 * É a ÚNICA dependência compartilhada entre os dois lados — trocar a
 * implementação do backend não deve exigir mudar o renderer.
 */

export interface MatrizResumo {
  id: number;
  nomeExibido: string;
  favorita: number;
  testada: number;
  categoriaId: number | null;
  statusId: number | null;
  larguraMm: number | null;
  alturaMm: number | null;
  numPontos: number | null;
  numCores: number | null;
  hash: string;
  formato: string;
  statusProcessamento: string;
  miniatura256: string | null;
}

export interface ListaMatrizes {
  total: number;
  itens: MatrizResumo[];
}

export interface FiltrosBusca {
  busca?: string;
  categoriaId?: number | null;
  etiquetaIds?: number[];
  statusId?: number | null;
  favorita?: boolean | null;
  testada?: boolean | null;
  pastaId?: number | null;
  subpasta?: string | null;
  formato?: string | null;
  maxLarguraMm?: number | null;
  maxAlturaMm?: number | null;
}

export interface PastaNode {
  nome: string;
  caminho: string;
  total: number;
  filhos: PastaNode[];
}

export interface Ordenacao {
  campo: "nome" | "data" | "tamanho" | "pontos";
  direcao: "asc" | "desc";
}

export interface Pagina {
  offset: number;
  limite: number;
}

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

export interface Categoria {
  id: number;
  nome: string;
  paiId: number | null;
  total: number;
}
export interface Etiqueta {
  id: number;
  nome: string;
  dimensao: string;
  cor: string | null;
  total: number;
}
export interface Status {
  id: number;
  nome: string;
  cor: string | null;
  sistema: number;
}
export interface Pasta {
  id: number;
  caminho: string;
  apelido: string | null;
  ativa: number;
  total: number;
}
export interface Drive {
  caminho: string;
  rotulo: string;
  livreBytes: number | null;
  removivel: boolean;
}
export interface GrupoDuplicado {
  hash: string;
  quantidade: number;
  /** Caminhos absolutos dos arquivos idênticos, separados por '|'. */
  caminhos: string;
}
export interface ErroProcessamento {
  id: number;
  caminho: string;
  etapa: string;
  mensagem: string;
  ocorridoEm: string;
}

export type ModoConflito = "renomear" | "pular" | "substituir";
export interface ResultadoCopia {
  total: number;
  copiados: number;
  renomeados: number;
  pulados: number;
  erros: number;
  itens: any[];
}
export type RespostaCopia =
  | { ok: true; resultado: ResultadoCopia }
  | { ok: false; erro: { codigo: string; mensagem: string } };

/** Superfície exposta em window.api (via contextBridge). */
export interface AppApi {
  selecionarPasta(): Promise<string | null>;
  importarPasta(caminho: string): Promise<ResultadoImportacao>;
  listarMatrizes(
    filtros: FiltrosBusca,
    ordenacao: Ordenacao,
    pagina: Pagina,
  ): Promise<ListaMatrizes>;
  detalhes(id: number): Promise<any>;
  editarMatriz(id: number, campos: Record<string, unknown>): Promise<void>;
  favoritar(id: number, favorita: boolean): Promise<void>;
  marcarTestada(id: number, testada: boolean): Promise<void>;
  adicionarEtiqueta(matrizId: number, nome: string, dimensao: string): Promise<number>;
  removerEtiqueta(matrizId: number, etiquetaId: number): Promise<void>;
  listarCategorias(): Promise<Categoria[]>;
  listarEtiquetas(): Promise<Etiqueta[]>;
  listarStatus(): Promise<Status[]>;
  listarPastas(): Promise<Pasta[]>;
  listarArvorePastas(): Promise<PastaNode[]>;
  listarDuplicados(): Promise<GrupoDuplicado[]>;
  listarErros(): Promise<ErroProcessamento[]>;
  abrirLocal(matrizId: number): Promise<void>;
  revelarCaminho(caminho: string): Promise<void>;
  estadoInicial(): Promise<{ temBiblioteca: boolean }>;
  listarDrives(): Promise<Drive[]>;
  escolherDestino(): Promise<string | null>;
  copiarParaPendrive(
    matrizIds: number[],
    destino: string,
    conflito: ModoConflito,
  ): Promise<RespostaCopia>;
  onProgresso(cb: (p: ProgressoImportacao) => void): () => void;
  onCopiaProgresso(cb: (p: { total: number; copiados: number; arquivoAtual: string }) => void): () => void;
}
