/**
 * Lógica da interface. Fala apenas com window.api (contratos), nunca com o
 * sistema diretamente.
 */
import type {
  AppApi, MatrizResumo, FiltrosBusca, Ordenacao, PastaNode, ResultadoImportacao,
  GrupoDuplicado, ErroProcessamento, Etiqueta, ArquivoSumido, Pasta,
} from "../shared/contracts.ts";

declare global {
  interface Window { api: AppApi; }
}
const api = window.api;

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;

/**
 * Substituto do prompt() nativo — o Electron NÃO implementa window.prompt()
 * (retorna null sempre). Mostra uma janelinha própria e resolve com o texto
 * digitado, ou null se cancelar.
 */
function pedirTexto(mensagem: string, valorPadrao = ""): Promise<string | null> {
  return new Promise((resolve) => {
    const modal = $("#modal-texto");
    const input = $<HTMLInputElement>("#modal-input");
    const ok = $<HTMLButtonElement>("#modal-ok");
    const cancelar = $<HTMLButtonElement>("#modal-cancelar");
    $("#modal-msg").textContent = mensagem;
    input.value = valorPadrao;
    modal.hidden = false;
    input.focus();
    input.select();

    const fechar = (valor: string | null) => {
      modal.hidden = true;
      ok.onclick = null;
      cancelar.onclick = null;
      input.onkeydown = null;
      resolve(valor);
    };
    ok.onclick = () => fechar(input.value);
    cancelar.onclick = () => fechar(null);
    input.onkeydown = (e) => {
      if (e.key === "Enter") fechar(input.value);
      else if (e.key === "Escape") fechar(null);
    };
  });
}
const thumbUrl = (hash: string, size = 256) => `thumb://img/${hash}/${size}`;
const fmtMm = (l: number | null, a: number | null) =>
  l != null && a != null ? `${l} × ${a} mm` : "—";
const fmtNum = (n: number | null) => (n == null ? "—" : n.toLocaleString("pt-BR"));

/**
 * Quantos desenhos vêm do banco por vez. A grade carrega mais sozinha ao rolar
 * até o fim, então bibliotecas grandes aparecem inteiras sem travar a janela.
 */
const TAMANHO_PAGINA = 300;

const estado = {
  filtros: {} as FiltrosBusca,
  ordenacao: { campo: "nome", direcao: "asc" } as Ordenacao,
  selecionada: null as number | null,
  filtroAtivo: "todos" as string,
  modo: "biblioteca" as "biblioteca" | "duplicados" | "erros" | "sumidos" | "config",
  expandidas: new Set<string>(),
  // Seleção múltipla (lote)
  marcadas: new Set<number>(),
  itensAtuais: [] as MatrizResumo[],
  ultimoIndice: null as number | null,
  // Paginação da grade
  total: 0,
  carregando: false,
  fim: false,
};

// ---- Inicialização --------------------------------------------------------

async function iniciar() {
  const { temBiblioteca } = await api.estadoInicial();
  if (temBiblioteca) {
    mostrarApp();
  } else {
    $("#welcome").hidden = false;
  }

  $<HTMLButtonElement>("#btn-escolher").onclick = escolherEImportar;
  $<HTMLButtonElement>("#btn-add-pasta").onclick = escolherEImportar;
  $<HTMLButtonElement>("#btn-atualizar").onclick = atualizarBiblioteca;
  $<HTMLButtonElement>("#btn-config").onclick = () => {
    estado.modo = "config";
    estado.filtroAtivo = "config";
    montarNav();
    recarregar();
  };
  $<HTMLButtonElement>("#prog-cancelar").onclick = () => {
    parando = true;
    $("#prog-titulo").textContent = "Parando… (terminando os que já começaram)";
    api.cancelarImportacao();
  };

  // Rolar até perto do fim traz a próxima leva de desenhos.
  const grade = $("#grade");
  grade.addEventListener("scroll", () => {
    if (estado.modo !== "biblioteca") return;
    if (grade.scrollTop + grade.clientHeight >= grade.scrollHeight - 600) {
      carregarPagina(false);
    }
  });

  const busca = $<HTMLInputElement>("#busca");
  let t: ReturnType<typeof setTimeout>;
  busca.addEventListener("input", () => {
    clearTimeout(t);
    t = setTimeout(() => {
      estado.filtros.busca = busca.value;
      recarregar();
    }, 200);
  });

  $<HTMLSelectElement>("#ordenar").addEventListener("change", (e) => {
    estado.ordenacao.campo = (e.target as HTMLSelectElement).value as Ordenacao["campo"];
    estado.ordenacao.direcao = estado.ordenacao.campo === "nome" ? "asc" : "desc";
    recarregar();
  });

  document.querySelectorAll<HTMLButtonElement>(".zoom button").forEach((b) => {
    b.onclick = () => {
      const atual = parseInt(getComputedStyle(document.documentElement).getPropertyValue("--card"));
      const novo = b.dataset.zoom === "g" ? Math.min(atual + 40, 340) : Math.max(atual - 40, 140);
      document.documentElement.style.setProperty("--card", `${novo}px`);
    };
  });

  // Barra de ações em lote
  $<HTMLButtonElement>("#lote-fav").onclick = () => favoritarLote();
  $<HTMLButtonElement>("#lote-test").onclick = () => testarLote();
  $<HTMLButtonElement>("#lote-renomear").onclick = () => renomearLote();
  $<HTMLButtonElement>("#lote-copiar").onclick = () => copiarParaPendrive([...estado.marcadas]);
  $<HTMLButtonElement>("#lote-limpar").onclick = () => limparSelecao();

  // Esc limpa a seleção; Ctrl/Cmd+A seleciona tudo o que está visível
  document.addEventListener("keydown", (e) => {
    const digitando = /^(INPUT|TEXTAREA|SELECT)$/.test((e.target as HTMLElement)?.tagName ?? "");
    if (e.key === "Escape" && estado.marcadas.size) {
      limparSelecao();
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a" && !digitando) {
      e.preventDefault();
      selecionarTodasVisiveis();
    }
  });

  api.onProgresso(atualizarProgresso);
}

