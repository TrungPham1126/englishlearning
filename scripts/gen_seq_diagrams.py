import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import FancyBboxPatch, Rectangle

plt.rcParams['font.sans-serif'] = 'Segoe UI'
plt.rcParams['font.family'] = 'sans-serif'
plt.rcParams['figure.autolayout'] = False

OUTPUT_DIR = r"D:\HocTap_DoAn\doanchuyennganh\englishlearning\HinhAnh_BaoCao_Chuong2"
os.makedirs(OUTPUT_DIR, exist_ok=True)

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
    ax.text(0.5, 0.975, f"{figure_num}: {title}", ha='center', va='top',
            fontsize=12.5, fontweight='bold', color=C_PRIMARY, transform=ax.transAxes)
    line = plt.Line2D([0.04, 0.96], [0.948, 0.948], color=C_SECONDARY, lw=1.5, transform=ax.transAxes)
    ax.add_line(line)

def draw_lifelines(ax, actors, top_y=0.90, bottom_y=0.06):
    """Draw UML Sequence Lifelines with header boxes and vertical dashed lines."""
    n = len(actors)
    xs = {}
    margin_x = 0.04
    usable_w = 0.92
    step = usable_w / (n - 1) if n > 1 else usable_w
    
    for i, actor in enumerate(actors):
        x = margin_x + i * step
        xs[actor] = x
        
        # Header box
        box_w = min(step * 0.85, 0.14)
        box = FancyBboxPatch((x - box_w/2, top_y - 0.045), box_w, 0.045, boxstyle="round,pad=0.008",
                             facecolor="#EBF8FF", edgecolor="#3182CE", linewidth=1.5, zorder=3)
        ax.add_patch(box)
        ax.text(x, top_y - 0.0225, actor, ha='center', va='center',
                fontsize=8.5, fontweight='bold', color=C_PRIMARY, zorder=4)
        
        # Vertical dashed lifeline
        line = plt.Line2D([x, x], [top_y - 0.045, bottom_y], color="#A0AEC0", lw=1.2, ls='--', zorder=1)
        ax.add_line(line)
        
    return xs

def draw_activation(ax, x, top_y, bottom_y, color="#E2E8F0", border_color="#718096"):
    """Draw UML activation bar on a lifeline."""
    w = 0.016
    rect = Rectangle((x - w/2, bottom_y), w, top_y - bottom_y,
                     facecolor=color, edgecolor=border_color, linewidth=1.0, zorder=2)
    ax.add_patch(rect)

def draw_msg(ax, x1, x2, y, label, is_return=False, is_async=False, color="#2D3748", label_color=None, num=None):
    """Draw a sequence message arrow between two lifelines."""
    ls = '--' if is_return else '-'
    style = "-|>"
    arrow_color = color if color else ("#718096" if is_return else "#2B6CB0")
    
    # Adjust start/end slightly outside activation bars
    ax.annotate("", xy=(x2, y), xytext=(x1, y),
                arrowprops=dict(arrowstyle=style, color=arrow_color, lw=1.3, linestyle=ls, shrinkA=3, shrinkB=3),
                zorder=4)
    
    lbl = f"{num}. {label}" if num else label
    mx = (x1 + x2) / 2
    lc = label_color if label_color else (C_PRIMARY if not is_return else "#4A5568")
    ax.text(mx, y + 0.012, lbl, ha='center', va='bottom', fontsize=8,
            fontweight='bold' if not is_return else 'normal', color=lc,
            bbox=dict(boxstyle='square,pad=0.15', facecolor=C_WHITE, edgecolor='none', alpha=0.9),
            zorder=5)

def draw_self_msg(ax, x, y, h, label, num=None, color=C_PRIMARY):
    """Draw self-call loopback arrow on the same lifeline."""
    w = 0.035
    pts = [(x, y), (x + w, y), (x + w, y - h), (x, y - h)]
    for i in range(len(pts)-1):
        if i == len(pts)-2:
            ax.annotate("", xy=pts[i+1], xytext=pts[i],
                        arrowprops=dict(arrowstyle="-|>", color=color, lw=1.3, shrinkA=0, shrinkB=2), zorder=4)
        else:
            ax.plot([pts[i][0], pts[i+1][0]], [pts[i][1], pts[i+1][1]], color=color, lw=1.3, zorder=4)
    lbl = f"{num}. {label}" if num else label
    ax.text(x + w + 0.005, y - h/2, lbl, ha='left', va='center', fontsize=7.5,
            color=color, fontweight='bold', zorder=5)

