import json

with open('vocab.json', 'r', encoding='utf-8') as f:
    v = json.load(f)

with open('mappings.txt', 'w', encoding='utf-8') as f:
    for k in sorted(v.keys()):
        if len(k) <= 2:
            f.write(f"{k}: {v[k]}\n")
