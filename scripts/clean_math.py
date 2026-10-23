import re

with open(r'D:\HocTap_DoAn\doanchuyennganh\englishlearning\scripts\chuong2_content.md', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace block math
text = text.replace(
    '$$\\Delta F = \\sqrt{(F1_{\\text{user}} - F1_{\\text{ref}})^2 + (F2_{\\text{user}} - F2_{\\text{ref}})^2}$$',
    '**ΔF = √[(F1_user - F1_ref)² + (F2_user - F2_ref)²]**'
)

text = text.replace(
    '$$I(0) = 1, \\quad I(1) = 6, \\quad I(n) = \\text{round}(I(n-1) \\times EF) \\quad (n \\ge 2)$$\n\n$$EF\' = \\max\\left(1.3, \\; EF + \\left(0.1 - (3 - q) \\times (0.08 + (3 - q) \\times 0.02)\\right)\\right)$$',
    '• **Khoảng cách lặp lại:** `I(0) = 1`; `I(1) = 6`; `I(n) = round(I(n-1) × EF)` (với `n ≥ 2`)\n• **Hệ số dễ nhớ:** `EF\' = max(1.3, EF + (0.1 - (3 - q) × (0.08 + (3 - q) × 0.02)))`'
)

# Replace inline math
text = text.replace('($q \\in \\{0: \\text{Again}, 1: \\text{Hard}, 2: \\text{Good}, 3: \\text{Easy}\\})$', '(q ∈ {0: Again, 1: Hard, 2: Good, 3: Easy})')
text = text.replace('($EF$)', '(EF)')
text = text.replace('($I$)', '(I)')
text = text.replace('\\$0.00', '0.00 USD')
text = text.replace('~\\$0.0003', '~0.0003 USD')
text = text.replace('~\\$0.0001', '~0.0001 USD')

with open(r'D:\HocTap_DoAn\doanchuyennganh\englishlearning\scripts\chuong2_content.md', 'w', encoding='utf-8') as f:
    f.write(text)

print("Math conversion to Unicode typography complete.")
