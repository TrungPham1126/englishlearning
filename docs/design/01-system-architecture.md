# 01. Kiến trúc Hệ thống Tổng thể (High-Level Design & C4 Model)

> Tài liệu này mô tả kiến trúc cấp cao (HLD), mô hình C4 (Context, Container, Component), ma trận giao tiếp liên dịch vụ và biểu đồ tuần tự (Sequence Diagrams) cho 5 luồng nghiệp vụ cốt lõi của nền tảng **English Learning Platform (ELP)**.

---

## 1. Phong cách Kiến trúc: Modular Monolith + Stateless AI Microservices

ELP áp dụng kiến trúc lai (**Hybrid Architecture**) kết hợp ưu điểm toàn vẹn giao dịch của **Modular Monolith** trên JVM với khả năng xử lý tính toán Deep Learning / DSP chuyên sâu của **2 Stateless Python AI Microservices**:

1. **Core Backend — Modular Monolith (`Spring Boot 3.2.5 / Java 17`):**
   - Toàn bộ nghiệp vụ kinh doanh, giao dịch cơ sở dữ liệu ACID, bảo mật JWT/RBAC, định tuyến WebSocket STOMP/Binary, xử lý hàng đợi RabbitMQ và điều phối Cloud API nằm trong một khối triển khai duy nhất (`englishlearning.jar`).
   - Mã nguồn được phân chia thành **11 domain packages** độc lập với kiến trúc phân tầng chuẩn hóa `Controller -> Service Interface -> Service Impl -> Repository -> Entity`, giao tiếp liên mô-đun thông qua Service Interfaces và DTOs.
2. **2 AI Microservices Không Trạng Thái (`Python FastAPI`):**
   - **`phonetics-service` (Port `8000`):** Nạp sẵn **Wav2Vec 2.0 XLS-R-53** (`facebook/wav2vec2-xlsr-53-espeak-cv-ft`), **Praat-Parselmouth** (C++ formant engine) và **Kokoro-82M Neural TTS**. Không kết nối cơ sở dữ liệu; giải phóng bộ nhớ audio ngay sau khi suy luận.
   - **`writing-scorer` (Port `8001`):** Nạp mô hình **`hybrid`** (`microsoft/deberta-v3-small` + TF-IDF/LightGBM + SVD Feedback Bank), chấm điểm luận IELTS (`TASK_1`, `TASK_2`, `PARAGRAPH`) hoàn toàn không trạng thái và ngoại tuyến.
3. **Frontend SPA (`React 19.2.8 / Vite 8.3 / TypeScript 6`):**
   - Phục vụ qua **Nginx** trong production (port `3000 -> 80`), đảm nhiệm reverse proxy `/api/` và `/ws`, stream trực tiếp `/uploads/` qua `sendfile` ở tầng kernel và chạy code-splitting theo 3 phân hệ vai trò (`Student`, `Teacher`, `Admin`).

| Tiêu chí kỹ thuật | Frontend SPA (`frontend/`) | Core Backend (`src/`) | AI Phonetics & TTS (`phonetics-service/`) | AI Writing Scorer (`writing-scorer/`) |
| :--- | :--- | :--- | :--- | :--- |
| **Runtime & Stack** | React 19.2.8, Vite 8.3, TypeScript 6, Zustand 5, TanStack Query 5, Nginx Alpine | Java 17, Spring Boot 3.2.5, Spring Security 6, JPA/Hibernate, HikariCP | Python 3.12 (3.10 Docker), FastAPI, PyTorch, Transformers, Parselmouth, Kokoro | Python, FastAPI, PyTorch 2.7, Transformers (`DeBERTa-v3-small`), LightGBM 4.7 |
| **Cổng mặc định** | `5173` (Dev) / `3000` (Docker Nginx `:80`) | `8080` | `8000` | `8001` |
| **Trách nhiệm chính** | UI/UX, Web Audio PCM/Waveform 60fps, HLS.js playback, CBT Proctoring, Excel import | Auth/RBAC, CRUD giáo trình, CBT engine, Quota/FinOps, Video ABR transcoding, AI orchestration | Forced Alignment Wav2Vec2, Formant F1/F2, Calibration SpeechOcean762, Kokoro-82M TTS | Chấm điểm 4 tiêu chí IELTS Writing (`TASK_1`, `TASK_2`, `PARAGRAPH`) + Guardrails |
| **Trạng thái (State)** | Client state (Zustand + localStorage CBT draft) | Stateful (MySQL 8.0 + Redis + R2 + Local temp disk) | Stateless (chỉ cache model weights tại `/app/cache`) | Stateless (chỉ nạp model tại `models/` lúc startup) |
| **Chiến lược Scale** | CDN / Nginx static replication | Horizontal scaling (sau khi Redis hóa state của `AiMonitoringServiceImpl`) | Scale độc lập theo CPU/GPU cho tác vụ audio/TTS | Scale độc lập theo GPU/CPU cho tác vụ NLP |