async function mostrarApp() {
  $("#welcome").hidden = true;
  $("#app").hidden = false;
  await Promise.all([montarNav(), recarregar()]);
}

// ---- Importação -----------------------------------------------------------

async function escolherEImportar() {
  const pasta = await api.selecionarPasta();
  if (!pasta) return;
  $("#welcome").hidden = true;
  $("#app").hidden = false;
  await comProgresso(() => api.importarPasta(pasta));
}

/** Revarre as pastas já monitoradas: acha desenhos novos, movidos e sumidos. */
async function atualizarBiblioteca() {
  await comProgresso(() => api.atualizarBiblioteca());
}

/** Roda uma importação mostrando o overlay de progresso e o resumo no fim. */
async function comProgresso(acao: () => Promise<ResultadoImportacao>) {
  parando = false;
  $("#prog-titulo").textContent = "Procurando seus bordados…";
  $<HTMLElement>("#prog-barra").style.width = "0%";
  $("#progresso").hidden = false;
  let resultado: ResultadoImportacao;
  try {
    resultado = await acao();
  } finally {
    parando = false;
    $("#progresso").hidden = true;
  }
  await montarNav();
  await recarregar();
  if (estado.modo === "biblioteca") $("#contagem").textContent = resumoImportacao(resultado);
}

function resumoImportacao(r: ResultadoImportacao): string {
  const partes = [`${r.novos} novo(s)`];
  if (r.atualizados) partes.push(`${r.atualizados} atualizado(s)`);
  if (r.movidos) partes.push(`${r.movidos} movido(s) de lugar`);
  if (r.sumidos) partes.push(`${r.sumidos} sumido(s)`);
  if (r.erros) partes.push(`${r.erros} com problema`);
  const cabeca = r.status === "cancelada" ? "Parou no meio" : "Pronto";
  return `${cabeca}: ${partes.join(", ")} (${(r.duracaoMs / 1000).toFixed(1)}s).`;
}

/** Verdadeiro entre o clique em "Parar" e o fim da importação. */
let parando = false;

function atualizarProgresso(p: {
  fase: string; total: number; processados: number; erros: number; arquivoAtual: string | null;
}) {
  const pct = p.total > 0 ? Math.round((p.processados / p.total) * 100) : 0;
  $<HTMLElement>("#prog-barra").style.width = `${pct}%`;
  if (parando) return; // não sobrescreve o aviso de "Parando…"
  $("#prog-titulo").textContent = p.fase === "varrendo" ? "Procurando seus bordados…" : "Lendo seus bordados…";
  $("#prog-texto").textContent =
    p.total > 0
      ? `${p.processados} de ${p.total}${p.arquivoAtual ? ` · ${p.arquivoAtual}` : ""}`
      : "Procurando arquivos…";
}

// ---- Navegação lateral ----------------------------------------------------

