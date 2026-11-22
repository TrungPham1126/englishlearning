# Tài liệu Thiết kế Hệ thống — English Learning Platform (ELP)

> **Hệ thống Học tiếng Anh Trực tuyến Tích hợp Đánh giá Ngữ âm Âm học, Chấm điểm Luận IELTS & Trí tuệ Nhân tạo Đa tầng**
> *Chuẩn biên soạn: IEEE 1016 (SDD) · C4 Architecture Model · arc42 · MADR (ADR)*

---

## 1. Hồ sơ Kiểm soát Tài liệu (Document Control)

| Thuộc tính | Giá trị |
| :--- | :--- |
| **Mã tài liệu** | `ELP-SDD-2026` |
| **Phiên bản** | `2.0.0` (As-Built & Production-Ready Engineering Baseline) |
| **Trạng thái** | Đang hiệu lực (Đồng bộ 100% với mã nguồn Monorepo hiện tại) |
| **Phạm vi hệ thống** | Monorepo gồm 4 thành phần thực thi: `frontend/` (React 19 SPA), `src/` (Spring Boot 3.2.5 Modular Monolith), `phonetics-service/` (FastAPI Port `8000`), `writing-scorer/` (FastAPI Port `8001`) cùng hạ tầng MySQL 8.0, Redis, RabbitMQ, Cloudflare R2 và Cloud AI (Gemini / Groq) |
| **Đối tượng đọc** | Software Architects, Backend/Frontend/AI Engineers, DevOps/SRE, QA Engineers, Technical Leads & Hội đồng phản biện kỹ thuật |
| **Tài liệu liên quan** | [PRODUCT.md](../../PRODUCT.md) · [DESIGN.md](../../DESIGN.md) · [README.md](../../README.md) · [docker-compose.yml](../../docker-compose.yml) |

### Lịch sử Sửa đổi (Revision History)

| Phiên bản | Ngày | Nội dung thay đổi | Trạng thái đồng bộ |
| :--- | :--- | :--- | :--- |
| `1.0.0` | 2026-10-17 | Bản đặc tả học thuật sơ khởi (Chương 1–2 báo cáo đồ án). | Đã lỗi thời (Legacy) |
| `2.0.0` | 2026-11-19 | Tái cấu trúc hoàn toàn theo chuẩn Engineering SDD doanh nghiệp (8 tài liệu module hóa, C4, ERD 32 bảng, API Spec 23 controllers, AI/Media Pipelines, STRIDE Security, Risk Register & 6 ADRs); đồng bộ đầy đủ với `writing-scorer` (port 8001), hiệu chuẩn `SpeechOcean762` v1.1.0, React 19, ABR HLS 4 mức, Exam Proctoring và FinOps R2/AI. | **Baseline hiện hành** |

---

## 2. Tóm tắt Điều hành (Executive Summary)

**English Learning Platform (ELP)** là nền tảng giáo dục tiếng Anh toàn diện định hướng dữ liệu, được thiết kế nhằm giải quyết triệt để 4 nút thắt của các hệ thống LMS học ngoại ngữ truyền thống:

1. **Thiếu đánh giá ngữ âm chuyên sâu cấp âm vị:** ELP vận hành microservice âm học độc lập (`phonetics-service`) kết hợp **Wav2Vec 2.0 XLS-R-53** (`facebook/wav2vec2-xlsr-53-espeak-cv-ft`), trích xuất **Formant nguyên âm F1/F2 bằng Praat-Parselmouth**, chấm điểm phụ âm và hiệu chuẩn thực nghiệm trên tập **SpeechOcean762** (4.989 câu nói, 250 người nói, 5-fold speaker GroupKFold).
2. **Chi phí và độ trễ khi phụ thuộc Cloud LLM đơn lẻ:** ELP áp dụng kiến trúc **Local-First AI + 3-Tier Resilience Pipeline**. Tác vụ phát âm ưu tiên engine cục bộ trước khi fallback sang **Groq Whisper STT + Gemini 2.5 Flash** và **Groq Chat LLM**; tác vụ chấm luận IELTS sử dụng microservice cục bộ **`writing-scorer`** (`hybrid` kết hợp `microsoft/deberta-v3-small` + TF-IDF/LightGBM đạt **Validation QWK = `0.828`, MAE = `0.2502`, Within ±0.5 band = `97.15%`**) kèm fallback Cloud LLM.
3. **Phân phối video bài giảng và học liệu nghe kém tối ưu:** ELP chuyển mã video bài giảng bất đồng bộ qua **RabbitMQ + FFmpeg** thành luồng **Adaptive Bitrate (ABR) HLS 4 mức chất lượng (`360p`, `480p`, `720p`, `1080p`)**, phân đoạn 4 giây và lưu trữ trên **Cloudflare R2** (kèm cơ chế proxy hỗ trợ HTTP `Range` `206`/`416` và tự động fallback phát file gốc nếu thiếu FFmpeg). Đồng thời tích hợp **Kokoro-82M Neural TTS** (24kHz mono WAV, hỗ trợ hội thoại đa giọng đọc) với chống trùng lặp SHA-256 và khả năng tự phục hồi âm thanh phía học viên (`STUDENT_REPAIR`).
4. **Thi cử trực tuyến (CBT) thiếu chống gian lận và quản trị chi phí (FinOps):** Hệ thống tích hợp giám sát phòng thi (`strictFullscreen`, `maxViolations`, ghi vết `violationLogJson`, cảnh báo tức thì qua WebSocket STOMP), kiểm soát hạn mức AI bằng **khóa bi quan (`PESSIMISTIC_WRITE`) + Sliding Window + Global Kill Switch**, và theo dõi chi phí **Cloudflare R2 Free Tier** theo thời gian thực.

