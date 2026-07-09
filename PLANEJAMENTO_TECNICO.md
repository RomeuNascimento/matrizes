# PLANEJAMENTO TÉCNICO — Organizador de Matrizes de Bordado

**Produto:** aplicativo desktop Windows para organizar matrizes de bordado computadorizado (foco em `.PES`)
**Promessa:** "Veja todas as suas matrizes como imagens e encontre qualquer desenho em segundos."
**Data:** 2026-07-09
**Status:** aguardando aprovação — nenhum código de produção foi escrito ou alterado.

---

## 1. Resumo executivo

Este documento planeja a transformação de um protótipo visual (HTML/CSS/JavaScript) em um aplicativo desktop Windows, local e offline, para bordadeiras que acumulam centenas ou milhares de matrizes de bordado espalhadas em pastas do computador.

**Decisões principais recomendadas:**

| Decisão | Recomendação |
|---|---|
| Plataforma desktop | **Electron** (Alternativa A) |
| Linguagem do backend | Node.js + TypeScript no processo principal |
| Banco de dados | SQLite via `better-sqlite3`, modo WAL |
| Leitura de `.PES` | Parser próprio em TypeScript (formato documentado; bloco PEC), validado contra `pyembroidery` como oráculo de testes; fallback: sidecar Python com PyEmbroidery |
| Miniaturas | Renderização dos pontos como SVG → rasterização PNG com `sharp`; cache em disco indexado por hash |
| Indexação | Fila em `worker_threads`, lotes, progresso via IPC, atualização incremental por `tamanho+mtime` com hash SHA-256 sob demanda |
| Segurança | Modo somente-leitura sobre os arquivos originais; toda escrita restrita a cópias explícitas e ao diretório de dados do app |

**Ponto crítico encontrado na auditoria:** o repositório `RomeuNascimento/matrizes` está **vazio** (sem commits, sem arquivos). O protótipo HTML/CSS/JS descrito no briefing **não está nesta pasta nem no repositório remoto**. Este planejamento foi elaborado a partir da descrição funcional fornecida; a Etapa de auditoria do protótipo (Seção 2) documenta exatamente o que foi verificado e precisa ser refeita assim que os arquivos do protótipo forem adicionados ao repositório. Nenhuma outra seção depende de detalhes internos do protótipo — a arquitetura foi desenhada para **absorver qualquer interface HTML/CSS/JS existente como camada de renderização**, então o plano permanece válido.

**Próximo passo recomendado:** enviar os arquivos do protótipo ao repositório para completar a auditoria (Seção 2) e, em paralelo, aprovar a arquitetura para iniciar a Fase 1 (prova técnica de leitura de PES).

---

## 2. Diagnóstico do projeto atual (Etapa 1 — Auditoria)

### 2.1 O que foi verificado

Auditoria executada em 2026-07-09 sobre `/home/user/matrizes` (clone do repositório `RomeuNascimento/matrizes`):

| Verificação | Comando/método | Resultado |
|---|---|---|
| Arquivos na pasta | listagem recursiva completa (incluindo ocultos) | **Apenas o diretório `.git/`** — nenhum arquivo de projeto |
| Histórico git local | `git log` | **Nenhum commit** ("No commits yet") |
| Branches locais | `git branch -a` | Apenas a branch de trabalho, sem commits |
| Branches remotas | `git ls-remote origin` | **Nenhuma referência** — repositório remoto vazio |

### 2.2 Consequência para cada item da auditoria solicitada

1. **Estrutura atual do projeto:** inexistente no repositório (apenas `.git/`).
2. **Tecnologias utilizadas:** não verificáveis — presume-se HTML/CSS/JavaScript puro, conforme briefing.
3. **Componentes e telas existentes:** não verificáveis. O briefing descreve: categorias, segmentações, filtros e cards de matrizes.
4. **Funcionalidades apenas simuladas:** não verificáveis; em protótipos estáticos, tipicamente **todas** (dados fixos no HTML, filtros sem lógica, botões sem handlers).
5. **Partes do HTML reaproveitáveis:** a decidir na re-auditoria. Em geral: estrutura da galeria/cards, sidebar de categorias, barra de busca/filtros, painel de detalhes e o CSS do tema tendem a ser 100% reaproveitáveis como camada de renderização.
6. **Partes a refatorar:** a decidir. Tipicamente: dados embutidos no HTML → templates alimentados por dados do backend; handlers inline → módulos JS; ausência de estados vazio/carregando/erro → adicionar.
7. **Problemas de arquitetura/manutenção/desempenho:** a decidir. Riscos típicos a inspecionar: HTML monolítico, CSS sem organização, renderização de milhares de cards sem virtualização.
8. **Dados fixos/mockados:** a decidir; presume-se que todos os cards e categorias são estáticos.
9. **Eventos sem funcionalidade real:** a decidir; presume-se busca, filtros, favoritos e botões de ação.
10. **Dependências externas:** **nenhuma dependência instalada foi encontrada** (não há `package.json`, `node_modules`, `requirements.txt` nem qualquer manifesto). A recomendação de bibliotecas na Seção 9 parte, portanto, de um projeto sem dependências — nada será instalado antes da aprovação.

### 2.3 Ação obrigatória antes da Fase 1

> **Pendência bloqueante da auditoria:** adicionar os arquivos do protótipo (HTML, CSS, JS e assets) ao repositório. A re-auditoria (checklist da Seção 2.2, itens 1–10, com referências a arquivos e linhas) será a primeira entrega da Fase 0 e pode alterar apenas a **Seção 11 (telas)** e a lista de arquivos reaproveitáveis — nenhuma decisão de arquitetura depende dela.

---

## 3. Escopo do MVP (Etapa 2)

### 3.1 Dentro do MVP

**Plataforma**
- Aplicativo instalável no Windows 10/11 x64 (instalador NSIS).
- Funcionamento 100% local e offline.

**Biblioteca**
- Seleção de uma ou mais pastas do computador (MVP: fluxo otimizado para uma pasta; múltiplas pastas suportadas pelo modelo de dados desde o início).
- Varredura recursiva de subpastas.
- Identificação de arquivos `.PES` (arquitetura pronta para outros formatos; ver Seção 8.10).
- Extração de metadados: nome, caminho, tamanho, datas, largura, altura, nº de pontos, nº de cores, versão do PES.
- Geração de miniaturas PNG com cache em disco.
- Exibição em grade com miniaturas grandes e rolagem virtualizada.
- Atualização incremental: novos arquivos, alterados e removidos detectados ao abrir o app e via botão "Atualizar biblioteca".

**Busca e organização**
- Busca por nome (nome exibido, nome original e caminho).
- Filtros por: pasta de origem, faixa de tamanho do bordado, formato, status, categoria, etiquetas, favorita, testada.
- Categorias (1 por matriz) e etiquetas (N por matriz), criáveis/editáveis/removíveis pela usuária.
- Favoritos.
- Marcação "testada" / "não testada".
- Observações de texto livre por matriz.

**Detalhes e operações**
- Painel de detalhes com miniatura ampliada e todos os metadados.
- Botão "Abrir local do arquivo" (Explorer com o arquivo selecionado).
- Seleção múltipla e "Copiar para pendrive" (Seção 14).
- Duplicados nível 1 (hash idêntico): identificar, agrupar e exibir — sem apagar nada.
- Tela de arquivos com erro de processamento.
- Relatório ao final de cada importação.

**Infra**
- Banco SQLite local no diretório de dados da usuária.
- Backup automático do banco e das configurações (Seção 13).
- Preservação absoluta dos arquivos originais (Seção 13 — requisito inegociável).

### 3.2 Fora do MVP (Etapa 2 — exclusões explícitas)

| Excluído do MVP | Motivo / quando |
|---|---|
| Edição de matrizes (redimensionar, mudar cores, converter formatos) | Produto diferente; alto risco; pós-MVP distante |
| Leitura de `.DST`, `.JEF`, `.EXP`, `.VP3`, `.XXX` (`.PEC` entra "de graça" pois é o bloco interno do PES) | v1.1+; a arquitetura já prevê (Seção 8.10) |
| Duplicados nível 2 (mesmo desenho em formatos diferentes) | v1.2+; MVP entrega apenas heurística informativa por nome-base (Seção 10) |
| Sincronização em nuvem, multiusuário, contas | Contradiz "local e offline" do MVP |
| Monitoramento de pastas em tempo real (watcher contínuo) | MVP usa rescan ao abrir + botão; watcher é v1.1 |
| Simulação de costura / preview animado ponto a ponto | v2 |
| Impressão de catálogo / exportação PDF | v1.2 |
| macOS / Linux | Windows primeiro |
| Auto-update automático | v1.1 (MVP: instalador manual; estrutura do electron-builder já deixa pronto) |
| Detecção de bastidor por máquina específica da usuária | MVP usa tabela genérica de bastidores (100×100, 130×180, 160×260 mm etc.) |
| Renomear/mover/organizar fisicamente os arquivos | Contrário à regra de segurança; talvez nunca entre |

---

## 4. Arquitetura recomendada e comparação de alternativas (Etapa 3)

### 4.1 Comparação