async function montarNav() {
  const arvore = await api.listarArvorePastas();
  const nav = $("#nav");
  nav.innerHTML = "";

  const botao = (rotulo: string, chave: string, cont: number | null, onClick: () => void) => {
    const b = document.createElement("button");
    b.className = estado.filtroAtivo === chave ? "ativo" : "";
    b.innerHTML = `<span>${rotulo}</span>${cont != null ? `<span class="cont">${cont}</span>` : ""}`;
    b.onclick = () => {
      estado.filtroAtivo = chave;
      onClick();
      montarNav();
      recarregar();
    };
    nav.appendChild(b);
  };

  const semFiltros = () => {
    estado.modo = "biblioteca";
    estado.filtros = { busca: estado.filtros.busca };
  };
  const comFiltro = (extra: Partial<FiltrosBusca>) => {
    estado.modo = "biblioteca";
    estado.filtros = { busca: estado.filtros.busca, ...extra };
  };

  botao("Todos os desenhos", "todos", null, semFiltros);
  botao("♥ Favoritas", "favoritas", null, () => comFiltro({ favorita: true }));
  botao("✓ Testadas", "testadas", null, () => comFiltro({ testada: true }));
  botao("○ Não testadas", "nao-testadas", null, () => comFiltro({ testada: false }));

  if (arvore.length) {
    const g = document.createElement("div");
    g.className = "grupo";
    g.textContent = "Pastas";
    nav.appendChild(g);
    for (const node of arvore) renderPasta(nav, node, 0);
  }

  // Grupo de etiquetas em uso (organização por marcas próprias da usuária)
  const [dups, erros, sumidos, etiquetas] = await Promise.all([
    api.listarDuplicados(), api.listarErros(), api.listarSumidos(), api.listarEtiquetas(),
  ]);
  const tagsUsadas = (etiquetas as Etiqueta[]).filter((e) => e.total > 0);
  if (tagsUsadas.length) {
    const g = document.createElement("div");
    g.className = "grupo";
    g.textContent = "Etiquetas";
    nav.appendChild(g);
    for (const t of tagsUsadas) {
      botao(`🏷 ${t.nome}`, `etq-${t.id}`, t.total, () => comFiltro({ etiquetaIds: [t.id] }));
    }
  }

  // Grupo de manutenção (repetidos / com problema / sumidos)
  if (dups.length || erros.length || sumidos.length) {
    const g = document.createElement("div");
    g.className = "grupo";
    g.textContent = "Manutenção";
    nav.appendChild(g);
    if (dups.length) {
      botao("⧉ Repetidos", "duplicados", dups.length, () => { estado.modo = "duplicados"; });
    }
    if (erros.length) {
      botao("⚠ Com problema", "erros", erros.length, () => { estado.modo = "erros"; });
    }
    if (sumidos.length) {
      botao("⌀ Sumidos", "sumidos", sumidos.length, () => { estado.modo = "sumidos"; });
    }
  }
}

/** Renderiza um nó de pasta (recursivo), com recolher/expandir. */
function renderPasta(container: HTMLElement, node: PastaNode, nivel: number) {
  const chave = `pasta-${node.caminho}`;
  const temFilhos = node.filhos.length > 0;
  const aberta = estado.expandidas.has(node.caminho);

  const linha = document.createElement("button");
  linha.className = "pasta" + (estado.filtroAtivo === chave ? " ativo" : "");
  linha.style.paddingLeft = `${10 + nivel * 14}px`;
  const seta = temFilhos ? (aberta ? "▾" : "▸") : "•";
  linha.innerHTML =
    `<span class="pasta-nome"><span class="seta">${seta}</span> ${node.nome}</span>` +
    `<span class="cont">${node.total}</span>`;

  linha.onclick = (ev) => {
    // clique na seta (início da linha) alterna; no resto, filtra
    const alvoSeta = (ev.offsetX ?? 99) < 24 + nivel * 14 && temFilhos;
    if (alvoSeta) {
      if (aberta) estado.expandidas.delete(node.caminho);
      else estado.expandidas.add(node.caminho);
      montarNav();
      return;
    }
    estado.filtroAtivo = chave;
    estado.modo = "biblioteca";
    estado.filtros = { busca: estado.filtros.busca, subpasta: node.caminho };
    montarNav();
    recarregar();
  };
  container.appendChild(linha);

  if (temFilhos && aberta) {
    for (const filho of node.filhos) renderPasta(container, filho, nivel + 1);
  }
}

// ---- Grade ----------------------------------------------------------------