---

## 2. Sơ đồ C4 Level 1: Ngữ cảnh Hệ thống (System Context)

```mermaid
flowchart LR
    Student["Học viên (ROLE_STUDENT)"]
    Teacher["Giảng viên (ROLE_TEACHER)"]
    Admin["Quản trị viên (ROLE_ADMIN)"]

    ELP["English Learning Platform (ELP Monorepo)"]

    CloudR2["Cloudflare R2 Storage (S3 API + CDN)"]
    Gemini["Google Gemini API (gemini-2.5-flash)"]
    Groq["Groq Cloud API (Whisper STT & Chat LLM)"]
    DictAPI["External Dictionary API (Tra cứu từ vựng IPA/Audio)"]

    Student -->|"Học lộ trình, Thi CBT, Luyện Nói/Viết, Xem Video HLS (HTTPS / WSS)"| ELP
    Teacher -->|"Lập Daily Plan, Tạo đề AI/Excel/TTS, Tải Video, Chấm bài (HTTPS / WSS)"| ELP
    Admin -->|"Quản trị RBAC, Duyệt Video, Giám sát AI Quota, FinOps R2, Audit Log (HTTPS)"| ELP

    ELP -->|"Upload/Stream ABR HLS, Audio TTS, Tài liệu (S3 TLS 1.3)"| CloudR2
    ELP -->|"Chấm Nói/Viết Fallback, Sinh Quiz/Exam CEFR (HTTPS JSON)"| Gemini
    ELP -->|"STT whisper-large-v3-turbo & LLM Fallback (HTTPS JSON)"| Groq
    ELP -->|"Tra cứu IPA, nghĩa, audio từ điển khi thêm từ mới (HTTPS)"| DictAPI
```

---

## 3. Sơ đồ C4 Level 2: Kiến trúc Container (Container Diagram)

```mermaid
flowchart TD
    Browser["Trình duyệt Người dùng (Desktop / Mobile SPA)"]

    subgraph Edge["Frontend & Reverse Proxy Container"]
        Nginx["Nginx Web Server (:3000 -> :80) & React 19 SPA"]
    end

    subgraph Core["Backend Core Container"]
        Spring["Spring Boot 3.2.5 Modular Monolith (:8080)"]
        FFmpeg["Tiến trình con FFmpeg (ABR HLS 360p-1080p)"]
    end

    subgraph AI["Python AI Microservices"]
        Phonetics["phonetics-service FastAPI (:8000) - Wav2Vec2 + Praat + Kokoro-82M"]
        Writing["writing-scorer FastAPI (:8001) - Hybrid DeBERTa-v3 + LightGBM"]
    end

    subgraph DataInfra["Persistence, Cache & Broker"]
        MySQL[("MySQL 8.0 (:3306 / :3307) - 32 Tables")]
        Redis[("Redis Cache (:6379) - TTL 60m & Audio Cache")]
        RabbitMQ["RabbitMQ Broker (:5672) - AMQP 0-9-1"]
        UploadsVol[("Shared Volume backend_uploads")]
    end

    subgraph External["Dịch vụ Cloud Ngoại vi"]
        R2["Cloudflare R2 Object Storage"]
        Gemini["Google Gemini 2.5 Flash"]
        Groq["Groq Cloud (Whisper + LLM)"]
    end

    Browser -->|"HTTPS (SPA, REST, Multipart) & WSS (/ws, /ws/audio)"| Nginx
    Nginx -->|"Serve static /assets & kernel sendfile /uploads"| UploadsVol
    Nginx -->|"Reverse Proxy /api/ & /ws -> :8080"| Spring

    Spring -->|"JDBC / HikariCP (max 30)"| MySQL
    Spring -->|"RedisTemplate / StringRedisTemplate"| Redis
    Spring -->|"AMQP Publish/Consume (video.transcode.queue, notification.queue)"| RabbitMQ
    Spring -->|"ProcessBuilder CLI"| FFmpeg
    Spring <-->|"Ghi/đọc file tạm & fallback media"| UploadsVol

    Spring -->|"HTTP Multipart /evaluate-phonetics & JSON /tts"| Phonetics
    Spring -->|"HTTP JSON /api/v1/writing/evaluate"| Writing

    Spring -->|"AWS SDK S3 v2.25.35 (Put/Get/Head/Delete/List)"| R2
    Spring -->|"REST Fallback & Exercise Gen"| Gemini
    Spring -->|"REST STT & LLM Fallback"| Groq
```