| Critério | **A — Electron + Node + SQLite** | **B — Tauri + Rust + SQLite** | **C — Electron/Tauri + sidecar Python (PyEmbroidery)** |
|---|---|---|---|
| Facilidade de desenvolvimento | **Alta** — uma linguagem (TS/JS) em todo o stack | Média/baixa — exige Rust no backend | Média — dois runtimes, dois processos, dois empacotamentos |
| Compatibilidade com o HTML atual | **Total** — o protótipo vira o renderer sem conversão | Total no WebView, mas APIs de sistema via Rust | Total na UI; parsing fica no sidecar |
| Acesso ao sistema de arquivos | Completo (Node `fs`, streams, `worker_threads`) | Completo, com modelo de permissões explícito (mais seguro, mais burocrático) | Completo (dividido entre host e sidecar) |
| Leitura de PES | Sem lib madura pronta em JS → **parser próprio** (~formato documentado; ver 4.3) | Sem lib madura em Rust → parser próprio em Rust (mais lento de desenvolver) | **PyEmbroidery: melhor cobertura existente do formato** (PES v1–v6 + dezenas de formatos) |
| Geração de imagens | `sharp` (nativa, rápida) ou SVG puro | `resvg`/`image` crates — bom | Pillow/`cairo` no Python — bom |
| Desempenho de indexação | Bom (workers + I/O assíncrono; hash e parse são I/O-bound) | **Excelente** | Bom, mas com custo de serialização entre processos |
| Consumo de memória | Alto (~150–300 MB base, Chromium) | **Baixo (~40–80 MB, WebView2)** | Mais alto ainda (Electron + interpretador Python residente) |
| Tamanho do instalador | ~80–120 MB | **~5–15 MB** (requer WebView2, já presente no Win10/11) | ~120–180 MB (Electron + Python congelado via PyInstaller) |
| Facilidade de manutenção | **Alta** — stack única, ecossistema enorme | Média — dois ecossistemas (Rust + JS) | **Baixa** — três superfícies (JS, Python, protocolo IPC próprio) |
| Empacotamento Windows | Maduro (`electron-builder`: NSIS, assinatura, auto-update) | Bom (`tauri-bundler` MSI/NSIS), auto-update ok | Complexo: PyInstaller + electron-builder; antivírus implica em falsos positivos com binários PyInstaller |
| Comunicação frontend↔backend | IPC nativo (`ipcMain`/`ipcRenderer` + `contextBridge`), tipável | `invoke`/eventos Tauri, tipável | Duas camadas: IPC Electron **+** stdio/HTTP local para o sidecar |
| Riscos técnicos | Parser PES próprio pode ter lacunas em versões antigas do formato | Curva Rust; parser PES do zero em Rust; menos exemplos | Sidecar morre/trava; antivírus; sincronizar versões; inicialização lenta |
| Complexidade para um MVP | **Baixa/média** | Média/alta | **Alta** |

### 4.2 Escolha: **Alternativa A — Electron + Node.js (TypeScript) + SQLite**

Justificativa objetiva:

1. **Menor distância do protótipo ao produto.** O HTML/CSS/JS existente roda no renderer do Electron sem tradução. Tauri também permitiria isso, mas toda a lógica de sistema (scan, hash, parse, thumbnails, cópia) teria de ser escrita em Rust — custo alto para um MVP.
2. **Uma única linguagem** reduz o custo de manutenção para um time pequeno (provavelmente 1 dev).
3. **Ecossistema Node cobre todos os subsistemas do MVP** com bibliotecas maduras: `better-sqlite3` (banco), `sharp` (imagens), `worker_threads` (fila), `drivelist` (pendrives), `chokidar` (watcher futuro), `electron-builder` (instalador NSIS).
4. **O gargalo real do produto é I/O de disco, não CPU** — a vantagem de desempenho do Rust (Tauri) pouco aparece; a desvantagem de memória do Electron (~200 MB) é aceitável em máquinas Windows modernas.
5. **A alternativa C só se justifica se o parser JS falhar.** PyEmbroidery é a referência do formato, mas o custo de empacotar e manter um sidecar Python supera o custo de portar a leitura de PES para TypeScript — o formato PES/PEC é documentado e o código do PyEmbroidery (MIT) serve de especificação executável. **Plano B declarado:** se na Fase 1 o parser TS não atingir os critérios de aceite com a biblioteca real de testes, adota-se C (sidecar Python) sem mudar nada da UI, do banco ou dos contratos IPC — apenas a implementação interna de `embroidery/` muda. Esse é o motivo de isolar o parser atrás de uma interface (Seção 15).

### 4.3 Estrutura macro

```
┌────────────────────────────────────────────────────────┐
│ Renderer (protótipo HTML/CSS/JS)                       │
│  galeria • filtros • busca • detalhes • configurações  │
└──────────────▲─────────────────────────────────────────┘
               │ contextBridge (window.api.*) — Seção 15
┌──────────────┴─────────────────────────────────────────┐
│ Main process (Node/TypeScript)                         │
│  ipc/ → services/ (importer, library, dedup, copy)     │
│  db/ (better-sqlite3, migrações)                       │
│  embroidery/ (parser PES/PEC atrás de interface)       │
│  thumbnails/ (SVG→PNG via sharp, cache por hash)       │
│  filesystem/ (scan, hash, drives, cópia segura)        │
└──────────────▲─────────────────────────────────────────┘
               │ worker_threads (pool)
┌──────────────┴─────────────────────────────────────────┐
│ Workers: hash + parse + thumbnail (por lote)           │
└────────────────────────────────────────────────────────┘

Dados da usuária (%APPDATA%/MatrizesApp/):
  library.db (SQLite WAL) • cache/thumbs/*.png • logs/ • backups/
```

Princípios:
- Renderer **nunca** toca disco/banco diretamente (`contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`).
- Trabalho pesado **nunca** roda no thread principal (nem do main, nem do renderer) — sempre em `worker_threads`.
- Arquivos originais são abertos **somente para leitura** em 100% do código, exceto a rotina de cópia (que só escreve no destino escolhido).

---

## 5. Leitura dos arquivos de bordado (Etapa 4)

Verificação prévia: **não há nenhuma dependência instalada no projeto** (Seção 2.2, item 10), portanto não existe biblioteca de bordado disponível para reaproveitar. Opções avaliadas:

| Opção | Estado | Avaliação |
|---|---|---|
| **PyEmbroidery** (Python, MIT) | Referência do mercado; PES v1–v6, PEC, DST, JEF, EXP, VP3, XXX… | Melhor cobertura, mas exige sidecar Python (Alternativa C) — descartada como padrão, mantida como plano B e como **oráculo de testes** |
| Ports JS existentes (npm) | Fragmentados, sem manutenção ativa, cobertura parcial de versões do PES | Não confiáveis como dependência de produção |
| libembroidery (C) | Ativa, mas binding Node exigiria compilação nativa própria | Custo alto de manutenção |
| **Parser próprio em TypeScript** | Formato PES/PEC documentado (specs públicas + código do PyEmbroidery como referência) | **Recomendado** — sem dependência nativa, sem sidecar, testável |

**Recomendação: parser próprio em TypeScript** (módulo `src/main/embroidery/`), lendo apenas o necessário para o MVP: cabeçalho PES (versão, bounding box, nome interno quando houver) + bloco PEC (lista de pontos e trocas de cor). Nada será instalado antes da aprovação deste plano.

Respostas aos 10 pontos:

1. **Detecção de arquivos.** Varredura recursiva com `fs.opendir` (iterativo, sem estourar pilha), filtrando por extensão case-insensitive (`.pes`). Confirmação pelo magic number: os 4 primeiros bytes de um PES são `#PES` (ex.: `#PES0060` = v6). Extensão certa + assinatura errada → registrar em `erros_processamento` como "não é um PES válido".
2. **Metadados.** Do sistema de arquivos: nome, caminho, tamanho, `birthtime`/`mtime`. Do cabeçalho PES: versão do formato e, nas versões que suportam, nome interno do desenho. Do bloco PEC: geometria e cores.
3. **Largura e altura.** Calculadas a partir do bounding box dos pontos do bloco PEC (unidade nativa: 0,1 mm). Armazenar em mm com 1 casa decimal. Não confiar apenas no bounding box declarado no cabeçalho (há arquivos com cabeçalho inconsistente) — recalcular dos pontos e usar o cabeçalho como validação.
4. **Quantidade de pontos.** Contagem dos comandos de ponto no PEC, excluindo comandos de controle (jump, trim, troca de cor, fim).
5. **Quantidade de cores.** Contagem de blocos de cor do PEC (nº de trocas + 1). O PEC indexa numa paleta fixa de 64 cores de linha; guardar também os índices para renderizar a miniatura com as cores corretas.
6. **Miniatura.** Reconstruir as polilinhas (sequências de pontos entre jumps/trims), gerar SVG (`<polyline>` por bloco de cor, `stroke-linecap/linejoin: round`, fundo transparente ou branco conforme tema), rasterizar para PNG com `sharp` em dois tamanhos: **256 px** (grade) e **512 px** (painel de detalhes). Guardar em `cache/thumbs/<sha256>_256.png`. Nomear pelo hash do conteúdo torna o cache imune a renomeações e compartilhável entre duplicados.
7. **Arquivos inválidos/corrompidos.** Todo parse roda em `try/catch` dentro do worker com validações defensivas (tamanho mínimo, offsets dentro do arquivo, limite de 2 milhões de pontos como sanidade). Falha → registro em `erros_processamento` (caminho, etapa, mensagem, data) + card "erro" na tela dedicada (Seção 11.13). Um arquivo ruim **nunca** interrompe o lote. Timeout de 30 s por arquivo no worker.
8. **Evitar reprocessamento.** Na reabertura: comparar (`caminho`, `tamanho`, `mtime`) de cada arquivo em disco com o banco. Iguais → pular (nem hash é recalculado). O custo de reabertura vira uma listagem de diretórios, não uma releitura de conteúdo.
9. **Detecção de alteração.** `tamanho+mtime` diferentes → recalcular SHA-256. Hash igual (só mtime mudou) → atualizar mtime no banco. Hash diferente → reparse + nova miniatura, preservando metadados da usuária (categoria, etiquetas, status, observações). Arquivo sumiu → marcar `ausente` (não deletar o registro; a usuária pode ter só desconectado um HD). Hash conhecido em caminho novo → tratar como arquivo movido/renomeado: religar o registro existente ao novo caminho, mantendo toda a organização.
10. **Outros formatos no futuro.** Interface única `EmbroideryReader` com `supports(ext, magicBytes)` e `read(buffer): DesignData` (pontos, blocos de cor, dimensões, metadados). Registry de readers por formato; tabela `formatos` no banco; o restante do pipeline (hash, thumbnail, banco, UI) é agnóstico ao formato. Adicionar `.DST` = escrever 1 classe + testes. Ordem sugerida pós-MVP: `.DST` (mais comum no mercado), `.JEF`, `.EXP`, `.VP3`, `.XXX`.