async function recarregar() {
  if (estado.modo === "duplicados") return renderDuplicados();
  if (estado.modo === "erros") return renderErros();
  if (estado.modo === "sumidos") return renderSumidos();
  if (estado.modo === "config") return renderConfiguracoes();
  return carregarPagina(true);
}

/**
 * Fila de uma posição só: garante que duas cargas nunca se misturem na grade.
 * Um recarregar sempre entra na fila (não pode ser perdido); um "carregar mais"
 * do rolar é descartado se já houver carga em andamento.
 */
let fila: Promise<void> = Promise.resolve();

function carregarPagina(reiniciar: boolean): Promise<void> {
  if (!reiniciar && (estado.carregando || estado.fim)) return Promise.resolve();
  estado.carregando = true;
  const anterior = fila;
  fila = (async () => {
    try {
      await anterior;
      await executarCarga(reiniciar);
    } finally {
      estado.carregando = false;
    }
  })();
  return fila;
}

/**
 * Traz uma leva de desenhos do banco. Com `reiniciar`, limpa a grade e começa
 * do zero (troca de filtro, busca ou ordenação); sem ele, acrescenta a próxima
 * leva ao final — é o que o rolar-até-embaixo usa.
 */
async function executarCarga(reiniciar: boolean) {
  const grade = $("#grade");
  const offset = reiniciar ? 0 : estado.itensAtuais.length;
  const { total, itens } = await api.listarMatrizes(estado.filtros, estado.ordenacao, {
    offset, limite: TAMANHO_PAGINA,
  });

  if (reiniciar) {
    estado.itensAtuais = [];
    grade.innerHTML = "";
    grade.classList.remove("lista");
    grade.scrollTop = 0;
    // Descarta da seleção itens que saíram da lista (filtro ou busca mudou)
    const visiveis = new Set((itens as MatrizResumo[]).map((m) => m.id));
    for (const id of [...estado.marcadas]) if (!visiveis.has(id)) estado.marcadas.delete(id);
  }

  const inicio = estado.itensAtuais.length;
  estado.itensAtuais.push(...(itens as MatrizResumo[]));
  estado.total = total;
  estado.fim = estado.itensAtuais.length >= total || itens.length === 0;

  const vazio = $("#vazio");
  if (estado.itensAtuais.length === 0) {
    vazio.hidden = false;
    vazio.textContent = estado.filtros.busca
      ? `Nenhum desenho encontrado para "${estado.filtros.busca}".`
      : "Nenhum desenho com esses filtros.";
  } else {
    vazio.hidden = true;
    const frag = document.createDocumentFragment();
    for (let i = inicio; i < estado.itensAtuais.length; i++) {
      frag.appendChild(criarCard(estado.itensAtuais[i], i));
    }
    grade.appendChild(frag);
  }

  atualizarContagem();
  atualizarBarraLote();
}

function atualizarContagem() {
  const total = estado.total;
  const mostrando = estado.itensAtuais.length;
  const palavra = total === 1 ? "desenho" : "desenhos";
  $("#contagem").textContent =
    mostrando < total
      ? `${total} ${palavra} — mostrando os ${mostrando} primeiros (role para ver mais)`
      : `${total} ${palavra}`;
}

function criarCard(m: MatrizResumo, indice: number): HTMLElement {
  const card = document.createElement("article");
  card.className = "card" +
    (estado.selecionada === m.id ? " sel" : "") +
    (estado.marcadas.has(m.id) ? " marc" : "");
  const flags =
    (m.favorita ? '<span class="chip on">♥</span>' : "") +
    (m.testada ? '<span class="chip on">testada</span>' : "");
  card.innerHTML = `
    <label class="check" title="Selecionar"><input type="checkbox" ${estado.marcadas.has(m.id) ? "checked" : ""}></label>
    <div class="thumb">${m.miniatura256 ? `<img loading="lazy" src="${thumbUrl(m.hash)}" alt="${esc(m.nomeExibido)}">` : "🧵"}</div>
    <div class="meta">
      <div class="nome" title="${esc(m.nomeExibido)}">${esc(m.nomeExibido)}</div>
      <div class="sub">${fmtMm(m.larguraMm, m.alturaMm)}</div>
      <div class="flags">${flags}</div>
    </div>`;

  // A caixinha (e sua área) alterna a seleção sem abrir os detalhes
  const check = card.querySelector<HTMLElement>(".check")!;
  check.onclick = (ev) => {
    ev.stopPropagation();
    alternarMarcada(m.id, indice, ev.shiftKey);
  };

  card.onclick = (ev) => {
    // Ctrl/Cmd+clique ou Shift+clique selecionam; clique simples abre detalhes
    if (ev.ctrlKey || ev.metaKey || ev.shiftKey) {
      alternarMarcada(m.id, indice, ev.shiftKey);
    } else {
      abrirDetalhes(m.id);
    }
  };
  card.ondblclick = () => api.abrirLocal(m.id);
  return card;
}

