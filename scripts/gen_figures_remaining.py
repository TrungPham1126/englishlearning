import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import FancyBboxPatch, Rectangle, Circle, Polygon
import numpy as np

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
    ax.text(0.5, 0.978, f"{figure_num}: {title}", ha='center', va='top',
            fontsize=13, fontweight='bold', color=C_PRIMARY, transform=ax.transAxes)
    line = plt.Line2D([0.04, 0.96], [0.952, 0.952], color=C_SECONDARY, lw=1.5, transform=ax.transAxes)
    ax.add_line(line)

def draw_box(ax, x, y, w, h, title, items=None, bg_color=C_WHITE, border_color=C_BORDER,
             title_color=C_PRIMARY, radius=0.012, lw=1.3, title_fs=9.5, body_fs=8, title_align='center'):
    box = FancyBboxPatch((x, y), w, h, boxstyle=f"round,pad={radius}",
                         facecolor=bg_color, edgecolor=border_color, linewidth=lw, zorder=2)
    ax.add_patch(box)
    
    if title:
        tx = x + w/2 if title_align == 'center' else x + 0.012
        ax.text(tx, y + h - 0.018, title, ha=title_align, va='top',
                fontsize=title_fs, fontweight='bold', color=title_color, zorder=3)
        sep = plt.Line2D([x + 0.008, x + w - 0.008], [y + h - 0.032, y + h - 0.032],
                         color=border_color, lw=0.7, zorder=3)
        ax.add_line(sep)
        
    if items:
        cur_y = y + h - 0.045
        for item in items:
            ax.text(x + 0.012, cur_y, item, ha='left', va='top',
                    fontsize=body_fs, color=C_DARK, zorder=3)
            cur_y -= 0.024

def draw_directed_arrow(ax, p1, p2, label="", color="#4A5568", lw=1.4, style="-|>", dashed=False,
                        label_offset=(0, 0.012), fontsize=7.5, label_color=None):
    ls = '--' if dashed else '-'
    ax.annotate("", xy=p2, xytext=p1,
                arrowprops=dict(arrowstyle=style, color=color, lw=lw, linestyle=ls, shrinkA=3, shrinkB=3),
                zorder=4)
    if label:
        mx = (p1[0] + p2[0]) / 2 + label_offset[0]
        my = (p1[1] + p2[1]) / 2 + label_offset[1]
        lc = label_color if label_color else color
        ax.text(mx, my, label, ha='center', va='center', fontsize=fontsize,
                fontweight='bold', color=lc,
                bbox=dict(boxstyle='square,pad=0.15', facecolor=C_WHITE, edgecolor='none', alpha=0.92),
                zorder=5)