> **Lưu ý triển khai Docker vs Local:** Trong `docker-compose.yml` hiện tại, 4 container được định nghĩa sẵn là `mysql`, `phonetics-service`, `backend`, `frontend` trên bridge network `englishlearning-network`. Các dịch vụ `Redis`, `RabbitMQ` và `writing-scorer` được cấu hình kết nối qua biến môi trường (`REDIS_HOST`, `RABBITMQ_HOST`, `PYTHON_WRITING_SERVICE_URL`) — xem chi tiết tại [06-security-nfr-operations.md](./06-security-nfr-operations.md).

---

## 4. Sơ đồ C4 Level 3: Kiến trúc 11 Mô-đun Backend (`com.englishlearning`)

Hệ thống Backend tuân thủ kiến trúc **Modular Monolith** với 11 package phân tách theo ranh giới miền nghiệp vụ (Domain Boundaries):

```mermaid
flowchart LR
    subgraph CrossCutting["Tầng Hạ tầng & Xuyên suốt (Cross-Cutting)"]
        Common["common (SecurityConfig, JWT, RabbitMQ, Redis, WebSocket, StorageConfig, GlobalExceptionHandler)"]
        System["system (AuditLogAspect AOP, AuditLogController, AuditLogService)"]
        Notif["notification (STOMP + RabbitMQ NotificationService)"]
    end

    subgraph CoreDomains["Miền Nghiệp vụ Đào tạo & Khảo thí"]
        Auth["auth (AuthController, AdminUserController, UserController, JWT, RefreshTokenRotation)"]
        Classroom["classroom (Admin/Teacher/StudentClassroomController)"]
        Curriculum["curriculum (Lessons, Documents, Grammar, Vocabulary, DailyStudyPlan, GlobalResources)"]
        Assignment["assignment (TeacherAssignmentController, Excel Apache POI, ExerciseAudioService)"]
        Submission["submission (StudentSubmissionController, TeacherGradingController, CBT & Proctoring)"]
    end

    subgraph IntelligenceMedia["Miền AI, Phân tích & Media"]
        AI["ai (AiLabController, AiTtsController, AdminAiMonitoringController, 3-Tier Services)"]
        Analytics["analytics (Admin/Teacher Dashboards, AdminDatabaseController, R2Cost, ExcelExport)"]
        Video["video (VideoController, VideoService, VideoTranscodeConsumer, R2StorageService)"]
    end

    Auth --> Common
    Classroom --> Auth
    Curriculum --> Classroom
    Assignment --> Curriculum
    Submission --> Assignment
    Submission --> AI
    Submission --> Notif
    AI --> Analytics
    Video --> Curriculum
    Video --> Notif
    Analytics --> Video
    Analytics --> Submission
    System -.->|"Spring AOP @AfterReturning"| CoreDomains
```

### Bảng đặc tả 11 Domain Packages