// ---- Seleção múltipla (lote) ---------------------------------------------

function alternarMarcada(id: number, indice: number, intervalo: boolean) {
  if (intervalo && estado.ultimoIndice != null) {
    const [a, b] = [estado.ultimoIndice, indice].sort((x, y) => x - y);
    // Define todos no intervalo com o mesmo estado do item clicado agora
    const marcar = !estado.marcadas.has(id);
    for (let i = a; i <= b; i++) {
      const item = estado.itensAtuais[i];
      if (!item) continue;
      if (marcar) estado.marcadas.add(item.id);
      else estado.marcadas.delete(item.id);
    }
  } else {
    if (estado.marcadas.has(id)) estado.marcadas.delete(id);
    else estado.marcadas.add(id);
  }
  estado.ultimoIndice = indice;
  atualizarGradeMarcacao();
  atualizarBarraLote();
}

/** Atualiza só as classes/checkboxes dos cards, sem recarregar do banco. */
function atualizarGradeMarcacao() {
  const cards = document.querySelectorAll<HTMLElement>("#grade .card");
  cards.forEach((card, i) => {
    const id = estado.itensAtuais[i]?.id;
    const marc = id != null && estado.marcadas.has(id);
    card.classList.toggle("marc", marc);
    const cb = card.querySelector<HTMLInputElement>(".check input");
    if (cb) cb.checked = marc;
  });
}

function limparSelecao() {
  estado.marcadas.clear();
  estado.ultimoIndice = null;
  atualizarGradeMarcacao();
  atualizarBarraLote();
}

function selecionarTodasVisiveis() {
  for (const m of estado.itensAtuais) estado.marcadas.add(m.id);
  atualizarGradeMarcacao();
  atualizarBarraLote();
}

function atualizarBarraLote() {
  const n = estado.marcadas.size;
  const barra = $("#barra-lote");
  barra.hidden = n === 0;
  if (n === 0) return;
  $("#lote-contagem").textContent =
    `${n} ${n === 1 ? "desenho selecionado" : "desenhos selecionados"}`;
}

async function favoritarLote() {
  const ids = [...estado.marcadas];
  if (!ids.length) return;
  for (const id of ids) await api.favoritar(id, true);
  limparSelecao();
  recarregar();
}

async function testarLote() {
  const ids = [...estado.marcadas];
  if (!ids.length) return;
  for (const id of ids) await api.marcarTestada(id, true);
  limparSelecao();
  recarregar();
}

async function renomearLote() {
  const ids = [...estado.marcadas];
  if (!ids.length) return;
  const base = await pedirTexto(
    `Dar um nome ao conjunto de ${ids.length} desenho(s).\n` +
      `Eles ficarão como "Nome 1", "Nome 2", "Nome 3"…\n\nDigite o nome base:`,
  );
  if (base == null) return;
  const nome = base.trim();
  if (!nome) return;
  // Renomeia na ordem em que aparecem na grade
  const ordenados = estado.itensAtuais.filter((m) => estado.marcadas.has(m.id));
  for (let i = 0; i < ordenados.length; i++) {
    await api.editarMatriz(ordenados[i].id, { nome_exibido: `${nome} ${i + 1}` });
  }
  limparSelecao();
  recarregar();
}

// ---- Telas de manutenção: repetidos e com problema ------------------------

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const nomeArquivo = (caminho: string) => caminho.split(/[\\/]/).pop() ?? caminho;