def draw_frame(ax, x, y, w, h, frame_type, condition="", bg_color="#F7FAFC", border_color="#CBD5E0"):
    """Draw alt/opt/loop boundary frame in sequence diagram."""
    rect = Rectangle((x, y), w, h, facecolor=bg_color, edgecolor=border_color, lw=1.2, ls='-', zorder=1, alpha=0.5)
    ax.add_patch(rect)
    # Header tag
    tag_w = 0.05
    tag_h = 0.025
    tag = patches.Polygon([(x, y+h), (x+tag_w, y+h), (x+tag_w+0.01, y+h-tag_h), (x, y+h-tag_h)],
                          facecolor="#E2E8F0", edgecolor=border_color, lw=1.0, zorder=2)
    ax.add_patch(tag)
    ax.text(x + 0.012, y + h - 0.016, frame_type, fontsize=7.5, fontweight='bold', color=C_PRIMARY, zorder=3)
    if condition:
        ax.text(x + tag_w + 0.02, y + h - 0.016, f"[{condition}]", fontsize=7.5, fontweight='bold', color=C_ORANGE, zorder=3)


# ==============================================================================
# HÌNH 2.4: SEQUENCE UC-AUTH-01 (ĐĂNG NHẬP VÀ LÀM MỚI TOKEN)
# ==============================================================================
def generate_hinh_2_4():
    fig, ax = plt.subplots(figsize=(15, 11), dpi=300)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis('off')

    draw_header(ax, "Biểu đồ tuần tự nghiệp vụ Đăng nhập và Làm mới phiên xác thực (UC-AUTH-01)", "Hình 2.4")

    actors = [
        "Người dùng\n(Browser)",
        "AuthController",
        "AuthService",
        "JwtTokenProvider",
        "RefreshTokenRepo",
        "Cơ sở dữ liệu\n(MariaDB)",
        "Redis Cache"
    ]
    xs = draw_lifelines(ax, actors, top_y=0.91, bottom_y=0.04)

    # Activations
    draw_activation(ax, xs[actors[0]], 0.86, 0.05)
    draw_activation(ax, xs[actors[1]], 0.85, 0.58)
    draw_activation(ax, xs[actors[2]], 0.84, 0.60)
    draw_activation(ax, xs[actors[3]], 0.76, 0.64)
    draw_activation(ax, xs[actors[4]], 0.70, 0.63)

    # --- Phase 1: Login ---
    y = 0.85
    draw_msg(ax, xs[actors[0]], xs[actors[1]], y, "POST /api/v1/auth/login {email, password}", num=1)
    
    y -= 0.04
    draw_msg(ax, xs[actors[1]], xs[actors[2]], y, "login(LoginRequest)", num=2)

    y -= 0.04
    draw_msg(ax, xs[actors[2]], xs[actors[5]], y, "findByEmail(email)", num=3)
    
    y -= 0.035
    draw_msg(ax, xs[actors[5]], xs[actors[2]], y, "User Entity (hashedPassword, roles, active)", is_return=True)

    y -= 0.04
    draw_self_msg(ax, xs[actors[2]], y, 0.025, "BCrypt.checkpw(rawPass, hashedPass)", num=4)
    
    y -= 0.045
    draw_msg(ax, xs[actors[2]], xs[actors[3]], y, "generateAccessToken(user, roles)", num=5)
    
    y -= 0.035
    draw_msg(ax, xs[actors[3]], xs[actors[2]], y, "Access Token JWT (15 phút)", is_return=True)

    y -= 0.04
    draw_msg(ax, xs[actors[2]], xs[actors[4]], y, "createRefreshToken(userId, expiry=7d)", num=6)

    y -= 0.035
    draw_msg(ax, xs[actors[4]], xs[actors[5]], y, "INSERT INTO refresh_tokens (token_hash, expiry)", num=7)

    y -= 0.04
    draw_msg(ax, xs[actors[2]], xs[actors[1]], y, "AuthResponse {accessToken, refreshToken, userDto}", is_return=True)

    y -= 0.04
    draw_msg(ax, xs[actors[1]], xs[actors[0]], y, "200 OK + Set-Cookie: refreshToken (HttpOnly, Secure)", is_return=True, num=8)

    # --- Phase 2: Token Expiration & Refresh Rotation ---
    y -= 0.06
    draw_frame(ax, 0.03, y - 0.29, 0.94, 0.31, "opt", "Khi Access Token hết hạn (401 Unauthorized) & Xoay vòng Token", bg_color="#FFFDF5")

    y -= 0.03
    draw_msg(ax, xs[actors[0]], xs[actors[1]], y, "GET /api/v1/student/courses (Access Token hết hạn)", num=9, color=C_RED)
    
    y -= 0.035
    draw_msg(ax, xs[actors[1]], xs[actors[0]], y, "401 Unauthorized (Expired JWT)", is_return=True, color=C_RED)

    y -= 0.04
    draw_msg(ax, xs[actors[0]], xs[actors[1]], y, "POST /api/v1/auth/refresh-token (Cookie: refreshToken)", num=10, color=C_ACCENT)

    draw_activation(ax, xs[actors[1]], y, y - 0.16)
    draw_activation(ax, xs[actors[2]], y - 0.03, y - 0.16)

    y -= 0.04
    draw_msg(ax, xs[actors[1]], xs[actors[2]], y, "refreshToken(oldRefreshToken)", num=11)

    y -= 0.035
    draw_msg(ax, xs[actors[2]], xs[actors[6]], y, "isBlacklisted(oldToken)?", num=12)

    y -= 0.035
    draw_msg(ax, xs[actors[2]], xs[actors[4]], y, "findByToken(oldToken) & verifyExpiration()", num=13)

    y -= 0.035
    draw_msg(ax, xs[actors[4]], xs[actors[5]], y, "DELETE oldToken & INSERT newToken (Rotation)", num=14)

    y -= 0.035
    draw_msg(ax, xs[actors[2]], xs[actors[6]], y, "addToBlacklist(oldToken, ttl=7d)", num=15)

    y -= 0.04
    draw_msg(ax, xs[actors[2]], xs[actors[1]], y, "AuthResponse {newAccessToken, newRefreshToken}", is_return=True)

    y -= 0.035
    draw_msg(ax, xs[actors[1]], xs[actors[0]], y, "200 OK + Set-Cookie: newRefreshToken + Retry Request cũ", is_return=True, num=16, color=C_GREEN)

    fig.savefig(os.path.join(OUTPUT_DIR, "Hinh_2_4_Sequence_DangNhap_LamMoiToken.png"), bbox_inches='tight')
    plt.close(fig)
    print("Exported Hinh_2_4_Sequence_DangNhap_LamMoiToken.png")