---

## 6. Modelo de dados (Etapa 5)

SQLite, modo WAL, `foreign_keys = ON`. Migrações versionadas (tabela `schema_migrations`). Convenções: `id INTEGER PRIMARY KEY AUTOINCREMENT`; datas em ISO-8601 UTC (`TEXT`); booleanos como `INTEGER 0/1`.

### 6.1 Tabelas

**`formatos`** — formatos de arquivo suportados
| Campo | Tipo | Notas |
|---|---|---|
| id | INTEGER PK | |
| extensao | TEXT UNIQUE NOT NULL | `pes`, `dst`, … |
| nome | TEXT | "Brother PES" |
| suportado | INTEGER NOT NULL DEFAULT 0 | 1 = reader implementado |

**`pastas_monitoradas`** — raízes escolhidas pela usuária
| Campo | Tipo | Notas |
|---|---|---|
| id | INTEGER PK | |
| caminho | TEXT UNIQUE NOT NULL | absoluto, normalizado |
| apelido | TEXT | "HD Externo" |
| ativa | INTEGER NOT NULL DEFAULT 1 | |
| criada_em / ultima_varredura_em | TEXT | |

**`matrizes`** — entidade lógica central (o "desenho")
| Campo | Tipo | Notas |
|---|---|---|
| id | INTEGER PK | |
| nome_exibido | TEXT NOT NULL | editável pela usuária |
| categoria_id | INTEGER FK→categorias(id) ON DELETE SET NULL | |
| fornecedor_id | INTEGER FK→fornecedores(id) ON DELETE SET NULL | |
| colecao_id | INTEGER FK→colecoes(id) ON DELETE SET NULL | |
| status_id | INTEGER FK→status(id) ON DELETE SET NULL | |
| favorita | INTEGER NOT NULL DEFAULT 0 | |
| testada | INTEGER NOT NULL DEFAULT 0 | |
| observacoes | TEXT | |
| bastidor_sugerido | TEXT | calculado das dimensões (ex.: "130×180") |
| criada_em / atualizada_em | TEXT NOT NULL | |

**`arquivos`** — arquivo físico em disco (N arquivos → 1 matriz; base do dedup nível 2)
| Campo | Tipo | Notas |
|---|---|---|
| id | INTEGER PK | |
| matriz_id | INTEGER NOT NULL FK→matrizes(id) ON DELETE CASCADE | |
| pasta_monitorada_id | INTEGER NOT NULL FK→pastas_monitoradas(id) ON DELETE CASCADE | |
| formato_id | INTEGER NOT NULL FK→formatos(id) | |
| nome_original | TEXT NOT NULL | nome do arquivo em disco |
| caminho_absoluto | TEXT NOT NULL UNIQUE | |
| caminho_relativo | TEXT NOT NULL | relativo à pasta monitorada |
| extensao | TEXT NOT NULL | |
| hash_sha256 | TEXT NOT NULL | **índice não-único** (duplicados compartilham hash) |
| tamanho_bytes | INTEGER NOT NULL | |
| criado_em_fs / modificado_em_fs | TEXT | datas do filesystem |
| largura_mm / altura_mm | REAL | unidade fixa: mm |
| unidade | TEXT NOT NULL DEFAULT 'mm' | |
| num_pontos / num_cores | INTEGER | |
| versao_formato | TEXT | ex.: "PES 6" |
| status_processamento | TEXT NOT NULL DEFAULT 'pendente' | `pendente`/`ok`/`erro`/`ausente` |
| analisado_em | TEXT | data da última análise |

> Nota: os "campos da matriz" pedidos no briefing ficam divididos entre `matrizes` (dados da usuária, que sobrevivem a mover/renomear arquivo) e `arquivos` (dados físicos/técnicos). No MVP cada matriz tem exatamente 1 arquivo; a separação existe para o dedup nível 2 e multi-formato sem migração futura.

**`categorias`** — hierárquica (subcategorias via auto-relação)
| id INTEGER PK · nome TEXT NOT NULL · pai_id INTEGER FK→categorias(id) ON DELETE CASCADE · icone TEXT · ordem INTEGER · UNIQUE(nome, pai_id) |

**`etiquetas`**
| id INTEGER PK · nome TEXT NOT NULL · dimensao TEXT NOT NULL DEFAULT 'geral' (`tema`/`ocasiao`/`aplicacao`/`tecnica`/`geral`) · cor TEXT · UNIQUE(nome, dimensao) |

**`matriz_etiquetas`** (N:N)
| matriz_id INTEGER FK→matrizes ON DELETE CASCADE · etiqueta_id INTEGER FK→etiquetas ON DELETE CASCADE · PRIMARY KEY (matriz_id, etiqueta_id) |

**`colecoes`** | id PK · nome TEXT UNIQUE NOT NULL · descricao TEXT |

**`fornecedores`** | id PK · nome TEXT UNIQUE NOT NULL · site TEXT · observacoes TEXT |

**`status`** — semeada com os 8 status da Seção 7; usuária pode criar mais
| id PK · nome TEXT UNIQUE NOT NULL · cor TEXT · sistema INTEGER DEFAULT 0 (1 = não removível) |

**`miniaturas`**
| id PK · hash_sha256 TEXT NOT NULL · tamanho_px INTEGER NOT NULL · caminho_cache TEXT NOT NULL · gerada_em TEXT · UNIQUE(hash_sha256, tamanho_px) |

**`configuracoes`** | chave TEXT PK · valor TEXT (JSON) |

**`historico_importacao`**
| id PK · pasta_monitorada_id FK · iniciada_em / finalizada_em TEXT · status TEXT (`concluida`/`cancelada`/`falhou`) · total_encontrados / novos / atualizados / removidos / erros INTEGER · duracao_ms INTEGER |

**`erros_processamento`**
| id PK · importacao_id FK→historico_importacao ON DELETE SET NULL · caminho_absoluto TEXT NOT NULL · etapa TEXT (`scan`/`hash`/`parse`/`thumbnail`/`copia`) · mensagem TEXT · ocorrido_em TEXT · resolvido INTEGER DEFAULT 0 |

### 6.2 Índices

```sql
CREATE INDEX idx_arquivos_hash        ON arquivos(hash_sha256);
CREATE UNIQUE INDEX ux_arquivos_path  ON arquivos(caminho_absoluto);
CREATE INDEX idx_arquivos_matriz      ON arquivos(matriz_id);
CREATE INDEX idx_arquivos_pasta       ON arquivos(pasta_monitorada_id);
CREATE INDEX idx_arquivos_status      ON arquivos(status_processamento);
CREATE INDEX idx_matrizes_categoria   ON matrizes(categoria_id);
CREATE INDEX idx_matrizes_status      ON matrizes(status_id);
CREATE INDEX idx_matrizes_flags       ON matrizes(favorita, testada);
CREATE INDEX idx_me_etiqueta          ON matriz_etiquetas(etiqueta_id);
-- Busca por nome: FTS5 sobre nome_exibido, nome_original e caminho_relativo
CREATE VIRTUAL TABLE matrizes_fts USING fts5(
  nome_exibido, nome_original, caminho_relativo,
  content='', tokenize='unicode61 remove_diacritics 2'
);
```

FTS5 com `remove_diacritics` garante que "coração" seja encontrado digitando "coracao" — essencial para o público-alvo. Sincronizada por triggers ou pelo serviço de escrita.

### 6.3 Regras contra duplicação

- `arquivos.caminho_absoluto` UNIQUE → o mesmo arquivo nunca entra duas vezes.
- `hash_sha256` **indexado, não único** → duplicados coexistem no banco e são agrupados por consulta (Seção 10).
- Reimportação usa UPSERT por caminho; hash já conhecido em caminho novo religa o registro (move/rename) em vez de criar matriz nova.
- `UNIQUE(nome, pai_id)` em categorias e `UNIQUE(nome, dimensao)` em etiquetas evitam taxonomias duplicadas (comparação case-insensitive via `COLLATE NOCASE`).

---

## 7. Sistema de organização (Etapa 6)

### 7.1 Modelo híbrido

Uma matriz tem **uma localização física** (intocada) e **N classificações lógicas**. Aparecer em "Natal", "toalha" e "favoritas" ao mesmo tempo é só resultado de consultas — nunca cópia física.