async function renderDuplicados() {
  limparSelecao();
  $("#detalhes").hidden = true;
  const grupos = await api.listarDuplicados();
  const grade = $("#grade");
  const vazio = $("#vazio");
  const totalArq = grupos.reduce((s, g) => s + g.quantidade, 0);
  $("#contagem").textContent =
    `${grupos.length} desenho(s) repetido(s) — ${totalArq} arquivos idênticos`;
  vazio.hidden = grupos.length > 0;
  if (!grupos.length) { vazio.textContent = "Nenhum arquivo repetido. 🎉"; grade.innerHTML = ""; return; }

  grade.innerHTML = "";
  grade.classList.add("lista");
  for (const g of grupos as GrupoDuplicado[]) {
    const caminhos = g.caminhos.split("|");
    const linhas = caminhos
      .map(
        (c) =>
          `<li><span class="dup-arq" title="${esc(c)}">${esc(nomeArquivo(c))}</span>` +
          `<button class="link" data-caminho="${esc(c)}">Abrir pasta</button></li>`,
      )
      .join("");
    const item = document.createElement("article");
    item.className = "manut";
    item.innerHTML = `
      <div class="manut-thumb"><img loading="lazy" src="${thumbUrl(g.hash)}" alt=""></div>
      <div class="manut-corpo">
        <div class="manut-titulo">${g.quantidade} cópias idênticas</div>
        <ul class="dup-lista">${linhas}</ul>
      </div>`;
    grade.appendChild(item);
  }
  grade.querySelectorAll<HTMLButtonElement>("button[data-caminho]").forEach((b) => {
    b.onclick = () => api.revelarCaminho(b.dataset.caminho!);
  });
}

async function renderErros() {
  limparSelecao();
  $("#detalhes").hidden = true;
  const erros = await api.listarErros();
  const grade = $("#grade");
  const vazio = $("#vazio");
  $("#contagem").textContent = `${erros.length} arquivo(s) com problema`;
  vazio.hidden = erros.length > 0;
  if (!erros.length) { vazio.textContent = "Nenhum arquivo com problema. 🎉"; grade.innerHTML = ""; return; }

  grade.innerHTML = "";
  grade.classList.add("lista");

  const topo = document.createElement("div");
  topo.className = "manut-topo";
  topo.innerHTML =
    `<p class="nota">Estes arquivos não puderam ser lidos. Se você já consertou ` +
    `ou substituiu algum, peça para tentar de novo.</p>`;
  const btnTentar = document.createElement("button");
  btnTentar.className = "secundario";
  btnTentar.textContent = "↻ Tentar de novo";
  btnTentar.onclick = async () => {
    estado.modo = "biblioteca";
    estado.filtroAtivo = "todos";
    await comProgresso(() => api.reprocessarErros());
  };
  topo.appendChild(btnTentar);
  grade.appendChild(topo);

  for (const e of erros as ErroProcessamento[]) {
    const item = document.createElement("article");
    item.className = "manut erro";
    item.innerHTML = `
      <div class="manut-icone">⚠</div>
      <div class="manut-corpo">
        <div class="manut-titulo" title="${esc(e.caminho)}">${esc(nomeArquivo(e.caminho))}</div>
        <div class="manut-msg">${esc(e.mensagem)} <span class="nota">(${esc(e.etapa)})</span></div>
        <button class="link" data-caminho="${esc(e.caminho)}">Abrir pasta</button>
      </div>`;
    grade.appendChild(item);
  }
  grade.querySelectorAll<HTMLButtonElement>("button[data-caminho]").forEach((b) => {
    b.onclick = () => api.revelarCaminho(b.dataset.caminho!);
  });
}

/**
 * Desenhos cujo arquivo original não está mais na pasta (apagado ou levado para
 * fora dela). Ficam guardados — com favorita, etiquetas e nome — até a usuária
 * decidir tirá-los do catálogo. Nenhum arquivo é apagado por aqui.
 */
async function renderSumidos() {
  limparSelecao();
  $("#detalhes").hidden = true;
  const sumidos = (await api.listarSumidos()) as ArquivoSumido[];
  const grade = $("#grade");
  const vazio = $("#vazio");
  $("#contagem").textContent = `${sumidos.length} desenho(s) sumido(s)`;
  vazio.hidden = sumidos.length > 0;
  if (!sumidos.length) {
    vazio.textContent = "Nenhum desenho sumido. 🎉";
    grade.innerHTML = "";
    return;
  }

  grade.innerHTML = "";
  grade.classList.add("lista");

  const topo = document.createElement("div");
  topo.className = "manut-topo";
  topo.innerHTML =
    `<p class="nota">Estes desenhos estavam no catálogo, mas o arquivo não está mais ` +
    `na pasta. Se você só mudou os arquivos de lugar, clique em <strong>Atualizar ` +
    `biblioteca</strong> que eles voltam sozinhos, com favoritas e etiquetas.</p>`;
  const btnTodos = document.createElement("button");
  btnTodos.className = "secundario";
  btnTodos.textContent = "Tirar todos do catálogo";
  btnTodos.onclick = async () => {
    if (!confirm(
      `Tirar ${sumidos.length} desenho(s) do catálogo?\n\n` +
      `Isso apaga só a ficha aqui dentro do aplicativo — nenhum arquivo do seu ` +
      `computador é tocado.`,
    )) return;
    await api.removerDoCatalogo();
    estado.modo = "biblioteca";
    estado.filtroAtivo = "todos";
    await montarNav();
    await recarregar();
  };
  topo.appendChild(btnTodos);
  grade.appendChild(topo);

  for (const s of sumidos) {
    const item = document.createElement("article");
    item.className = "manut";
    item.innerHTML = `
      <div class="manut-thumb"><img loading="lazy" src="${thumbUrl(s.hash)}" alt=""></div>
      <div class="manut-corpo">
        <div class="manut-titulo">${esc(s.nomeExibido)}</div>
        <div class="manut-msg" title="${esc(s.caminho)}">${esc(s.caminho)}</div>
        <button class="link" data-matriz="${s.matrizId}">Tirar do catálogo</button>
      </div>`;
    grade.appendChild(item);
  }
  grade.querySelectorAll<HTMLButtonElement>("button[data-matriz]").forEach((b) => {
    b.onclick = async () => {
      await api.removerDoCatalogo([Number(b.dataset.matriz)]);
      await montarNav();
      await renderSumidos();
    };
  });
}

