import os
import sys
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import FancyBboxPatch, Rectangle, Circle
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

def draw_header(ax, title, figure_num):
    """Draw a standardized academic header banner."""
    ax.text(0.5, 0.97, f"{figure_num}: {title}", ha='center', va='top',
            fontsize=13, fontweight='bold', color=C_PRIMARY, transform=ax.transAxes)
    line = plt.Line2D([0.05, 0.95], [0.94, 0.94], color=C_SECONDARY, lw=1.5, transform=ax.transAxes)
    ax.add_line(line)

def draw_card(ax, x, y, w, h, title, items=None, bg_color=C_WHITE, border_color=C_BORDER,
              title_color=C_PRIMARY, radius=0.015, lw=1.5, title_fs=10, body_fs=8.5, title_align='center'):
    """Draw a rounded card box with title and multi-line content."""
    box = FancyBboxPatch((x, y), w, h, boxstyle=f"round,pad={radius}",
                         facecolor=bg_color, edgecolor=border_color, linewidth=lw, zorder=2)
    ax.add_patch(box)
    
    if title:
        tx = x + w/2 if title_align == 'center' else x + 0.015
        ax.text(tx, y + h - 0.02, title, ha=title_align, va='top',
                fontsize=title_fs, fontweight='bold', color=title_color, zorder=3)
        # Separator line under title
        sep = plt.Line2D([x + 0.01, x + w - 0.01], [y + h - 0.038, y + h - 0.038],
                         color=border_color, lw=0.8, zorder=3)
        ax.add_line(sep)
        
    if items:
        cur_y = y + h - 0.055
        for item in items:
            ax.text(x + 0.015, cur_y, item, ha='left', va='top',
                    fontsize=body_fs, color=C_DARK, zorder=3)
            cur_y -= 0.026

def draw_arrow(ax, p1, p2, label="", color="#4A5568", lw=1.5, style="-|>", dashed=False,
               label_offset=(0, 0.015), fontsize=8, label_color=None):
    """Draw a directed arrow between two points with an optional label."""
    ls = '--' if dashed else '-'
    ax.annotate("", xy=p2, xytext=p1,
                arrowprops=dict(arrowstyle=style, color=color, lw=lw, linestyle=ls, shrinkA=2, shrinkB=2),
                zorder=4)
    if label:
        mx = (p1[0] + p2[0]) / 2 + label_offset[0]
        my = (p1[1] + p2[1]) / 2 + label_offset[1]
        lc = label_color if label_color else color
        ax.text(mx, my, label, ha='center', va='center', fontsize=fontsize,
                fontweight='bold', color=lc,
                bbox=dict(boxstyle='square,pad=0.2', facecolor=C_WHITE, edgecolor='none', alpha=0.92),
                zorder=5)

