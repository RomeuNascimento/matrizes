/**
 * Extração das linhas (threads) embutidas no cabeçalho do PES, que existem a
 * partir da versão 5. Versões 1–4 não trazem paleta própria (usa-se a paleta
 * fixa do PEC).
 *
 * Portado de pyembroidery (PesReader.read_pes_header_version_*).
 */

/** Cursor de leitura sequencial sobre um Buffer, espelhando a API do pyembroidery. */
class Cursor {
  constructor(private buf: Buffer, public pos: number) {}

  seek(delta: number): void {
    this.pos += delta;
  }
  eof(): boolean {
    return this.pos >= this.buf.length;
  }
  u8(): number {
    return this.buf[this.pos++];
  }
  u16le(): number {
    const v = this.buf.readUInt16LE(this.pos);
    this.pos += 2;
    return v;
  }
  u24be(): number {
    const v =
      (this.buf[this.pos] << 16) |
      (this.buf[this.pos + 1] << 8) |
      this.buf[this.pos + 2];
    this.pos += 3;
    return v >>> 0;
  }
  /** String prefixada por tamanho (1 byte). Comprimento 0 → null. */
  pesString(): string | null {
    if (this.eof()) return null;
    const len = this.u8();
    if (len === 0) return null;
    const s = this.buf.toString("latin1", this.pos, this.pos + len);
    this.pos += len;
    return s;
  }
}

function skipMetadata(c: Cursor): void {
  // name, category, author, keywords, comments
  for (let i = 0; i < 5; i++) c.pesString();
}

function toHex(color24: number): string {
  const r = (color24 >> 16) & 0xff;
  const g = (color24 >> 8) & 0xff;
  const b = color24 & 0xff;
  const h = (n: number) => n.toString(16).padStart(2, "0").toUpperCase();
  return `#${h(r)}${h(g)}${h(b)}`;
}

function readThreads(c: Cursor, count: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    if (c.eof()) break;
    c.pesString(); // catalog_number
    const color = 0xff000000 | c.u24be();
    out.push(toHex(color & 0xffffff));
    c.seek(5);
    c.pesString(); // description
    c.pesString(); // brand
    c.pesString(); // chart
  }
  return out;
}

/**
 * Lê a lista de threads embutidas. `version` é o número (5, 5.5, 6, 7, 8, 9, 10).
 * O cursor deve iniciar logo após os 12 primeiros bytes (assinatura + offset PEC).
 * Retorna [] para versões sem paleta embutida ou se o cabeçalho tiver itens
 * complexos (fills/motifs/feathers), caso em que o pyembroidery também aborta.
 */
export function readEmbeddedThreads(buf: Buffer, version: number | null): string[] {
  if (version === null || version < 5) return [];
  const c = new Cursor(buf, 12);

  try {
    if (version >= 5 && version < 6) {
      c.seek(4);
      skipMetadata(c);
      c.seek(24);
      c.pesString(); // image
      c.seek(24);
    } else if (version === 6 || version === 7) {
      c.seek(4);
      skipMetadata(c);
      c.seek(36);
      c.pesString(); // image_file
      c.seek(24);
    } else if (version === 8) {
      c.seek(4);
      skipMetadata(c);
      c.seek(38);
      c.pesString();
      c.seek(26);
    } else if (version === 9) {
      c.seek(4);
      skipMetadata(c);
      c.seek(14);
      c.pesString(); // hoop_name
      c.seek(30);
      c.pesString(); // image_file
      c.seek(34);
    } else if (version === 10) {
      c.seek(4);
      skipMetadata(c);
      c.seek(14);
      c.pesString();
      c.seek(38);
      c.pesString();
      c.seek(34);
    } else {
      return [];
    }

    if (c.u16le() !== 0) return []; // programmable fills
    if (c.u16le() !== 0) return []; // motifs
    if (c.u16le() !== 0) return []; // feather patterns
    const countThreads = c.u16le();
    if (countThreads < 0 || countThreads > 1000) return [];
    return readThreads(c, countThreads);
  } catch {
    return []; // cabeçalho inesperado → cai na paleta do PEC
  }
}