| STT | Package (`com.englishlearning.*`) | Controllers | Services cốt lõi | Entities quản lý |
| :-: | :--- | :--- | :--- | :--- |
| 1 | `auth` | `AuthController`, `AdminUserController`, `UserController` | `AuthService`, `JwtService`, `RefreshTokenService`, `AdminUserService`, `UserDetailsServiceImpl` | `User`, `Role`, `RefreshToken`, `Student`, `Teacher` |
| 2 | `classroom` | `AdminClassroomController`, `TeacherClassroomController`, `StudentClassroomController` | `ClassroomService` | `Classroom`, `ClassStudent` |
| 3 | `curriculum` | `CurriculumController`, `DailyStudyPlanController`, `VocabularyController`, `AdminResourceController` | `CurriculumService`, `DailyStudyPlanService`, `DailyPlanService`, `VocabularyService`, `DictionaryLookupService`, `DocumentStorageService`, `GlobalResourceService`, `TtsAudioService`, `UserStreakService` | `Lesson`, `LessonDocument`, `GrammarTopic`, `VocabularyItem`, `StudentVocabularyProgress`, `DailyStudyPlan`, `DailyPlanItem`, `StudentDailyProgress`, `GlobalResource` |
| 4 | `assignment` | `TeacherAssignmentController` | `AssignmentService`, `ExerciseAudioService` | `Assignment`, `AssignmentQuestion`, `QuestionOption`, `ExerciseAudio` |
| 5 | `submission` | `StudentSubmissionController`, `TeacherGradingController` | `SubmissionService`, `CbtExerciseService`, `GradingEngineService` | `AssignmentAttempt`, `StudentAnswer` |
| 6 | `ai` | `AiLabController`, `AiTtsController`, `AdminAiMonitoringController` | `ShadowingService`, `ShadowingPracticeService`, `PythonIntegrationService`, `AiLabService`, `ExerciseGenerationService`, `GeminiClientService`, `GroqClientService`, `KokoroTtsClientService`, `WhisperPronunciationService`, `QuotaManagementService`, `AiMonitoringService`, `AiEvaluationService` + `AudioWebSocketHandler` | `AiEvaluation`, `AiGeneratedExercise`, `StudentAiQuota` |
| 7 | `analytics` | `AdminDashboardController`, `TeacherDashboardController`, `AnalyticsController`, `AdminDatabaseController` | `AdminDashboardService`, `AdminDatabaseService`, `AnalyticsService`, `ClassroomReportExcelExporter` | `LearningSession`, `StudentSkillProfile` |
| 8 | `video` | `VideoController` | `VideoService`, `HlsVideoConversionService`, `R2StorageService`, `R2UsageTracker`, `VideoTranscodeConsumer` | `Video`, `VideoWatchHistory` |
| 9 | `notification` | `NotificationController` | `NotificationService` | `Notification` |
| 10 | `system` | `AuditLogController` | `AuditLogService`, `AuditLogAspect` | `AuditLog` |
| 11 | `common` | *(Không có Controller)* | `RabbitMqEventPublisher`, `GlobalExceptionHandler`, `SecurityConfig`, `WebSocketConfig`, `AudioWebSocketConfig`, `RabbitMqConfig`, `RedisConfig`, `StorageConfig`, `AsyncConfig`, `AppProperties` | *(Shared DTOs & Exceptions)* |

---

## 5. Ma trận Giao tiếp Liên dịch vụ (Communication Matrix)

