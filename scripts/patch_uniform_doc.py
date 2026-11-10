#!/usr/bin/env python3
# Finish the "uniform manual output" patch on checklist-document.tsx.
# (The attestation ternary + footer conditional — applied by line surgery
#  because JSX comment dash-counts make exact string matching fragile.)
import sys

P = 'src/components/checklist-document.tsx'
s = open(P, encoding='utf-8').read()
orig = s

def must(cond, msg):
    if not cond:
        print('FAIL:', msg)
        sys.exit(1)

# 1) Remove ` {isManual ? ( <manual card> ) : ( ` wrapper, keep the else branch.
start = s.find('        {isManual ? (\n')
must(start != -1, 'ternary open not found')
else_open = s.find('        ) : (\n', start)
must(else_open != -1, 'ternary else not found')
s = s[:start] + s[else_open + len('        ) : (\n'):]

# 2) Remove the closing `)}` of the removed ternary (the first one at this indent
#    after the attestation card's final `</div>`).
close = s.find('\n        )}\n', start)
must(close != -1, 'ternary close not found')
s = s[:close] + s[close + len('\n        )}\n') - 1:]  # keep the preceding newline

# 3) Signature fallbacks -> candidate name (uniform with the PDF).
must(s.count("{data.signedName ?? data.printedName ?? '\u2014'}") == 1, 'signed fallback')
s = s.replace("{data.signedName ?? data.printedName ?? '\u2014'}", '{data.signedName ?? data.printedName ?? name}')
must(s.count("{data.printedName ?? data.signedName ?? '\u2014'}") == 1, 'printed fallback')
s = s.replace("{data.printedName ?? data.signedName ?? '\u2014'}", '{data.printedName ?? data.signedName ?? name}')

# 4) Uniform footer (no manual-vs-link distinction).
old_footer = """            {isManual
              ? 'Entered manually by the recruiter.'
              : `Access was granted to the recruiter who requested this checklist, through ${CHECKLIST_BRAND.name}.`}"""
must(old_footer in s, 'footer conditional not found')
s = s.replace(old_footer, '            `Access was granted to the recruiter who requested this checklist, through ${CHECKLIST_BRAND.name}.`')

# 5) No remaining references.
must('isManual' not in s, 'isManual still referenced')
must('Recruiter-entered' not in s, 'recruiter-entered text still present')

open(P, 'w', encoding='utf-8').write(s)
print(f'OK — patched {P} ({len(orig)} -> {len(s)} bytes)')