| Dimensão | Mecanismo no modelo | Cardinalidade |
|---|---|---|
| Localização original | `arquivos.caminho_*` + `pastas_monitoradas` | 1 |
| Categoria/subcategoria (tema) | `categorias` hierárquica | 1 por matriz |
| Etiquetas | `etiquetas` com campo `dimensao` | N |
| — Tema extra | etiqueta `dimensao='tema'` | N |
| — Ocasião | etiqueta `dimensao='ocasiao'` | N |
| — Aplicação | etiqueta `dimensao='aplicacao'` | N |
| — Técnica | etiqueta `dimensao='tecnica'` | N |
| Coleção | `colecoes` | 1 |
| Fornecedor | `fornecedores` | 1 |
| Bastidor | `bastidor_sugerido` (derivado das dimensões) | 1 |
| Status | `status` | 1 |
| Favorita / Testada | flags booleanas | — |
| Observações | texto livre | — |

### 7.2 Vocabulário inicial (seeds — todos editáveis)

- **Categorias (tema):** floral, infantil, religioso, animais, profissões, casamento, maternidade, personagens, monogramas, frases.
- **Etiquetas de ocasião:** Natal, Páscoa, Dia das Mães, Dia dos Pais, casamento, batizado, aniversário.
- **Etiquetas de aplicação:** toalha, camiseta, uniforme, boné, fralda, bolsa, almofada, patch, enxoval.
- **Etiquetas de técnica:** aplique, preenchimento, redwork, ponto corrido, ITH, quilting, FSL, patch.
- **Status:** não testada (padrão), testada, deu problema, precisa editar, já utilizada, uso pessoal, uso comercial. ("Favorita" é flag, não status — pode coexistir com qualquer status.)

### 7.3 Gestão de categorias e etiquetas na interface

- **Criar:** botão "+" na sidebar (categorias) e no editor de etiquetas do painel de detalhes; campo de etiqueta com autocomplete que oferece "criar '<texto>'" quando não existe — cria sem sair do fluxo.
- **Editar/renomear:** menu de contexto (⋯) em cada item da sidebar e na tela Configurações → aba Organização. Renomear reflete em todas as matrizes instantaneamente (é só um UPDATE).
- **Remover:** sempre com confirmação mostrando o impacto ("A categoria 'Floral' está em 143 matrizes. Elas ficarão **sem categoria** — nenhum arquivo será alterado."). Remoção de categoria-pai pergunta o destino das filhas. Status de sistema não podem ser removidos.
- **Mesclar:** (v1.1) arrastar etiqueta sobre outra → mesclar.
- Aplicação em massa: com N matrizes selecionadas, painel lateral aplica categoria/etiquetas/status a todas de uma vez — essencial para organizar milhares de itens.

---

## 8. Importação e indexação (Etapa 7) + estratégia de miniaturas

### 8.1 Fluxo completo

```
1. Usuária clica "Adicionar pasta" → diálogo nativo do Windows
2. Confirmação: "Ler a pasta X? O aplicativo apenas LÊ seus arquivos;
   nada será movido, renomeado ou apagado." → grava em pastas_monitoradas
3. FASE SCAN (rápida): varredura recursiva → lista de candidatos (.pes)
   → UI já mostra "Encontrados: 8.412 arquivos"
4. Diff com o banco: novos / alterados (size+mtime) / inalterados / sumidos
5. FASE PROCESSAMENTO (fila em workers, por arquivo):
   a. hash SHA-256 (streaming)
   b. parse PES → metadados
   c. miniatura 256px + 512px → cache
   d. UPSERT transacional no banco (lotes de 50)
6. Progresso via evento IPC a cada lote → grade se preenche progressivamente
7. Relatório final (novos, atualizados, ausentes, erros, duração) → historico_importacao
```

### 8.2 Escala e desempenho

| Biblioteca | Meta de comportamento |
|---|---|
| 1.000 arquivos | Importação completa < 1 min; UI fluida o tempo todo |
| 10.000 arquivos | < 10 min na 1ª importação; reabertura do app < 5 s (só diff size+mtime) |
| 50.000 arquivos | 1ª importação pode levar dezenas de minutos **em background**, com app utilizável; grade virtualizada mantém 60 fps; buscas < 200 ms (FTS5 + índices) |

Mecanismos:

- **Fila de processamento** no main process; pool de `worker_threads` com **concorrência = min(nº de núcleos − 1, 4)** — hash e parse são I/O-bound; mais workers que isso só disputa disco.
- **Lotes**: escrita no banco em transações de ~50 registros (uma transação por arquivo mata o desempenho do SQLite).
- **Barra de progresso** com fases distintas (varrendo → processando i/N → gravando), nome do arquivo atual e ETA.
- **Cancelamento**: flag cooperativa checada entre arquivos; tudo já gravado permanece (lotes são atômicos); importação marcada `cancelada`.
- **Retomada**: automática e natural — reexecutar a importação pula tudo que tem `status_processamento='ok'` e `size+mtime` inalterados; só processa o que faltou.
- **Erros e logs**: por arquivo em `erros_processamento`; log estruturado em `%APPDATA%/MatrizesApp/logs/` (rotação por tamanho, ex.: 5 MB × 5 arquivos) via `electron-log`.
- **Cache**: miniaturas por hash (Seção 8.3); reprocessar um arquivo idêntico nunca regenera imagem.
- **Atualização incremental**: diff `size+mtime` ao abrir o app e via botão "Atualizar biblioteca". Watcher contínuo (chokidar) fica para v1.1 — em HDs externos e pastas de rede watchers são pouco confiáveis, então o rescan permanece como fonte de verdade.
- **UI nunca trava**: renderer só recebe eventos e consulta páginas do banco via IPC; toda I/O pesada está nos workers; listagens são paginadas (`limit/offset` de 200) com scroll virtualizado.

### 8.3 Estratégia de miniaturas (item 9 da estrutura pedida)

- Formato: PNG (fundo adaptável ao tema), 256 px (grade) e 512 px (detalhes), gerados a partir de SVG das polilinhas de pontos com as cores da paleta PEC.
- Cache em `%APPDATA%/MatrizesApp/cache/thumbs/`, nome = `<hash>_<tamanho>.png` → imune a renomeação de arquivo, compartilhado entre duplicados, invalidado naturalmente quando o conteúdo muda (hash muda).
- Registro na tabela `miniaturas`; na exibição, renderer recebe caminho do PNG via protocolo customizado (`thumb://<hash>/256`) registrado no main — evita expor filesystem ao renderer.
- Miniatura ausente/corrompida → regenerada sob demanda; placeholder cinza com nome do arquivo enquanto isso.
- Limpeza: comando em Configurações "Limpar miniaturas órfãs" (hashes sem arquivo correspondente).

---

## 9. Dependências sugeridas (nenhuma será instalada antes da aprovação)

| Pacote | Papel | Observação |
|---|---|---|
| `electron` | runtime desktop | LTS atual |
| `electron-builder` | instalador NSIS, empacotamento | |
| `better-sqlite3` | SQLite síncrono e rápido | binário pré-compilado por versão do Electron (`electron-rebuild`) |
| `sharp` | rasterizar SVG→PNG | binário pré-compilado |
| `drivelist` | detectar unidades removíveis | fallback: PowerShell `Get-Volume` |
| `electron-log` | logs com rotação | |
| `typescript`, `vite`, `electron-vite` | build do main/preload/renderer | renderer continua sendo o HTML do protótipo |
| `vitest` + `playwright` | testes unitários + E2E | |
| `chokidar` | watcher de pastas | **v1.1**, não instalar no MVP |
| `pyembroidery` (Python, só em `tests/oracle/`) | oráculo de validação do parser em CI | não é dependência do app distribuído |

---

## 10. Duplicados (Etapa 8)

### Nível 1 — arquivo idêntico (MVP)
- Detecção: `GROUP BY hash_sha256 HAVING COUNT(*) > 1` — custo zero, o hash já existe.
- Tela "Duplicados": grupos com miniatura única (é o mesmo conteúdo) + lista dos caminhos, tamanho, datas.
- Ações permitidas: abrir local de cada cópia; marcar grupo como "revisado"; **nada de apagar automaticamente** — o app não possui função de deletar arquivos no MVP. A usuária decide fora do app (ou em versão futura, com exclusão explícita, opt-in, via lixeira do Windows e confirmação dupla).

### Nível 2 — mesmo desenho em formatos/arquivos diferentes (pós-MVP; heurística leve no MVP)
- **MVP:** agrupamento informativo por nome-base normalizado (minúsculas, sem acentos, sem sufixos `(1)`, `- copia`) — ex.: `rosa.pes` + `rosa.dst` aparecem como "possível mesmo desenho". Apenas informativo, com rótulo "possível".
- **v1.2+:** assinatura geométrica do desenho (nº de pontos + nº de cores + dimensões arredondadas + hash da sequência de pontos normalizada) → detecta o mesmo desenho re-salvo em outro formato. O modelo `matrizes` 1:N `arquivos` já suporta consolidar o grupo numa matriz só, sem migração.
- Em ambos os níveis o sistema **identifica, agrupa, mostra e deixa a usuária decidir** — nunca apaga, move ou renomeia sozinho.

---

## 11. Telas e experiência do usuário (Etapa 9)

