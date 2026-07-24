import os, re, yaml
from collections import Counter

ROOT = 'knowledge/experiences'
files = []
for dp, dn, fns in os.walk(ROOT):
    for fn in fns:
        if fn.endswith('.md'):
            files.append(os.path.join(dp, fn))

grades = Counter()
source_counts = Counter()
examples = {'A': [], 'B': [], 'C': [], 'D': [], '': []}

for f in files:
    with open(f, 'r', encoding='utf-8') as fh:
        raw = fh.read()
    try:
        parts = re.split(r'^---\s*$', raw, maxsplit=2, flags=re.MULTILINE)
        data = yaml.safe_load(parts[1]) if len(parts) >= 2 else {}
    except Exception:
        data = {}
    g = data.get('source_grade', '') or ''
    grades[g] += 1
    sources = data.get('sources', [])
    source_counts[len(sources)] += 1
    if len(examples[g]) < 5:
        title = ''
        m = re.search(r'^#\s+(.+)', raw, re.M)
        if m:
            title = m.group(1)
        examples[g].append((title, os.path.basename(f), len(sources)))

with open('frontend/scripts/grade_reclassify.txt', 'w', encoding='utf-8') as fh:
    fh.write(f'grades: {dict(grades)}\n')
    fh.write(f'source_counts: {dict(source_counts)}\n\n')
    for g, lst in examples.items():
        fh.write(f'{g or "(empty)"}:\n')
        for t, fn, sc in lst:
            fh.write(f'  - {t} | {fn} | sources={sc}\n')
print('written')
