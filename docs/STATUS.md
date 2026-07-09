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
| **Renomear** (nome exibido, no painel de detalhes) | ✅ | `renderer/app.ts` |
| **Seleção múltipla na grade** (caixa no card, Ctrl/Shift+clique, Ctrl+A, Esc) | ✅ | `renderer/app.ts` |
| **Ações em lote**: favoritar, marcar testada, renomear e copiar | ✅ | barra flutuante em `renderer/app.ts` |
| **Tela de repetidos** (agrupa idênticos por hash, abre pasta) | ✅ | `renderDuplicados` em `renderer/app.ts` |
| **Tela de arquivos com problema** (motivo + abrir pasta) | ✅ | `renderErros` em `renderer/app.ts` |
| **Editar etiquetas** (adicionar/remover no painel de detalhes) | ✅ | `renderer/app.ts` |
| Favoritas / Testadas / Não testadas (lateral) | ✅ | `renderer/app.ts` |
| Cópia segura para pendrive | ✅ | `services/copier.ts` |
| Backup + verificação de integridade | ✅ | `db/backup.ts` |
| App Electron (build + typecheck) | ✅ | `src/main/index.ts`, `src/renderer/` |

## Falta tela (backend pronto)

| Item | Estado | Observação |
|---|---|---|
| Categorias (organizar em pastas próprias) | 🟡 | `listarCategorias()` pronto; falta atribuir na UI |
| Tela de configurações | ⬜ | — |

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

## Observações a investigar

- **Miniaturas pretas** — o parser e o renderizador estão corretos para a
  amostra (v1, 37/37 com cores certas; ver `AFLORAL` renderizado). O problema
  aparece na biblioteca real, provavelmente em arquivos **v5–v9** (que trazem
  paleta embutida — caminho ainda não validado visualmente) ou em desenhos de
  linha realmente escura.
  - **Como diagnosticar** (a usuária roda no Windows, um comando por linha):
    ```
    npm run inspect -- "C:\\caminho\\do\\arquivo.pes"
    ```
    Agora o `inspect` imprime a **versão** e as **cores lidas por bloco**, avisa
    quando **todas** as cores saem escuras (= miniatura preta) e **gera o PNG**
    (`arquivo.thumb.png`) ao lado, para comparar com a cor real do desenho.
  - Pedir à usuária a **versão** e as **cores** que aparecerem para um arquivo
    que ela sabe ser colorido → isso aponta se é falha de paleta por versão.
  - Correção de cor NÃO foi feita às cegas de propósito: o teste de paridade
    exige igualdade exata com o oráculo PyEmbroidery; mexer sem um arquivo real
    que reproduza o defeito arriscaria mascarar a causa.

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
- **Etiquetas**: no painel de detalhes (à direita), o botão **+ etiqueta**
  adiciona uma marca (ex.: "floral", "natal") e o **×** em cada etiqueta a
  remove. Servem para achar depois pela busca.

## Decisões firmadas

- Arquitetura: **Electron + Node/TypeScript + SQLite**; parser próprio em TS
  (sem Python em runtime; PyEmbroidery só como oráculo de teste).
- Funciona **local e offline**.
- **Subpastas** são a organização principal.
- Segurança: modo leitura sobre os originais; escrita só no destino de cópia e
  em `%APPDATA%\matrizes`.