---

## 3. Mục tiêu Thiết kế & Ngoài Phạm vi (Goals & Non-Goals)

### 3.1. Mục tiêu Kiến trúc (Design Goals)

- **Local-First, Zero-Interruption Resilience:** Giảm thiểu chi phí token Cloud API và đảm bảo người học không bị gián đoạn bài thi/luyện nói khi mạng chập chờn hoặc chạm ngưỡng Rate Limit (`HTTP 429`).
- **Tính toàn vẹn giao dịch & Tách lớp rõ ràng:** Giữ toàn bộ nghiệp vụ cốt lõi (người dùng, lớp học, bài tập, bài nộp, chấm điểm, tài chính/quota) trong **Spring Boot Modular Monolith** đảm bảo ACID trên MySQL 8.0, đồng thời tách hoàn toàn tính toán ML/DSP nặng (PyTorch, Praat, DeBERTa, Kokoro) sang 2 Python ASGI services không trạng thái (stateless).
- **Trải nghiệm thời gian thực không nghẽn UI:** Thu âm Web Audio API & vẽ sóng âm Canvas 60fps bằng transient Zustand subscription (không kích hoạt re-render React), làm mới JWT chủ động trước upload lớn và qua 401 Promise Queue Mutex.
- **Minh bạch kỹ thuật (As-Built Honesty):** Tài liệu phản ánh chính xác kiến trúc đang chạy trong code, đồng thời ghi nhận rõ các khoảng trống vận hành (Technical Debt / Risks) cần xử lý trước khi go-live quy mô lớn.

### 3.2. Ngoài Phạm vi Hiện tại (Non-Goals / Deferred Capabilities)

- **Chưa hỗ trợ thanh toán / cổng thu học phí trực tuyến:** Quy trình ghi danh vào lớp (`POST /api/admin/classrooms/{id}/enroll`) hiện do Quản trị viên thao tác trực tiếp sau khi xác nhận học phí ngoại tuyến; tự đăng ký người dùng (`POST /api/v1/auth/register`) đang chủ động vô hiệu hóa (`403 Forbidden`).
- **Chưa tách thành Microservices phân tán toàn phần hay Multi-Region:** Core backend vận hành dạng Modular Monolith một khối triển khai (11 packages); một số bảng như `student_vocabulary_progress` đã thiết kế sẵn schema chuẩn SM-2 nhưng API chu trình ôn tập SM-2 chưa mở khóa ở tầng controller.
- **Chưa hỗ trợ WebRTC live video classroom:** Tương tác giảng dạy thực hiện qua bài giảng video HLS bất đồng bộ, bài tập/thi CBT, luyện nói/viết AI và thông báo thời gian thực STOMP/Binary WS.

---

## 4. Bản đồ Hệ sinh thái & Phân vai Người dùng