| Kênh giao tiếp | Thành phần nguồn -> Đích | Giao thức & Định dạng | Timeout / Độ tin cậy / Fallback |
| :--- | :--- | :--- | :--- |
| **Client <-> Backend API** | React SPA -> Nginx -> Spring Boot `:8080` | RESTful HTTP/1.1+JSON hoặc `multipart/form-data` (tối đa `500MB`) | Proactive JWT refresh cho FormData; 401 Promise Queue Mutex; Retry `1` trên TanStack Query |
| **Backend -> Phonetics AI** | `PythonIntegrationServiceImpl` -> `phonetics-service:8000` | HTTP Multipart (`audio` + `script`) / JSON (`/tts`, `/tts/dialogue`) | `connect-timeout=10s`, `read-timeout=120s` (override `application.properties`); lỗi -> Fallback Tier 2 (Whisper + Gemini) |
| **Backend -> Writing Scorer** | `PythonIntegrationServiceImpl` -> `writing-scorer:8001` | HTTP POST JSON (`application/json`) | `connect-timeout=5s`, `read-timeout=30s`; lỗi -> Fallback Cloud LLM (Groq -> Gemini) |
| **Backend <-> Message Broker** | `VideoServiceImpl` / `RabbitMqEventPublisher` -> RabbitMQ -> `VideoTranscodeConsumer` | AMQP 0-9-1 (`Jackson2JsonMessageConverter`) | Durable queues (`video.transcode.queue`, `notification.queue`), listener retry `3` lần (`2000ms` x `1.5`); nếu broker chết -> fallback `taskExecutor.execute()` chạy sau `afterCommit` |
| **Backend <-> Client Push** | `NotificationServiceImpl` -> React SPA qua `/ws` | STOMP over WebSocket / SockJS (`Authorization` / `token` trong `CONNECT`) | Kênh `/user/{userId}/queue/notifications`, `/topic/classroom.{id}`, `/topic/system-announcements`, `/topic/public`; Nginx `proxy_read_timeout 3600s` |
| **Realtime Audio Stream** | Browser -> `AudioWebSocketHandler` (`/ws/audio`) | Raw Binary WebSocket (Text JSON `{referenceText}` + Binary PCM) | Trả `ShadowingEvaluationResponse` JSON trực tiếp qua session mở |
| **Backend <-> Object Storage** | `R2StorageServiceImpl` -> Cloudflare R2 | S3 REST API qua AWS SDK v2 (`2.25.35`), TLS 1.3 | Path-style access enabled; rollback atomic khi upload HLS thất bại; fallback local `./uploads/` nếu chưa cấu hình R2 (`dummy`) |
| **Video/Audio Streaming** | Browser (`HLS.js` / `<video>`) -> `VideoController` / Nginx | HTTP/1.1 + `Range` (`206 Partial Content`, `416`) | Chunk đọc local `8MB`; stream R2 qua `R2ObjectStream`; Nginx `sendfile` trực tiếp cho `/uploads/` |

---

## 6. Biểu đồ Tuần tự cho 5 Luồng Nghiệp vụ Cốt lõi (Sequence Diagrams)

### 6.1. Luồng 1: Đăng nhập, Rotation Refresh Token & Tự làm mới Phiên (UC-AUTH-01)

```mermaid
sequenceDiagram
    autonumber
    actor U as "Người dùng"
    participant SPA as "React SPA + axiosClient"
    participant Store as "useAuthStore (Zustand)"
    participant AuthCtrl as "AuthController"
    participant AuthSvc as "AuthServiceImpl"
    participant JwtSvc as "JwtServiceImpl"
    participant RtSvc as "RefreshTokenServiceImpl"
    participant DB as "MySQL (users, refresh_tokens)"

    U->>SPA: "Nhập email, mật khẩu và bấm Đăng nhập"
    SPA->>AuthCtrl: "POST /api/v1/auth/login (withCredentials=true)"
    AuthCtrl->>AuthSvc: "login(LoginRequest)"
    AuthSvc->>DB: "Xác thực AuthenticationManager & BCrypt hash"
    AuthSvc->>JwtSvc: "generateAccessToken(userDetails, TTL 30m)"
    AuthSvc->>RtSvc: "createRefreshToken(user) -> deleteByUser cũ & lưu token mới"
    RtSvc->>DB: "DELETE cũ + INSERT refresh_tokens"
    AuthCtrl-->>SPA: "200 OK {accessToken, user} + Set-Cookie refreshToken (HttpOnly, SameSite=Strict)"
    SPA->>Store: "setAuth(accessToken, user) -> đồng bộ localStorage"

    Note over SPA,AuthCtrl: "Kịch bản 1: Request FormData lớn sắp hết hạn token (buffer <= 60s)"
    SPA->>SPA: "isJwtExpiringSoon(token, 60000) == true"
    SPA->>AuthCtrl: "Proactive POST /api/v1/auth/refresh-token (gửi Cookie)"

    Note over SPA,AuthCtrl: "Kịch bản 2: API thông thường nhận 401 Unauthorized"
    SPA->>AuthCtrl: "GET/POST API với Bearer AccessToken đã hết hạn"
    AuthCtrl-->>SPA: "401 Unauthorized (JwtAuthenticationEntryPoint)"
    SPA->>SPA: "Đưa các request đồng thời vào failedQueue (Mutex isRefreshing=true)"
    SPA->>AuthCtrl: "POST /api/v1/auth/refresh-token (Cookie refreshToken)"
    AuthCtrl->>RtSvc: "verifyExpiration(oldToken) -> kiểm tra revoked & expiryDate"
    RtSvc->>DB: "Xóa token cũ & tạo token mới (Rotation)"
    AuthCtrl-->>SPA: "200 OK {newAccessToken} + Set-Cookie mới"
    SPA->>Store: "setAccessToken(newAccessToken)"
    SPA->>AuthCtrl: "processQueue() phát lại toàn bộ request bị hoãn"
```

