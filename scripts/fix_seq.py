import re

with open(r'D:\HocTap_DoAn\doanchuyennganh\englishlearning\scripts\gen_seq_diagrams.py', 'r', encoding='utf-8') as f:
    text = f.read()

# Pattern for draw_msg calls missing y
# draw_msg(ax, xs[actors[A]], xs[actors[B]], "Label", ...)
pattern = r'(draw_msg\(\s*ax\s*,\s*xs\[actors\[\d+\]\]\s*,\s*xs\[actors\[\d+\]\]\s*),\s*("[^"]*")'

def replacer(m):
    return f"{m.group(1)}, y, {m.group(2)}"

fixed_text = re.sub(pattern, replacer, text)

with open(r'D:\HocTap_DoAn\doanchuyennganh\englishlearning\scripts\gen_seq_diagrams.py', 'w', encoding='utf-8') as f:
    f.write(fixed_text)

print("Replacement complete.")