Princípios: miniaturas grandes por padrão (slider de zoom 3 tamanhos), busca sempre visível no topo, filtros como chips clicáveis com contadores, zero jargão técnico ("desenhos" e não "matrizes indexadas"; "pontos" e não "stitch count"), fontes ≥ 14 px, alvos de clique ≥ 40 px, alto contraste. Público com pouca familiaridade digital: cada tela tem no máximo 1 ação primária evidente.

Para cada tela: **O** = objetivo · **E** = elementos · **A** = ações · **V** = estado vazio · **C** = carregamento · **X** = erros · **F** = confirmações.

1. **Primeira abertura (boas-vindas)** — **O:** levar à primeira importação em 1 clique. **E:** logotipo, frase-promessa, ilustração, botão único "Escolher minha pasta de bordados". **A:** escolher pasta → 2. **V:** é o próprio estado vazio do app. **C:** n/a. **X:** n/a. **F:** nenhuma.
2. **Seleção de pasta** — **O:** autorizar leitura consciente. **E:** diálogo nativo do Windows + cartão de confirmação com o caminho e o texto "O aplicativo apenas lê seus arquivos. Nada será movido, renomeado ou apagado." **A:** confirmar / cancelar / escolher outra. **X:** pasta inacessível → "Não consegui ler esta pasta. Ela pode estar protegida ou em um disco desconectado." **F:** a própria tela.
3. **Processamento inicial** — **O:** dar visibilidade e manter confiança durante a 1ª indexação. **E:** barra de progresso por fases, contador "1.240 de 8.412", nome do arquivo atual, ETA, botão "Cancelar", aviso "Você já pode usar os desenhos que aparecerem abaixo" com a grade se preenchendo ao vivo. **A:** cancelar; continuar usando. **C:** a tela inteira é o estado de carregamento. **X:** contagem de erros discreta ("12 arquivos com problema — ver depois"). **F:** cancelar → "Parar a leitura? O que já foi lido ficará salvo."
4. **Biblioteca principal (shell)** — **O:** tela-mãe. **E:** topo (busca, zoom, botão Atualizar, Copiar para pendrive), sidebar (Todos, Favoritas, Categorias, Etiquetas por dimensão, Status, Pastas, Duplicados, Erros, Configurações — com contadores), área central (grade), painel de detalhes à direita (colapsável). **A:** navegar, filtrar, buscar, selecionar. **V/C/X:** delegados à grade.
5. **Grade de matrizes** — **O:** encontrar visualmente em segundos. **E:** cards com miniatura grande, nome, dimensões (ex.: "98 × 122 mm"), ícones ♥ / "testada"; scroll virtualizado; ordenação (nome, data, tamanho, nº pontos). **A:** clique = detalhes; duplo clique = abrir local; Ctrl/Shift+clique e "modo seleção" com checkboxes = seleção múltipla; menu de contexto (favoritar, testada, categoria, copiar). **V:** sem biblioteca → tela 1; com filtro sem resultado → "Nenhum desenho encontrado com esses filtros" + botão "Limpar filtros". **C:** placeholders (skeleton) nos cards. **X:** card com miniatura quebrada mostra placeholder + aviso no painel.
6. **Lista de categorias (sidebar)** — **O:** navegação e gestão da taxonomia. **E:** árvore com contadores, botão "+", menu ⋯ (renomear, mover, excluir, criar subcategoria). **A:** clicar = filtrar; arrastar matrizes para a categoria (v1.1). **V:** "Crie categorias para organizar seus desenhos" + botão. **F:** excluir → mostra impacto (Seção 7.3).
7. **Filtros** — **O:** refinar sem digitar. **E:** chips por dimensão (ocasião, aplicação, técnica, status, pasta, formato, faixa de tamanho via presets de bastidor: "até 10×10", "até 13×18", "acima"), combináveis (E entre dimensões, OU dentro da dimensão), barra "filtros ativos" com × individual e "limpar tudo". **V:** contadores zerados ficam esmaecidos. **X:** n/a.
8. **Busca** — **O:** achar por nome em qualquer campo de texto. **E:** campo grande com placeholder "Busque pelo nome do desenho…", ignora acentos/maiúsculas, busca incremental (debounce ~200 ms), combina com filtros ativos. **V:** "Nada encontrado para 'urso'. Dica: tente parte do nome." **C:** resultados < 200 ms, sem spinner na prática.
9. **Painel de detalhes** — **O:** tudo sobre um desenho + ações. **E:** miniatura 512 px (clique = lupa/zoom), nome editável (lápis), metadados legíveis (tamanho em mm, pontos, cores, bastidor sugerido, arquivo, pasta, datas), categoria (dropdown), etiquetas (chips + autocomplete), status, ♥, testada, observações (autosave), botões "Abrir local do arquivo" e "Copiar para pendrive". **A:** editar tudo inline; multi-seleção → painel vira edição em massa ("Aplicar a 23 desenhos"). **X:** arquivo ausente → banner "Este arquivo não está mais onde estava (disco desconectado?)" + ação "Procurar de novo". **F:** nenhuma (edições são reversíveis e não tocam arquivos).
10. **Edição de etiquetas** — **O:** gestão completa do vocabulário. **E:** Configurações → Organização: lista por dimensão, contadores de uso, criar/renomear/excluir/mudar cor. **F:** excluir → impacto ("usada em N desenhos").
11. **Favoritos** — **O:** acesso imediato às queridinhas. **E:** item fixo na sidebar; grade filtrada. **V:** "Toque no ♥ de um desenho para vê-lo aqui."
12. **Matrizes não processadas** — **O:** transparência da fila. **E:** contador "Processando… 312 restantes" na sidebar durante importações; cards com skeleton entram na grade conforme ficam prontos. **V:** oculto quando não há pendências.
13. **Arquivos com erro** — **O:** nada some silenciosamente. **E:** lista com nome, caminho, etapa e explicação simples ("O arquivo parece danificado"), botões "Tentar novamente" e "Abrir local". **V:** "Nenhum problema encontrado 🎉". **F:** nenhuma (não há exclusão).
14. **Duplicados** — **O:** enxergar repetições e decidir. **E:** grupos com miniatura + caminhos + datas; contagem total; rodapé fixo "Nenhum arquivo será apagado pelo aplicativo." **A:** abrir local; marcar "revisado". **V:** "Nenhum arquivo repetido encontrado."
15. **Configurações** — **O:** ajustes sem intimidar. **E:** abas: Pastas (adicionar/pausar/remover pasta monitorada — remover pergunta se limpa os registros; arquivos físicos nunca são tocados), Organização (tela 10), Aparência (tema claro/escuro, tamanho dos cards), Manutenção (backup agora, restaurar backup, limpar miniaturas órfãs, abrir pasta de logs), Sobre. **F:** restaurar backup → confirmação dupla explicando que substitui o catálogo atual (e que um backup do estado atual é feito antes).
16. **Seleção e cópia para pendrive** — detalhada na Seção 14 (assistente em 3 passos).
17. **Relatório de importação** — **O:** fechar o ciclo com confiança. **E:** resumo (novos, atualizados, ausentes, erros, duração), botões "Ver novos" (filtro por data desta importação), "Ver erros" (tela 13), "Fechar"; histórico das últimas importações em Configurações. **V:** "Nenhuma novidade — sua biblioteca já estava em dia."

---

## 12. Segurança dos arquivos (Etapa 10) — requisito crítico

**Proibições absolutas (invariantes de código, não só de UX):**
- Não mover, não renomear, não apagar, não sobrescrever arquivos originais; não reorganizar pastas.

**Medidas de engenharia:**