# ==============================================================================
# 1. HÌNH 2.1: KIẾN TRÚC TỔNG THỂ HỆ THỐNG
# ==============================================================================
def generate_hinh_2_1():
    fig, ax = plt.subplots(figsize=(15, 10.5), dpi=300)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis('off')

    draw_header(ax, "Sơ đồ kiến trúc tổng thể hệ thống (Modular Monolith & Acoustic Microservice)", "Hình 2.1")

    # Layer 1: Client Tier
    draw_card(ax, 0.05, 0.77, 0.90, 0.14, "TẦNG TRÌNH DIỄN & KHÁCH HÀNG (CLIENT PRESENTATION TIER)",
              bg_color="#EBF8FF", border_color="#3182CE", title_color="#2B6CB0", title_fs=11)
    draw_card(ax, 0.07, 0.785, 0.26, 0.09, "Học viên (Student App)",
              ["• Lộ trình học ngày & SRS Flashcard", "• Luyện phát âm Shadowing AI", "• Thi & làm bài kiểm tra CBT"],
              bg_color=C_WHITE, border_color="#63B3ED")
    draw_card(ax, 0.37, 0.785, 0.26, 0.09, "Giảng viên (Teacher Portal)",
              ["• Quản lý lớp học & học viên", "• Soạn bài tập AI / Excel / TTS", "• Tải lên bài giảng Video MP4"],
              bg_color=C_WHITE, border_color="#63B3ED")
    draw_card(ax, 0.67, 0.785, 0.26, 0.09, "Quản trị viên (Admin Center)",
              ["• Quản lý người dùng & phân quyền", "• Giám sát Quota AI & Audit Log", "• Phê duyệt học liệu & báo cáo"],
              bg_color=C_WHITE, border_color="#63B3ED")

    # Layer 2: API Gateway & Security
    draw_card(ax, 0.05, 0.64, 0.90, 0.08, "TẦNG BẢO MẬT & ĐIỀU PHỐI (GATEWAY & SECURITY FILTER)",
              ["Spring Security 6 | JWT Dual-Token Filter | RBAC Authorization (STUDENT, TEACHER, ADMIN) | Spring AOP Audit Interceptor | CORS & Rate Limiting"],
              bg_color="#F7FAFC", border_color="#CBD5E0", title_color=C_PRIMARY, body_fs=9, title_fs=10.5)

    # Layer 3: Modular Monolith (Spring Boot 3)
    draw_card(ax, 0.05, 0.32, 0.58, 0.28, "TẦNG ỨNG DỤNG CỐT LÕI (SPRING BOOT 3 MODULAR MONOLITH)",
              bg_color="#FEFCBF", border_color="#D69E2E", title_color="#975A16", title_fs=11)
    
    # Modules inside Monolith
    draw_card(ax, 0.07, 0.46, 0.16, 0.11, "Auth & Account",
              ["• BCrypt hashing", "• Refresh token rotation", "• Role assignments"],
              bg_color=C_WHITE, border_color="#ECC94B", title_fs=9, body_fs=7.5)
    draw_card(ax, 0.25, 0.46, 0.17, 0.11, "Classroom & Plan",
              ["• Lớp học & ghi danh", "• Lộ trình học ngày", "• SM-2 Spaced Rep."],
              bg_color=C_WHITE, border_color="#ECC94B", title_fs=9, body_fs=7.5)
    draw_card(ax, 0.44, 0.46, 0.17, 0.11, "Assignment Engine",
              ["• Soạn đề đa nguồn", "• Khảo thí CBT đa dạng", "• Chấm điểm tự động"],
              bg_color=C_WHITE, border_color="#ECC94B", title_fs=9, body_fs=7.5)

    draw_card(ax, 0.07, 0.335, 0.16, 0.11, "Video & Media",
              ["• Nhận video MP4", "• Đẩy queue RabbitMQ", "• Quản lý HLS m3u8"],
              bg_color=C_WHITE, border_color="#ECC94B", title_fs=9, body_fs=7.5)
    draw_card(ax, 0.25, 0.335, 0.17, 0.11, "AI Coordinator",
              ["• Điều phối 3-Tier AI", "• Chấm Speaking/Writing", "• Bóc băng STT Whisper"],
              bg_color=C_WHITE, border_color="#ECC94B", title_fs=9, body_fs=7.5)
    draw_card(ax, 0.44, 0.335, 0.17, 0.11, "Notify & Analytics",
              ["• WebSocket STOMP", "• Radar 4 kỹ năng CEFR", "• Ghi log kiểm toán AOP"],
              bg_color=C_WHITE, border_color="#ECC94B", title_fs=9, body_fs=7.5)

    # Layer 4: Python FastAPI Acoustic Microservice & Cloud AI
    draw_card(ax, 0.66, 0.32, 0.29, 0.28, "DỊCH VỤ ÂM HỌC & CLOUD AI",
              bg_color="#E6FFFA", border_color="#319795", title_color="#234E52", title_fs=11)
    draw_card(ax, 0.675, 0.46, 0.26, 0.11, "Python FastAPI Acoustic Engine",
              ["• Wav2Vec2 XLS-R-53 Forced Alignment", "• Praat-Parselmouth Formant F1/F2", "• Consonant GOP & Kokoro-82M TTS"],
              bg_color=C_WHITE, border_color="#4FD1C5", title_fs=9, body_fs=7.5)
    draw_card(ax, 0.675, 0.335, 0.26, 0.11, "Cloud AI Services (LLM & STT)",
              ["• Google Gemini 1.5 Flash (Chấm AI)", "• Groq Whisper-large-v3 (STT siêu tốc)", "• Groq LLaMA 3.3 70B (Dự phòng Tier 3)"],
              bg_color=C_WHITE, border_color="#4FD1C5", title_fs=9, body_fs=7.5)

    # Layer 5: Data & Infrastructure Tier
    draw_card(ax, 0.05, 0.05, 0.90, 0.22, "TẦNG HẠ TẦNG LƯU TRỮ VÀ XỬ LÝ NỀN BẤT ĐỒNG BỘ",
              bg_color="#EDF2F7", border_color="#A0AEC0", title_color=C_PRIMARY, title_fs=11)
    
    draw_card(ax, 0.07, 0.07, 0.20, 0.16, "MariaDB / MySQL 10.4",
              ["• 32 bảng chuẩn quan hệ", "• ACID & Transactional", "• HikariCP Connection Pool", "• Khóa ngoại & Chỉ mục B-Tree"],
              bg_color=C_WHITE, border_color="#CBD5E0", title_fs=9.5, body_fs=8)
    draw_card(ax, 0.29, 0.07, 0.19, 0.16, "Redis In-Memory Cache",
              ["• Token Blacklist xoay vòng", "• Session Cache & OTP", "• Rate Limiting bộ nhớ đệm", "• Giảm tải truy vấn CSDL"],
              bg_color=C_WHITE, border_color="#CBD5E0", title_fs=9.5, body_fs=8)
    draw_card(ax, 0.50, 0.07, 0.21, 0.16, "RabbitMQ Broker & Worker",
              ["• Queue 'video.transcode.queue'", "• FFmpeg HLS Worker (6s/ts)", "• Dead Letter Exchange (DLX)", "• Hàng đợi bất đồng bộ"],
              bg_color=C_WHITE, border_color="#CBD5E0", title_fs=9.5, body_fs=8)
    draw_card(ax, 0.73, 0.07, 0.20, 0.16, "Cloudflare R2 Object Store",
              ["• S3 API Compatible", "• Lưu trữ video HLS & audio", "• CDN Edge Caching toàn cầu", "• Miễn phí Egress Bandwidth"],
              bg_color=C_WHITE, border_color="#CBD5E0", title_fs=9.5, body_fs=8)

    # Connecting Arrows
    draw_arrow(ax, (0.50, 0.77), (0.50, 0.72), "HTTPS REST / WebSocket STOMP", color=C_SECONDARY, lw=2)
    draw_arrow(ax, (0.35, 0.64), (0.35, 0.60), "Spring DispatcherServlet", color=C_PRIMARY, lw=1.8)
    draw_arrow(ax, (0.63, 0.46), (0.66, 0.46), "REST (HTTP/JSON)", color=C_ACCENT, lw=1.8)
    draw_arrow(ax, (0.63, 0.38), (0.66, 0.38), "External Cloud HTTPS", color=C_ORANGE, lw=1.8)
    
    draw_arrow(ax, (0.17, 0.32), (0.17, 0.23), "JDBC / JPA", color=C_PRIMARY, lw=1.6)
    draw_arrow(ax, (0.38, 0.32), (0.38, 0.23), "Jedis TCP", color=C_RED, lw=1.6)
    draw_arrow(ax, (0.58, 0.32), (0.58, 0.23), "AMQP 0-9-1", color=C_PURPLE, lw=1.6)
    draw_arrow(ax, (0.71, 0.15), (0.73, 0.15), "Upload HLS m3u8", color=C_GREEN, lw=1.6)

    fig.savefig(os.path.join(OUTPUT_DIR, "Hinh_2_1_KienTrucTongThe.png"), bbox_inches='tight')
    plt.close(fig)
    print("Exported Hinh_2_1_KienTrucTongThe.png")

generate_hinh_2_1()
