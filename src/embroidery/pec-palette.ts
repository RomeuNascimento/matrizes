/**
 * Paleta fixa de 64 linhas do formato PEC (Brother).
 *
 * Índice 0 é reservado ("desconhecido") e não corresponde a uma cor. Os bytes
 * de cor do bloco PEC indexam nesta tabela via `byte % 65`.
 *
 * Portado de pyembroidery (EmbThreadPec.get_thread_set) — nossa referência.
 */
export interface PecThread {
  r: number;
  g: number;
  b: number;
  nome: string;
}

/** Índice 0 = null (desconhecido); 1..64 = cores. */
export const PEC_THREADS: (PecThread | null)[] = [
  null,
  { r: 14, g: 31, b: 124, nome: "Prussian Blue" },
  { r: 10, g: 85, b: 163, nome: "Blue" },
  { r: 0, g: 135, b: 119, nome: "Teal Green" },
  { r: 75, g: 107, b: 175, nome: "Cornflower Blue" },
  { r: 237, g: 23, b: 31, nome: "Red" },
  { r: 209, g: 92, b: 0, nome: "Reddish Brown" },
  { r: 145, g: 54, b: 151, nome: "Magenta" },
  { r: 228, g: 154, b: 203, nome: "Light Lilac" },
  { r: 145, g: 95, b: 172, nome: "Lilac" },
  { r: 158, g: 214, b: 125, nome: "Mint Green" },
  { r: 232, g: 169, b: 0, nome: "Deep Gold" },
  { r: 254, g: 186, b: 53, nome: "Orange" },
  { r: 255, g: 255, b: 0, nome: "Yellow" },
  { r: 112, g: 188, b: 31, nome: "Lime Green" },
  { r: 186, g: 152, b: 0, nome: "Brass" },
  { r: 168, g: 168, b: 168, nome: "Silver" },
  { r: 125, g: 111, b: 0, nome: "Russet Brown" },
  { r: 255, g: 255, b: 179, nome: "Cream Brown" },
  { r: 79, g: 85, b: 86, nome: "Pewter" },
  { r: 0, g: 0, b: 0, nome: "Black" },
  { r: 11, g: 61, b: 145, nome: "Ultramarine" },
  { r: 119, g: 1, b: 118, nome: "Royal Purple" },
  { r: 41, g: 49, b: 51, nome: "Dark Gray" },
  { r: 42, g: 19, b: 1, nome: "Dark Brown" },
  { r: 246, g: 74, b: 138, nome: "Deep Rose" },
  { r: 178, g: 118, b: 36, nome: "Light Brown" },
  { r: 252, g: 187, b: 197, nome: "Salmon Pink" },
  { r: 254, g: 55, b: 15, nome: "Vermilion" },
  { r: 240, g: 240, b: 240, nome: "White" },
  { r: 106, g: 28, b: 138, nome: "Violet" },
  { r: 168, g: 221, b: 196, nome: "Seacrest" },
  { r: 37, g: 132, b: 187, nome: "Sky Blue" },
  { r: 254, g: 179, b: 67, nome: "Pumpkin" },
  { r: 255, g: 243, b: 107, nome: "Cream Yellow" },
  { r: 208, g: 166, b: 96, nome: "Khaki" },
  { r: 209, g: 84, b: 0, nome: "Clay Brown" },
  { r: 102, g: 186, b: 73, nome: "Leaf Green" },
  { r: 19, g: 74, b: 70, nome: "Peacock Blue" },
  { r: 135, g: 135, b: 135, nome: "Gray" },
  { r: 216, g: 204, b: 198, nome: "Warm Gray" },
  { r: 67, g: 86, b: 7, nome: "Dark Olive" },
  { r: 253, g: 217, b: 222, nome: "Flesh Pink" },
  { r: 249, g: 147, b: 188, nome: "Pink" },
  { r: 0, g: 56, b: 34, nome: "Deep Green" },
  { r: 178, g: 175, b: 212, nome: "Lavender" },
  { r: 104, g: 106, b: 176, nome: "Wisteria Violet" },
  { r: 239, g: 227, b: 185, nome: "Beige" },
  { r: 247, g: 56, b: 102, nome: "Carmine" },
  { r: 181, g: 75, b: 100, nome: "Amber Red" },
  { r: 19, g: 43, b: 26, nome: "Olive Green" },
  { r: 199, g: 1, b: 86, nome: "Dark Fuchsia" },
  { r: 254, g: 158, b: 50, nome: "Tangerine" },
  { r: 168, g: 222, b: 235, nome: "Light Blue" },
  { r: 0, g: 103, b: 62, nome: "Emerald Green" },
  { r: 78, g: 41, b: 144, nome: "Purple" },
  { r: 47, g: 126, b: 32, nome: "Moss Green" },
  { r: 255, g: 204, b: 204, nome: "Flesh Pink" },
  { r: 255, g: 217, b: 17, nome: "Harvest Gold" },
  { r: 9, g: 91, b: 166, nome: "Electric Blue" },
  { r: 240, g: 249, b: 112, nome: "Lemon Yellow" },
  { r: 227, g: 243, b: 91, nome: "Fresh Green" },
  { r: 255, g: 153, b: 0, nome: "Orange" },
  { r: 255, g: 240, b: 141, nome: "Cream Yellow" },
  { r: 255, g: 200, b: 200, nome: "Applique" },
];

export const PEC_THREAD_COUNT = PEC_THREADS.length; // 65

export function pecThreadHex(colorByte: number): string {
  const t = PEC_THREADS[colorByte % PEC_THREAD_COUNT];
  const c = t ?? { r: 0, g: 0, b: 0 };
  const hex = (n: number) => n.toString(16).padStart(2, "0").toUpperCase();
  return `#${hex(c.r)}${hex(c.g)}${hex(c.b)}`;
}