# ==============================================================================
# HÌNH 2.2: MA TRẬN GIAO TIẾP VÀ PHÂN LUỒNG LIÊN DỊCH VỤ
# ==============================================================================
def generate_hinh_2_2():
    fig, ax = plt.subplots(figsize=(15, 10.5), dpi=300)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis('off')

    draw_header(ax, "Sơ đồ cơ chế giao tiếp liên dịch vụ (REST, RabbitMQ, WebSocket STOMP, Cloudflare R2)", "Hình 2.2")

    # Client Box
    draw_box(ax, 0.05, 0.58, 0.22, 0.32, "Frontend Client\n(React 18 SPA)",
             ["• Axios HTTP Interceptor", "• SockJS & STOMP Client", "• Web Audio API (16kHz)", "• HLS.js Video Streamer", "• State Store (Zustand)"],
             bg_color="#EBF8FF", border_color="#3182CE", title_color="#2B6CB0", title_fs=10.5, body_fs=8.5)

    # Core Backend Box
    draw_box(ax, 0.39, 0.52, 0.26, 0.40, "Core Application Backend\n(Spring Boot 3 Modular Monolith)",
             ["• DispatcherServlet & Controllers", "• Spring Security 6 & JWT Filter", "• RabbitTemplate (AMQP Producer)",
              "• SimpMessagingTemplate (STOMP)", "• S3Client (Cloudflare R2 SDK)", "• JPA / Hibernate (HikariCP)", "• Jedis / RedisTemplate"],
             bg_color="#FEFCBF", border_color="#D69E2E", title_color="#975A16", title_fs=10.5, body_fs=8.5)

    # Python Service Box
    draw_box(ax, 0.73, 0.68, 0.22, 0.22, "Acoustic Microservice\n(Python FastAPI)",
             ["• Port 8000 (Uvicorn)", "• Wav2Vec2 Forced Alignment", "• Praat-Parselmouth (F1/F2)", "• Consonant GOP Scorer", "• Kokoro-82M Neural TTS"],
             bg_color="#E6FFFA", border_color="#319795", title_color="#234E52", title_fs=10.5, body_fs=8.5)

    # External Cloud AI
    draw_box(ax, 0.73, 0.40, 0.22, 0.22, "Cloud AI Platforms\n(Google & Groq Cloud)",
             ["• Google Gemini 1.5 Flash", "  (Chấm tự luận & phát âm)", "• Groq Whisper-large-v3", "  (Bóc băng STT < 800ms)", "• Groq LLaMA 3.3 70B", "  (Dự phòng Tier 3)"],
             bg_color="#FAF5FF", border_color="#805AD5", title_color="#553C9A", title_fs=10.5, body_fs=8.5)

    # RabbitMQ & Worker
    draw_box(ax, 0.39, 0.18, 0.26, 0.24, "Hàng đợi & Xử lý bất đồng bộ\n(RabbitMQ & FFmpeg Worker)",
             ["• Exchange 'video.transcode'", "• Queue 'video.transcode.queue'", "• @RabbitListener Consumer", "• FFmpeg Subprocess (HLS)", "• Dead Letter Exchange (DLX)"],
             bg_color="#FFF5F5", border_color="#E53E3E", title_color="#9B2C2C", title_fs=10.5, body_fs=8.5)

    # Storage & Persistence
    draw_box(ax, 0.05, 0.18, 0.22, 0.24, "Lưu trữ dữ liệu & Cache\n(MariaDB & Redis)",
             ["• MariaDB (Port 3306)", "  - 32 bảng chuẩn quan hệ", "  - ACID & B-Tree Index", "• Redis Cache (Port 6379)", "  - Token Blacklist xoay vòng", "  - Session & Rate Limit"],
             bg_color="#F7FAFC", border_color="#A0AEC0", title_color=C_PRIMARY, title_fs=10.5, body_fs=8.5)

    # Cloudflare R2
    draw_box(ax, 0.73, 0.12, 0.22, 0.22, "Lưu trữ đối tượng đám mây\n(Cloudflare R2 Object Storage)",
             ["• S3 API Compatible", "• Buckets: videos, audios, docs", "• master.m3u8 & .ts segments", "• Zero Egress Fee CDN", "• Edge Caching toàn cầu"],
             bg_color="#EDF2F7", border_color="#4A5568", title_color=C_PRIMARY, title_fs=10.5, body_fs=8.5)

    # Directed Communication Arrows
    # 1. Client <-> Spring Boot (REST)
    draw_directed_arrow(ax, (0.27, 0.78), (0.39, 0.78), "HTTPS REST (JSON / Multipart)", color=C_SECONDARY, lw=1.8, label_offset=(0, 0.015))
    draw_directed_arrow(ax, (0.39, 0.74), (0.27, 0.74), "200 OK / Response DTO", color=C_SECONDARY, lw=1.5, dashed=True, label_offset=(0, -0.015))

    # 2. Client <-> Spring Boot (WebSocket)
    draw_directed_arrow(ax, (0.39, 0.65), (0.27, 0.65), "WSS STOMP (Real-time Feedback)", color=C_GREEN, lw=1.8, label_offset=(0, 0.015))

    # 3. Spring Boot <-> Python FastAPI
    draw_directed_arrow(ax, (0.65, 0.82), (0.73, 0.82), "HTTP REST (WAV + Script)", color=C_ACCENT, lw=1.8, label_offset=(0, 0.015))
    draw_directed_arrow(ax, (0.73, 0.78), (0.65, 0.78), "Acoustic JSON (< 1s)", color=C_ACCENT, lw=1.5, dashed=True, label_offset=(0, -0.015))

    # 4. Spring Boot <-> Cloud AI
    draw_directed_arrow(ax, (0.65, 0.58), (0.73, 0.58), "HTTPS REST (Prompt / Audio)", color=C_PURPLE, lw=1.8, label_offset=(0, 0.015))
    draw_directed_arrow(ax, (0.73, 0.52), (0.65, 0.52), "Evaluation JSON", color=C_PURPLE, lw=1.5, dashed=True, label_offset=(0, -0.015))

    # 5. Spring Boot -> RabbitMQ
    draw_directed_arrow(ax, (0.52, 0.52), (0.52, 0.42), "AMQP Producer (publish)", color=C_RED, lw=1.8, label_offset=(0.06, 0))

    # 6. Worker -> Cloudflare R2
    draw_directed_arrow(ax, (0.65, 0.28), (0.73, 0.28), "S3 API (Upload HLS chunks)", color=C_GREEN, lw=1.8, label_offset=(0, 0.015))

    # 7. Spring Boot <-> MariaDB / Redis
    draw_directed_arrow(ax, (0.39, 0.35), (0.27, 0.35), "JDBC Pool & Jedis TCP", color=C_PRIMARY, lw=1.8, label_offset=(0, 0.015))

    # 8. Client direct stream from Cloudflare R2
    draw_directed_arrow(ax, (0.73, 0.20), (0.27, 0.20), "HTTPS Video HLS Streaming (.m3u8 CDN)", color="#D69E2E", lw=1.8, dashed=True, label_offset=(0, 0.015))

    fig.savefig(os.path.join(OUTPUT_DIR, "Hinh_2_2_CoCheGiaoTiepLienDichVu.png"), bbox_inches='tight')
    plt.close(fig)
    print("Exported Hinh_2_2_CoCheGiaoTiepLienDichVu.png")


