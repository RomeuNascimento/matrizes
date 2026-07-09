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
| Favoritas / Testadas / Não testadas (lateral) | ✅ | `renderer/app.ts` |
| Cópia segura para pendrive | ✅ | `services/copier.ts` |
| Backup + verificação de integridade | ✅ | `db/backup.ts` |
| App Electron (build + typecheck) | ✅ | `src/main/index.ts`, `src/renderer/` |

## Falta tela (backend pronto)

| Item | Estado | Observação |
|---|---|---|
| Seleção múltipla na grade | 🟡 | cópia já aceita vários ids; falta a UI de seleção |
| Renomear em lote | 🟡 | depende da seleção múltipla |
| Favoritar/testar/copiar em lote | 🟡 | idem |
| Tela de duplicados | 🟡 | `listarDuplicados()` pronto |
| Tela de arquivos com erro | 🟡 | `listarErros()` pronto |
| Categorias/etiquetas (edição) | 🟡 | CRUD parcial no repositório |
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

- **Muitas miniaturas aparecem em preto sólido** na biblioteca real. Pode ser
  linha escura real (comum em molduras) OU uma lacuna na leitura de cor de
  certos arquivos/versões. Vale investigar com alguns desses arquivos: rodar
  `npm run inspect -- "caminho\\arquivo.pes"` e comparar cor lida vs. esperada.

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

1. **Seleção múltipla na grade** → habilita favoritar/testar/copiar/renomear em
   lote (o pedido natural depois da navegação por pastas).
2. Investigar as **miniaturas pretas** (ver Observações).
3. Telas de **duplicados** e **erros** (backends prontos).
4. Quando estabilizar: **fábrica de instalador** (GitHub Actions) + auto-update.

## Decisões firmadas

- Arquitetura: **Electron + Node/TypeScript + SQLite**; parser próprio em TS
  (sem Python em runtime; PyEmbroidery só como oráculo de teste).
- Funciona **local e offline**.
- **Subpastas** são a organização principal.
- Segurança: modo leitura sobre os originais; escrita só no destino de cópia e
  em `%APPDATA%\matrizes`.
