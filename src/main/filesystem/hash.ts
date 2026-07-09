/**
 * Cálculo de hash SHA-256 de arquivos, por streaming (não carrega o arquivo
 * inteiro na memória).
 */
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { toLongPath } from "./paths.ts";

export function hashFile(caminho: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(toLongPath(caminho));
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}