# ==============================================================================
# HÌNH 2.3: KIẾN TRÚC DỰ PHÒNG ĐA TẦNG (3-TIER AI FALLBACK)
# ==============================================================================
def generate_hinh_2_3():
    fig, ax = plt.subplots(figsize=(15, 11), dpi=300)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis('off')

    draw_header(ax, "Luồng xử lý dữ liệu và cơ chế dự phòng đa tầng (3-Tier AI Fallback Pipeline)", "Hình 2.3")

    # Input Box
    draw_box(ax, 0.38, 0.85, 0.24, 0.075, "Dữ liệu đầu vào (Input)",
             ["• Audio file (.wav, .mp3, .webm)", "• Câu tham chiếu mẫu (Target Text)"],
             bg_color="#EBF8FF", border_color="#3182CE", title_color="#2B6CB0", title_fs=10, body_fs=8)

    # Pre-processing Gate
    draw_box(ax, 0.38, 0.72, 0.24, 0.08, "Cổng tiền xử lý & Đánh giá chất lượng",
             ["• Resample 16kHz Mono & Bandpass Filter", "• VAD (Voice Activity) & SNR >= 12dB Gate"],
             bg_color="#EDF2F7", border_color="#CBD5E0", title_color=C_PRIMARY, title_fs=9.5, body_fs=8)

    draw_directed_arrow(ax, (0.50, 0.85), (0.50, 0.80), "Upload audio", color=C_PRIMARY)

    # Tier 1 Container
    draw_box(ax, 0.06, 0.43, 0.88, 0.24, "TẦNG 1: DỊCH VỤ ÂM HỌC NỘI BỘ (PYTHON FASTAPI ACOUSTIC ENGINE) - ƯU TIÊN 1",
             bg_color="#E6FFFA", border_color="#319795", title_color="#234E52", title_fs=10.5)

    draw_box(ax, 0.08, 0.45, 0.20, 0.17, "1. Căn chỉnh âm vị (Alignment)",
             ["• Wav2Vec2 XLS-R-53", "• CTC Posterior Matrix", "• Viterbi Trellis Search", "• Cắt ghép ranh giới từ/âm"],
             bg_color=C_WHITE, border_color="#4FD1C5", title_fs=9, body_fs=7.5)

    draw_box(ax, 0.30, 0.45, 0.20, 0.17, "2. Phân tích nguyên âm Formant",
             ["• Praat-Parselmouth Engine", "• Đo Formant thực F1, F2", "• Vowel Space sai lệch EUC", "• Khẩu hình chuẩn giới tính"],
             bg_color=C_WHITE, border_color="#4FD1C5", title_fs=9, body_fs=7.5)

    draw_box(ax, 0.52, 0.45, 0.19, 0.17, "3. Chấm phụ âm (Consonant GOP)",
             ["• Goodness of Pronunciation", "• Bằng chứng âm học phổ năng lượng", "• Coda /r/ & Word-final stop", "• Chấm điểm phụ âm chuyên biệt"],
             bg_color=C_WHITE, border_color="#4FD1C5", title_fs=9, body_fs=7.5)

    draw_box(ax, 0.73, 0.45, 0.19, 0.17, "4. Nhịp điệu & Độ trôi chảy",
             ["• Tốc độ nói WPM & Độ lưu loát", "• Awkward Pause (gap >= 250ms)", "• Phonetic Linking (gap < 35ms)", "• Hoàn thiện câu & Trọng âm"],
             bg_color=C_WHITE, border_color="#4FD1C5", title_fs=9, body_fs=7.5)

    draw_directed_arrow(ax, (0.50, 0.72), (0.50, 0.67), "Vượt qua kiểm tra chất lượng", color=C_GREEN)

    # Decision Diamond 1
    d1 = Polygon([(0.50, 0.40), (0.56, 0.36), (0.50, 0.32), (0.44, 0.36)],
                 facecolor="#FEFCBF", edgecolor="#D69E2E", lw=1.3, zorder=3)
    ax.add_patch(d1)
    ax.text(0.50, 0.36, "Thành công?\n(Thời gian < 3.5s)", ha='center', va='center', fontsize=8, fontweight='bold', color="#975A16", zorder=4)

    draw_directed_arrow(ax, (0.50, 0.43), (0.50, 0.40), color=C_PRIMARY)

    # Success Output
    draw_box(ax, 0.75, 0.29, 0.20, 0.10, "KẾT QUẢ ĐÁNH GIÁ (OUTPUT)",
             ["• Bảng điểm từng âm vị IPA", "• Biểu đồ Formant F1/F2", "• Điểm KPI: 4 chỉ số", "• Nhận xét sư phạm tiếng Việt"],
             bg_color="#F0FFF4", border_color="#38A169", title_color="#22543D", title_fs=9, body_fs=7.5)
    draw_directed_arrow(ax, (0.56, 0.36), (0.75, 0.36), "CÓ (< 1s, Chi phí $0)", color=C_GREEN, lw=1.8)

    # Tier 2 Box
    draw_box(ax, 0.06, 0.16, 0.39, 0.13, "TẦNG 2: GROQ WHISPER STT + GEMINI 1.5 FLASH",
             ["• Groq Whisper-large-v3: Bóc băng phiên âm nguyên văn cực nhanh (< 800ms)",
              "• Google Gemini 1.5 Flash: Đóng vai trò Giám khảo Ngữ âm Cambridge",
              "• Đối chiếu chi tiết câu mẫu, phát hiện từ bỏ sót, từ đọc sai, chấm điểm và gợi ý"],
             bg_color="#FAF5FF", border_color="#805AD5", title_color="#553C9A", title_fs=9.5, body_fs=7.5)

    draw_directed_arrow(ax, (0.44, 0.36), (0.25, 0.29), "KHÔNG (Timeout / Lỗi Python)", color=C_ORANGE, lw=1.6)

    # Decision Diamond 2
    d2 = Polygon([(0.25, 0.13), (0.30, 0.095), (0.25, 0.06), (0.20, 0.095)],
                 facecolor="#FEFCBF", edgecolor="#D69E2E", lw=1.3, zorder=3)
    ax.add_patch(d2)
    ax.text(0.25, 0.095, "Gemini OK?", ha='center', va='center', fontsize=7.5, fontweight='bold', color="#975A16", zorder=4)

    draw_directed_arrow(ax, (0.25, 0.16), (0.25, 0.13), color=C_PURPLE)
    draw_directed_arrow(ax, (0.30, 0.095), (0.75, 0.31), "CÓ (Đánh giá hoàn tất)", color=C_GREEN, lw=1.6, dashed=True)

    # Tier 3 Box
    draw_box(ax, 0.40, 0.04, 0.54, 0.10, "TẦNG 3: GROQ LLAMA 3.3 70B & HEURISTIC ENGINE (DỰ PHÒNG KHẨN CẤP)",
             ["• Kích hoạt khi Gemini cạn hạn ngạch (HTTP 429 Quota Exceeded) hoặc đứt cáp quốc tế",
              "• Chạy Groq LLaMA 3.3 70B (JSON mode) kết hợp thuật toán đối chiếu chuỗi Levenshtein cục bộ",
              "• Đảm bảo tính liên tục của hệ sinh thái với độ sẵn sàng dịch vụ đạt 99.9%"],
             bg_color="#FFF5F5", border_color="#E53E3E", title_color="#9B2C2C", title_fs=9.5, body_fs=7.5)

    draw_directed_arrow(ax, (0.25, 0.06), (0.40, 0.06), "KHÔNG (Hết quota 429)", color=C_RED, lw=1.6)
    draw_directed_arrow(ax, (0.70, 0.14), (0.80, 0.29), "Xuất kết quả", color=C_GREEN, lw=1.6, dashed=True)

    fig.savefig(os.path.join(OUTPUT_DIR, "Hinh_2_3_CoCheDuPhong3TierAI.png"), bbox_inches='tight')
    plt.close(fig)
    print("Exported Hinh_2_3_CoCheDuPhong3TierAI.png")