| Thành phần / Tác nhân | Vai trò trong hệ thống | Điểm tương tác chính |
| :--- | :--- | :--- |
| **Học viên (`ROLE_STUDENT`)** | Học theo lộ trình ngày (`DailyStudyPlan`), xem video HLS, học từ vựng/ngữ pháp, thi CBT có giám sát chống gian lận, luyện phát âm Shadowing/Speaking IELTS, luyện viết Writing (Task 1/Task 2/Paragraph), tự sửa audio lỗi (`repair`). | SPA `/student/*`, `/ws` (STOMP), `/ws/audio` (Binary WS) |
| **Giảng viên (`ROLE_TEACHER`)** | Quản lý lớp phụ trách, lập kế hoạch học ngày, tạo bài tập đa nguồn (thủ công, Import Excel `.xlsx`, AI Quiz/Exam Draft), tổng hợp âm thanh Kokoro TTS, tải video bài giảng, chấm bài tự luận/nói và theo dõi cảnh báo gian lận. | SPA `/teacher/*`, `/ws` (STOMP) |
| **Quản trị viên (`ROLE_ADMIN`)** | Quản trị tài khoản & RBAC, tạo/duyệt lớp & ghi danh học viên, kiểm duyệt video (`PENDING_REVIEW -> APPROVED/REJECTED`), quản trị kho tài nguyên chung, phát thông báo toàn hệ thống, tra cứu Audit Log, giám sát AI Quota/Kill-Switch, quản trị DB/R2 FinOps & xuất Excel báo cáo. | SPA `/admin/*`, `/ws` (STOMP) |
| **AI Phonetics & TTS (`:8000`)** | Phân tích ngữ âm học Wav2Vec2 + Praat F1/F2 hiệu chuẩn SpeechOcean762 và tổng hợp giọng nói Kokoro-82M TTS (đơn thoại & hội thoại đa giọng). | REST nội bộ `:8000` (`evaluate-phonetics`, `/tts`, `/tts/dialogue`) |
| **AI Writing Scorer (`:8001`)** | Chấm điểm luận IELTS (`TASK_1`, `TASK_2`, `PARAGRAPH`) ngoại tuyến với mô hình `hybrid` (`DeBERTa-v3-small` + LightGBM + Feedback Bank + Guardrails). | REST nội bộ `:8001` (`/api/v1/writing/evaluate`) |
| **Dịch vụ Cloud Ngoại vi** | **Google Gemini (`gemini-2.5-flash`)** & **Groq Cloud (`whisper-large-v3-turbo`, `openai/gpt-oss-120b`)** làm AI Tier 2/3 & sinh đề; **Cloudflare R2** lưu trữ phân tán HLS, audio, tài liệu qua S3 API. | HTTPS / TLS 1.3 |

---

## 5. Danh mục Bộ Tài liệu Thiết kế (Documentation Map)

Bộ tài liệu thiết kế chuẩn doanh nghiệp được tổ chức thành 8 tệp chuyên sâu theo cấu trúc từ Tổng quan kiến trúc -> Dữ liệu -> Giao diện lập trình -> AI/Media -> Frontend -> Vận hành/Bảo mật -> Quyết định kiến trúc:

| STT | Tài liệu | Phạm vi & Nội dung trọng tâm | Đối tượng ưu tiên |
| :-: | :--- | :--- | :--- |
| 00 | [README.md](./README.md) | Hồ sơ kiểm soát tài liệu, Executive Summary, Goals/Non-Goals, Glossary và bản đồ điều hướng. | Tất cả thành viên & Stakeholders |
| 01 | [01-system-architecture.md](./01-system-architecture.md) | HLD, C4 Model (Level 1–3), cấu trúc 11 package Modular Monolith, ma trận giao tiếp (REST/AMQP/STOMP/Binary WS/S3) và 5 Sequence Diagrams cốt lõi. | Architects, Backend & Fullstack Devs |
| 02 | [02-database-design.md](./02-database-design.md) | Chiến lược lưu trữ MySQL 8.0, HikariCP, sơ đồ ERD 32 bảng (chia 2 miền), Data Dictionary đầy đủ 5 cụm, 15 Domain Enums, Indexes, Pessimistic Lock & Cascade Purge. | Backend Devs, DBAs, Data Engineers |
| 03 | [03-api-specification.md](./03-api-specification.md) | Chuẩn Envelope `ApiResponse`/`ErrorResponse`, Exception mapping, đặc tả toàn bộ 23 Spring Controllers, hợp đồng 2 Python AI services, WebSocket & HTTP Range Streaming. | Backend, Frontend & QA Engineers |
| 04 | [04-ai-and-media-pipelines.md](./04-ai-and-media-pipelines.md) | Kiến trúc 3-Tier AI Fallback, Pipeline Wav2Vec2 + Praat F1/F2 (SpeechOcean762 v1.1.0), Pipeline Writing Hybrid DeBERTa-v3 (`QWK 0.828`), Kokoro-82M TTS, ABR HLS 4 mức & R2 FinOps. | AI/ML Engineers, Media & Backend Devs |
| 05 | [05-frontend-architecture.md](./05-frontend-architecture.md) | Kiến trúc React 19 + Vite 8 + TypeScript 6, 31 Routes & Lazy Code-Splitting, TanStack Query + Zustand, Axios Proactive Refresh & Mutex, Audio 60fps Canvas, Proctoring & Excel Import. | Frontend & UI/UX Engineers |
| 06 | [06-security-nfr-operations.md](./06-security-nfr-operations.md) | Mô hình mối đe dọa STRIDE, NFR/SLO định lượng, Deployment Topology (Docker/Local/Hybrid), Test Pyramid (86+24+13 suites) và **Risk Register / Technical Debt (P0–P2)**. | Security, DevOps/SRE, QA & Tech Leads |
| 07 | [07-adr-architecture-decisions.md](./07-adr-architecture-decisions.md) | 6 Architecture Decision Records (ADR-001 đến ADR-006) theo chuẩn MADR ghi lại bối cảnh, phương án thay thế và đánh đổi kiến trúc. | Architects & Engineering Managers |