# ==============================================================================
# HÌNH 2.5: SEQUENCE UC-AI-01 (LUYỆN PHÁT ÂM SHADOWING)
# ==============================================================================
def generate_hinh_2_5():
    fig, ax = plt.subplots(figsize=(15, 11), dpi=300)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis('off')

    draw_header(ax, "Biểu đồ tuần tự nghiệp vụ Luyện phát âm Shadowing qua dịch vụ âm học và AI (UC-AI-01)", "Hình 2.5")

    actors = [
        "Học viên\n(React UI)",
        "Shadowing\nController",
        "Shadowing\nService",
        "Python Acoustic\n(FastAPI)",
        "Cloud AI Fallback\n(Gemini / Groq)",
        "AiEvaluationRepo\n& DB",
        "Analytics\nService"
    ]
    xs = draw_lifelines(ax, actors, top_y=0.91, bottom_y=0.04)

    draw_activation(ax, xs[actors[0]], 0.86, 0.06)
    draw_activation(ax, xs[actors[1]], 0.85, 0.08)
    draw_activation(ax, xs[actors[2]], 0.84, 0.10)

    y = 0.85
    draw_msg(ax, xs[actors[0]], xs[actors[1]], y, "POST /api/v1/ai/shadowing/evaluate (audio.wav, script, studentAnswerId)", num=1)

    y -= 0.04
    draw_msg(ax, xs[actors[1]], xs[actors[2]], y, "evaluateShadowing(audioFile, studentAnswerId, script)", num=2)

    y -= 0.04
    draw_self_msg(ax, xs[actors[2]], y, 0.025, "cleanReferenceSentence(script)", num=3)

    # --- Phase: Tier 1 ---
    y -= 0.045
    draw_msg(ax, xs[actors[2]], xs[actors[3]], y, "POST /api/v1/audio/evaluate-phonetics (audio_bytes, clean_script)", num=4, color=C_ACCENT)
    draw_activation(ax, xs[actors[3]], y, y - 0.22)

    y -= 0.035
    draw_self_msg(ax, xs[actors[3]], y, 0.02, "Preprocess: 16kHz mono, Bandpass Filter", num=5)

    y -= 0.035
    draw_self_msg(ax, xs[actors[3]], y, 0.02, "VAD & Quality Gate: SNR, Duration, Clipping", num=6)

    y -= 0.035
    draw_self_msg(ax, xs[actors[3]], y, 0.02, "Neural Forced Alignment: Wav2Vec2 CTC matrix", num=7)

    y -= 0.035
    draw_self_msg(ax, xs[actors[3]], y, 0.02, "Formant F1/F2 (Praat) & Consonant GOP Scorer", num=8)

    y -= 0.04
    draw_msg(ax, xs[actors[3]], xs[actors[2]], y, "200 OK: SpeechAssessmentResponse (words, phonemes, F1/F2, KPI)", is_return=True, color=C_GREEN, num=9)

    # --- Phase: Tier 2 & 3 Fallback Frame ---
    y -= 0.06
    draw_frame(ax, 0.15, y - 0.17, 0.70, 0.19, "alt", "Nếu Python Engine gặp Timeout (> 3.5s) hoặc Lỗi kết nối", bg_color="#FFF5F5")

    y -= 0.03
    draw_msg(ax, xs[actors[2]], xs[actors[4]], y, "Groq Whisper: transcribeAudioVerbose(audioBytes)", num=10, color=C_ORANGE)
    draw_activation(ax, xs[actors[4]], y, y - 0.11)

    y -= 0.035
    draw_msg(ax, xs[actors[4]], xs[actors[2]], y, "STT Verbatim Transcript & Word Timestamps", is_return=True)

    y -= 0.035
    draw_msg(ax, xs[actors[2]], xs[actors[4]], y, "Gemini 1.5 Flash: evaluateWithSystemInstruction(transcript, script)", num=11, color=C_PURPLE)

    y -= 0.035
    draw_msg(ax, xs[actors[4]], xs[actors[2]], y, "Fallback JSON (KPI, wordStatus, IPA feedback)", is_return=True)

    # --- Persist & Update ---
    y -= 0.06
    draw_msg(ax, xs[actors[2]], xs[actors[5]], y, "INSERT INTO ai_evaluations & UPDATE student_answers", num=12)

    y -= 0.04
    draw_msg(ax, xs[actors[2]], xs[actors[6]], y, "updateSkillScore(studentId, 'SPEAKING', delta)", num=13)

    y -= 0.04
    draw_msg(ax, xs[actors[2]], xs[actors[1]], y, "ShadowingEvaluationResponse (score, tokens, wordRows)", is_return=True)

    y -= 0.04
    draw_msg(ax, xs[actors[1]], xs[actors[0]], y, "200 OK: Render Waveform, IPA details, Formant Chart", is_return=True, num=14, color=C_PRIMARY)

    fig.savefig(os.path.join(OUTPUT_DIR, "Hinh_2_5_Sequence_LuyenPhatAm_Shadowing.png"), bbox_inches='tight')
    plt.close(fig)
    print("Exported Hinh_2_5_Sequence_LuyenPhatAm_Shadowing.png")