### 6.2. Luồng 2: Đánh giá Phát âm Shadowing qua 3-Tier AI Fallback (UC-AI-01)

```mermaid
sequenceDiagram
    autonumber
    actor S as "Học viên"
    participant UI as "SpeakingAiEvaluationPage + AudioEngine"
    participant Ctrl as "AiLabController"
    participant ShadSvc as "ShadowingServiceImpl"
    participant PyInt as "PythonIntegrationServiceImpl"
    participant PyPho as "phonetics-service (:8000)"
    participant Groq as "Groq Cloud (Whisper + LLM)"
    participant Gemini as "Gemini 2.5 Flash"
    participant DB as "MySQL (ai_evaluations, student_answers)"

    S->>UI: "Nhấn Micro đọc câu mẫu (60fps Canvas Waveform)"
    UI->>Ctrl: "POST /api/v1/ai/speaking/shadowing-evaluate (Multipart audio + referenceSentence + studentAnswerId)"
    Ctrl->>ShadSvc: "evaluateShadowing(audioFile, studentAnswerId, customSentence)"

    ShadSvc->>PyInt: "Tier 1: evaluatePhonetics(audioBytes, filename, cleanRef)"
    PyInt->>PyPho: "POST /api/v1/audio/evaluate-phonetics"

    alt "Tầng 1 thành công (HTTP 200)"
        PyPho-->>PyInt: "SpeechAssessmentResponse (IPA, F1/F2, GOP, SpeechOcean762 calibrated)"
        PyInt-->>ShadSvc: "ShadowingEvaluationResponse (evaluatedBy=PYTHON_ACOUSTIC_ENGINE)"
    else "Tầng 1 lỗi kỹ thuật / Timeout (ngoại trừ HTTP 4xx LowConfidence)"
        PyInt-->>ShadSvc: "Throw RuntimeException"
        ShadSvc->>Groq: "Tier 2a: Whisper STT (whisper-large-v3-turbo) bóc băng transcript"
        Groq-->>ShadSvc: "Transcript JSON"
        ShadSvc->>Gemini: "Tier 2b: generateWithSystemInstruction (Cambridge Phonetics)"
        alt "Gemini thành công"
            Gemini-->>ShadSvc: "JSON chấm phát âm (evaluatedBy=GEMINI_AI_FALLBACK)"
        else "Gemini 429 Quota / Timeout"
            ShadSvc->>Groq: "Tier 3: chatCompletionJson (openai/gpt-oss-120b)"
            Groq-->>ShadSvc: "JSON chấm phát âm (evaluatedBy=GROQ_AI_FALLBACK)"
        end
    end

    opt "Nếu có studentAnswerId"
        ShadSvc->>DB: "Lưu AiEvaluation + cập nhật StudentAnswer + AnalyticsService.updateSkillScore"
    end
    ShadSvc-->>Ctrl: "ShadowingEvaluationResponse"
    Ctrl-->>UI: "200 OK ApiResponse<ShadowingEvaluationResponse>"
    UI-->>S: "Tô màu câu (GREEN/YELLOW/RED/GRAY) + Bảng IPA & KPI"
```

### 6.3. Luồng 3: Chấm điểm IELTS Writing Cục bộ (Local Hybrid ML + Fallback)

