"""Synchronize static navigation while keeping all links usable without JavaScript."""
import argparse
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "dist"
NAVIGATION = (
    ("index", "賽區"), ("teams", "隊伍"), ("players", "選手"),
    ("champions", "英雄"), ("worlds", "世界賽"), ("backtest", "回測"), ("sources", "資料來源"),
)
HEADER = re.compile(r'<header class="site-header">.*?</header>', re.S)


def header(current):
    links = []
    for page, title in NAVIGATION:
        selected = ' aria-current="page"' if page == current else ""
        links.append(f'<a href="./{page}.html"{selected}>{title}</a>')
    return ('<header class="site-header"><div>'
            '<a class="brand" href="./index.html">LOL 賽事數據</a>'
            '<nav class="nav" aria-label="主要導覽">' + "".join(links) + '</nav></div></header>')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    changed = []
    for path in sorted(ROOT.glob("*.html")):
        text = path.read_text(encoding="utf-8")
        generated, n = HEADER.subn(lambda _: header(path.stem), text)
        if n != 1:
            raise ValueError(f"Expected one site header in {path.name}")
        if generated != text:
            changed.append(path.name)
            if not args.check:
                path.write_text(generated, encoding="utf-8")
    if args.check and changed:
        parser.exit(1, "Out of sync: " + ", ".join(changed) + "\n")


if __name__ == "__main__":
    main()