# ==============================================================================
# HÌNH 2.9: BIỂU ĐỒ LỚP CHI TIẾT (CORE DOMAIN CLASS DIAGRAM)
# ==============================================================================
def generate_hinh_2_9():
    fig, ax = plt.subplots(figsize=(16, 11.5), dpi=300)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis('off')

    draw_header(ax, "Biểu đồ lớp chi tiết của miền dữ liệu cốt lõi (Core Domain Model)", "Hình 2.9")

    # Helper for UML Class Box
    def draw_uml_class(x, y, w, h, class_name, attrs, methods=None, bg_color="#FFFFFF", border_color="#3182CE"):
        box = Rectangle((x, y), w, h, facecolor=bg_color, edgecolor=border_color, lw=1.4, zorder=2)
        ax.add_patch(box)
        # Class Header
        ax.text(x + w/2, y + h - 0.018, class_name, ha='center', va='top', fontsize=9.5, fontweight='bold', color=C_PRIMARY, zorder=3)
        sep1 = plt.Line2D([x, x + w], [y + h - 0.028, y + h - 0.028], color=border_color, lw=1.0, zorder=3)
        ax.add_line(sep1)
        
        # Attributes
        cur_y = y + h - 0.04
        for a in attrs:
            ax.text(x + 0.008, cur_y, a, ha='left', va='top', fontsize=7.5, color=C_DARK, zorder=3)
            cur_y -= 0.018
            
        if methods:
            sep2 = plt.Line2D([x, x + w], [cur_y + 0.005, cur_y + 0.005], color=border_color, lw=0.8, zorder=3)
            ax.add_line(sep2)
            cur_y -= 0.012
            for m in methods:
                ax.text(x + 0.008, cur_y, m, ha='left', va='top', fontsize=7.5, color="#2B6CB0", zorder=3)
                cur_y -= 0.018

    # Row 1: Users & Auth
    draw_uml_class(0.04, 0.73, 0.19, 0.20, "User",
                   ["- id: UUID", "- email: String", "- password: String", "- fullName: String", "- status: UserStatus", "- createdAt: Instant"],
                   ["+ getAuthorities(): List", "+ hasRole(name): boolean"])

    draw_uml_class(0.27, 0.81, 0.17, 0.12, "Role",
                   ["- id: Long", "- name: RoleName", "- description: String"],
                   ["+ getAuthority(): String"])

    draw_uml_class(0.27, 0.65, 0.17, 0.14, "RefreshToken",
                   ["- id: UUID", "- user: User", "- tokenHash: String", "- expiryDate: Instant", "- revoked: boolean"],
                   ["+ isExpired(): boolean"])

    draw_uml_class(0.48, 0.77, 0.19, 0.16, "Student",
                   ["- id: UUID", "- user: User", "- targetBand: Double", "- currentLevel: CEFR", "- bio: String"],
                   ["+ updateTarget(band)"])

    draw_uml_class(0.71, 0.77, 0.19, 0.16, "Teacher",
                   ["- id: UUID", "- user: User", "- bio: String", "- department: String", "- qualifications: String"],
                   ["+ verifyCredentials()"])

    # Row 2: Classroom & Study Plans
    draw_uml_class(0.71, 0.47, 0.24, 0.24, "Classroom",
                   ["- id: UUID", "- name: String", "- code: String", "- description: String", "- teacher: Teacher", "- maxStudents: Integer", "- status: ClassStatus"],
                   ["+ addStudent(student)", "+ removeStudent(student)", "+ getActiveStudents()"])

    draw_uml_class(0.48, 0.47, 0.19, 0.22, "DailyStudyPlan",
                   ["- id: UUID", "- student: Student", "- classRef: Classroom", "- planDate: LocalDate", "- status: PlanStatus"],
                   ["+ completeItem(itemId)", "+ calculateProgress()"])

    draw_uml_class(0.27, 0.47, 0.17, 0.15, "DailyPlanItem",
                   ["- id: UUID", "- plan: DailyStudyPlan", "- type: ItemType", "- refId: UUID", "- completed: boolean"],
                   ["+ markComplete()"])

    # Row 3: Assignment & CBT Testing
    draw_uml_class(0.04, 0.38, 0.20, 0.28, "Assignment",
                   ["- id: UUID", "- title: String", "- type: AssignType", "- totalPoints: Double", "- durationMinutes: Integer", "- deadline: Instant", "- teacher: Teacher", "- classRef: Classroom"],
                   ["+ isExpired(): boolean", "+ getQuestionCount()"])

    draw_uml_class(0.04, 0.05, 0.20, 0.27, "AssignmentQuestion",
                   ["- id: UUID", "- assignment: Assignment", "- content: String", "- type: QuestionType", "- points: Double", "- orderIndex: Integer", "- explanation: String"],
                   ["+ addOption(opt)", "+ validateAnswer()"])

    draw_uml_class(0.27, 0.05, 0.17, 0.18, "QuestionOption",
                   ["- id: UUID", "- question: Question", "- content: String", "- isCorrect: boolean", "- orderIndex: Integer"],
                   ["+ isRightChoice()"])

    # Row 4: Attempts & AI Evaluation
    draw_uml_class(0.48, 0.12, 0.21, 0.27, "AssignmentAttempt",
                   ["- id: UUID", "- assignment: Assignment", "- student: Student", "- startedAt: Instant", "- submittedAt: Instant", "- totalScore: Double", "- status: AttemptStatus"],
                   ["+ calculateTotalScore()", "+ finalizeSubmission()"])

    draw_uml_class(0.73, 0.12, 0.22, 0.30, "StudentAnswer",
                   ["- id: UUID", "- attempt: Attempt", "- question: Question", "- selectedOption: Option", "- textResponse: String", "- audioUrl: String", "- earnedPoints: Double", "- isCorrect: Boolean"],
                   ["+ attachAiEvaluation(eval)", "+ gradeObjective()"])

    # Connectors & Cardinalities
    draw_directed_arrow(ax, (0.23, 0.85), (0.27, 0.85), "N:M", color=C_PRIMARY, lw=1.2)
    draw_directed_arrow(ax, (0.23, 0.75), (0.27, 0.72), "1:N", color=C_PRIMARY, lw=1.2)
    draw_directed_arrow(ax, (0.23, 0.80), (0.48, 0.80), "1:1", color=C_SECONDARY, lw=1.2)
    draw_directed_arrow(ax, (0.23, 0.82), (0.71, 0.82), "1:1", color=C_SECONDARY, lw=1.2)
    
    draw_directed_arrow(ax, (0.80, 0.77), (0.80, 0.71), "1:N", color=C_PRIMARY, lw=1.2)
    draw_directed_arrow(ax, (0.57, 0.77), (0.57, 0.69), "1:N", color=C_PRIMARY, lw=1.2)
    draw_directed_arrow(ax, (0.71, 0.58), (0.67, 0.58), "1:N", color=C_PRIMARY, lw=1.2)
    draw_directed_arrow(ax, (0.48, 0.54), (0.44, 0.54), "1:N", color=C_PRIMARY, lw=1.2)

    draw_directed_arrow(ax, (0.14, 0.38), (0.14, 0.32), "1:N (Composition)", color=C_RED, lw=1.4)
    draw_directed_arrow(ax, (0.24, 0.15), (0.27, 0.15), "1:N (Composition)", color=C_RED, lw=1.4)
    draw_directed_arrow(ax, (0.24, 0.50), (0.48, 0.25), "1:N", color=C_PRIMARY, lw=1.2)
    draw_directed_arrow(ax, (0.58, 0.47), (0.58, 0.39), "1:N", color=C_PRIMARY, lw=1.2)
    draw_directed_arrow(ax, (0.69, 0.25), (0.73, 0.25), "1:N", color=C_PRIMARY, lw=1.2)

    fig.savefig(os.path.join(OUTPUT_DIR, "Hinh_2_9_BieuDoLop_CoreDomain.png"), bbox_inches='tight')
    plt.close(fig)
    print("Exported Hinh_2_9_BieuDoLop_CoreDomain.png")


