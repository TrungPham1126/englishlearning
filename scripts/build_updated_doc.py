import sys

with open('current_doc.md', 'r', encoding='utf-8') as f:
    doc_lines = f.readlines()

with open(r'scripts\chuong2_content.md', 'r', encoding='utf-8') as f:
    ch2_text = f.read()

# Locate Chapter 2 start and Chapter 3 start in current_doc.md
ch2_start = -1
ch3_start = -1

for i, line in enumerate(doc_lines):
    if 'CHƯƠNG 2' in line:
        ch2_start = i
        break

for i, line in enumerate(doc_lines):
    if 'CHƯƠNG 3' in line:
        ch3_start = i
        break

print(f"ch2_start line: {ch2_start + 1}")
print(f"ch3_start line: {ch3_start + 1}")

if ch2_start == -1 or ch3_start == -1:
    print("Error: Could not locate chapter markers.")
    sys.exit(1)

# Before Chapter 2
before_ch2 = doc_lines[:ch2_start]

# After Chapter 2 (from Chapter 3 onward)
after_ch2 = doc_lines[ch3_start:]

# Extract clean Chapter 2 content (without document title headers if any)
ch2_clean = ch2_text
if '### **CHƯƠNG 2' in ch2_clean:
    idx = ch2_clean.index('### **CHƯƠNG 2')
    ch2_clean = ch2_clean[idx:]

# Combine
new_doc = "".join(before_ch2) + ch2_clean.strip() + "\n\n" + "".join(after_ch2)

with open('updated_doc.md', 'w', encoding='utf-8') as f:
    f.write(new_doc)

print("Successfully created updated_doc.md")
print(f"Original doc length: {len(''.join(doc_lines))} chars")
print(f"Updated doc length:  {len(new_doc)} chars")