// ---- Configurações --------------------------------------------------------

async function renderConfiguracoes() {
  limparSelecao();
  $("#detalhes").hidden = true;
  const [pastas, info] = await Promise.all([api.listarPastas(), api.infoApp()]);
  const grade = $("#grade");
  $("#vazio").hidden = true;
  $("#contagem").textContent = "Configurações";
  grade.innerHTML = "";
  grade.classList.add("lista");

  const linhasPastas = (pastas as Pasta[])
    .map(
      (p) =>
        `<li><span class="dup-arq" title="${esc(p.caminho)}">${esc(p.caminho)}</span>` +
        `<span class="nota">${p.total} desenho(s)</span>` +
        `<button class="link" data-remover-pasta="${p.id}">Parar de acompanhar</button></li>`,
    )
    .join("");

  const bloco = document.createElement("div");
  bloco.className = "config";
  bloco.innerHTML = `
    <section class="manut">
      <div class="manut-corpo">
        <div class="manut-titulo">Suas pastas de bordado</div>
        <p class="nota">O aplicativo só lê estas pastas. Ele nunca move, renomeia
          ou apaga nada dentro delas.</p>
        <ul class="dup-lista">${linhasPastas || "<li class='nota'>Nenhuma pasta ainda.</li>"}</ul>
      </div>
    </section>
    <section class="manut">
      <div class="manut-corpo">
        <div class="manut-titulo">Seus dados</div>
        <p class="nota">Favoritas, etiquetas e nomes ficam guardados aqui, separados
          dos arquivos de bordado. Uma cópia de segurança é feita toda vez que você
          fecha o aplicativo.</p>
        <dl class="config-dl">
          <dt>Catálogo</dt><dd title="${esc(info.pastaDados)}">${esc(info.pastaDados)}</dd>
          <dt>Cópias de segurança</dt><dd title="${esc(info.pastaBackups)}">${esc(info.pastaBackups)}</dd>
          <dt>Versão</dt><dd>${esc(info.versao)}</dd>
        </dl>
      </div>
    </section>`;
  grade.appendChild(bloco);

  bloco.querySelectorAll<HTMLButtonElement>("button[data-remover-pasta]").forEach((b) => {
    b.onclick = async () => {
      const pasta = (pastas as Pasta[]).find((p) => p.id === Number(b.dataset.removerPasta));
      if (!pasta) return;
      if (!confirm(
        `Parar de acompanhar esta pasta?\n\n${pasta.caminho}\n\n` +
        `Os ${pasta.total} desenho(s) dela saem do aplicativo (junto com favoritas e ` +
        `etiquetas). Nenhum arquivo do seu computador é apagado — para trazer tudo ` +
        `de volta, é só adicionar a pasta outra vez.`,
      )) return;
      await api.removerPasta(pasta.id);
      await montarNav();
      await renderConfiguracoes();
    };
  });
}

// ---- Painel de detalhes ---------------------------------------------------

