from __future__ import annotations

import base64
from io import BytesIO
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT.parent / "project_sources"


def data_uri(image: Image.Image) -> str:
    stream = BytesIO()
    image.save(stream, format="PNG", optimize=True)
    return "data:image/png;base64," + base64.b64encode(stream.getvalue()).decode("ascii")


def write_wordmark(source: Path, target: Path) -> None:
    image = Image.open(source).convert("RGBA")
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 510 180" '
        'role="img" aria-labelledby="wordmark-title">'
        '<title id="wordmark-title">WrongGoods</title>'
        f'<image width="510" height="180" href="{data_uri(image)}"/>'
        "</svg>\n"
    )
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(svg, encoding="utf-8")


def write_micro_mark(source: Path, target: Path) -> None:
    image = Image.open(source).convert("RGBA")
    w = image.crop((0, 0, 133, 90))
    g = image.crop((29, 90, 116, 180))
    mark = Image.new("RGBA", (226, 90))
    mark.alpha_composite(w, (0, 0))
    mark.alpha_composite(g, (139, 0))
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" '
        'role="img" aria-labelledby="mark-title">'
        '<title id="mark-title">WG</title>'
        '<rect width="64" height="64" rx="6" fill="#E9F529"/>'
        f'<image x="5" y="20" width="54" height="22" href="{data_uri(mark)}"/>'
        "</svg>\n"
    )
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(svg, encoding="utf-8")


write_wordmark(
    SOURCE_DIR / "15-Asset-4-2x.png",
    ROOT / "landing/public/assets/wronggoods-wordmark.svg",
)
write_wordmark(
    SOURCE_DIR / "16-Asset-1-2x.png",
    ROOT / "public/brand/wordmark.svg",
)
write_micro_mark(
    SOURCE_DIR / "16-Asset-1-2x.png",
    ROOT / "landing/public/favicon.svg",
)
write_micro_mark(
    SOURCE_DIR / "16-Asset-1-2x.png",
    ROOT / "public/favicon.svg",
)


def replace_in_file(path: Path, replacements: dict[str, str]) -> None:
    text = path.read_text(encoding="utf-8")
    for old, new in replacements.items():
        if old not in text:
            raise ValueError(f"Expected source text not found in {path}: {old}")
        text = text.replace(old, new)
    path.write_text(text, encoding="utf-8")


replace_in_file(
    ROOT / "landing/public/index.html",
    {
        'content="#0A0A0A"': 'content="#0C0C0C"',
        '<a class="wordmark" href="/" aria-label="WrongGoods home"><span>WRONG</span><span>GOODS</span></a>':
            '<a class="wordmark" href="/" aria-label="WrongGoods home"><img src="/assets/wronggoods-wordmark.svg" width="510" height="179" alt=""></a>',
    },
)
replace_in_file(
    ROOT / "landing/public/privacy.html",
    {
        '<meta name="viewport" content="width=device-width,initial-scale=1">':
            '<meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0C0C0C">',
        '<link rel="icon" href="/favicon.svg">': '<link rel="icon" href="/favicon.svg" type="image/svg+xml">',
        '<a class="wordmark" href="/" aria-label="WrongGoods home"><span>WRONG</span><span>GOODS</span></a>':
            '<a class="wordmark" href="/" aria-label="WrongGoods home"><img src="/assets/wronggoods-wordmark.svg" width="510" height="179" alt=""></a>',
    },
)
replace_in_file(
    ROOT / "landing/public/styles.css",
    {
        '--black:#0A0A0A;--bone:#F0EDE6;--yellow:#D9DE21':
            '--black:#0C0C0C;--bone:#EFECE3;--yellow:#E9F529',
        '.wordmark{font:33px/.89 Anton,Impact,sans-serif;letter-spacing:-.025em;display:grid}':
            '.wordmark{display:block;width:142px;flex:0 0 auto}.wordmark img{display:block;width:100%;height:auto}',
        '.wordmark{font-size:27px}': '.wordmark{width:116px}',
    },
)
