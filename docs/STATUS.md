# Status de implementação do MVP

Situação por item do checklist do plano. Legenda: ✅ pronto e testado ·
🟡 backend pronto, falta tela · ⬜ pendente · 🪟 requer máquina Windows.

## Núcleo (pronto e testado — 62 testes automatizados)

| Item | Estado | Onde |
|---|---|---|
| Leitor de `.PES` (v1–v6, paleta embutida) | ✅ | `src/main/embroidery/` |
| Paridade exata com oráculo (37/37) | ✅ | `tests/unit/pes-reader.test.ts` |
| Miniaturas SVG→PNG nas cores reais | ✅ | `src/main/thumbnails/` |
| Banco SQLite: esquema, migrações, seeds | ✅ | `src/main/db/` |
| Busca por nome sem acento (FTS5) | ✅ | `repository.ts` / `db.test.ts` |
| Filtros (pasta, tamanho, formato, status, categoria, etiquetas, favorita, testada) | ✅ | `repository.ts` |
| Varredura recursiva + hash SHA-256 | ✅ | `src/main/filesystem/` |
| Importação incremental (tamanho+mtime) | ✅ | `services/importer.ts` |
| Cache de miniaturas por hash | ✅ | `thumbnails/cache.ts` |
| Favoritas, testada, observações, etiquetas | ✅ | `repository.ts` |
| Sugestão de bastidor | ✅ | `services/bastidores.ts` |
| Cópia segura para pendrive | ✅ | `services/copier.ts` / `copier.test.ts` |
| Detecção de unidades removíveis | ✅ (código; só roda no SO real) | `filesystem/drives.ts` |
| Duplicados por hash (identificar/agrupar) | ✅ backend | `repository.ts` |
| Backup + verificação de integridade | ✅ | `db/backup.ts` |
| App Electron: galeria, busca, detalhes, importar | ✅ (build+types) | `src/main/index.ts`, `src/renderer/` |

## Falta tela (backend pronto)

| Item | Estado | Observação |
|---|---|---|
| Tela de duplicados | 🟡 | `listarDuplicados()` já existe; falta a tela |
| Tela de arquivos com erro | 🟡 | `listarErros()` já existe; falta a tela |
| Seleção múltipla na grade + cópia em lote | 🟡 | cópia aceita vários ids; UI copia 1 por vez hoje |
| Edição de categorias/etiquetas (tela) | 🟡 | CRUD parcial no repositório |
| Tela de configurações | ⬜ | — |
| Relatório de importação (tela dedicada) | 🟡 | resumo já aparece na barra |

## Pendências que exigem a máquina Windows

| Item | Estado |
|---|---|
| Recompilar módulos nativos p/ Electron (`npm run rebuild`) | 🪟 |
| Rodar o app com janela (`npm run dev`) | 🪟 |
| Gerar e testar o instalador NSIS (`npm run dist`) | 🪟 |
| Testar com pendrive real | 🪟 |
| Assinatura de código (evitar SmartScreen) | 🪟 / decisão pendente |

## Fora do MVP (planejado para depois)

- Monitoramento de pastas em tempo real (watcher) — v1.1
- Duplicados nível 2 (mesmo desenho em formatos diferentes) — v1.2
- Outros formatos (`.DST`, `.JEF`, `.EXP`, `.VP3`, `.XXX`) — arquitetura já preparada
- Edição de matrizes, catálogo em PDF, nuvem — pós-MVP

## Próximos passos recomendados

1. Na máquina Windows: `npm install && npm run rebuild && npm run dev` para ver
   o app rodando com a biblioteca real.
2. Adicionar as telas de duplicados e erros (backend já pronto).
3. Seleção múltipla na grade para cópia em lote.
4. `npm run dist` para o primeiro instalador de teste.