async function abrirDetalhes(id: number) {
  estado.selecionada = id;
  document.querySelectorAll(".card").forEach((c) => c.classList.remove("sel"));
  const d = await api.detalhes(id);
  const painel = $("#detalhes");
  painel.hidden = false;

  const etiquetas = (d.etiquetas ?? [])
    .map(
      (e: any) =>
        `<span class="chip etq">${esc(e.nome)}` +
        `<button class="etq-x" data-etq="${e.id}" title="Remover etiqueta">×</button></span>`,
    )
    .join(" ");

  painel.innerHTML = `
    <div class="big"><img src="${thumbUrl(d.hash, 512)}" alt="${d.nome_exibido}"></div>
    <h2 class="nome-det">${d.nome_exibido} <button id="d-renomear" class="lapis" title="Renomear">✎</button></h2>
    <dl>
      <dt>Tamanho</dt><dd>${fmtMm(d.larguraMm, d.alturaMm)}</dd>
      <dt>Pontos</dt><dd>${fmtNum(d.numPontos)}</dd>
      <dt>Cores</dt><dd>${fmtNum(d.numCores)}</dd>
      <dt>Bastidor</dt><dd>${d.bastidor_sugerido ?? "—"}</dd>
      <dt>Formato</dt><dd>${(d.formato ?? "").toUpperCase()} ${d.versaoFormato ? `(${d.versaoFormato})` : ""}</dd>
      <dt>Arquivo</dt><dd title="${d.caminhoAbsoluto}">${d.nomeOriginal}</dd>
    </dl>
    <div class="etiquetas">
      ${etiquetas}
      <button id="d-add-etq" class="chip add" title="Adicionar etiqueta">+ etiqueta</button>
    </div>
    <div class="acoes">
      <button id="d-fav" class="secundario">${d.favorita ? "♥ Favorita" : "♡ Favoritar"}</button>
      <button id="d-test" class="secundario">${d.testada ? "✓ Testada" : "Marcar testada"}</button>
    </div>
    <div class="acoes">
      <button id="d-abrir" class="secundario">Abrir local do arquivo</button>
      <button id="d-copiar" class="primary">Copiar para pendrive</button>
    </div>`;

  $<HTMLButtonElement>("#d-fav").onclick = async () => {
    await api.favoritar(id, !d.favorita);
    abrirDetalhes(id); recarregar();
  };
  $<HTMLButtonElement>("#d-test").onclick = async () => {
    await api.marcarTestada(id, !d.testada);
    abrirDetalhes(id); recarregar();
  };
  $<HTMLButtonElement>("#d-abrir").onclick = () => api.abrirLocal(id);
  $<HTMLButtonElement>("#d-copiar").onclick = () => copiarParaPendrive([id]);
  $<HTMLButtonElement>("#d-renomear").onclick = async () => {
    const novo = await pedirTexto("Novo nome do desenho:", d.nome_exibido);
    if (novo == null) return;
    const nome = novo.trim();
    if (!nome || nome === d.nome_exibido) return;
    await api.editarMatriz(id, { nome_exibido: nome });
    abrirDetalhes(id);
    recarregar();
  };
  $<HTMLButtonElement>("#d-add-etq").onclick = async () => {
    const nome = await pedirTexto("Nova etiqueta (ex.: floral, natal, infantil):");
    if (nome == null) return;
    const limpo = nome.trim();
    if (!limpo) return;
    await api.adicionarEtiqueta(id, limpo, "geral");
    abrirDetalhes(id);
  };
  painel.querySelectorAll<HTMLButtonElement>(".etq-x").forEach((b) => {
    b.onclick = async () => {
      await api.removerEtiqueta(id, Number(b.dataset.etq));
      abrirDetalhes(id);
    };
  });
}

// ---- Cópia para pendrive --------------------------------------------------

async function copiarParaPendrive(ids: number[]) {
  const drives = await api.listarDrives();
  let destino: string | null;
  if (drives.length === 0) {
    if (!confirm("Nenhum pendrive encontrado. Deseja escolher outra pasta de destino?")) return;
    destino = await api.escolherDestino();
  } else {
    const lista = drives
      .map((d, i) => `${i + 1}. ${d.rotulo} (${d.caminho})`)
      .join("\n");
    const escolha = await pedirTexto(`Para onde copiar ${ids.length} desenho(s)?\n${lista}\n\nDigite o número (ou cancele):`);
    if (escolha == null) return;
    const idx = parseInt(escolha) - 1;
    destino = drives[idx]?.caminho ?? null;
  }
  if (!destino) return;

  const resp = await api.copiarParaPendrive(ids, destino, "renomear");
  if (!resp.ok) {
    alert(resp.erro.mensagem);
    return;
  }
  const r = resp.resultado;
  alert(
    `✅ ${r.copiados + r.renomeados} copiado(s) para ${destino}` +
      (r.pulados ? `\n${r.pulados} já existia(m) (pulado).` : "") +
      (r.erros ? `\n${r.erros} com erro.` : ""),
  );
}

iniciar();