# ==============================================================================
# HÌNH 2.10: SƠ ĐỒ QUAN HỆ THỰC THỂ ERD TOÀN DIỆN (32 THỰC THỂ)
# ==============================================================================
def generate_hinh_2_10():
    fig, ax = plt.subplots(figsize=(16, 12), dpi=300)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis('off')

    draw_header(ax, "Sơ đồ quan hệ thực thể (ERD) toàn diện của cơ sở dữ liệu hệ thống (32 thực thể)", "Hình 2.10")

    def draw_erd_entity(x, y, w, h, table_name, pk_col, fks=None, other_cols=None, bg_color="#FFFFFF", border_color="#3182CE"):
        box = Rectangle((x, y), w, h, facecolor=bg_color, edgecolor=border_color, lw=1.2, zorder=2)
        ax.add_patch(box)
        # Header
        ax.text(x + w/2, y + h - 0.016, table_name, ha='center', va='top', fontsize=8.5, fontweight='bold', color=C_PRIMARY, zorder=3)
        sep1 = plt.Line2D([x, x + w], [y + h - 0.024, y + h - 0.024], color=border_color, lw=0.9, zorder=3)
        ax.add_line(sep1)
        
        cur_y = y + h - 0.036
        # PK
        ax.text(x + 0.006, cur_y, f"PK {pk_col}", ha='left', va='top', fontsize=7.2, fontweight='bold', color=C_RED, zorder=3)
        cur_y -= 0.015
        
        # FKs
        if fks:
            for fk in fks:
                ax.text(x + 0.006, cur_y, f"FK {fk}", ha='left', va='top', fontsize=7.0, color="#805AD5", zorder=3)
                cur_y -= 0.014
                
        # Others
        if other_cols:
            for col in other_cols:
                ax.text(x + 0.006, cur_y, f"• {col}", ha='left', va='top', fontsize=6.8, color=C_DARK, zorder=3)
                cur_y -= 0.013

    # Cluster 1: Auth & User Identity (Left Upper)
    draw_box(ax, 0.03, 0.68, 0.45, 0.26, "CỤM 1: XÁC THỰC, PHÂN QUYỀN VÀ TÀI KHOẢN NGƯỜI DÙNG",
             bg_color="#F7FAFC", border_color="#3182CE", title_color="#2B6CB0", title_fs=9.5, radius=0.008)
    draw_erd_entity(0.045, 0.70, 0.11, 0.20, "users", "id: varchar(36)",
                    other_cols=["email", "password", "full_name", "status", "created_at"])
    draw_erd_entity(0.17, 0.81, 0.09, 0.09, "roles", "id: bigint", other_cols=["name", "description"])
    draw_erd_entity(0.17, 0.70, 0.09, 0.095, "user_roles", "role_id, user_id",
                    fks=["role_id -> roles", "user_id -> users"])
    draw_erd_entity(0.275, 0.80, 0.095, 0.10, "students", "id: varchar(36)",
                    fks=["id -> users"], other_cols=["target_band", "bio"])
    draw_erd_entity(0.275, 0.69, 0.095, 0.10, "teachers", "id: varchar(36)",
                    fks=["id -> users"], other_cols=["department", "bio"])
    draw_erd_entity(0.38, 0.70, 0.09, 0.10, "refresh_tokens", "id: varchar(36)",
                    fks=["user_id -> users"], other_cols=["token_hash", "expiry_date"])
    draw_erd_entity(0.38, 0.81, 0.09, 0.09, "audit_logs", "id: varchar(36)",
                    fks=["user_id -> users"], other_cols=["action", "endpoint", "ip"])

    # Cluster 2: Classroom & Curriculum (Right Upper)
    draw_box(ax, 0.51, 0.68, 0.46, 0.26, "CỤM 2: QUẢN LÝ LỚP HỌC, HỌC PHẦN VÀ LỘ TRÌNH NGÀY",
             bg_color="#F7FAFC", border_color="#319795", title_color="#234E52", title_fs=9.5, radius=0.008)
    draw_erd_entity(0.525, 0.76, 0.10, 0.14, "classes", "id: varchar(36)",
                    fks=["teacher_id -> teachers"], other_cols=["name", "code", "status"])
    draw_erd_entity(0.525, 0.69, 0.10, 0.065, "class_students", "id", fks=["class_id", "student_id"])
    draw_erd_entity(0.64, 0.78, 0.10, 0.12, "lessons", "id: varchar(36)",
                    fks=["class_id -> classes"], other_cols=["title", "order_idx"])
    draw_erd_entity(0.64, 0.69, 0.10, 0.085, "lesson_documents", "id",
                    fks=["lesson_id -> lessons"], other_cols=["file_name", "r2_url"])
    draw_erd_entity(0.755, 0.77, 0.105, 0.13, "daily_study_plans", "id",
                    fks=["student_id -> students"], other_cols=["plan_date", "status"])
    draw_erd_entity(0.755, 0.69, 0.105, 0.075, "daily_plan_items", "id",
                    fks=["plan_id -> daily_study_plans"], other_cols=["type", "ref_id"])
    draw_erd_entity(0.87, 0.76, 0.09, 0.14, "learning_sessions", "id",
                    fks=["student_id -> students"], other_cols=["session_type", "duration"])

    # Cluster 3: Assignments & Examination CBT (Left Lower)
    draw_box(ax, 0.03, 0.35, 0.45, 0.30, "CỤM 3: KHẢO THÍ TRẮC NGHIỆM / TỰ LUẬN CBT & LƯỢT LÀM BÀI",
             bg_color="#F7FAFC", border_color="#D69E2E", title_color="#975A16", title_fs=9.5, radius=0.008)
    draw_erd_entity(0.045, 0.48, 0.11, 0.14, "assignments", "id: varchar(36)",
                    fks=["class_id", "teacher_id"], other_cols=["title", "type", "deadline", "duration"])
    draw_erd_entity(0.045, 0.365, 0.11, 0.11, "assignment_questions", "id",
                    fks=["assignment_id"], other_cols=["content", "type", "points"])
    draw_erd_entity(0.17, 0.365, 0.09, 0.09, "question_options", "id",
                    fks=["question_id"], other_cols=["content", "is_correct"])
    draw_erd_entity(0.17, 0.49, 0.10, 0.13, "assignment_attempts", "id",
                    fks=["assignment_id", "student_id"], other_cols=["started_at", "total_score", "status"])
    draw_erd_entity(0.285, 0.46, 0.105, 0.16, "student_answers", "id",
                    fks=["attempt_id", "question_id"], other_cols=["selected_opt", "text_resp", "audio_url", "earned_pts"])
    draw_erd_entity(0.40, 0.46, 0.075, 0.16, "ai_evaluations", "id",
                    fks=["student_answer_id"], other_cols=["overall_score", "eval_type", "engine", "mistakes_json"])

    # Cluster 4: AI & Student Analytics (Right Lower)
    draw_box(ax, 0.51, 0.35, 0.46, 0.30, "CỤM 4: ĐÁNH GIÁ AI, HẠN NGẠCH VÀ PHÂN TÍCH NĂNG LỰC HỌC VIÊN",
             bg_color="#F7FAFC", border_color="#805AD5", title_color="#553C9A", title_fs=9.5, radius=0.008)
    draw_erd_entity(0.525, 0.49, 0.10, 0.13, "student_skill_profiles", "id",
                    fks=["student_id"], other_cols=["listening_score", "speaking_score", "reading_score", "writing_score"])
    draw_erd_entity(0.525, 0.365, 0.10, 0.115, "student_ai_quotas", "id",
                    fks=["student_id"], other_cols=["daily_requests", "max_quota", "reset_date"])
    draw_erd_entity(0.64, 0.49, 0.105, 0.13, "student_daily_progress", "id",
                    fks=["student_id", "plan_id"], other_cols=["date", "minutes_spent", "streak_count"])
    draw_erd_entity(0.64, 0.365, 0.105, 0.115, "ai_generated_exercises", "id",
                    fks=["teacher_id", "class_id"], other_cols=["topic", "cefr_level", "raw_prompt"])

    # Cluster 5: Media, Spaced Repetition SRS & Notifications (Bottom Span)
    draw_box(ax, 0.03, 0.04, 0.94, 0.28, "CỤM 5: TỪ VỰNG SPRAY REPETITION (SM-2), VIDEO HLS & HỌC LIỆU SỐ ĐA PHƯƠNG TIỆN",
             bg_color="#F7FAFC", border_color="#E53E3E", title_color="#9B2C2C", title_fs=9.5, radius=0.008)
    draw_erd_entity(0.045, 0.07, 0.11, 0.18, "vocabulary_items", "id",
                    other_cols=["word", "meaning", "ipa", "part_of_speech", "example", "audio_url"])
    draw_erd_entity(0.17, 0.07, 0.13, 0.18, "student_vocabulary_progress", "id",
                    fks=["student_id", "vocabulary_id"], other_cols=["stage", "ease_factor", "interval_days", "repetitions", "next_review_at"])
    draw_erd_entity(0.315, 0.07, 0.11, 0.18, "exercise_audios", "id",
                    other_cols=["script_text", "audio_url", "r2_key", "voice_id", "duration_sec"])
    draw_erd_entity(0.44, 0.07, 0.12, 0.18, "videos", "id",
                    fks=["lesson_id", "teacher_id"], other_cols=["title", "duration", "status", "hls_playlist_url", "raw_storage_url"])
    draw_erd_entity(0.575, 0.07, 0.12, 0.15, "video_watch_histories", "id",
                    fks=["video_id", "student_id"], other_cols=["last_position", "completed"])
    draw_erd_entity(0.71, 0.07, 0.11, 0.15, "notifications", "id",
                    fks=["user_id"], other_cols=["title", "message", "type", "is_read"])
    draw_erd_entity(0.835, 0.07, 0.12, 0.15, "grammar_topics", "id",
                    other_cols=["title", "summary", "level", "content_markdown"])

    # Relational linking highlights
    draw_directed_arrow(ax, (0.155, 0.75), (0.17, 0.75), color=C_PRIMARY, lw=1.2)
    draw_directed_arrow(ax, (0.155, 0.42), (0.17, 0.42), color=C_PRIMARY, lw=1.2)
    draw_directed_arrow(ax, (0.27, 0.52), (0.285, 0.52), color=C_PRIMARY, lw=1.2)
    draw_directed_arrow(ax, (0.39, 0.52), (0.40, 0.52), color=C_PRIMARY, lw=1.2)
    draw_directed_arrow(ax, (0.155, 0.14), (0.17, 0.14), color=C_PRIMARY, lw=1.2)
    draw_directed_arrow(ax, (0.56, 0.14), (0.575, 0.14), color=C_PRIMARY, lw=1.2)

    fig.savefig(os.path.join(OUTPUT_DIR, "Hinh_2_10_SoDoERD_CoSoDuLieu.png"), bbox_inches='tight')
    plt.close(fig)
    print("Exported Hinh_2_10_SoDoERD_CoSoDuLieu.png")


