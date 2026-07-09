# Fase 1 — Prova técnica de leitura de PES

**Resultado:** 37/37 arquivos `.PES` reais lidos e desenhados com sucesso (100%). 124.099 pontos no total.

Amostra: conjunto *Alfabeto Floral* (37 arquivos) em `tests/fixtures/pes/alfabeto-floral/`.
A maioria é **PES v1**, mas há também **v4** (`MEIOARCOFLORAL`) e **v6** com paleta
de linhas embutida (`ARCOFLORAL`, `ARCOFLORAL2`) — o que já exercita o leitor em
mais de uma versão do formato.

## Leitor próprio em TypeScript — validado (decisão do plano resolvida)

O leitor de PES foi **portado para TypeScript** (`src/embroidery/`) e reproduz
**exatamente** a verdade de referência do oráculo nos 37 arquivos: dimensões,
número de pontos, número de cores e os valores hex das cores — incluindo os
arquivos **PES v6 com paleta de linhas embutida**.

- Geometria (dimensões + pontos): decodificada do bloco PEC, comum a todas as versões.
- Cores: paleta fixa de 64 linhas do PEC (v1–v4) + leitura das threads embutidas (v5+).
- Sem dependência de Python em tempo de execução; o PyEmbroidery permanece apenas
  como oráculo de teste.

> **Decisão pendente "parser próprio vs. sidecar Python" — resolvida:** o parser
> próprio em TypeScript é suficiente. Mantemos a Alternativa A (Electron + Node/TS).

Rode `npm run validate` (comparação detalhada) ou `npm test` (paridade como teste
automatizado, 43 casos).

A leitura de referência foi feita com o oráculo (PyEmbroidery). Estes números são a **verdade de referência** que o leitor próprio em TypeScript deverá reproduzir.

## Como reproduzir

```bash
python3 -m venv .venv-oracle
.venv-oracle/bin/pip install -r tests/oracle/requirements.txt
.venv-oracle/bin/python scripts/oracle_report.py tests/fixtures/pes/alfabeto-floral saida/
.venv-oracle/bin/python scripts/build_gallery.py saida/ galeria.html
```

## Metadados extraídos

| Arquivo | Versão | Largura (mm) | Altura (mm) | Pontos | Cores |
|---|---|--:|--:|--:|--:|
| AFLORAL | PES 1 | 45.9 | 51.9 | 2.467 | 5 |
| ARCOFLORAL | PES 6 | 175.7 | 216.6 | 9.012 | 8 |
| ARCOFLORAL2 | PES 6 | 175.7 | 218.4 | 16.656 | 48 |
| ARCOFLORAL3 | PES 1 | 94.9 | 103.6 | 9.128 | 16 |
| BFLORAL | PES 1 | 39.6 | 51.7 | 2.550 | 5 |
| CANTOFLORAL | PES 1 | 75.4 | 39.3 | 2.529 | 6 |
| CFLORAL | PES 1 | 41.1 | 52.2 | 2.263 | 5 |
| DETALHE | PES 1 | 61.8 | 147.2 | 938 | 1 |
| DETALHE2 | PES 1 | 123.7 | 23.4 | 3.962 | 12 |
| DFLORAL | PES 1 | 39.3 | 51.9 | 2.438 | 5 |
| EFLORAL | PES 1 | 37.3 | 53.1 | 2.658 | 5 |
| FFLORAL | PES 1 | 36.6 | 52.1 | 2.375 | 5 |
| FLOR | PES 1 | 25.6 | 39.8 | 1.197 | 4 |
| FLORGRANDE | PES 1 | 72.8 | 73.3 | 5.108 | 24 |
| GFLORAL | PES 1 | 42.7 | 51.9 | 2.379 | 5 |
| HFLORAL | PES 1 | 44.3 | 52.2 | 3.139 | 5 |
| IFLORAL | PES 1 | 23.8 | 53.9 | 2.255 | 5 |
| JFLORAL | PES 1 | 30.1 | 52.6 | 2.034 | 5 |
| KFLORAL | PES 1 | 43.4 | 52.4 | 2.854 | 5 |
| LFLORAL | PES 1 | 38.9 | 52.5 | 2.117 | 5 |
| MEIOARCOFLORAL | PES 4 | 142.0 | 42.6 | 2.214 | 4 |
| MEIOARCOFLORAL2 | PES 1 | 121.9 | 27.9 | 4.223 | 16 |
| MFLORAL | PES 1 | 46.4 | 53.3 | 3.558 | 5 |
| MONOGRAMAFLORAL | PES 1 | 93.4 | 106.7 | 3.056 | 4 |
| NFLORAL | PES 1 | 43.1 | 52.9 | 2.934 | 5 |
| OFLORAL | PES 1 | 42.6 | 52.8 | 2.035 | 5 |
| PFLORAL | PES 1 | 36.9 | 52.1 | 2.361 | 5 |
| QFLORAL | PES 1 | 43.3 | 52.6 | 2.399 | 5 |
| RFLORAL | PES 1 | 40.7 | 52.3 | 2.721 | 5 |
| SFLORAL | PES 1 | 35.0 | 52.6 | 2.304 | 5 |
| TFLORAL | PES 1 | 42.0 | 53.0 | 2.395 | 5 |
| UFLORAL | PES 1 | 42.8 | 52.5 | 2.438 | 5 |
| VFLORAL | PES 1 | 43.9 | 52.8 | 2.534 | 5 |
| WFLORAL | PES 1 | 46.5 | 53.3 | 3.416 | 5 |
| XFLORAL | PES 1 | 42.0 | 51.7 | 2.650 | 5 |
| YFLORAL | PES 1 | 42.2 | 53.8 | 2.461 | 5 |
| ZFLORAL | PES 1 | 33.4 | 52.4 | 2.341 | 5 |

## Observações técnicas

- Todos os arquivos desta amostra são **PES v1**, a versão mais antiga do formato. Precisamos de amostras de v2–v6 para cobrir o restante (ver decisões pendentes).
- Alguns arquivos acusam contagem de cores alta (ex.: `ARCOFLORAL2` = 48). Em PES v1 isso reflete o número de comandos de troca de cor no bloco PEC; vale confirmar, ao portar o leitor, se todas correspondem a cores realmente distintas.
- As dimensões são calculadas a partir do *bounding box* dos pontos (unidade nativa 0,1 mm), não do cabeçalho — mais confiável.
