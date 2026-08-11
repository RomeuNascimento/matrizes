# Status de implementação — Matrizes

Última atualização: sessão de preparação para venda (v1.0.0).

Legenda: ✅ pronto e testado · 🟡 backend pronto, falta tela · ⬜ pendente ·
🪟 requer máquina Windows · 💬 decisão de negócio pendente.

## Onde estamos

O app **funciona na máquina Windows da usuária** com a biblioteca real dela
(~1807 matrizes, PES v1 a v9). **70 testes automatizados** passando; typecheck e
build limpos. A fábrica de instalador (GitHub Actions) está pronta, mas ainda
não rodou.

## Núcleo (pronto e testado)

| Item | Estado | Onde |
|---|---|---|
| Leitor de `.PES` (v1–v10, paleta embutida) | ✅ | `src/main/embroidery/` |
| Paridade com oráculo PyEmbroidery (37/37) | ✅ | `tests/unit/pes-reader.test.ts` |
| Miniaturas SVG→PNG nas cores reais, fundo tipo tecido | ✅ | `src/main/thumbnails/` |
| Auto-cura de miniatura (regenera cache faltante) | ✅ | protocolo `thumb://` em `index.ts` |
| Banco SQLite: esquema, migrações, seeds | ✅ | `src/main/db/` |
| Busca sem acento (FTS5, com conteúdo) | ✅ | `repository.ts` |
| Varredura recursiva + hash + import incremental | ✅ | `filesystem/`, `services/importer.ts` |
| **Galeria paginada (rola e carrega mais)** | ✅ | `carregarPagina` em `renderer/app.ts` |
| **Atualizar biblioteca** (revarre as pastas monitoradas) | ✅ | `atualizarBiblioteca` no IPC |
| **Religação de arquivo movido/renomeado** (por hash) | ✅ | `importer.ts` + `tests/integration/sincronizacao.test.ts` |
| **Tela de sumidos** (arquivo saiu da pasta) | ✅ | `renderSumidos` em `renderer/app.ts` |
| **Cancelar importação** ("Parar") | ✅ | `cancelarImportacao` no IPC |
| **Tela de configurações** (pastas, dados, versão) | ✅ | `renderConfiguracoes` em `renderer/app.ts` |
| **Parar de acompanhar uma pasta** | ✅ | `repo.removerPasta` |
| Navegação por subpastas (árvore recolhível) | ✅ | `repository.listarArvorePastas` + `renderer` |
| Renomear (janelinha própria, não `prompt()`) | ✅ | `pedirTexto` em `renderer/app.ts` |
| Painel de detalhes fixo (só a grade rola) | ✅ | `overflow:hidden` + `min-height:0` |
| Seleção múltipla + ações em lote | ✅ | `renderer/app.ts` |
| Tela de repetidos (agrupa idênticos por hash) | ✅ | `renderDuplicados` |
| Tela de arquivos com problema + **tentar de novo** | ✅ | `renderErros` + `reprocessarErros` |
| Etiquetas: criar/aplicar/remover + filtrar pela lateral | ✅ | `renderer/app.ts` |
| Favoritas / Testadas / Não testadas | ✅ | `renderer/app.ts` |
| Cópia segura para pendrive | ✅ | `services/copier.ts` |
| Backup + verificação de integridade | ✅ | `db/backup.ts` |
| **Ícone do app** (flor, .png + .ico multi-resolução) | ✅ | `build/`, `scripts/gerar-icone.ts` |
| **Fábrica de instalador** (GitHub Actions, Windows) | ✅ | `.github/workflows/instalador.yml` |
| **Guia de instalação para a compradora** | ✅ | `docs/INSTALACAO.md` |

## O que ainda falta

| Item | Estado | Observação |
|---|---|---|
| Rodar a fábrica e testar o instalador no Windows | 🪟 | Actions → "Instalador do Windows" → Run workflow |
| Testar com pendrive real | 🪟 | fluxo de cópia já tem teste de integração |
| Categorias na UI | 🟡 | `listarCategorias()` pronto; etiquetas hoje cobrem o caso |
| Assinatura de código (evita aviso do SmartScreen) | 💬 | certificado ~US$ 100–400/ano — ver `docs/INSTALACAO.md` §2 |
| Proteção contra cópia / licença | 💬 | hoje o instalador é livre: quem tiver o .exe instala |
| Auto-update | ⬜ | previsto para v1.1; hoje a atualização é reinstalar |
| Teste de carga com 50k arquivos sintéticos | ⬜ | biblioteca real (1807) roda bem |
| Smoke E2E da janela Electron | ⬜ | não roda neste container (headless) |

## Como sai o instalador

1. GitHub → aba **Actions** → **Instalador do Windows** → **Run workflow**.
2. Ao terminar, baixar o artefato `Matrizes-instalador-windows`.
3. Para publicar uma versão: `git tag v1.0.0 && git push origin v1.0.0` — a
   Release é criada com o `.exe` anexado.

O workflow roda testes + typecheck no Linux antes de empacotar; se algo quebrar,
não gera instalador.

## Como a usuária roda hoje (modo desenvolvedora)

A usuária **não é programadora** — guiar com paciência, comandos um por linha,
sem `&&` (o PowerShell dela é a versão que não aceita). O app roda **no Windows
dela**, não neste ambiente (container Linux headless; aqui só dá para
`npm test`, `npm run typecheck`, `npm run build:app`).

```
git clone -b claude/embroidery-app-technical-plan-logdvd https://github.com/RomeuNascimento/matrizes.git
cd matrizes
npm install
npm run rebuild        # recompila better-sqlite3/sharp p/ Electron
npm run dev            # abre o app
```
Atualizar depois: `git pull` e `npm run dev`. Quando o instalador estiver
testado, esse caminho todo é substituído por um duplo-clique.

**Dados da usuária** ficam em `%APPDATA%\matrizes` — separados do código;
atualizar não apaga nada, e os arquivos de bordado originais nunca são tocados.

## Comportamento de sincronia (importante para o suporte)

- **Arquivo novo na pasta** → aparece ao clicar em "↻ Atualizar biblioteca".
- **Arquivo movido ou renomeado** → religado pelo hash do conteúdo; mantém nome
  dado, favorita e etiquetas. Não duplica.
- **Arquivo apagado** → vira "sumido": sai da galeria mas a ficha continua
  guardada em Manutenção → ⌀ Sumidos, até a usuária mandar tirar do catálogo.
- **Importação cancelada** → não marca nada como sumido (a varredura ficou pela
  metade, então a conclusão seria falsa).
- Nada disso escreve nos arquivos de bordado. O app só lê.

## Decisões firmadas

- Arquitetura: **Electron + Node/TypeScript + SQLite**; parser próprio em TS
  (sem Python em runtime; PyEmbroidery só como oráculo de teste).
- Funciona **local e offline**.
- **Subpastas** são a organização principal; **etiquetas** complementam.
- Segurança: **modo leitura sobre os originais** (nunca move/renomeia/apaga);
  escrita só no destino de cópia e em `%APPDATA%\matrizes`.
- **Público-alvo:** mulheres ~50 anos, pouca intimidade com informática.
  Priorizar simplicidade, botões óbvios e nada que mexa nos arquivos originais.
- IA para auto-organizar por tema: adiada (precisa de internet e tem custo).
