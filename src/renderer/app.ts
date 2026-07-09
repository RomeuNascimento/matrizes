/**
 * Lógica da interface. Fala apenas com window.api (contratos), nunca com o
 * sistema diretamente.
 */
import type {
  AppApi, MatrizResumo, FiltrosBusca, Ordenacao, PastaNode,
} from "../shared/contracts.ts";

declare global {
  interface Window { api: AppApi; }
}
const api = window.api;

const $ = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const thumbUrl = (hash: string, size = 256) => `thumb://img/${hash}/${size}`;
const fmtMm = (l: number | null, a: number | null) =>
  l != null && a != null ? `${l} × ${a} mm` : "—";
const fmtNum = (n: number | null) => (n == null ? "—" : n.toLocaleString("pt-BR"));

const estado = {
  filtros: {} as FiltrosBusca,
  ordenacao: { campo: "nome", direcao: "asc" } as Ordenacao,
  selecionada: null as number | null,
  filtroAtivo: "todos" as string,
  expandidas: new Set<string>(),
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
  $("#progresso").hidden = false;
  const resultado = await api.importarPasta(pasta);
  $("#progresso").hidden = true;
  await montarNav();
  await recarregar();
  const c = $("#contagem");
  c.textContent =
    `Importação concluída: ${resultado.novos} novos, ${resultado.atualizados} atualizados, ` +
    `${resultado.erros} com erro (${(resultado.duracaoMs / 1000).toFixed(1)}s).`;
}

function atualizarProgresso(p: {
  fase: string; total: number; processados: number; erros: number; arquivoAtual: string | null;
}) {
  const pct = p.total > 0 ? Math.round((p.processados / p.total) * 100) : 0;
  $<HTMLElement>("#prog-barra").style.width = `${pct}%`;
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

  const semFiltros = () => (estado.filtros = { busca: estado.filtros.busca });

  botao("Todos os desenhos", "todos", null, semFiltros);
  botao("♥ Favoritas", "favoritas", null, () =>
    (estado.filtros = { busca: estado.filtros.busca, favorita: true }));
  botao("✓ Testadas", "testadas", null, () =>
    (estado.filtros = { busca: estado.filtros.busca, testada: true }));
  botao("○ Não testadas", "nao-testadas", null, () =>
    (estado.filtros = { busca: estado.filtros.busca, testada: false }));

  if (arvore.length) {
    const g = document.createElement("div");
    g.className = "grupo";
    g.textContent = "Pastas";
    nav.appendChild(g);
    for (const node of arvore) renderPasta(nav, node, 0);
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
  const { total, itens } = await api.listarMatrizes(estado.filtros, estado.ordenacao, {
    offset: 0, limite: 500,
  });
  const grade = $("#grade");
  const vazio = $("#vazio");
  $("#contagem").textContent = `${total} ${total === 1 ? "desenho" : "desenhos"}`;
  grade.innerHTML = "";

  if (itens.length === 0) {
    vazio.hidden = false;
    vazio.textContent = estado.filtros.busca
      ? `Nenhum desenho encontrado para "${estado.filtros.busca}".`
      : "Nenhum desenho com esses filtros.";
    return;
  }
  vazio.hidden = true;

  for (const m of itens as MatrizResumo[]) {
    const card = document.createElement("article");
    card.className = "card" + (estado.selecionada === m.id ? " sel" : "");
    const flags =
      (m.favorita ? '<span class="chip on">♥</span>' : "") +
      (m.testada ? '<span class="chip on">testada</span>' : "");
    card.innerHTML = `
      <div class="thumb">${m.miniatura256 ? `<img loading="lazy" src="${thumbUrl(m.hash)}" alt="${m.nomeExibido}">` : "🧵"}</div>
      <div class="meta">
        <div class="nome" title="${m.nomeExibido}">${m.nomeExibido}</div>
        <div class="sub">${fmtMm(m.larguraMm, m.alturaMm)}</div>
        <div class="flags">${flags}</div>
      </div>`;
    card.onclick = () => abrirDetalhes(m.id);
    card.ondblclick = () => api.abrirLocal(m.id);
    grade.appendChild(card);
  }
}

// ---- Painel de detalhes ---------------------------------------------------

async function abrirDetalhes(id: number) {
  estado.selecionada = id;
  document.querySelectorAll(".card").forEach((c) => c.classList.remove("sel"));
  const d = await api.detalhes(id);
  const painel = $("#detalhes");
  painel.hidden = false;

  const etiquetas = (d.etiquetas ?? [])
    .map((e: any) => `<span class="chip">${e.nome}</span>`)
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
    <div class="etiquetas">${etiquetas || '<span class="nota">Sem etiquetas</span>'}</div>
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
    const novo = prompt("Novo nome do desenho:", d.nome_exibido);
    if (novo == null) return;
    const nome = novo.trim();
    if (!nome || nome === d.nome_exibido) return;
    await api.editarMatriz(id, { nome_exibido: nome });
    abrirDetalhes(id);
    recarregar();
  };
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
    const escolha = prompt(`Para onde copiar ${ids.length} desenho(s)?\n${lista}\n\nDigite o número (ou cancele):`);
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
