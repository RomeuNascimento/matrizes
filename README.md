# Matrizes — organizador de matrizes de bordado

Aplicativo desktop (Windows) para bordadeiras organizarem centenas ou milhares
de matrizes de bordado computadorizado (foco em arquivos `.PES`).

> **Promessa:** ver todas as suas matrizes como imagens e encontrar qualquer
> desenho em segundos.

## Estado atual (v1.0.0)

Aplicativo completo e testado ponta a ponta:

- ✅ **Leitor de PES** próprio em TypeScript — paridade exata com o oráculo
  (PyEmbroidery) nos 37 arquivos reais, incluindo PES v1–v10 e paleta embutida.
- ✅ **Miniaturas** renderizadas em TS (SVG → PNG via `sharp`), nas cores reais das linhas.
- ✅ **Banco SQLite** com esquema completo, migrações, seeds e busca sem acento (FTS5).
- ✅ **Varredura + hash + importação** incremental, com miniaturas em cache por hash.
- ✅ **Sincronia com o disco:** arquivos movidos ou renomeados são religados pelo
  hash (mantendo favoritas e etiquetas); apagados viram "sumidos", nunca somem
  do catálogo sem a usuária mandar.
- ✅ **App Electron**: galeria paginada, busca, filtros, subpastas, etiquetas,
  seleção múltipla e ações em lote, telas de manutenção, configurações,
  cópia para pendrive e backup automático.
- ✅ **Instalador do Windows** montado por GitHub Actions (`npm run dist` num
  runner Windows), com ícone próprio.

Status detalhado: [`docs/STATUS.md`](./docs/STATUS.md) ·
Guia da compradora: [`docs/INSTALACAO.md`](./docs/INSTALACAO.md) ·
Decisões: [`PLANEJAMENTO_TECNICO.md`](./PLANEJAMENTO_TECNICO.md) ·
Prova técnica: [`docs/FASE1-leitura-pes.md`](./docs/FASE1-leitura-pes.md).

## Estrutura

```
src/
  main/           processo principal (Node)
    embroidery/   leitor de PES/PEC + paleta
    thumbnails/   SVG -> PNG + cache
    db/           SQLite: migrações, seeds, repositório
    filesystem/   varredura, hash, caminhos longos
    services/     importador, bastidores
    ipc/          handlers de IPC
    index.ts      ciclo de vida, janela, protocolo thumb://
  preload/        window.api (contextBridge)
  renderer/       interface (HTML/CSS/TS)
  shared/         contratos backend <-> renderer
tests/            unitários + integração + fixtures (.PES reais)
scripts/          inspeção, validação, oráculo (Python), galeria
```

## Desenvolvimento

```bash
npm install
npm test              # 70 testes (parser, banco, pipeline, sincronia)
npm run typecheck     # checagem de tipos
npm run validate      # compara o leitor TS com o oráculo, arquivo a arquivo
npm run icones        # regera build/icon.png e build/icon.ico
npm run dev           # abre o app em modo desenvolvimento (requer ambiente gráfico)
```

> **Módulos nativos:** `better-sqlite3` e `sharp` precisam ser compilados para a
> ABI do Electron ao rodar o app. Rode `npm run rebuild` após instalar (usa
> `@electron/rebuild`). Ao empacotar, o `electron-builder` já cuida disso.

## Empacotamento (Windows)

**Pelo GitHub (recomendado — não precisa de um PC Windows):** aba **Actions** →
**Instalador do Windows** → **Run workflow**. O `.exe` sai como artefato. Para
publicar uma versão, basta uma tag: `git tag v1.0.0 && git push origin v1.0.0`.

**Numa máquina Windows:**

```bash
npm install
npm run dist          # gera o instalador NSIS em dist/
```

## Ferramentas de referência (Python)

O PyEmbroidery é usado **apenas** como oráculo de validação (não faz parte do
app distribuído):

```bash
python3 -m venv .venv-oracle
.venv-oracle/bin/pip install -r tests/oracle/requirements.txt
.venv-oracle/bin/python scripts/oracle_report.py tests/fixtures/pes/alfabeto-floral saida/
```
