/**
 * Sugestão de bastidor: dado o tamanho do desenho (mm), indica o menor bastidor
 * padrão em que ele cabe. Tabela genérica (a usuária poderá editar no futuro).
 */
export interface Bastidor {
  nome: string;
  larguraMm: number;
  alturaMm: number;
}

export const BASTIDORES: Bastidor[] = [
  { nome: "100×100", larguraMm: 100, alturaMm: 100 },
  { nome: "130×180", larguraMm: 130, alturaMm: 180 },
  { nome: "160×260", larguraMm: 160, alturaMm: 260 },
  { nome: "200×300", larguraMm: 200, alturaMm: 300 },
  { nome: "360×200", larguraMm: 360, alturaMm: 200 },
];

/**
 * Retorna o nome do menor bastidor que acomoda o desenho (testando as duas
 * orientações), ou null se não couber em nenhum da tabela.
 */
export function sugerirBastidor(
  larguraMm: number | null,
  alturaMm: number | null,
): string | null {
  if (larguraMm == null || alturaMm == null) return null;
  const l = Math.min(larguraMm, alturaMm);
  const a = Math.max(larguraMm, alturaMm);
  let melhor: Bastidor | null = null;
  for (const b of BASTIDORES) {
    const bl = Math.min(b.larguraMm, b.alturaMm);
    const ba = Math.max(b.larguraMm, b.alturaMm);
    if (l <= bl && a <= ba) {
      if (!melhor || b.larguraMm * b.alturaMm < melhor.larguraMm * melhor.alturaMm) {
        melhor = b;
      }
    }
  }
  return melhor ? melhor.nome : null;
}
