#!/usr/bin/env python3
"""Objective ink-coverage analysis of rendered checklist PDF pages.
For each page: find where content starts/ends vertically (first/last ink row),
and report the empty gap between the last content and the footer area."""
import sys
from PIL import Image

def analyze(path):
    im = Image.open(path).convert('L')
    w, h = im.size
    px = im.load()
    # a row has "ink" if it contains >=8 pixels darker than 235
    rows = []
    for y in range(h):
        ink = 0
        for x in range(0, w, 3):  # sample every 3rd px
            if px[x, y] < 235:
                ink += 1
                if ink >= 8:
                    break
        rows.append(ink >= 8)
    # find first and last ink row
    first = next((i for i, r in enumerate(rows) if r), None)
    last = next((h - 1 - i for i, r in enumerate(reversed(rows)) if r), None)
    # exclude the footer zone (bottom 5%) to find the true content end
    content_zone = rows[: int(h * 0.94)]
    lastc = next((len(content_zone) - 1 - i for i, r in enumerate(reversed(content_zone)) if r), None)
    # find internal blank gaps > 60px within the content zone
    gaps = []
    run = 0
    for i in range(first, lastc + 1):
        if not rows[i]:
            run += 1
        else:
            if run > 55:
                gaps.append((i - run, i, run))
            run = 0
    pct_used = (lastc - first) / h * 100 if first is not None else 0
    print(f"{path.split('/')[-1]}: size={w}x{h} first_ink={first} last_ink={last} "
          f"content_end={lastc} ({pct_used:.0f}% of height used) "
          f"gap_to_footer={h - lastc}px")
    for g in gaps:
        print(f"   internal blank gap: rows {g[0]}-{g[1]} ({g[2]}px ≈ {g[2]/h*792:.0f}pt)")

for p in sys.argv[1:]:
    analyze(p)
