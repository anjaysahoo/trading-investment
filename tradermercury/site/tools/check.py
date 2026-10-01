#!/usr/bin/env python3
"""Validate the site: YouTube timestamps, relative links + anchors, chapter contract.
Usage: python3 check.py [--final]   (exit 1 on any error)"""
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

TOOLS = Path(__file__).resolve().parent
SITE = TOOLS.parent
TSV = TOOLS / '../../notes/research/videos-dated.tsv'
YT = re.compile(r'https://www\.youtube\.com/watch\?v=([\w-]{11})&t=(\d+)s')
FORBIDDEN = ('lessons/', 'reference/', 'CURRICULUM', 'GLOSSARY.md')
BANNED_TEXT = re.compile(r'quiz|skill check', re.I)


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.ids, self.links, self.errors = {}, [], []
        self.ch = None
        self.sections = []   # stack: [is_idea, has_ts, line]
        self.dts = []        # (line, id)

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = (a.get('class') or '').split()
        line = self.getpos()[0]
        if 'id' in a:
            if a['id'] in self.ids:
                self.errors.append((line, f'duplicate id "{a["id"]}"'))
            self.ids[a['id']] = line
        if tag == 'body':
            self.ch = a.get('data-ch')
        if tag == 'section':
            self.sections.append(['idea' in cls, False, line])
        if tag == 'a' and 'ts' in cls:
            for s in self.sections:
                s[1] = True
        if tag == 'dt':
            self.dts.append((line, a.get('id')))
        for k in ('href', 'src'):
            if a.get(k) is not None:
                self.links.append((line, a[k]))

    def handle_endtag(self, tag):
        if tag == 'section' and self.sections:
            is_idea, has_ts, line = self.sections.pop()
            if is_idea and not has_ts:
                self.errors.append((line, 'section.idea without a.ts link'))

    def handle_data(self, data):
        m = BANNED_TEXT.search(data)
        if m:
            self.errors.append((self.getpos()[0], f'banned text "{m.group()}"'))


def main():
    final = '--final' in sys.argv[1:]
    videos = {}
    for row in TSV.read_text().splitlines()[1:]:
        cols = row.split('\t')
        videos[cols[3]] = int(cols[1])
    registry = {f: int(n) for n, f in re.findall(r"n:(\d+),.*?file:'([^']+)'", (SITE / 'nav.js').read_text())}

    pages = {}
    for p in sorted(SITE.rglob('*.html')):
        pg = Page()
        pg.feed(p.read_text())
        pg.close()
        pages[p.resolve()] = pg

    errors, nlinks = [], 0
    err = lambda p, line, msg: errors.append(f'{p.relative_to(SITE)}:{line}: {msg}')

    for path, pg in pages.items():
        for line, msg in pg.errors:
            err(path, line, msg)
        for line, url in pg.links:
            nlinks += 1
            if any(f in url for f in FORBIDDEN):
                err(path, line, f'forbidden link {url}')
            if 'youtube.com' in url or 'youtu.be' in url:
                m = YT.fullmatch(url)
                if not m:
                    err(path, line, f'bad YouTube link format {url}')
                elif m.group(1) not in videos:
                    err(path, line, f'unknown video id {m.group(1)}')
                elif int(m.group(2)) > videos[m.group(1)]:
                    err(path, line, f't={m.group(2)}s > video length {videos[m.group(1)]}s')
                continue
            if re.match(r'^[a-z][a-z0-9+.-]*:', url, re.I):   # http(s), mailto, etc.
                continue
            if url.startswith('/'):
                err(path, line, f'root-absolute path {url} (breaks on Pages)')
                continue
            target, _, anchor = url.partition('#')
            tpath = (path.parent / target).resolve() if target else path
            if not tpath.exists():
                pending = not final and tpath.parent == (SITE / 'ch').resolve() and tpath.name in registry
                if not pending:
                    err(path, line, f'missing target {target}')
                continue
            if anchor and tpath.suffix == '.html' and anchor not in pages[tpath].ids:
                err(path, line, f'missing anchor #{anchor} in {target or "self"}')

        if path.parent == (SITE / 'ch').resolve():
            if path.name not in registry:
                err(path, 1, 'chapter file not in nav.js registry')
            elif pg.ch != str(registry[path.name]):
                err(path, 1, f'body data-ch={pg.ch!r}, registry says {registry[path.name]}')

    if final:
        for f in registry:
            if not (SITE / 'ch' / f).exists():
                errors.append(f'ch/{f}:0: registry file missing')
        gl = pages.get((SITE / 'glossary.html').resolve())
        if gl:
            for line, i in gl.dts:
                if not i:
                    errors.append(f'glossary.html:{line}: dt without id')

    for e in errors:
        print(e)
    print(f'{len(pages)} pages, {nlinks} links {"OK" if not errors else "checked"}, {len(errors)} errors')
    sys.exit(1 if errors else 0)


if __name__ == '__main__':
    main()