```mermaid
sequenceDiagram
    autonumber
    actor S as "Học viên / Giảng viên"
    participant Ctrl as "AiLabController"
    participant LabSvc as "AiLabServiceImpl"
    participant PyInt as "PythonIntegrationServiceImpl"
    participant PyWrite as "writing-scorer (:8001)"
    participant Cloud as "Cloud LLM (Groq -> Gemini)"
    participant DB as "MySQL (ai_evaluations, student_answers)"

    S->>Ctrl: "POST /api/v1/ai/writing/evaluate (topic, essayText, writingTask, studentAnswerId)"
    Ctrl->>LabSvc: "evaluateWriting(topic, essayText, answerId, writingTask)"
    LabSvc->>LabSvc: "resolveWritingTaskMode() -> TASK_1 / TASK_2 / PARAGRAPH + SubType"

    alt "preferLocalWritingScorer=true & writingServiceEnabled=true"
        LabSvc->>PyInt: "evaluateWriting(topic, essayText, ..., pythonTaskParam)"
        PyInt->>PyWrite: "POST /api/v1/writing/evaluate (JSON)"
        PyWrite->>PyWrite: "Hybrid DeBERTa-v3-small + LightGBM + Guardrails + VN Feedback"
        alt "Local Scorer thành công (có overallBand)"
            PyWrite-->>PyInt: "WritingEvaluateResponse (evaluatedBy=PYTHON_WRITING_SCORER)"
            PyInt-->>LabSvc: "JsonNode result"
            opt "Nếu python.writing-service.enrich-feedback-with-llm=true"
                LabSvc->>Cloud: "Làm giàu feedback/mistakes, giữ nguyên band điểm local"
                Cloud-->>LabSvc: "Enriched JSON (PYTHON_WRITING_SCORER_HYBRID)"
            end
        else "writing-scorer tắt / lỗi kết nối / timeout 30s"
            PyInt-->>LabSvc: "Throw Exception"
            LabSvc->>Cloud: "Tier 2/3 Fallback: Groq -> Gemini với System Instruction theo TASK_1/2/PARAGRAPH"
            Cloud-->>LabSvc: "JSON evaluation"
        end
    end

    LabSvc->>LabSvc: "calibrateWritingEvaluation() chuẩn hóa điểm & phản hồi"
    opt "Nếu có studentAnswerId"
        LabSvc->>DB: "Lưu AiEvaluation (grammar, vocab, coherence, cefr, correctedText) & StudentAnswer"
    end
    LabSvc-->>Ctrl: "JsonNode response"
    Ctrl-->>S: "200 OK ApiResponse<JsonNode>"
```

### 6.4. Luồng 4: Làm bài CBT, Giám sát Chống Gian lận & Chấm điểm Song song (UC-STU-01)

```mermaid
sequenceDiagram
    autonumber
    actor S as "Học viên"
    participant ExamUI as "ExamTakePage + useExamProctoring"
    participant SubCtrl as "StudentSubmissionController"
    participant SubSvc as "SubmissionServiceImpl"
    participant GrdSvc as "GradingEngineServiceImpl"
    participant NotifSvc as "NotificationServiceImpl"
    participant DB as "MySQL (assignment_attempts, student_answers)"
    actor T as "Giảng viên"

    S->>ExamUI: "Mở bài thi CBT -> vào chế độ Fullscreen"
    ExamUI->>SubCtrl: "POST /api/v1/student/assignments/{assignmentId}/start"
    SubCtrl->>SubSvc: "startAttempt(studentId, assignmentId)"
    SubSvc->>DB: "Tạo AssignmentAttempt (status=IN_PROGRESS, startedAt=now)"
    SubSvc-->>ExamUI: "AttemptResponse (attemptId, questions, timeLimit, strictFullscreen, maxViolations)"

    loop "Trong quá trình làm bài (lưu nháp LocalStorage mỗi vài giây)"
        alt "Phát hiện thoát Fullscreen / chuyển Tab (qua grace period 1.2s)"
            ExamUI->>SubCtrl: "POST /api/v1/student/assignments/attempts/{attemptId}/violation"
            SubCtrl->>SubSvc: "recordViolation(attemptId, eventType, reason, currentAnswers)"
            SubSvc->>DB: "Tăng violationCount, append violationLogJson"
            opt "Nếu violationCount >= maxViolations"
                SubSvc->>DB: "Đặt isCheatingFlagged=true & cưỡng chế nộp bài"
                SubSvc->>NotifSvc: "Gửi CHEATING_ALERT tới Giảng viên qua STOMP /queue/notifications"
                NotifSvc-->>T: "Real-time Cheating Alert"
            end
        end
    end

    S->>ExamUI: "Nhấn Nộp bài (hoặc hết giờ tự nộp)"
    ExamUI->>SubCtrl: "POST /api/v1/student/assignments/{assignmentId}/attempts/{attemptId}/submit"
    SubCtrl->>SubSvc: "submitAttempt(studentId, attemptId, SubmissionRequest)"
    SubSvc->>GrdSvc: "evaluateSubmission(questions, answers)"
    GrdSvc-->>SubSvc: "GradingResult (chấm ngay MCQ/T-F/Fill-Blank/Matching; đánh dấu ESSAY/AUDIO_RESPONSE)"
    SubSvc->>DB: "Lưu StudentAnswer, totalScore, status (COMPLETED hoặc SUBMITTED/GRADING)"
    opt "Nếu có giảng viên phụ trách"
        SubSvc->>NotifSvc: "Bắn thông báo SUBMISSION_RECEIVED"
    end
    SubSvc-->>ExamUI: "200 OK AttemptResponse"
    ExamUI-->>S: "Hiển thị điểm khách quan / Trạng thái chờ chấm AI hoặc Giảng viên"
```