# ==============================================================================
# HÌNH 2.11: KIẾN TRÚC FRONTEND REACT SPA, ZUSTAND & AXIOS INTERCEPTOR
# ==============================================================================
def generate_hinh_2_11():
    fig, ax = plt.subplots(figsize=(15, 11), dpi=300)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis('off')

    draw_header(ax, "Kiến trúc Frontend React SPA, phân quyền định tuyến và quản lý trạng thái Zustand", "Hình 2.11")

    # Layer 1: View Layer
    draw_box(ax, 0.05, 0.74, 0.90, 0.18, "TẦNG TRÌNH DIỄN GIAO DIỆN THEO PHÂN HỆ (VIEW & FEATURE PAGES)",
             bg_color="#EBF8FF", border_color="#3182CE", title_color="#2B6CB0", title_fs=11)

    draw_box(ax, 0.07, 0.76, 0.26, 0.12, "Phân hệ Học viên (Student)",
             ["• Lộ trình học ngày (DailyHomework)", "• Luyện Shadowing AI (SpeakingAiEval)", "• Làm bài tập CBT (AssignmentTake)", "• Flashcard từ vựng SRS (StudentFlashcards)", "• Hồ sơ năng lực CEFR (StudentProfile)"],
             bg_color=C_WHITE, border_color="#63B3ED", title_fs=9, body_fs=7.5)

    draw_box(ax, 0.37, 0.76, 0.26, 0.12, "Phân hệ Giảng viên (Teacher)",
             ["• Quản lý lớp học (TeacherClassrooms)", "• Soạn bài tập AI / Excel / TTS", "• Chấm bài tự luận (TeacherGrading)", "• Tải bài giảng Video & Giáo trình", "• Lập kế hoạch ngày (TeacherDailyPlan)"],
             bg_color=C_WHITE, border_color="#63B3ED", title_fs=9, body_fs=7.5)

    draw_box(ax, 0.67, 0.76, 0.26, 0.12, "Phân hệ Quản trị (Admin)",
             ["• Quản lý người dùng & phân vai trò", "• Giám sát Quota AI & Chi phí token", "• Kiểm toán hệ thống (AuditLogPage)", "• Phê duyệt video & thư viện tài nguyên", "• Phát thông báo toàn hệ thống"],
             bg_color=C_WHITE, border_color="#63B3ED", title_fs=9, body_fs=7.5)

    # Layer 2: Routing & RBAC Guard
    draw_box(ax, 0.05, 0.57, 0.90, 0.13, "TẦNG ĐỊNH TUYẾN & BẢO VỆ PHÂN QUYỀN (ROUTER & RBAC GUARD)",
             ["React Router v6 | ProtectedRoute Component | RoleGuard: ROLE_STUDENT, ROLE_TEACHER, ROLE_ADMIN | Tự động chuyển hướng /login nếu chưa xác thực | Bảo vệ cây điều hướng client-side"],
             bg_color="#F7FAFC", border_color="#CBD5E0", title_color=C_PRIMARY, title_fs=10.5, body_fs=8.5)

    draw_directed_arrow(ax, (0.50, 0.74), (0.50, 0.70), "Ủy quyền truy cập", color=C_PRIMARY)

    # Layer 3: State Management (Zustand)
    draw_box(ax, 0.05, 0.36, 0.43, 0.18, "TẦNG QUẢN LÝ TRẠNG THÁI (ZUSTAND STORE)",
             ["• useAuthStore: State user, token, isAuthenticated, roles",
              "  - login(email, pass) / logout()",
              "  - setAccessToken(token) & setRefreshToken(token)",
              "  - persist middleware: Lưu trữ phiên an toàn LocalStorage",
              "• useAssignmentStore: Đếm ngược thời gian CBT, trạng thái lưu bài tạm",
              "• useClassroomStore: Bộ lọc lớp học, danh sách học viên hiện hành"],
             bg_color="#FEFCBF", border_color="#D69E2E", title_color="#975A16", title_fs=10, body_fs=8)

    # Layer 4: Networking & Interceptor
    draw_box(ax, 0.52, 0.36, 0.43, 0.18, "TẦNG GIAO TIẾP MẠNG (AXIOS DUAL INTERCEPTOR)",
             ["• Request Interceptor:",
              "  - Kiểm tra Access Token từ useAuthStore",
              "  - Tự động gắn Header: 'Authorization: Bearer <token>'",
              "• Response Interceptor (Xử lý 401 Unauthorized):",
              "  - Sử dụng hàng đợi Promise (Failed Request Queue Mutex)",
              "  - Gọi POST /api/v1/auth/refresh-token làm mới Access Token",
              "  - Phát lại toàn bộ request thất bại trong hàng đợi trong suốt"],
             bg_color="#E6FFFA", border_color="#319795", title_color="#234E52", title_fs=10, body_fs=8)

    draw_directed_arrow(ax, (0.27, 0.57), (0.27, 0.54), "Đọc trạng thái đăng nhập", color=C_PRIMARY)
    draw_directed_arrow(ax, (0.73, 0.57), (0.73, 0.54), "Dispatch HTTP API", color=C_SECONDARY)
    draw_directed_arrow(ax, (0.52, 0.44), (0.48, 0.44), "Cập nhật token mới", color=C_ACCENT, lw=1.5, dashed=True)

    # Layer 5: Real-time & Media Engine
    draw_box(ax, 0.05, 0.06, 0.90, 0.26, "TẦNG ĐỘNG CƠ ĐA PHƯƠNG TIỆN VÀ GIAO TIẾP THỜI GIAN THỰC (MEDIA & REALTIME ENGINE)",
             bg_color="#FAF5FF", border_color="#805AD5", title_color="#553C9A", title_fs=11)

    draw_box(ax, 0.07, 0.08, 0.27, 0.19, "Web Audio API Recorder",
             ["• Thu âm qua Microphone Browser", "• AudioWorklet Node xử lý luồng PCM", "• Resample trực tiếp 16kHz Mono", "• Giảm nhiễu & vẽ Waveform thời gian thực", "• Đóng gói Blob định dạng audio/wav chuẩn"],
             bg_color=C_WHITE, border_color="#D6BCFA", title_fs=9.5, body_fs=8)

    draw_box(ax, 0.37, 0.08, 0.27, 0.19, "WebSocket & STOMP Client",
             ["• Kết nối SockJS fallback WSS", "• Subscribe kênh cá nhân:", "  /topic/student/{id}", "• Nhận kết quả chấm Speaking/Writing AI", "• Hiển thị Toast thông báo tức thời"],
             bg_color=C_WHITE, border_color="#D6BCFA", title_fs=9.5, body_fs=8)

    draw_box(ax, 0.67, 0.08, 0.26, 0.19, "HLS.js Video Player",
             ["• Phát luồng Video HLS Adaptive (.m3u8)", "• Tự động chọn băng thông (720p/480p/360p)", "• Đồng bộ mốc thời gian xem bài giảng", "• Gửi tín hiệu theo dõi tiến độ học tập", "• Chống tải lậu nội dung số"],
             bg_color=C_WHITE, border_color="#D6BCFA", title_fs=9.5, body_fs=8)

    draw_directed_arrow(ax, (0.20, 0.36), (0.20, 0.27), "Ghi âm & Đóng gói Blob", color=C_PURPLE)
    draw_directed_arrow(ax, (0.50, 0.36), (0.50, 0.27), "Đăng ký kênh STOMP", color=C_PURPLE)
    draw_directed_arrow(ax, (0.80, 0.36), (0.80, 0.27), "Nhận CDN Playlist URL", color=C_PURPLE)

    fig.savefig(os.path.join(OUTPUT_DIR, "Hinh_2_11_KienTrucFrontend_ReactZustand.png"), bbox_inches='tight')
    plt.close(fig)
    print("Exported Hinh_2_11_KienTrucFrontend_ReactZustand.png")


