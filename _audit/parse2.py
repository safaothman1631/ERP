import json, io
SRC = r"C:\Users\SAFA\AppData\Local\Temp\claude\C--Users-SAFA-zoho\46523523-8e14-4afc-8bdc-9be60d69639f\tasks\wwg9tmyxx.output"
OUT = r"C:\Users\SAFA\zoho\_audit\verify-manifest.txt"
raw = open(SRC, encoding='utf-8', errors='replace').read()
parsed = json.loads(raw)
res = parsed.get('result', parsed)
allitems = res.get('all', []) if isinstance(res, dict) else res
safe = res.get('safeNow', []) if isinstance(res, dict) else []
w = io.open(OUT, 'w', encoding='utf-8')
w.write("TOTAL ITEMS: %d | SAFE_NOW+CONFIRMED: %d\n" % (len(allitems), len(safe)))
w.write("\nLOGS: %s\n" % " | ".join(parsed.get('logs', [])))
# group by implementability
from collections import defaultdict
g = defaultdict(list)
for it in allitems:
    g[it.get('implementability','?')].append(it)
for bucket in ['SAFE_NOW','NEEDS_INFRA','NEEDS_TEAM_OR_REALDATA','HUMAN_TASK']:
    items = g.get(bucket, [])
    w.write("\n\n################# %s (%d) #################\n" % (bucket, len(items)))
    for it in items:
        w.write("\n[%s] %s\n   @ %s\n   %s\n" % (it.get('verdict'), it.get('title'), it.get('file'), it.get('note','')))
w.close()
print("wrote", OUT, "items=", len(allitems), "safe=", len(safe))
