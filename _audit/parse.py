import json, io
SRC = r"C:\Users\SAFA\AppData\Local\Temp\claude\C--Users-SAFA-zoho\46523523-8e14-4afc-8bdc-9be60d69639f\tasks\wkiml23vq.output"
OUT = r"C:\Users\SAFA\zoho\_audit\audit-summary.txt"
raw = open(SRC, encoding='utf-8', errors='replace').read()

def extract_array(s):
    start = s.find('[')
    depth = 0; instr = False; esc = False
    for i in range(start, len(s)):
        ch = s[i]
        if instr:
            if esc: esc = False
            elif ch == '\\': esc = True
            elif ch == '"': instr = False
        else:
            if ch == '"': instr = True
            elif ch == '[': depth += 1
            elif ch == ']':
                depth -= 1
                if depth == 0:
                    return s[start:i+1]
    return s[start:]

try:
    parsed = json.loads(raw)
except Exception:
    parsed = json.loads(extract_array(raw))
data = parsed.get('result', parsed) if isinstance(parsed, dict) else parsed

w = io.open(OUT, 'w', encoding='utf-8')
sev_order = {"P0":0,"P1":1,"P2":2,"P3":3}
from collections import Counter
tally = Counter()
w.write("DIMENSIONS RETURNED: %d\n" % len(data))
for d in data:
    if not isinstance(d, dict):
        w.write("\n(non-dict element: %r)\n" % (str(d)[:80])); continue
    w.write("\n========== %s | score=%s ==========\n" % (d.get('dimension'), d.get('score')))
    w.write("SUMMARY: %s\n" % (d.get('summary','') or ''))
    fs = d.get('findings', []) or []
    for f in fs:
        tally[f.get('severity')] += 1
    for f in sorted(fs, key=lambda x: sev_order.get(x.get('severity'),9)):
        w.write("  [%s] %s\n     @ %s\n     fix: %s\n" % (
            f.get('severity'), f.get('title'), f.get('file'),
            (f.get('recommendation','') or '')[:240]))
    ver = d.get('verified', []) or []
    if ver:
        real = sum(1 for v in ver if (v.get('verdict') or {}).get('real'))
        w.write("  -- verified P0/P1: %d/%d confirmed real\n" % (real, len(ver)))
w.write("\n\n===== SEVERITY TALLY =====\n")
for s in ["P0","P1","P2","P3"]:
    w.write("  %s: %d\n" % (s, tally.get(s,0)))
w.write("  TOTAL: %d\n" % sum(tally.values()))
w.close()
print("wrote", OUT, "dims=", len(data), "findings=", sum(tally.values()))