# ==============================================================================
# HÌNH 2.6: SEQUENCE UC-TEA-01 (KHỞI TẠO BÀI TẬP AI / EXCEL / TTS)
# ==============================================================================
def generate_hinh_2_6():
    fig, ax = plt.subplots(figsize=(15, 11), dpi=300)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis('off')

    draw_header(ax, "Biểu đồ tuần tự nghiệp vụ Khởi tạo bài tập thông minh AI / Excel / TTS (UC-TEA-01)", "Hình 2.6")

    actors = [
        "Giảng viên\n(Teacher UI)",
        "Assignment\nController",
        "AiExercise\nService",
        "Gemini AI\nEngine",
        "Kokoro-82M\nTTS Service",
        "Cloudflare R2\nStorage",
        "AssignmentRepo\n& PlanService"
    ]
    xs = draw_lifelines(ax, actors, top_y=0.91, bottom_y=0.04)

    draw_activation(ax, xs[actors[0]], 0.86, 0.06)
    draw_activation(ax, xs[actors[1]], 0.85, 0.08)
    draw_activation(ax, xs[actors[2]], 0.84, 0.12)

    y = 0.85
    draw_msg(ax, xs[actors[0]], xs[actors[1]], y, "POST /api/v1/teacher/assignments/generate-ai {topic, cefr, count, types}", num=1)

    y -= 0.04
    draw_msg(ax, xs[actors[1]], xs[actors[2]], y, "generateExercises(promptDto)", num=2)

    y -= 0.04
    draw_msg(ax, xs[actors[2]], xs[actors[3]], y, "generateContent(systemPrompt, userRequirement)", num=3, color=C_PURPLE)
    draw_activation(ax, xs[actors[3]], y, y - 0.07)

    y -= 0.04
    draw_self_msg(ax, xs[actors[3]], y, 0.02, "LLM Inferences: Tạo câu hỏi, đáp án, giải thích", num=4)

    y -= 0.04
    draw_msg(ax, xs[actors[3]], xs[actors[2]], y, "JSON Raw List: Questions, Options, Keys, AudioScripts", is_return=True, num=5)

    y -= 0.04
    draw_self_msg(ax, xs[actors[2]], y, 0.02, "Parse & Validate JSON schema câu hỏi", num=6)

    # Audio synthesis loop
    y -= 0.05
    draw_frame(ax, 0.20, y - 0.17, 0.74, 0.19, "loop", "Đối với mỗi câu hỏi dạng LISTENING / SHADOWING", bg_color="#F0FFF4")

    y -= 0.035
    draw_msg(ax, xs[actors[2]], xs[actors[4]], y, "POST /api/v1/audio/tts {text, voice='af_heart', speed=1.0}", num=7, color=C_ACCENT)
    draw_activation(ax, xs[actors[4]], y, y - 0.05)

    y -= 0.035
    draw_msg(ax, xs[actors[4]], xs[actors[2]], y, "24kHz Mono WAV Audio Bytes", is_return=True)

    y -= 0.035
    draw_msg(ax, xs[actors[2]], xs[actors[5]], y, "uploadAudio(prefix='audios/exercises/', wavBytes)", num=8, color=C_GREEN)
    draw_activation(ax, xs[actors[5]], y, y - 0.04)

    y -= 0.035
    draw_msg(ax, xs[actors[5]], xs[actors[2]], y, "Public CDN Audio URL: https://r2.../audio.wav", is_return=True)

    # Save to DB & Plan
    y -= 0.06
    draw_msg(ax, xs[actors[2]], xs[actors[6]], y, "saveAssignment(assignment, questions, options, audioRefs)", num=9)
    draw_activation(ax, xs[actors[6]], y, y - 0.07)

    y -= 0.04
    draw_msg(ax, xs[actors[6]], xs[actors[6]], y, "attachToDailyStudyPlan(classId, planDate, assignmentId)", num=10)

    y -= 0.04
    draw_msg(ax, xs[actors[6]], xs[actors[2]], y, "Assignment ID & Saved Metadata", is_return=True)

    y -= 0.04
    draw_msg(ax, xs[actors[2]], xs[actors[1]], y, "AssignmentResponse DTO", is_return=True)

    y -= 0.04
    draw_msg(ax, xs[actors[1]], xs[actors[0]], y, "201 Created: Hiển thị bộ câu hỏi & file audio cho GV duyệt", is_return=True, num=11, color=C_PRIMARY)

    fig.savefig(os.path.join(OUTPUT_DIR, "Hinh_2_6_Sequence_TaoBaiTap_AI_Excel_TTS.png"), bbox_inches='tight')
    plt.close(fig)
    print("Exported Hinh_2_6_Sequence_TaoBaiTap_AI_Excel_TTS.png")


