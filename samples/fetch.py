#!/usr/bin/env python3
"""Download Serval's public docs and extract the TypeScript workflow snippets into this folder."""
import concurrent.futures
import re
import urllib.request
from pathlib import Path

HERE = Path(__file__).parent
INDEX = "https://docs.serval.com/llms.txt"
FENCE = re.compile(r"^\s*(`{3,})\s*(typescript|ts|javascript|js)\b", re.I)
QUOTE = re.compile(r"^(\s*>\s?)+")
KEEP = re.compile(r"""from\s+["']serval/|\.apiRequest\(|\bctx\b""")


def get(url):
    if not url.startswith("https://docs.serval.com/"):
        raise ValueError(url)
    with urllib.request.urlopen(url, timeout=30) as r:
        return r.read(5_000_000).decode("utf-8", "replace")


def index_urls():
    urls = set()
    for sub in re.findall(r"https://docs\.serval\.com/[^\s)]+\.txt", get(INDEX)):
        urls.update(re.findall(r"https://docs\.serval\.com/sections/[^\s)]+\.md", get(sub)))
    return sorted(urls)


def blocks(md):
    lines = [QUOTE.sub("", l) for l in md.split("\n")]
    i = 0
    while i < len(lines):
        m = FENCE.match(lines[i])
        if m:
            end = re.compile(r"^\s*" + m.group(1) + r"\s*$")
            body = []
            i += 1
            while i < len(lines) and not end.match(lines[i]):
                body.append(lines[i])
                i += 1
            yield "\n".join(body)
        i += 1


def main():
    urls = index_urls()
    with concurrent.futures.ThreadPoolExecutor(8) as pool:
        pages = dict(zip(urls, pool.map(get, urls)))
    kept = 0
    for url, md in pages.items():
        slug = re.sub(r"^https://docs\.serval\.com/sections/|\.md$", "", url).replace("/", "_")
        for n, code in enumerate(blocks(md), 1):
            if KEEP.search(code):
                (HERE / f"{slug}__{n}.ts").write_text(f"// @source {url}\n{code}\n")
                kept += 1
    print(f"{len(pages)} pages, {kept} snippets")


if __name__ == "__main__":
    main()
