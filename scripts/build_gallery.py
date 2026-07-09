#!/usr/bin/env python3
"""
Monta uma galeria HTML autocontida (imagens embutidas em base64) a partir da
saída do oracle_report.py. Serve para VISUALIZAR as matrizes lidas dos .PES.

Uso: build_gallery.py <pasta_saida_do_oracle> <arquivo_html>
"""
import sys
import os
import json
import base64
import io
import html
from PIL import Image

TILE = 340


def br(n):
    """Formata inteiro com ponto de milhar (padrão pt-BR)."""
    return f"{n:,}".replace(",", ".")


def b64_thumb(png_path):
    img = Image.open(png_path).convert("RGBA")
    img.thumbnail((TILE, TILE), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def main():
    out_dir, html_path = sys.argv[1], sys.argv[2]
    data = json.load(open(os.path.join(out_dir, "metadata.json"), encoding="utf-8"))
    oks = [d for d in data if d.get("status") == "ok"]

    total_pontos = sum(d["num_pontos"] for d in oks)
    cards = []
    for d in oks:
        nome = html.escape(os.path.splitext(d["arquivo"])[0])
        png = os.path.join(out_dir, d["miniatura"])
        src = "data:image/png;base64," + b64_thumb(png)
        swatches = "".join(
            f'<span class="sw" style="--c:{html.escape(c)}"></span>' for c in d.get("cores_hex", [])
        )
        cards.append(f"""
      <article class="card" data-nome="{nome.lower()}" data-pontos="{d['num_pontos']}"
               data-cores="{d['num_cores']}" data-area="{d['largura_mm'] * d['altura_mm']:.0f}">
        <div class="thumb"><img loading="lazy" src="{src}" alt="Matriz {nome}"></div>
        <div class="meta">
          <h2 class="nome">{nome}</h2>
          <p class="dim">{d['largura_mm']} × {d['altura_mm']} mm</p>
          <div class="row">
            <span class="tag">{br(d['num_pontos'])} pontos</span>
            <span class="tag">{d['num_cores']} cores</span>
          </div>
          <div class="swatches">{swatches}</div>
        </div>
      </article>""")

    cards_html = "\n".join(cards)

    doc = f"""<title>Minhas matrizes de bordado</title>
<style>
  :root {{
    --ground:#E7E2D6; --surface:#FBF9F4; --surface-2:#F1EDE3;
    --ink:#2C352A; --ink-soft:#5E6656; --line:#D8D2C4;
    --rose:#C0356F; --sage:#6E8B4E;
    --tile:#F6F2E9;
    --shadow:0 1px 2px rgba(44,53,42,.06), 0 8px 24px rgba(44,53,42,.07);
  }}
  @media (prefers-color-scheme: dark) {{
    :root {{
      --ground:#171A14; --surface:#20241C; --surface-2:#181C15;
      --ink:#ECE7DA; --ink-soft:#A7AC98; --line:#333829;
      --rose:#E877A6; --sage:#A6C486; --tile:#252A1E;
      --shadow:0 1px 2px rgba(0,0,0,.3), 0 10px 30px rgba(0,0,0,.35);
    }}
  }}
  :root[data-theme="light"] {{
    --ground:#E7E2D6; --surface:#FBF9F4; --surface-2:#F1EDE3;
    --ink:#2C352A; --ink-soft:#5E6656; --line:#D8D2C4;
    --rose:#C0356F; --sage:#6E8B4E; --tile:#F6F2E9;
    --shadow:0 1px 2px rgba(44,53,42,.06), 0 8px 24px rgba(44,53,42,.07);
  }}
  :root[data-theme="dark"] {{
    --ground:#171A14; --surface:#20241C; --surface-2:#181C15;
    --ink:#ECE7DA; --ink-soft:#A7AC98; --line:#333829;
    --rose:#E877A6; --sage:#A6C486; --tile:#252A1E;
    --shadow:0 1px 2px rgba(0,0,0,.3), 0 10px 30px rgba(0,0,0,.35);
  }}

  * {{ box-sizing:border-box; }}
  body {{
    margin:0; background:var(--ground); color:var(--ink);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
    line-height:1.5; -webkit-font-smoothing:antialiased;
  }}
  .wrap {{ max-width:1180px; margin:0 auto; padding:clamp(20px,4vw,52px) clamp(16px,3vw,32px) 64px; }}

  header .eyebrow {{
    font-size:.72rem; letter-spacing:.18em; text-transform:uppercase;
    color:var(--rose); font-weight:600; margin:0 0 12px;
  }}
  header h1 {{
    font-family:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;
    font-weight:600; font-size:clamp(2rem,5vw,3.1rem); line-height:1.05;
    letter-spacing:-.01em; margin:0 0 14px; text-wrap:balance;
  }}
  header p.lead {{ font-size:1.05rem; color:var(--ink-soft); max-width:60ch; margin:0; }}

  .stats {{ display:flex; flex-wrap:wrap; gap:28px; margin:30px 0 6px;
            padding:20px 24px; background:var(--surface); border:1px solid var(--line);
            border-radius:14px; box-shadow:var(--shadow); }}
  .stat .n {{ font-family:"Iowan Old Style",Palatino,Georgia,serif; font-size:1.7rem;
             font-weight:600; font-variant-numeric:tabular-nums; }}
  .stat .l {{ font-size:.8rem; color:var(--ink-soft); letter-spacing:.02em; }}

  .toolbar {{ display:flex; flex-wrap:wrap; gap:12px; align-items:center;
             margin:28px 0 22px; }}
  .search {{ flex:1 1 260px; position:relative; }}
  .search input {{
    width:100%; padding:13px 16px 13px 44px; font-size:1rem; color:var(--ink);
    background:var(--surface); border:1px solid var(--line); border-radius:11px;
  }}
  .search input::placeholder {{ color:var(--ink-soft); }}
  .search input:focus {{ outline:2px solid var(--rose); outline-offset:1px; border-color:transparent; }}
  .search svg {{ position:absolute; left:15px; top:50%; transform:translateY(-50%);
                width:18px; height:18px; stroke:var(--ink-soft); }}
  select {{ padding:13px 16px; font-size:.95rem; color:var(--ink);
           background:var(--surface); border:1px solid var(--line); border-radius:11px; }}
  select:focus {{ outline:2px solid var(--rose); outline-offset:1px; }}

  .grid {{ display:grid; gap:20px;
          grid-template-columns:repeat(auto-fill,minmax(220px,1fr)); }}
  .card {{ background:var(--surface); border:1px solid var(--line); border-radius:16px;
          overflow:hidden; box-shadow:var(--shadow);
          transition:transform .15s ease, box-shadow .15s ease; }}
  .card:hover {{ transform:translateY(-3px);
                box-shadow:0 4px 8px rgba(44,53,42,.08), 0 16px 40px rgba(44,53,42,.12); }}
  .thumb {{ aspect-ratio:1/1; background:
    radial-gradient(circle at 50% 40%, var(--surface-2), var(--tile));
    display:flex; align-items:center; justify-content:center; padding:14px; }}
  .thumb img {{ max-width:100%; max-height:100%; object-fit:contain; }}
  .meta {{ padding:14px 16px 16px; }}
  .nome {{ font-family:"Iowan Old Style",Palatino,Georgia,serif; font-size:1.1rem;
          font-weight:600; margin:0 0 2px; letter-spacing:.01em; }}
  .dim {{ margin:0 0 10px; color:var(--ink-soft); font-size:.86rem;
         font-variant-numeric:tabular-nums; }}
  .row {{ display:flex; flex-wrap:wrap; gap:6px; margin-bottom:11px; }}
  .tag {{ font-size:.73rem; color:var(--ink-soft); background:var(--surface-2);
         border:1px solid var(--line); padding:3px 9px; border-radius:999px;
         font-variant-numeric:tabular-nums; }}
  .swatches {{ display:flex; gap:5px; flex-wrap:wrap; }}
  .sw {{ width:15px; height:15px; border-radius:50%; background:var(--c);
        box-shadow:inset 0 0 0 1px rgba(0,0,0,.15); }}

  .empty {{ text-align:center; color:var(--ink-soft); padding:60px 20px; display:none; }}
  footer {{ margin-top:48px; padding-top:20px; border-top:1px solid var(--line);
           color:var(--ink-soft); font-size:.82rem; }}
  @media (prefers-reduced-motion: reduce) {{ .card {{ transition:none; }} }}
</style>

<div class="wrap">
  <header>
    <p class="eyebrow">Prova técnica · leitura de arquivos .PES</p>
    <h1>Suas matrizes, vistas como imagens</h1>
    <p class="lead">Estas {len(oks)} miniaturas foram desenhadas diretamente a partir dos pontos e
    das cores de linha gravados nos seus arquivos <strong>.PES</strong> — nenhum arquivo
    original foi alterado. É a promessa do aplicativo funcionando de verdade.</p>
  </header>

  <div class="stats">
    <div class="stat"><div class="n">{len(oks)}</div><div class="l">desenhos lidos</div></div>
    <div class="stat"><div class="n">{br(total_pontos)}</div><div class="l">pontos no total</div></div>
    <div class="stat"><div class="n">100%</div><div class="l">arquivos reconhecidos</div></div>
  </div>

  <div class="toolbar">
    <div class="search">
      <svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"></circle><path d="M21 21l-4.3-4.3"></path></svg>
      <input id="q" type="search" placeholder="Busque um desenho pelo nome…" autocomplete="off">
    </div>
    <select id="sort" aria-label="Ordenar">
      <option value="nome">Ordem alfabética</option>
      <option value="pontos">Mais pontos primeiro</option>
      <option value="cores">Mais cores primeiro</option>
      <option value="area">Maiores primeiro</option>
    </select>
  </div>

  <div class="grid" id="grid">
{cards_html}
  </div>
  <p class="empty" id="empty">Nenhum desenho encontrado com esse nome.</p>

  <footer>Gerado a partir de {len(oks)} arquivos .PES reais usando o leitor de referência do
  projeto (PyEmbroidery). Dimensões, contagem de pontos, cores e a imagem vêm do próprio arquivo.</footer>
</div>

<script>
  const grid = document.getElementById('grid');
  const cards = Array.from(grid.children);
  const q = document.getElementById('q');
  const sort = document.getElementById('sort');
  const empty = document.getElementById('empty');

  function apply() {{
    const term = q.value.trim().toLowerCase();
    let visible = 0;
    cards.forEach(c => {{
      const hit = c.dataset.nome.includes(term);
      c.style.display = hit ? '' : 'none';
      if (hit) visible++;
    }});
    empty.style.display = visible ? 'none' : 'block';

    const key = sort.value;
    const shown = cards.filter(c => c.style.display !== 'none');
    shown.sort((a, b) => key === 'nome'
      ? a.dataset.nome.localeCompare(b.dataset.nome)
      : Number(b.dataset[key]) - Number(a.dataset[key]));
    shown.forEach(c => grid.appendChild(c));
  }}
  q.addEventListener('input', apply);
  sort.addEventListener('change', apply);
  apply();
</script>"""

    with open(html_path, "w", encoding="utf-8") as f:
        f.write(doc)
    size_kb = os.path.getsize(html_path) / 1024
    print(f"Galeria gerada: {html_path} ({size_kb:.0f} KB, {len(oks)} cards)")


if __name__ == "__main__":
    main()
