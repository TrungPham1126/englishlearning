import os
import sys
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import FancyBboxPatch, ArrowStyle
import numpy as np

# Set standard styles
plt.rcParams['font.sans-serif'] = 'Segoe UI'
plt.rcParams['font.family'] = 'sans-serif'
plt.rcParams['figure.autolayout'] = False

OUTPUT_DIR = r"D:\HocTap_DoAn\doanchuyennganh\englishlearning\HinhAnh_BaoCao_Chuong2"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Color Palette
C_PRIMARY = "#1A365D"    # Deep Navy
C_SECONDARY = "#2B6CB0"  # Steel Blue
C_ACCENT = "#2C7A7B"     # Dark Cyan / Teal
C_ORANGE = "#C05621"     # Warm Amber / Orange
C_GREEN = "#276749"      # Forest Green
C_PURPLE = "#553C9A"     # Deep Purple
C_RED = "#9B2C2C"        # Crimson
C_DARK = "#2D3748"       # Charcoal Text
C_BG_LIGHT = "#F7FAFC"   # Warm White
C_BOX_BG = "#EDF2F7"     # Light Slate Box
C_BORDER = "#CBD5E0"     # Border Grey
C_WHITE = "#FFFFFF"

def draw_card(ax, x, y, w, h, title, subtitle="", bg_color=C_WHITE, border_color=C_BORDER, title_color=C_PRIMARY, radius=0.015, lw=1.5):
    """Draw a rounded card box with title and content."""
    box = FancyBboxPatch((x, y), w, h, boxstyle=f"round,pad={radius}",
                         facecolor=bg_color, edgecolor=border_color, linewidth=lw, zorder=2)
    ax.add_patch(box)
    if title:
        ax.text(x + w/2, y + h - 0.025, title, ha='center', va='top',
                fontsize=11, fontweight='bold', color=title_color, zorder=3)
    if subtitle:
        ax.text(x + w/2, y + h - 0.055, subtitle, ha='center', va='top',
                fontsize=9, color=C_DARK, zorder=3)

def draw_arrow(ax, p1, p2, label="", color="#4A5568", lw=1.8, style="-|>", dashed=False, label_offset=(0, 0.015), fontsize=8.5):
    """Draw a directed arrow between two points with an optional label."""
    ls = '--' if dashed else '-'
    ax.annotate("", xy=p2, xytext=p1,
                arrowprops=dict(arrowstyle=style, color=color, lw=lw, linestyle=ls, shrinkA=3, shrinkB=3),
                zorder=4)
    if label:
        mx = (p1[0] + p2[0]) / 2 + label_offset[0]
        my = (p1[1] + p2[1]) / 2 + label_offset[1]
        ax.text(mx, my, label, ha='center', va='center', fontsize=fontsize,
                fontweight='bold', color=color,
                bbox=dict(boxstyle='square,pad=0.2', facecolor=C_WHITE, edgecolor='none', alpha=0.9),
                zorder=5)

print("Diagram helper module initialized.")
