# Arquivos .PES de teste

Esta pasta guarda uma **amostra** de arquivos `.PES` reais usada para
desenvolver e validar o leitor de bordado. Os arquivos aqui são versionados
no Git de propósito (são pequenos, alguns KB cada).

## Como enviar seus arquivos (a partir do seu computador)

Eu (Claude) rodo num container na nuvem e **não tenho acesso à sua pasta
Downloads**. Para testarmos com seus arquivos reais, coloque uma amostra aqui
no repositório. O jeito mais fácil, sem usar terminal:

1. Abra o repositório no GitHub: **github.com/RomeuNascimento/matrizes**
2. No seletor de branch (canto superior esquerdo da lista de arquivos),
   escolha a branch **`claude/embroidery-app-technical-plan-logdvd`**.
3. Navegue até a pasta **`tests/fixtures/pes/`**.
4. Clique em **Add file → Upload files**.
5. **Arraste os arquivos `.PES`** para a área de upload.
6. Em "Commit changes", confirme que está na branch acima e clique em
   **Commit changes**.
7. Me avise aqui que você subiu — eu dou `git pull` e começo a decifrar o
   formato com os seus arquivos.

## Que amostra enviar (não precisa ser tudo)

Não suba a pasta inteira. Uma amostra **representativa** de ~15 a 40 arquivos
é o ideal. Tente incluir variedade:

- desenhos **pequenos e grandes** (ex.: um monograminho e um bordado grande);
- **poucas e muitas cores**;
- se você souber, arquivos de **máquinas ou lojas diferentes**
  (Brother, Wilcom, Embird, PE-Design geram PES um pouco diferentes);
- se tiver algum arquivo que você **desconfia estar com problema**, inclua —
  é ótimo para testar o tratamento de erros.

## Depois de validar

Assim que o leitor estiver funcionando, estes arquivos viram a base dos testes
automatizados. Se você não quiser deixar seus desenhos no repositório a longo
prazo, a gente troca por um conjunto menor/neutro ou remove — é só avisar.