# ==============================================================================
# HÌNH 2.7: SEQUENCE UC-STU-01 (LÀM BÀI CBT VÀ CHẤM AI)
# ==============================================================================
def generate_hinh_2_7():
    fig, ax = plt.subplots(figsize=(15, 11), dpi=300)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis('off')

    draw_header(ax, "Biểu đồ tuần tự nghiệp vụ Làm bài tập CBT và Chấm bài tự luận/nói bằng AI (UC-STU-01)", "Hình 2.7")

    actors = [
        "Học viên\n(Student UI)",
        "Submission\nController",
        "Submission\nService",
        "AutoGrading\nEngine",
        "Async AI Task\n(Speaking/Writing)",
        "AttemptRepo\n& DB",
        "WebSocket\nBroker"
    ]
    xs = draw_lifelines(ax, actors, top_y=0.91, bottom_y=0.04)

    draw_activation(ax, xs[actors[0]], 0.86, 0.06)
    draw_activation(ax, xs[actors[1]], 0.85, 0.40)
    draw_activation(ax, xs[actors[2]], 0.84, 0.42)

    # Step 1: Start Attempt
    y = 0.85
    draw_msg(ax, xs[actors[0]], xs[actors[1]], y, "POST /api/v1/student/assignments/{id}/start", num=1)

    y -= 0.04
    draw_msg(ax, xs[actors[1]], xs[actors[2]], y, "startAttempt(studentId, assignmentId)", num=2)

    y -= 0.04
    draw_msg(ax, xs[actors[2]], xs[actors[5]], y, "INSERT INTO assignment_attempts (status='IN_PROGRESS')", num=3)

    y -= 0.035
    draw_msg(ax, xs[actors[5]], xs[actors[2]], y, "Attempt Entity (id, startedAt, timeLimit)", is_return=True)

    y -= 0.035
    draw_msg(ax, xs[actors[2]], xs[actors[1]], y, "AttemptStartResponse {attemptId, questionsList}", is_return=True)

    y -= 0.035
    draw_msg(ax, xs[actors[1]], xs[actors[0]], y, "200 OK: Bắt đầu đếm ngược thời gian làm bài CBT", is_return=True, num=4)

    # Step 2: Auto-save Answers
    y -= 0.05
    draw_frame(ax, 0.03, y - 0.07, 0.70, 0.08, "loop", "Tự động lưu câu trả lời định kỳ hoặc khi chuyển câu", bg_color="#F7FAFC")
    y -= 0.035
    draw_msg(ax, xs[actors[0]], xs[actors[1]], y, "PUT /api/v1/student/attempts/{id}/save-answer {qId, selectedOption, text}", num=5)
    y -= 0.035
    draw_msg(ax, xs[actors[1]], xs[actors[5]], y, "UPSERT INTO student_answers", num=6)

    # Step 3: Final Submit
    y -= 0.06
    draw_msg(ax, xs[actors[0]], xs[actors[1]], y, "POST /api/v1/student/attempts/{id}/submit", num=7, color=C_RED)
    draw_activation(ax, xs[actors[1]], y, y - 0.22)
    draw_activation(ax, xs[actors[2]], y - 0.03, y - 0.22)

    y -= 0.04
    draw_msg(ax, xs[actors[1]], xs[actors[2]], y, "submitAttempt(attemptId)", num=8)

    y -= 0.04
    draw_msg(ax, xs[actors[2]], xs[actors[3]], y, "gradeObjectiveQuestions(answers, questions)", num=9)
    draw_activation(ax, xs[actors[3]], y, y - 0.04)

    y -= 0.035
    draw_msg(ax, xs[actors[3]], xs[actors[2]], y, "Objective Score (Trắc nghiệm, Điền từ)", is_return=True)

    y -= 0.04
    draw_msg(ax, xs[actors[2]], xs[actors[4]], y, "dispatchAsyncAiGrading(speakingAnswers, writingAnswers)", num=10, color=C_PURPLE)
    draw_activation(ax, xs[actors[4]], y, y - 0.16)

    y -= 0.04
    draw_msg(ax, xs[actors[2]], xs[actors[5]], y, "UPDATE attempts SET status='SUBMITTED', partial_score", num=11)

    y -= 0.04
    draw_msg(ax, xs[actors[2]], xs[actors[1]], y, "SubmitResponse {attemptId, partialScore, status='EVALUATING'}", is_return=True)

    y -= 0.035
    draw_msg(ax, xs[actors[1]], xs[actors[0]], y, "200 OK: Trả về điểm trắc nghiệm tức thì & thông báo chờ AI chấm", is_return=True, num=12)

    # Async AI finish & WebSocket notification
    y -= 0.05
    draw_self_msg(ax, xs[actors[4]], y, 0.025, "Chấm Speaking (Phonetics) & Writing (Grammar/CEFR)", num=13)

    y -= 0.04
    draw_msg(ax, xs[actors[4]], xs[actors[5]], y, "SAVE ai_evaluations & UPDATE total_score, status='GRADED'", num=14)

    y -= 0.04
    draw_msg(ax, xs[actors[4]], xs[actors[6]], y, "publishNotification('/topic/student/' + id, finalResultDto)", num=15, color=C_GREEN)
    draw_activation(ax, xs[actors[6]], y, y - 0.04)

    y -= 0.04
    draw_msg(ax, xs[actors[6]], xs[actors[0]], y, "WebSocket Push: Cập nhật điểm tổng & Báo cáo AI chi tiết", is_return=True, color=C_GREEN, num=16)

    fig.savefig(os.path.join(OUTPUT_DIR, "Hinh_2_7_Sequence_LamBaiCBT_ChamAI.png"), bbox_inches='tight')
    plt.close(fig)
    print("Exported Hinh_2_7_Sequence_LamBaiCBT_ChamAI.png")


