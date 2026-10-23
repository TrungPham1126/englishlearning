import re
import json
import os

with open('xampp_backup.sql', 'r', encoding='utf-8', errors='ignore') as f:
    sql = f.read()

pattern = r'CREATE TABLE `(\w+)` \((.*?)\) ENGINE='
matches = re.findall(pattern, sql, re.DOTALL)
schema = {}
for name, body in matches:
    lines = [l.strip() for l in body.split('\n') if l.strip()]
    cols = []
    pks = []
    fks = []
    for l in lines:
        if l.startswith('`'):
            parts = l.split('`')
            col_name = parts[1]
            rest = parts[2].strip().rstrip(',')
            cols.append({'name': col_name, 'type': rest})
        elif 'PRIMARY KEY' in l:
            pks = re.findall(r'`(\w+)`', l)
        elif 'FOREIGN KEY' in l:
            m = re.search(r'FOREIGN KEY \(`(\w+)`\) REFERENCES `(\w+)` \(`(\w+)`\)', l)
            if m:
                fks.append({'col': m.group(1), 'ref_table': m.group(2), 'ref_col': m.group(3)})
    schema[name] = {'cols': cols, 'pks': pks, 'fks': fks}

with open('schema_summary.json', 'w', encoding='utf-8') as f:
    json.dump(schema, f, indent=2, ensure_ascii=False)

print(f"Success! Parsed {len(schema)} tables.")
for t in sorted(schema.keys()):
    cols_n = len(schema[t]['cols'])
    pks_str = ','.join(schema[t]['pks'])
    fks_n = len(schema[t]['fks'])
    print(f"Table: {t:<30} | {cols_n:>2} cols | PK: {pks_str:<15} | FKs: {fks_n}")