### 6.5. Luồng 5: Tải lên Video, Chuyển mã ABR HLS 4 Mức & Kiểm duyệt Phát hành (UC-SYS-01)

```mermaid
sequenceDiagram
    autonumber
    actor T as "Giảng viên"
    actor A as "Quản trị viên"
    participant VidCtrl as "VideoController"
    participant VidSvc as "VideoServiceImpl"
    participant RMQ as "RabbitMQ / taskExecutor"
    participant Consumer as "VideoTranscodeConsumer"
    participant FFmpeg as "FFmpeg Process (360p-1080p)"
    participant R2 as "Cloudflare R2 (S3 API)"
    participant DB as "MySQL (videos)"

    T->>VidCtrl: "POST /api/v1/videos (multipart MP4 <= 500MB, lessonId)"
    VidCtrl->>VidSvc: "uploadOriginalVideo(lessonId, file, userId)"
    VidSvc->>VidSvc: "Lưu file tạm vào uploads/raw/{uuid}.mp4 & dọn artifact cũ"
    VidSvc->>DB: "Lưu Video (status=DRAFT -> PROCESSING)"

    alt "RabbitMQ khả dụng & FFmpeg có sẵn"
        VidSvc->>RMQ: "convertAndSend(video.transcode.queue, VideoTranscodeMessage)"
    else "RabbitMQ lỗi kết nối"
        VidSvc->>RMQ: "Fallback dispatchAsyncTranscode via taskExecutor (afterCommit)"
    end
    VidSvc-->>VidCtrl: "VideoUploadResponse (videoId, status=PROCESSING)"
    VidCtrl-->>T: "200 OK ApiResponse<VideoUploadResponse>"

    RMQ->>Consumer: "processVideoTranscode(message)"
    Consumer->>FFmpeg: "Encode 4 ABR streams (360p, 480p, 720p, 1080p), -hls_time 4"
    alt "FFmpeg exitCode == 0"
        FFmpeg-->>Consumer: "stream_*.m3u8 + stream_*_%03d.ts"
        Consumer->>Consumer: "writeMasterPlaylist(master.m3u8)"
        alt "Cloudflare R2 đã cấu hình (non-dummy)"
            Consumer->>R2: "uploadHlsFolder(hls/{id}) theo thứ tự .ts -> variant .m3u8 -> master.m3u8"
            Consumer->>R2: "uploadFile(raw/{id}/...mp4)"
            Consumer->>Consumer: "Xóa sạch thư mục HLS & raw file tạm trên local disk"
            Consumer->>DB: "Cập nhật status=PENDING_REVIEW, hlsPlaylistUrl, rawStorageUrl"
        else "Chế độ Local / Dummy R2"
            Consumer->>DB: "Giữ file local, cập nhật hlsPlaylistUrl=/api/v1/videos/{id}/hls/master.m3u8, status=PENDING_REVIEW"
        end
    else "Thiếu FFmpeg / Lỗi Transcode / Lỗi R2"
        Consumer->>Consumer: "handleFallbackToRaw(video) -> phục vụ qua /api/v1/videos/{id}/raw"
        Consumer->>DB: "Đặt status=PENDING_REVIEW"
    end

    Consumer->>T: "Gửi thông báo SYSTEM_ALERT qua NotificationService"

    A->>VidCtrl: "PATCH /api/v1/videos/{id}/review?approved=true"
    VidCtrl->>DB: "Cập nhật status=APPROVED (hoặc REJECTED + rejectionReason)"
```