1. **Modo leitura por construção:** o módulo `filesystem/` expõe apenas `scan`, `readStream`, `stat`, `openInExplorer` e `copyTo`. Não existe função de escrita/renomeio/exclusão em pastas da usuária no código do MVP — a revisão de código e um teste automatizado garantem que nenhum caminho sob `pastas_monitoradas` recebe `write/rename/unlink`.
2. **Escrita restrita a dois lugares:** diretório de dados do app (`%APPDATA%/MatrizesApp/`) e destino de cópia explicitamente escolhido pela usuária.
3. **Cópia segura (Seção 14):** copiar → verificar → nunca substituir. Conflito de nome gera automaticamente `nome (2).pes`. Sobrescrever exige escolha explícita por arquivo (opção não padrão).
4. **Validação de espaço:** antes de copiar, comparar soma dos tamanhos + margem de 5% com o espaço livre do destino; insuficiente → bloquear com mensagem clara.
5. **Confirmações destrutivas:** as únicas operações "destrutivas" do MVP são sobre o **catálogo** (remover pasta monitorada, restaurar backup) — sempre com confirmação explícita que diferencia "registros do aplicativo" de "seus arquivos" ("seus arquivos continuam intactos no disco").
6. **Registro de operações:** toda cópia, importação e restauração gera entradas de log auditáveis (o quê, quando, origem, destino, resultado).
7. **Recuperação do banco:** SQLite em WAL + `PRAGMA integrity_check` na inicialização; corrupção detectada → renomear banco corrompido (preservado para diagnóstico), restaurar automaticamente o backup mais recente e avisar a usuária. Pior caso: recriar banco vazio e oferecer re-importação (os arquivos e miniaturas seguem no disco; perde-se só a organização desde o último backup).
8. **Backup de banco + configurações:** cópia automática de `library.db` (via `VACUUM INTO`, seguro com WAL) para `backups/` a cada fechamento com alterações, mantendo os últimos 7 + 1 semanal; botão "Fazer backup agora" e "Restaurar" em Configurações.
9. **Pendrive removido durante cópia:** cada arquivo é copiado para nome temporário (`.part`) e renomeado ao concluir + verificar; remoção do drive → erro capturado, arquivos `.part` órfãos são descartados na próxima detecção do drive, relatório mostra exatamente o que foi concluído e o que faltou, com botão "Tentar novamente os restantes". Originais jamais são afetados (são apenas fonte de leitura).
10. **Caminhos longos e especiais:** uso do prefixo `\\?\` no Windows para caminhos > 260 caracteres; normalização Unicode (NFC) de nomes; testes dedicados (Seção 17).

---

## 13. Cópia para pendrive (Etapa 11)

Assistente em 3 passos, disparado pelo botão "Copiar para pendrive" com N matrizes selecionadas:

**Passo 1 — Destino.** Lista de unidades removíveis (`drivelist`; fallback PowerShell `Get-Volume`) com rótulo, letra, espaço livre e ícone; botão "Atualizar"; opção "Escolher outra pasta…" (qualquer destino); subpasta opcional (padrão: `Bordados <AAAA-MM-DD>`). *Vazio:* "Nenhum pendrive encontrado. Conecte um e toque em Atualizar."

**Passo 2 — Revisão.** Lista dos arquivos com miniatura, nome e tamanho; total e espaço livre do destino; avisos por item: ⚠ "maior que o bastidor configurado (130×180)" (configurável em Configurações); ⚠ "já existe um arquivo com este conteúdo no destino" (hash dos arquivos de mesmo nome/tamanho no destino) — duplicado exato é desmarcado por padrão; conflito só de nome → padrão "renomear para nome (2).pes", alternativa opt-in "substituir". Se o formato configurado da máquina da usuária divergir do arquivo (ex.: máquina só lê `.pes` e o item é outro formato, quando houver multi-formato), avisar — no MVP, conversão não existe, apenas aviso.

**Passo 3 — Cópia e conclusão.** Barra de progresso por arquivo e total; cancelamento a qualquer momento (arquivos já concluídos permanecem; `.part` é descartado); ao final: "✅ 37 desenhos copiados para PENDRIVE (E:)" com "Abrir pasta no pendrive" e, se houve falhas, lista de erros + "Tentar novamente". Erros também vão para o log. **Nunca** apagar/limpar conteúdo existente do destino — não há essa função; qualquer futura "limpar pasta de destino" exigiria confirmação dupla explícita.

---

## 14. Estrutura de pastas do projeto (Etapa 13)

Adaptada ao stack recomendado (Electron + TypeScript + electron-vite):

```text
matrizes/
├── src/
│   ├── main/                     # processo principal (Node)
│   │   ├── index.ts              # bootstrap, janela, protocolo thumb://
│   │   ├── ipc/                  # registro dos handlers (contratos da Seção 15)
│   │   ├── services/             # orquestração: importer, library, dedup, copier, backup
│   │   ├── db/                   # conexão, migrações (001_init.sql…), repositórios
│   │   ├── embroidery/           # EmbroideryReader (interface) + PesReader + registry
│   │   ├── thumbnails/           # stitches→SVG→PNG, cache
│   │   ├── filesystem/           # scan, hash, drives, cópia segura, longpath
│   │   └── workers/              # worker de processamento (hash+parse+thumb)
│   ├── preload/
│   │   └── index.ts              # contextBridge → window.api (única ponte)
│   ├── renderer/                 # ← protótipo HTML/CSS/JS reaproveitado
│   │   ├── index.html
│   │   ├── styles/
│   │   ├── scripts/              # estado, render da grade virtualizada, telas
│   │   └── assets/
│   └── shared/                   # tipos TS dos contratos IPC, constantes, enums
├── assets/                       # ícone do app, imagens do instalador
├── tests/
│   ├── unit/                     # parser, hash, dedup, repositórios
│   ├── fixtures/pes/             # arquivos PES reais de teste (várias versões)
│   ├── oracle/                   # scripts pyembroidery p/ validar o parser (CI)
│   └── e2e/                      # Playwright
├── scripts/                      # gerar fixtures, rebuild nativo, seed dev
├── docs/                         # este arquivo, ADRs, formato PES (notas)
├── build/                        # config electron-builder, NSIS
├── package.json
├── electron.vite.config.ts
└── tsconfig.json
```

Dados em runtime (fora do repositório): `%APPDATA%/MatrizesApp/` → `library.db`, `cache/thumbs/`, `logs/`, `backups/`.

---

## 15. Contratos entre frontend e backend (Etapa 14)

Ponte única: `window.api.<dominio>.<metodo>(payload) → Promise<resultado>` + eventos `window.api.on(evento, callback)`. Todos os payloads são JSON serializável; erros voltam como `{ ok:false, erro:{ codigo, mensagem } }`. Exemplos (sem implementação):

```jsonc
// pastas.selecionar() → abre diálogo nativo
// → { "ok": true, "caminho": "D:/Bordados" }  |  { "ok": true, "caminho": null } (cancelou)

// importacao.iniciar({ "pastaId": 3 })
// → { "ok": true, "importacaoId": 41 }

// importacao.cancelar({ "importacaoId": 41 }) → { "ok": true }

// evento "importacao:progresso"
{ "importacaoId": 41, "fase": "processando",        // varrendo|processando|gravando
  "total": 8412, "processados": 1240, "erros": 12,
  "arquivoAtual": "rosa_flor.pes", "etaSegundos": 340 }

// evento "importacao:finalizada"
{ "importacaoId": 41, "status": "concluida",
  "novos": 812, "atualizados": 37, "ausentes": 4, "erros": 12, "duracaoMs": 421000 }

// matrizes.listar({ "filtros": { "busca": "coracao", "categoriaId": 2,
//   "etiquetaIds": [5, 9], "statusId": null, "favorita": true, "testada": null,
//   "pastaId": null, "formato": "pes",
//   "tamanho": { "maxLarguraMm": 130, "maxAlturaMm": 180 } },
//   "ordenacao": { "campo": "nome", "direcao": "asc" },
//   "pagina": { "offset": 0, "limite": 200 } })
// → { "ok": true, "total": 143, "itens": [ {
//      "id": 77, "nomeExibido": "Coração floral", "thumbUrl": "thumb://ab12…/256",
//      "larguraMm": 98.4, "alturaMm": 122.0, "numPontos": 15230, "numCores": 4,
//      "favorita": true, "testada": false, "statusId": 1, "categoriaId": 2 } ] }

// matrizes.detalhes({ "id": 77 }) → objeto completo (matriz + arquivo + etiquetas
//   + caminhoAbsoluto + bastidorSugerido + observacoes + datas)

// matrizes.editar({ "id": 77, "campos": { "nomeExibido": "Coração G",
//   "categoriaId": 4, "statusId": 2, "observacoes": "usar estabilizador firme" } })
// → { "ok": true }
// matrizes.editarEmMassa({ "ids": [77,78,79], "campos": { "categoriaId": 4 } })

// etiquetas.adicionar({ "matrizId": 77, "etiqueta": { "nome": "Natal", "dimensao": "ocasiao" } })
//   → cria a etiqueta se não existir → { "ok": true, "etiquetaId": 12 }
// etiquetas.remover({ "matrizId": 77, "etiquetaId": 12 }) → { "ok": true }

// matrizes.favoritar({ "id": 77, "favorita": true }) → { "ok": true }
// matrizes.marcarTestada({ "id": 77, "testada": true }) → { "ok": true }

// arquivos.abrirLocal({ "matrizId": 77 }) → Explorer com o arquivo selecionado

// drives.listar() → { "ok": true, "drives": [
//   { "letra": "E:", "rotulo": "PENDRIVE", "livreBytes": 3100000000, "removivel": true } ] }

// copia.iniciar({ "matrizIds": [77,81,90], "destino": "E:/Bordados 2026-07-09",
//   "conflito": "renomear" })                          // renomear|pular|substituir
// → { "ok": true, "copiaId": 7 }
// eventos "copia:progresso" / "copia:finalizada" (mesmo padrão da importação)

// erros.listar({ "pagina": { "offset": 0, "limite": 100 } })
// → { "ok": true, "total": 12, "itens": [ { "id": 3, "caminho": "D:/…/x.pes",
//      "etapa": "parse", "mensagem": "Arquivo truncado", "ocorridoEm": "…" } ] }

