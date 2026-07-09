#!/usr/bin/env python3
"""
Oráculo de leitura de bordado (PyEmbroidery) + renderizador de miniaturas.

Uso:
    oracle_report.py <pasta_com_pes> <pasta_saida>

Para cada arquivo .PES encontrado (recursivo), gera:
  - metadados de referência (dimensões em mm, nº de pontos, nº de cores, versão);
  - uma miniatura PNG desenhada nas cores reais das linhas.

Escreve <pasta_saida>/metadata.json e <pasta_saida>/thumbs/<nome>.png.

Objetivo: servir de VERDADE DE REFERÊNCIA (oráculo) para validar o leitor
próprio em TypeScript e provar visualmente a leitura das matrizes.
"""
import sys
import os
import json
import glob

from PIL import Image, ImageDraw
import pyembroidery
from pyembroidery import STITCH, JUMP, TRIM, COLOR_CHANGE, END, STOP, COMMAND_MASK

THUMB = 512
PAD = 24


def rgb_for(threadlist, index):
    if threadlist and 0 <= index < len(threadlist):
        t = threadlist[index]
        return (t.get_red(), t.get_green(), t.get_blue())
    return (40, 40, 40)


def analyze(path):
    pattern = pyembroidery.read(path)
    stitches = pattern.stitches or []

    xs = [s[0] for s in stitches]
    ys = [s[1] for s in stitches]
    if xs:
        min_x, max_x, min_y, max_y = min(xs), max(xs), min(ys), max(ys)
    else:
        min_x = max_x = min_y = max_y = 0

    stitch_count = sum(1 for s in stitches if (s[2] & COMMAND_MASK) == STITCH)
    color_changes = sum(1 for s in stitches if (s[2] & COMMAND_MASK) == COLOR_CHANGE)
    color_count = color_changes + 1 if stitches else 0

    version = None
    for key in ("version", "pes_version"):
        if key in pattern.extras:
            version = pattern.extras[key]
            break

    palette = []
    for t in pattern.threadlist:
        hexcolor = "#%02X%02X%02X" % (t.get_red(), t.get_green(), t.get_blue())
        if hexcolor not in palette:
            palette.append(hexcolor)

    meta = {
        "arquivo": os.path.basename(path),
        "nome_interno": pattern.extras.get("name") or pattern.get_metadata("name"),
        "versao": version,
        "largura_mm": round((max_x - min_x) / 10.0, 1),
        "altura_mm": round((max_y - min_y) / 10.0, 1),
        "num_pontos": stitch_count,
        "num_cores": color_count,
        "cores_hex": palette,
        "tamanho_bytes": os.path.getsize(path),
    }
    return pattern, meta, (min_x, min_y, max_x, max_y)


def render(pattern, bounds, out_path):
    min_x, min_y, max_x, max_y = bounds
    span_x = max(max_x - min_x, 1)
    span_y = max(max_y - min_y, 1)
    scale = min((THUMB - 2 * PAD) / span_x, (THUMB - 2 * PAD) / span_y)
    off_x = (THUMB - span_x * scale) / 2
    off_y = (THUMB - span_y * scale) / 2

    def tf(x, y):
        px = off_x + (x - min_x) * scale
        py = off_y + (max_y - y) * scale  # inverte Y para ficar em pé
        return (px, py)

    img = Image.new("RGBA", (THUMB, THUMB), (255, 255, 255, 0))
    draw = ImageDraw.Draw(img)

    prev = None
    ci = 0
    threads = pattern.threadlist
    for s in pattern.stitches:
        cmd = s[2] & COMMAND_MASK
        if cmd == COLOR_CHANGE:
            ci += 1
            prev = None
            continue
        if cmd in (END, STOP):
            continue
        pt = tf(s[0], s[1])
        if cmd == STITCH:
            if prev is not None:
                draw.line([prev, pt], fill=rgb_for(threads, ci), width=3, joint="curve")
            prev = pt
        else:  # JUMP / TRIM: move sem desenhar
            prev = pt

    img.save(out_path)


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        sys.exit(1)
    src, out = sys.argv[1], sys.argv[2]
    thumbs_dir = os.path.join(out, "thumbs")
    os.makedirs(thumbs_dir, exist_ok=True)

    files = sorted(glob.glob(os.path.join(src, "**", "*.pes"), recursive=True) +
                   glob.glob(os.path.join(src, "**", "*.PES"), recursive=True))
    results = []
    for path in files:
        entry = {"arquivo": os.path.basename(path)}
        try:
            pattern, meta, bounds = analyze(path)
            png = os.path.join(thumbs_dir, os.path.splitext(os.path.basename(path))[0] + ".png")
            render(pattern, bounds, png)
            meta["miniatura"] = os.path.relpath(png, out)
            meta["status"] = "ok"
            results.append(meta)
            print(f"OK  {meta['arquivo']:<24} {meta['largura_mm']}x{meta['altura_mm']}mm "
                  f"{meta['num_pontos']} pontos {meta['num_cores']} cor(es)")
        except Exception as e:  # arquivo inválido não derruba o lote
            entry["status"] = "erro"
            entry["erro"] = str(e)
            results.append(entry)
            print(f"ERRO {entry['arquivo']}: {e}")

    with open(os.path.join(out, "metadata.json"), "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    oks = [r for r in results if r.get("status") == "ok"]
    print(f"\n{len(oks)}/{len(results)} arquivos lidos com sucesso.")


if __name__ == "__main__":
    main()
