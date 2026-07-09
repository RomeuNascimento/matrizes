# Matrizes — organizador de matrizes de bordado

Aplicativo desktop (Windows) para bordadeiras organizarem centenas ou milhares
de matrizes de bordado computadorizado (foco em arquivos `.PES`).

> **Promessa:** ver todas as suas matrizes como imagens e encontrar qualquer
> desenho em segundos.

## Estado atual

Início do desenvolvimento. Estamos na **Fase 1 — prova técnica de leitura de
PES**, que é o item de maior risco do projeto.

- 📄 Planejamento completo: [`PLANEJAMENTO_TECNICO.md`](./PLANEJAMENTO_TECNICO.md)
- 🧩 Leitor de PES (em construção): [`src/embroidery/`](./src/embroidery/)
- 🔬 Ferramenta de inspeção: [`scripts/inspect.ts`](./scripts/inspect.ts)
- 📥 Onde enviar arquivos de teste: [`tests/fixtures/pes/README.md`](./tests/fixtures/pes/README.md)

## Rodando localmente

```bash
npm install
npm test              # testes unitários (vitest)
npm run typecheck     # checagem de tipos
npm run inspect -- caminho/para/um-arquivo.pes   # inspeciona um .PES real
```

## Stack

Electron + TypeScript + SQLite (ver seção "Arquitetura recomendada" do
planejamento). Nesta fase inicial rodamos apenas o núcleo em Node/TypeScript,
sem Electron, para provar a leitura dos arquivos antes de montar a interface.
