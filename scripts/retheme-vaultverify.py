#!/usr/bin/env python3
"""Re-theme src/ from the indigo/navy palette to the VaultVerify green/teal
palette (extracted from the reference Skills Checklist PDF). Idempotent."""
import re, pathlib

ROOT = pathlib.Path('/home/z/my-project/src')

# hex → hex (case-insensitive, applied to both lowercase and uppercase forms)
HEX_MAP = {
    # accent (was indigo) → VaultVerify green
    '4f46e5': '1F7A44',
    '6366f1': '2E9E5B',
    '4338ca': '1E6B3C',
    '818cf8': '7BC894',
    'c7d2fe': 'CBE8D6',
    'eef2ff': 'E9F5EC',
    'e0e7ff': 'DDEFE3',
    'a5b4fc': '9DDBB6',
    # dark navy → dark teal
    '0a1628': '0A2B23',
    '1a2a6c': '0E3B32',
    '312e81': '124F41',
    'a8b8d8': 'A8CFB8',
    '8ea0c8': '7FA893',
    # greens → reference greens
    '059669': '2E9E5B',
    '15803d': '2E7D4F',
    '047857': '1E6B3C',
    '10b981': '34A853',
    'dcfce7': 'DFF2E3',
    '86efac': 'BFE3CE',
    'ecfdf5': 'E9F5EC',
    # blues → reference blues
    '2563eb': '2F6BC4',
    '1d4ed8': '2F6BC4',
    'dbeafe': 'E3EDFB',
    '93c5fd': 'B9D0F5',
    # ambers → reference ambers
    'b45309': '9A6200',
    'd97706': 'C77F0A',
    'fef3c7': 'FDF1DC',
    'fcd34d': 'F3D9A6',
    'fbbf24': 'F5A623',
    # reds → reference reds
    'dc2626': 'E5484D',
    'b91c1c': 'C13A3E',
    'fee2e2': 'FDEAEA',
    'fca5a5': 'F3B8BA',
    'fef2f2': 'FDEEEE',
}

RGBA_MAP = {
    'rgba(79,70,229': 'rgba(31,122,68',   # 4f46e5
    'rgba(67,56,202': 'rgba(30,107,60',   # 4338ca
    'rgba(99,102,241': 'rgba(46,158,91',  # 6366f1
}

changed_files = 0
for p in ROOT.rglob('*'):
    if p.suffix not in ('.tsx', '.ts'):
        continue
    s = p.read_text()
    orig = s
    for old, new in HEX_MAP.items():
        s = re.sub(re.escape('#' + old), '#' + new, s, flags=re.IGNORECASE)
    for old, new in RGBA_MAP.items():
        s = s.replace(old, new)
        s = s.replace(old.replace(',', ', '), new.replace(',', ', '))
    if s != orig:
        p.write_text(s)
        changed_files += 1
        print(f'  {p.relative_to(ROOT.parent)}')
print(f'{changed_files} files re-themed')