**Tài liệu bổ trợ tại thư mục gốc:**
- [DESIGN.md](../../DESIGN.md): Quy chuẩn Design System (`impeccable`), bảng màu Deep Navy `#1e40af`, Typography (`Inter`, `JetBrains Mono`, `font-ipa`), Radius Hierarchy & Do's/Don'ts.
- [PRODUCT.md](../../PRODUCT.md): Đặc tả tầm nhìn sản phẩm, chân dung người dùng, hệ thống 6 kỹ năng & 6 dạng câu hỏi CBT.

---

## 6. Bảng Thuật ngữ Kỹ thuật (Glossary & Acronyms)

| Thuật ngữ / Viết tắt | Diễn giải |
| :--- | :--- |
| **ABR (Adaptive Bitrate Streaming)** | Kỹ thuật phát video thích ứng băng thông với nhiều mức phân giải (`360p`, `480p`, `720p`, `1080p`) thông qua danh sách phát `master.m3u8`. |
| **ADR (Architecture Decision Record)** | Bản ghi quyết định kiến trúc, lưu giữ lý do, các phương án thay thế và hệ quả của một lựa chọn kỹ thuật quan trọng. |
| **CBT (Computer-Based Testing)** | Hệ thống thi/làm bài kiểm tra trên máy tính hỗ trợ đếm ngược, tự động nộp bài và giám sát chống gian lận (`Proctoring`). |
| **CEFR** | Khung tham chiếu trình độ ngôn ngữ chung châu Âu (`A1`, `A2`, `B1`, `B2`, `C1`, `C2`). |
| **CTC (Connectionist Temporal Classification)** | Hàm mất mát/giải mã chuỗi trong Wav2Vec2 dùng để gióng hàng (alignment) âm vị không cần nhãn thời gian từng frame. |
| **F1 / F2 Formants** | Hai tần số cộng hưởng đầu tiên của đường thanh quản (Hz), phản ánh độ mở hàm (F1) và vị trí lưỡi trước/sau (F2) khi phát âm nguyên âm. |
| **FinOps** | Thực hành quản trị và tối ưu chi phí vận hành hạ tầng đám mây & AI API (token LLM, Cloudflare R2 storage & operations). |
| **GOP (Goodness of Pronunciation)** | Chỉ số đo lường mức độ chuẩn xác của phát âm từng âm vị dựa trên chênh lệch xác suất hậu nghiệm giữa âm vị chuẩn và âm vị nhận diện tốt nhất. |
| **HLS (HTTP Live Streaming)** | Giao thức truyền phát video phân đoạn (`.ts` + `.m3u8`) qua HTTP chuẩn. |
| **IPA (International Phonetic Alphabet)** | Bảng ký hiệu ngữ âm quốc tế dùng để biểu diễn chính xác âm vị của từ vựng và kết quả chấm phát âm. |
| **QWK (Quadratic Weighted Kappa)** | Chỉ số đánh giá mức độ đồng thuận giữa điểm dự đoán của mô hình AI Writing và giám khảo con người (có trọng số bình phương cho sai lệch lớn). |
| **RBAC (Role-Based Access Control)** | Kiểm soát truy cập dựa trên vai trò (`ROLE_ADMIN`, `ROLE_TEACHER`, `ROLE_STUDENT`). |
| **SM-2 (SuperMemo 2)** | Thuật toán lặp lại ngắt quãng (Spaced Repetition) tính khoảng thời gian ôn tập tối ưu dựa trên hệ số dễ nhớ (`easeFactor`). |
| **STT / TTS** | Speech-to-Text (nhận dạng giọng nói thành văn bản) / Text-to-Speech (tổng hợp giọng nói từ văn bản). |
| **VAD (Voice Activity Detection)** | Bộ phát hiện đoạn có tiếng nói thực tế nhằm loại bỏ khoảng lặng và nhiễu nền trước khi phân tích ngữ âm. |
