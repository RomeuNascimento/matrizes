# Status de implementação — Matrizes

Última atualização: fim da sessão em que o app foi rodado com a biblioteca
real da usuária (~1807 matrizes) no Windows.

Legenda: ✅ pronto e testado · 🟡 backend pronto, falta tela · ⬜ pendente ·
🪟 requer máquina Windows.

## Onde estamos

O app **está funcionando na máquina Windows da usuária**, lendo a biblioteca
real dela (~1807 matrizes, incluindo arquivos PES v1 a v9). Galeria com
miniaturas, busca, navegação por subpastas, detalhes, favoritar/testar,
renomear e cópia para pendrive — tudo operante. **63 testes automatizados**
passando; typecheck e build limpos.

## Núcleo (pronto e testado)

| Item | Estado | Onde |
|---|---|---|
| Leitor de `.PES` (v1–v10, paleta embutida) | ✅ | `src/main/embroidery/` |
| Paridade com oráculo PyEmbroidery (37/37) | ✅ | `tests/unit/pes-reader.test.ts` |
| Miniaturas SVG→PNG nas cores reais | ✅ | `src/main/thumbnails/` |
| Banco SQLite: esquema, migrações, seeds | ✅ | `src/main/db/` |
| Busca sem acento (FTS5) | ✅ | `repository.ts` |
| Varredura recursiva + hash + import incremental | ✅ | `filesystem/`, `services/importer.ts` |
| **Navegação por subpastas** (árvore recolhível) | ✅ | `repository.listarArvorePastas` + `renderer` |
| **Renomear** (nome exibido; janelinha própria, não `prompt()`) | ✅ | `pedirTexto` em `renderer/app.ts` |
| **Miniaturas com fundo claro** (desenhos escuros visíveis) | ✅ | `--fabric` em `styles.css` |
| **Auto-cura de miniatura** (regenera cache faltante) | ✅ | protocolo `thumb://` em `index.ts` |
| **Painel de detalhes fixo** (não some ao rolar; só a grade rola) | ✅ | `overflow:hidden` + `min-height:0` |
| **FTS com conteúdo** (renomear/mover não quebram a busca) | ✅ | migração 3 em `migrations.ts` |
| **Seleção múltipla na grade** (caixa no card, Ctrl/Shift+clique, Ctrl+A, Esc) | ✅ | `renderer/app.ts` |
| **Ações em lote**: favoritar, marcar testada, renomear e copiar | ✅ | barra flutuante em `renderer/app.ts` |
| **Tela de repetidos** (agrupa idênticos por hash, abre pasta) | ✅ | `renderDuplicados` em `renderer/app.ts` |
| **Tela de arquivos com problema** (motivo + abrir pasta) | ✅ | `renderErros` em `renderer/app.ts` |
| **Etiquetas**: criar/aplicar/remover + **filtrar pela lateral** | ✅ | grupo "Etiquetas" em `renderer/app.ts` |
| Favoritas / Testadas / Não testadas (lateral) | ✅ | `renderer/app.ts` |
| Cópia segura para pendrive | ✅ | `services/copier.ts` |
| Backup + verificação de integridade | ✅ | `db/backup.ts` |
| App Electron (build + typecheck) | ✅ | `src/main/index.ts`, `src/renderer/` |

## Falta tela (backend pronto)

| Item | Estado | Observação |
|---|---|---|
| Categorias (organizar em pastas próprias) | ✅ | `criarCategoria()` + atribuir no detalhe e em lote; grupo "Categorias" na lateral filtra |
| Tela de configurações | ⬜ | — |

## Distribuição (Fase 5) — ✅ no ar

- **Instalador Windows automático**: GitHub Actions (`.github/workflows/build-windows.yml`,
  `windows-2022`) compila e publica um Release a cada commit com `[release]`; a versão vem
  do `package.json`. Gera instalador `.exe` **e** versão portátil `.zip`.
- **Atualização automática** (`electron-updater`, Releases públicos): o app instalado
  verifica e baixa sozinho; instala ao clicar "Reiniciar agora". Sem SmartScreen nas
  atualizações (só na 1ª instalação). Validado ponta a ponta pela usuária (v0.1.0 → v0.1.2).
- Correção da grade: `grid-auto-rows: max-content` (cards não achatam/cortam em zoom maior).

## Pendências de máquina Windows

| Item | Estado |
|---|---|
| Gerar/testar instalador NSIS (`npm run dist`) | 🪟 |
| Testar com pendrive real | 🪟 |
| (Opcional) fábrica de instalador via GitHub Actions | ⬜ (usuária optou por seguir no modo git por ora) |

## Ideias discutidas / adiadas

- **IA para auto-organizar por tema** (floral, moldura, letra…): possível, mas
  precisa de internet e tem custo → adiada como "turbo" opcional; começar pela
  organização por subpastas (feita) e nomes de pasta.
- **Instalador de clique-duplo + auto-update**: objetivo final (Fase 5). Depende
  de build no Windows — planejado via GitHub Actions quando o app estabilizar.

## Miniaturas "pretas" — RESOLVIDO (era duas coisas)

Diagnosticado com a biblioteca real (via `npm run inspect`):