// categorias.listar/criar/renomear/excluir · colecoes.* · fornecedores.* ·
// status.listar · config.obter/definir · backup.executar/restaurar ·
// duplicados.listar → grupos por hash
```

Regra de compatibilidade: os tipos desses contratos vivem em `src/shared/` e são a **única** dependência compartilhada entre renderer e main — trocar a implementação do backend (ex.: plano B com sidecar Python) não altera o renderer.

---

## 16. Fases de implementação (Etapa 12)

> Complexidade usa apenas: **baixa / média / alta** (pedido do briefing — sem estimativas de tempo).

### Fase 0 — Auditoria e fundação — complexidade: baixa
- **Objetivo:** protótipo no repositório, auditoria concluída, arquitetura aprovada, projeto esqueleto compilando.
- **Entregáveis:** re-auditoria da Seção 2 (com arquivos/linhas); ADR da arquitetura; scaffold Electron+TS vazio abrindo o HTML do protótipo.
- **Arquivos:** `package.json`, `electron.vite.config.ts`, `tsconfig.json`, `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/**` (cópia do protótipo, sem alterações), `docs/ADR-001-arquitetura.md`.
- **Dependências:** protótipo enviado ao repositório (bloqueante); aprovação deste plano.
- **Critérios de aceite:** `npm run dev` abre o protótipo numa janela Electron; auditoria publicada.
- **Riscos:** protótipo não chegar (bloqueia só a parte visual — Fases 1–2 do backend não dependem dele).
- **Testes:** smoke E2E "janela abre e título correto".

### Fase 1 — Prova técnica de PES — complexidade: alta
- **Objetivo:** eliminar o maior risco do projeto — ler PES real e desenhar miniatura fiel.
- **Entregáveis:** `PesReader` (header v1–v6 + PEC); gerador de miniatura SVG→PNG; harness que processa uma pasta de amostras e mostra os cards na interface; validação contra pyembroidery (oráculo).
- **Arquivos:** `src/main/embroidery/{reader.ts,pes.ts,pec.ts,palette.ts,registry.ts}`, `src/main/thumbnails/{render.ts,cache.ts}`, `tests/unit/pes*.test.ts`, `tests/fixtures/pes/**`, `tests/oracle/compare.py`.
- **Dependências:** amostras reais de PES da usuária (várias versões/máquinas) — **pedir desde já**.
- **Critérios de aceite:** ≥ 95% das amostras parseadas; dimensões/pontos/cores idênticos ao pyembroidery em 100% das parseadas; miniaturas visualmente corretas (inspeção manual da usuária); arquivo corrompido não derruba o processo.
- **Riscos:** variações de versão do PES (mitigação: oráculo + fixtures diversas; plano B: sidecar Python **decidido no fim desta fase**).
- **Testes:** unitários por versão de PES; fuzzing leve (truncar/corromper fixtures); comparação com oráculo em CI.

### Fase 2 — Biblioteca local — complexidade: alta
- **Objetivo:** pipeline completo pasta→banco→galeria.
- **Entregáveis:** banco + migrações; scan recursivo; hash; fila com workers; progresso na UI; grade virtualizada com miniaturas reais; relatório de importação; atualização incremental (diff na abertura + botão).
- **Arquivos:** `src/main/db/**`, `src/main/filesystem/{scan.ts,hash.ts,longpath.ts}`, `src/main/workers/process-file.ts`, `src/main/services/{importer.ts,library.ts}`, `src/main/ipc/**`, `src/shared/contracts.ts`, `src/renderer/scripts/{grade.ts,progresso.ts}` (refatoração do protótipo para dados reais).
- **Dependências:** Fase 1.
- **Critérios de aceite:** metas de escala da Seção 8.2 (1k/10k medidos; 50k testado com biblioteca sintética); cancelar/retomar funcionando; UI nunca congela > 100 ms; reabertura só reprocessa o que mudou.
- **Riscos:** desempenho da grade com 50k itens (mitigação: virtualização + paginação desde o 1º dia); locks do SQLite (mitigação: WAL + fila única de escrita).
- **Testes:** integração do pipeline com pasta sintética (incl. caminhos longos e Unicode); teste de carga 50k; E2E "importar pasta pequena e ver cards".

### Fase 3 — Organização — complexidade: média
- **Objetivo:** busca e classificação completas.
- **Entregáveis:** FTS5 + busca incremental; filtros combináveis com contadores; CRUD de categorias/etiquetas/coleções/fornecedores/status; favoritos; testada; observações; painel de detalhes com edição inline e em massa; seeds da Seção 7.2.
- **Arquivos:** `src/main/services/organizacao.ts`, repositórios correspondentes, `src/renderer/scripts/{filtros.ts,detalhes.ts,taxonomia.ts}`.
- **Dependências:** Fase 2.
- **Critérios de aceite:** busca sem acentos < 200 ms com 10k itens; toda edição persiste e sobrevive a reimportação; excluir categoria/etiqueta mostra impacto e nunca toca arquivos.
- **Riscos:** UX confusa de filtros para o público-alvo (mitigação: teste com 2–3 bordadeiras reais nesta fase).
- **Testes:** unitários de queries de filtro; E2E dos fluxos de organizar.

### Fase 4 — Operações — complexidade: média
- **Objetivo:** duplicados, erros e cópia para pendrive.
- **Entregáveis:** tela de duplicados (nível 1 + heurística de nome); tela de erros com "tentar novamente"; assistente de cópia (Seção 13) com detecção de drives, verificação de espaço, conflitos, progresso, cancelamento e relatório; detecção de arquivos movidos (religação por hash).
- **Arquivos:** `src/main/services/{dedup.ts,copier.ts}`, `src/main/filesystem/drives.ts`, `src/renderer/scripts/{duplicados.ts,copiar.ts,erros.ts}`.
- **Dependências:** Fase 2 (hashes); Fase 3 (seleção múltipla).
- **Critérios de aceite:** cópia sobrevive à remoção do pendrive sem corromper nada e relata exatamente o estado; nunca sobrescreve sem opt-in; duplicados idênticos 100% detectados.
- **Riscos:** variedade de comportamento de drives USB/antivírus (mitigação: testes com hardware real diverso).
- **Testes:** integração de cópia com conflitos/espaço insuficiente/remoção simulada; unitários de agrupamento de duplicados.

### Fase 5 — Empacotamento e endurecimento — complexidade: média
- **Objetivo:** produto instalável e confiável.
- **Entregáveis:** instalador NSIS (x64) com ícone e atalhos; backup/restauração de banco+configurações; `integrity_check` na inicialização; logs com rotação; testes com a biblioteca real da usuária; documentação de instalação; (preparo de auto-update para v1.1, desativado).
- **Arquivos:** `build/**`, `src/main/services/backup.ts`, `docs/INSTALACAO.md`.
- **Dependências:** Fases 1–4.
- **Critérios de aceite:** instala/desinstala limpo no Windows 10 e 11; instalador não é bloqueado silenciosamente pelo SmartScreen/Defender (decisão de assinatura de código — Seção 19); beta com ≥ 2 usuárias reais completando o fluxo ponta-a-ponta sem ajuda.
- **Riscos:** falsos positivos de antivírus (mitigação: assinatura de código; sem PyInstaller no stack A isso já reduz muito).
- **Testes:** matriz Win10/Win11; instalação, upgrade e desinstalação; smoke pós-instalação.

### Ordem exata de implementação (visão de tarefas)

1. Enviar protótipo ao repositório → re-auditoria (F0)
2. Scaffold Electron+TS + protótipo abrindo na janela (F0)
3. Coletar amostras PES reais (paralelo, bloqueia F1)
4. Parser PES/PEC + testes + oráculo (F1)
5. Renderização de miniatura + cache (F1)
6. Harness visual da prova técnica (F1) → **gate: decisão parser TS vs sidecar**
7. Migrações + repositórios SQLite (F2)
8. Scan recursivo + hash + longpath (F2)
9. Fila de workers + progresso IPC (F2)
10. Grade virtualizada ligada ao banco (F2)
11. Atualização incremental + relatório (F2)
12. FTS5 + busca (F3)
13. Filtros combináveis (F3)
14. CRUD taxonomia + seeds (F3)
15. Painel de detalhes + edição em massa (F3)
16. Duplicados nível 1 + heurística nome (F4)
17. Tela de erros + retry (F4)
18. Drives + assistente de cópia segura (F4)
19. Backup/restauração + integrity check (F5)
20. Instalador NSIS + matriz de testes Windows (F5)
21. Beta com usuárias reais (F5)

---

## 17. Estratégia de testes e critérios de aceite do MVP (Etapa 15)

**Camadas:**

| Camada | Ferramenta | Cobre |
|---|---|---|
| Unitários | Vitest | parser PES (por versão), paleta PEC, hash, diff incremental, agrupamento de duplicados, queries de filtro, resolução de conflitos de nome |
| Integração | Vitest + tmp dirs | pipeline scan→hash→parse→thumb→banco; migrações; backup/restauração; cópia com falhas simuladas |
| Banco | Vitest | migrações sobem de qualquer versão; FKs; UNIQUEs; FTS sincronizado; integrity_check |
| Interface (E2E) | Playwright + Electron | primeira abertura → importar → buscar → filtrar → editar → copiar; estados vazios/erro |
| Oráculo | pyembroidery (CI) | metadados do parser TS ≡ pyembroidery para todas as fixtures |
| Carga | script sintético | 1k/10k/50k arquivos: tempos, memória (< 500 MB no pico), fluidez |
| Robustez | fixtures adversariais | corrompidos/truncados, 0 pontos, caminhos > 260 chars, acentos/emoji/espaços em nomes, arquivos com mesmo nome em pastas diferentes, duplicados, somente leitura, pasta sem permissão |
| Pendrive | manual guiado + integração simulada | FAT32/exFAT/NTFS, remoção durante cópia, destino cheio, conflitos |
| SO | manual (matriz) | Windows 10 22H2 e Windows 11 (x64); instalação, upgrade, desinstalação |

**Critérios objetivos de aceite do MVP (gate de release):**

1. Importa pasta real com ≥ 10.000 PES sem travar a UI (nenhum congelamento > 100 ms) e conclui a indexação.
2. ≥ 95% dos arquivos válidos ganham miniatura; 100% dos inválidos aparecem na tela de erros com motivo.
3. Metadados (dimensões, pontos, cores) conferem com o oráculo pyembroidery em 100% dos arquivos parseados das fixtures.
4. Busca e filtros respondem < 200 ms com 10k itens; busca ignora acentos e maiúsculas.
5. Reabrir o app com biblioteca inalterada leva < 5 s até a grade utilizável; nenhum reprocessamento ocorre.
6. Zero gravações fora de `%APPDATA%/MatrizesApp/` e do destino de cópia (verificado por teste com monitor de filesystem).
7. Cópia para pendrive: conflito → renomeia; espaço insuficiente → bloqueia antes; remoção no meio → relatório exato, sem `.part` residual visível e sem corromper nada.
8. Duplicados por hash: 100% de precisão nas fixtures; nenhuma função de exclusão de arquivos existe no binário.
9. Corromper o banco manualmente → app se recupera do backup e avisa; organização até o último backup preservada.
10. Instala e desinstala limpo em Win10/Win11; 2 usuárias-alvo completam "instalar → importar → achar um desenho → copiar para pendrive" sem instrução verbal.

---

## 18. Riscos (Etapa 16)

| # | Risco | Impacto | Prob. | Mitigação | Fase |
|---|---|---|---|---|---|
| 1 | Protótipo ausente do repositório (estado atual) | Médio — bloqueia reaproveitamento da UI e a re-auditoria | **Certa** | Solicitar envio imediato; backend (F1–F2) não depende dele | 0 |
| 2 | Parser PES incompleto p/ versões antigas/variantes | Alto — promessa central falha | Média | Fixtures reais diversas + oráculo pyembroidery + gate de decisão na F1 com plano B (sidecar Python) já desenhado | 1 |
| 3 | Miniaturas visualmente imprecisas (ordem de cores, jumps) | Alto — confiança da usuária | Média | Render por blocos de cor da paleta PEC; validação visual com bordadeiras; comparar com software da máquina | 1 |
| 4 | Alto consumo de memória com 50k itens | Médio | Média | Paginação no banco, grade virtualizada, streams p/ hash, teste de carga com teto de 500 MB | 2 |
| 5 | Interface travando durante importação | Alto | Média | Todo trabalho em workers; escrita em lotes; medição de bloqueio no CI (aceite nº 1) | 2 |
| 6 | Banco SQLite corrompido | Alto | Baixa | WAL + integrity_check + backups automáticos rotacionados + restauração assistida | 5 |
| 7 | Caminhos alterados (HD trocado, pasta renomeada) | Médio | Alta | Religação por hash; estado `ausente` não destrutivo; "Procurar de novo" | 2/4 |
| 8 | Arquivos em rede/NAS lentos ou instáveis | Médio | Média | Timeouts por arquivo; erros isolados por item; documentar suporte "melhor esforço" a rede no MVP | 2 |
| 9 | Antivírus/SmartScreen bloqueando instalador | Alto — mata adoção | Média | Assinatura de código (decisão pendente); electron-builder NSIS padrão; sem binários PyInstaller | 5 |
| 10 | Pendrive desconectado durante cópia | Médio | Alta | Cópia via `.part` + verificação + relatório de retomada (Seções 12–13) | 4 |
| 11 | Diferenças entre versões do formato PES (v1–v6, PEC embutido) | Alto | Alta | Detecção por assinatura `#PESxxxx`; caminhos de código por versão; fixtures por versão; oráculo | 1 |
| 12 | UX complexa demais para o público-alvo | Alto | Média | Princípios da Seção 11; teste com usuárias reais nas F3 e F5 | 3/5 |
| 13 | `better-sqlite3`/`sharp` nativos vs versão do Electron | Médio | Média | `electron-rebuild` no CI; versões pinadas; smoke test pós-build | 0/5 |

---

## 19. Decisões pendentes (Etapa 16 — complemento)

| # | Decisão | Opções | Recomendação | Precisa até |
|---|---|---|---|---|
| 1 | Envio do protótipo ao repositório | — | Enviar já | Fase 0 |
| 2 | Parser TS vs sidecar Python | A / C | A, com gate na F1 | Fim da F1 |
| 3 | Assinatura de código (certificado ~US$ 100–400/ano) | assinar / conviver com SmartScreen | Assinar antes do lançamento público | Fase 5 |
| 4 | Nome do produto e identidade visual | — | Necessário p/ instalador, `%APPDATA%`, ícone | Fase 5 (usar "MatrizesApp" como codinome até lá) |
| 5 | Windows 32-bit / Windows 7-8 | suportar ou não | **Não suportar** (Electron atual exige Win10+); validar com público-alvo | Fase 0 |
| 6 | Amostras de PES reais para fixtures (quantas máquinas/lojas?) | — | Coletar ≥ 50 arquivos de fontes variadas com autorização | Fase 1 |
| 7 | Idioma único pt-BR ou i18n preparado | — | pt-BR hardcoded no MVP; strings centralizadas p/ facilitar i18n futuro | Fase 0 |
| 8 | Telemetria de erros (opt-in) | nenhuma / Sentry local→arquivo | Só logs locais no MVP (offline por promessa) | Fase 5 |
| 9 | Bastidores configuráveis pela usuária | tabela fixa vs editável | Tabela padrão + edição simples em Configurações | Fase 3 |

**Perguntas técnicas a responder antes da implementação:**

1. O protótipo usa algum framework/CSS lib, ou é HTML/CSS/JS puro? (define o esforço de integração na F0 — só verificável com os arquivos)
2. Quais máquinas de bordar as usuárias-alvo têm (Brother? Janome?) — confirma prioridade PES e a ordem dos próximos formatos.
3. Existem PES gerados por softwares diversos (Wilcom, Embird, PE-Design) na biblioteca real? — amplia as fixtures da F1.
4. Tamanho real típico das bibliotecas das primeiras usuárias (calibra os testes de carga).
5. As pastas ficam em HD interno, externo ou rede? (prioriza o tratamento de `ausente` e timeouts).
6. Há orçamento para certificado de assinatura de código?

---

## 20. Checklist completo do MVP

**Plataforma**
- [ ] Instalador NSIS x64 para Windows 10/11
- [ ] Funciona 100% offline
- [ ] Dados em `%APPDATA%/MatrizesApp/`

**Importação**
- [ ] Selecionar pasta (diálogo nativo + confirmação de leitura)
- [ ] Varredura recursiva de subpastas
- [ ] Detecção de `.pes` por extensão + assinatura `#PES`
- [ ] Hash SHA-256 streaming
- [ ] Metadados: dimensões (mm), pontos, cores, versão
- [ ] Miniaturas 256/512 px com cache por hash
- [ ] Fila em workers, lotes, progresso, cancelamento, retomada
- [ ] Atualização incremental (abertura + botão)
- [ ] Detecção de movidos/renomeados por hash
- [ ] Relatório de importação + histórico

**Biblioteca**
- [ ] Grade virtualizada com miniaturas grandes e zoom
- [ ] Busca por nome sem acentos (< 200 ms @ 10k)
- [ ] Filtros: pasta, tamanho/bastidor, formato, status, categoria, etiquetas, favorita, testada
- [ ] Categorias hierárquicas CRUD + seeds
- [ ] Etiquetas por dimensão (tema/ocasião/aplicação/técnica) CRUD + seeds
- [ ] Coleções e fornecedores
- [ ] Favoritos, testada/não testada, observações
- [ ] Painel de detalhes com edição inline e em massa
- [ ] Abrir local do arquivo

**Operações**
- [ ] Duplicados por hash (identificar/agrupar/mostrar; sem apagar)
- [ ] Heurística informativa de nome-base
- [ ] Tela de erros com "tentar novamente"
- [ ] Cópia para pendrive (drives, espaço, conflitos, `.part`, progresso, relatório)
- [ ] Aviso de bastidor excedido na cópia

**Segurança**
- [ ] Zero escrita em pastas da usuária (teste automatizado)
- [ ] Backups automáticos do banco + restauração
- [ ] integrity_check na inicialização
- [ ] Logs com rotação
- [ ] Caminhos longos (`\\?\`) e Unicode

**Qualidade**
- [ ] Oráculo pyembroidery em CI
- [ ] Testes de carga 1k/10k/50k
- [ ] E2E dos fluxos principais
- [ ] Beta com ≥ 2 usuárias reais

## 21. Arquivos a criar × reaproveitar

**A criar:** toda a árvore `src/main/**`, `src/preload/index.ts`, `src/shared/contracts.ts`, configs (`package.json`, `electron.vite.config.ts`, `tsconfig.json`, `build/**`), `tests/**`, `docs/**` — lista detalhada por fase na Seção 16.

**Reaproveitáveis (a confirmar na re-auditoria):** o HTML/CSS/JS do protótipo entra em `src/renderer/` como está — layout da galeria, cards, sidebar de categorias, filtros, busca e tema visual. Refatorações esperadas: dados mockados → binding aos contratos da Seção 15; grade estática → virtualizada; adicionar estados vazio/carregando/erro.

**Complexidade por fase:** F0 baixa · F1 alta · F2 alta · F3 média · F4 média · F5 média.

---

## 22. Próximo passo recomendado

1. **Enviar os arquivos do protótipo ao repositório** (bloqueia a re-auditoria e o reaproveitamento da UI).
2. **Aprovar este planejamento** (ou apontar ajustes).
3. **Coletar ≥ 50 arquivos `.PES` reais e variados** para as fixtures da Fase 1.
4. Iniciar **Fase 0** (scaffold + re-auditoria) e, na sequência, a **Fase 1** — a prova técnica de leitura de PES é o item de maior risco e deve ser atacada primeiro.