# ==============================================================================
# HÌNH 2.12: LUỒNG TƯƠNG TÁC AUDIO VÀ PHẢN HỒI WEBSOCKET
# ==============================================================================
def generate_hinh_2_12():
    fig, ax = plt.subplots(figsize=(15, 10.5), dpi=300)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis('off')

    draw_header(ax, "Sơ đồ luồng tương tác thời gian thực thu âm Audio và phản hồi WebSocket", "Hình 2.12")

    # Step 1: User & Microphone
    draw_box(ax, 0.05, 0.65, 0.26, 0.25, "1. Thu âm & Tiền xử lý tại Client",
             ["• Người dùng nhấn 'Record'", "• MediaDevices.getUserMedia()", "• AudioContext & AnalyserNode",
              "• Vẽ biểu đồ sóng âm (Waveform Canvas)", "• Đóng gói PCM 16kHz Mono Blob", "• Kiểm tra thời lượng (Duration >= 1s)"],
             bg_color="#EBF8FF", border_color="#3182CE", title_color="#2B6CB0", title_fs=10, body_fs=8)

    # Step 2: Upload API
    draw_box(ax, 0.37, 0.65, 0.26, 0.25, "2. Gửi dữ liệu & Điều phối Backend",
             ["• Gửi POST Multipart /evaluate (WAV)", "• Header: Authorization Bearer JWT", "• Backend kiểm tra tính toàn vẹn",
              "• Tạo bản ghi StudentAnswer (IN_PROGRESS)", "• Điều phối sang dịch vụ âm học Python", "• Trả về HTTP 202 hoặc xử lý trực tiếp"],
             bg_color="#FEFCBF", border_color="#D69E2E", title_color="#975A16", title_fs=10, body_fs=8)

    # Step 3: Acoustic & AI Computing
    draw_box(ax, 0.69, 0.65, 0.26, 0.25, "3. Xử lý âm học & Đánh giá AI",
             ["• Căn chỉnh âm vị Wav2Vec2 CTC", "• Phân tích Formant F1/F2 (Praat)", "• Chấm điểm phụ âm GOP & Độ trôi chảy",
              "• Dự phòng Gemini AI nếu lỗi (Fallback)", "• Tổng hợp điểm KPI & nhận xét sư phạm", "• Lưu AiEvaluation vào MariaDB"],
             bg_color="#E6FFFA", border_color="#319795", title_color="#234E52", title_fs=10, body_fs=8)

    # Connecting Row 1
    draw_directed_arrow(ax, (0.31, 0.77), (0.37, 0.77), "Upload Audio WAV", color=C_SECONDARY, lw=1.8)
    draw_directed_arrow(ax, (0.63, 0.77), (0.69, 0.77), "Phân tích âm học", color=C_ACCENT, lw=1.8)

    # Step 4: Realtime Notification (Middle Row)
    draw_box(ax, 0.53, 0.25, 0.42, 0.26, "4. Kênh đẩy thông báo thời gian thực (WebSocket / STOMP)",
             ["• Backend gọi SimpMessagingTemplate.convertAndSend()",
              "• Kênh đích người dùng: /topic/student/{userId}/evaluation",
              "• Gói tin STOMP JSON:",
              "  - overallScore, isPassed, statusMessage",
              "  - kpi {pronunciation, fluency, completeness, prosody}",
              "  - sentenceTokens [word, color, pause, linking]",
              "  - wordRows [word, phonemes: [{ipa, score, note}]]"],
             bg_color="#FAF5FF", border_color="#805AD5", title_color="#553C9A", title_fs=10, body_fs=8)

    draw_directed_arrow(ax, (0.82, 0.65), (0.82, 0.51), "Kích hoạt sự kiện hoàn tất", color=C_PURPLE, lw=1.8)

    # Step 5: Reactive UI Rendering
    draw_box(ax, 0.05, 0.25, 0.42, 0.26, "5. Cập nhật giao diện người dùng phản ứng (Reactive UI)",
             ["• Client lắng nghe sự kiện trên kênh WebSocket",
              "• Đổi trạng thái từ 'Đang chấm điểm...' sang 'Hoàn thành'",
              "• Tô màu trực quan câu nói (Xanh lá / Vàng / Đỏ / Xám)",
              "• Hiển thị biểu đồ radar 4 chỉ số kỹ năng CEFR",
              "• Mở chi tiết từng âm vị IPA và khẩu hình Formant F1/F2",
              "• Phát âm thanh chúc mừng nếu đạt chuẩn (Passed >= 80)"],
             bg_color="#F0FFF4", border_color="#38A169", title_color="#22543D", title_fs=10, body_fs=8)

    draw_directed_arrow(ax, (0.53, 0.38), (0.47, 0.38), "STOMP Push Message", color=C_GREEN, lw=2.0)

    fig.savefig(os.path.join(OUTPUT_DIR, "Hinh_2_12_LuongTuongTacAudio_WebSocket.png"), bbox_inches='tight')
    plt.close(fig)
    print("Exported Hinh_2_12_LuongTuongTacAudio_WebSocket.png")

generate_hinh_2_2()
generate_hinh_2_3()
generate_hinh_2_9()
generate_hinh_2_10()
generate_hinh_2_11()
generate_hinh_2_12()