1. **Miniaturas rasgadas** (100, 101…): o PNG do cache faltava e o app mostrava
   imagem quebrada. → Corrigido: o protocolo `thumb://` **regenera na hora** a
   partir do original (auto-cura). ✅
2. **Molduras pretas**: NÃO é bug. O `inspect` de uma moldura v9 mostrou
   `Blocos cor: 1`, `Cores/bloco: #000000`, paleta embutida `#000000 #ED171F` —
   ou seja, o arquivo diz que a linha é **preta mesmo** (conferido contra o
   pyembroidery, que leria igual). O que atrapalhava era **preto sobre fundo
   escuro** (sumia). → Corrigido: miniaturas agora têm **fundo claro tipo tecido**
   (`--fabric`, claro nos dois temas), então o preto aparece como bordado em
   pano. ✅

O `inspect` foi reforçado e continua útil para outros casos: imprime versão,
cores por bloco, **índices PEC crus**, **nº de cores da paleta embutida** e gera
o PNG (`arquivo.thumb.png`) ao lado.

## Como a usuária roda o app (contexto para retomar)

A usuária **não é programadora** — guiar com paciência, comandos um por linha,
sem `&&` (o PowerShell dela é a versão que não aceita). O app roda **no Windows
dela**, não neste ambiente (que é um container Linux headless — aqui só dá para
`npm test`, `npm run typecheck`, `npm run build:app`; a janela do Electron NÃO
abre aqui).

Fluxo dela (já configurado com Git):
```
git clone -b claude/embroidery-app-technical-plan-logdvd https://github.com/RomeuNascimento/matrizes.git
cd matrizes
npm install
npm run rebuild        # recompila better-sqlite3/sharp p/ Electron (@electron/rebuild)
npm run dev            # abre o app
```
Atualizar depois: `git pull` e `npm run dev`.

**Dados da usuária** (biblioteca, favoritas, etc.) ficam em
`%APPDATA%\matrizes` — separados do código; atualizar o código não apaga nada,
e os arquivos de bordado originais nunca são tocados. A migração v2 normaliza
os separadores de caminho automaticamente ao abrir (habilita a navegação por
subpastas na base já existente, sem reimportar).

## Próximos passos sugeridos (para a nova sessão)

1. **Miniaturas pretas**: rodar o `inspect` num arquivo real colorido que saia
   preto e conferir versão/cores (ver Observações). É o que falta para saber se
   há bug de paleta em alguma versão.
2. **Categorias na UI**: permitir agrupar desenhos em categorias próprias
   (backend `listarCategorias()`/`editarMatriz(categoria_id)` já existe).
3. **Tela de configurações** (⬜ ainda sem backend).
4. Quando estabilizar: **fábrica de instalador** (GitHub Actions) + auto-update.

## Como usar a seleção múltipla (para explicar à usuária)

- Passe o mouse sobre um desenho e clique na **caixinha** que aparece no canto
  para selecioná-lo. Uma **barra aparece embaixo** com as ações em lote.
- Atalhos opcionais: **Ctrl+clique** marca/desmarca; **Shift+clique** marca um
  intervalo; **Ctrl+A** seleciona todos os visíveis; **Esc** limpa.
- Ações em lote: **Favoritar**, **Marcar testada**, **Renomear em lote**
  (dá um nome base e numera: "Flor 1", "Flor 2"…) e **Copiar para pendrive**.
- Clique simples (sem tecla) continua abrindo os **detalhes**; duplo-clique
  abre o local do arquivo — nada disso mudou.

## Telas de manutenção e etiquetas (para explicar à usuária)

- Na lateral, quando houver, aparece o grupo **Manutenção**:
  - **⧉ Repetidos**: agrupa arquivos idênticos (mesmo conteúdo) e mostra a
    miniatura + a lista de cópias, com **Abrir pasta** de cada uma para você
    decidir qual apagar (o app nunca apaga sozinho).
  - **⚠ Com problema**: lista arquivos que não deram para ler, com o motivo e
    **Abrir pasta** para localizar.
- **Etiquetas** (o jeito de organizar sem mexer nos arquivos): no painel de
  detalhes, o botão **+ etiqueta** cria/aplica uma marca (ex.: "floral", "natal")
  e o **×** em cada etiqueta a remove. As etiquetas em uso aparecem na **lateral**,
  no grupo **Etiquetas** — clicando numa, a grade mostra só os desenhos com ela.

## Decisões firmadas

- Arquitetura: **Electron + Node/TypeScript + SQLite**; parser próprio em TS
  (sem Python em runtime; PyEmbroidery só como oráculo de teste).
- Funciona **local e offline**.
- **Subpastas** são a organização principal.
- Segurança: **modo leitura sobre os originais** (nunca move/renomeia/apaga);
  escrita só no destino de cópia e em `%APPDATA%\matrizes`. Organização se faz
  por **subpastas** (leitura) e **etiquetas** (só no banco) — não movendo arquivos.
- **Público-alvo:** mulheres ~50 anos, pouca intimidade com informática. Priorizar
  simplicidade, botões óbvios e nada que mexa nos arquivos originais.