# ==============================================================================
# HÌNH 2.8: SEQUENCE UC-SYS-01 (CHUYỂN ĐỔI VIDEO HLS QUA RABBITMQ)
# ==============================================================================
def generate_hinh_2_8():
    fig, ax = plt.subplots(figsize=(15, 11), dpi=300)
    ax.set_xlim(0, 1)
    ax.set_ylim(0, 1)
    ax.axis('off')

    draw_header(ax, "Biểu đồ tuần tự nghiệp vụ Tải lên và Chuyển đổi Video HLS bất đồng bộ qua RabbitMQ (UC-SYS-01)", "Hình 2.8")

    actors = [
        "Giảng viên\n(Teacher UI)",
        "VideoController",
        "VideoService",
        "RabbitMQ Broker\n(video.transcode)",
        "TranscodeConsumer\n(Worker)",
        "FFmpeg\nSubprocess",
        "Cloudflare R2\nStorage",
        "VideoRepo\n& Notify"
    ]
    xs = draw_lifelines(ax, actors, top_y=0.91, bottom_y=0.04)

    draw_activation(ax, xs[actors[0]], 0.86, 0.06)
    draw_activation(ax, xs[actors[1]], 0.85, 0.58)
    draw_activation(ax, xs[actors[2]], 0.84, 0.60)

    y = 0.85
    draw_msg(ax, xs[actors[0]], xs[actors[1]], y, "POST /api/v1/teacher/videos/upload (MultipartFile video.mp4, title, lessonId)", num=1)

    y -= 0.04
    draw_msg(ax, xs[actors[1]], xs[actors[2]], y, "uploadAndQueueTranscode(file, title, lessonId)", num=2)

    y -= 0.04
    draw_self_msg(ax, xs[actors[2]], y, 0.025, "Lưu file tạm vào local: uploads/videos/{id}.mp4", num=3)

    y -= 0.045
    draw_msg(ax, xs[actors[2]], xs[actors[7]], y, "INSERT INTO videos (status='UPLOADED', raw_url=localPath)", num=4)

    y -= 0.04
    draw_msg(ax, xs[actors[2]], xs[actors[3]], y, "rabbitTemplate.convertAndSend(queue, VideoTranscodeMessage{videoId})", num=5, color=C_PURPLE)

    y -= 0.04
    draw_msg(ax, xs[actors[2]], xs[actors[1]], y, "VideoUploadResponse {videoId, status='QUEUED'}", is_return=True)

    y -= 0.035
    draw_msg(ax, xs[actors[1]], xs[actors[0]], y, "202 Accepted: Đang xếp hàng xử lý mã hóa nền", is_return=True, num=6)

    # --- Background Worker Execution ---
    y -= 0.05
    draw_frame(ax, 0.32, y - 0.39, 0.66, 0.41, "bg", "Tiến trình xử lý ngầm bất đồng bộ (Background Async Worker)", bg_color="#F7FAFC")

    y -= 0.03
    draw_msg(ax, xs[actors[3]], xs[actors[4]], y, "@RabbitListener: onMessage(VideoTranscodeMessage)", num=7, color=C_PURPLE)
    draw_activation(ax, xs[actors[4]], y, y - 0.32)

    y -= 0.04
    draw_msg(ax, xs[actors[4]], xs[actors[7]], y, "UPDATE videos SET status='PROCESSING'", num=8)

    y -= 0.04
    draw_msg(ax, xs[actors[4]], xs[actors[5]], y, "ProcessBuilder('ffmpeg -i ... -hls_time 6 -f hls master.m3u8')", num=9, color=C_RED)
    draw_activation(ax, xs[actors[5]], y, y - 0.07)

    y -= 0.04
    draw_self_msg(ax, xs[actors[5]], y, 0.02, "Mã hóa H.264 & Cắt video thành các lát 6 giây (.ts)", num=10)

    y -= 0.04
    draw_msg(ax, xs[actors[5]], xs[actors[4]], y, "FFmpeg Exit Code = 0 (Success)", is_return=True)

    y -= 0.04
    draw_msg(ax, xs[actors[4]], xs[actors[6]], y, "uploadHlsFolder('hls/' + videoId, dir) & uploadRawBackup()", num=11, color=C_GREEN)
    draw_activation(ax, xs[actors[6]], y, y - 0.04)

    y -= 0.04
    draw_msg(ax, xs[actors[6]], xs[actors[4]], y, "Cloudflare CDN URL: https://r2.../master.m3u8", is_return=True)

    y -= 0.04
    draw_msg(ax, xs[actors[4]], xs[actors[7]], y, "UPDATE videos SET status='READY', hls_url=playlistUrl", num=12)

    y -= 0.04
    draw_self_msg(ax, xs[actors[4]], y, 0.02, "Dọn dẹp ổ cứng: Xóa file MP4 và thư mục HLS local", num=13)

    y -= 0.04
    draw_msg(ax, xs[actors[4]], xs[actors[7]], y, "NotificationService.notifyTeacher(teacherId, 'Video sẵn sàng')", num=14)

    y -= 0.035
    draw_msg(ax, xs[actors[7]], xs[actors[0]], y, "WebSocket Push: Thông báo video đã sẵn sàng phát HLS adaptive", is_return=True, color=C_GREEN, num=15)

    fig.savefig(os.path.join(OUTPUT_DIR, "Hinh_2_8_Sequence_ChuyenDoiVideo_HLS_RabbitMQ.png"), bbox_inches='tight')
    plt.close(fig)
    print("Exported Hinh_2_8_Sequence_ChuyenDoiVideo_HLS_RabbitMQ.png")

generate_hinh_2_4()
generate_hinh_2_5()
generate_hinh_2_6()
generate_hinh_2_7()
generate_hinh_2_8()
