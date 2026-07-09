/**
 * Utilidades de caminho, com atenção às particularidades do Windows
 * (caminhos longos > 260 caracteres e normalização Unicode).
 */
import { resolve } from "node:path";

/**
 * Prefixa com `\\?\` no Windows quando o caminho é longo, permitindo ultrapassar
 * o limite histórico de 260 caracteres. Em outros sistemas, retorna como está.
 */
export function toLongPath(p: string): string {
  if (process.platform !== "win32") return p;
  const abs = resolve(p);
  if (abs.startsWith("\\\\?\\")) return abs;
  if (abs.length < 240) return abs;
  if (abs.startsWith("\\\\")) return "\\\\?\\UNC\\" + abs.slice(2);
  return "\\\\?\\" + abs;
}

/** Normaliza para comparação estável (NFC + separadores para frente). */
export function normalizePath(p: string): string {
  return p.normalize("NFC");
}
