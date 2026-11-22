# 07. Nhật ký Quyết định Kiến trúc (Architecture Decision Records — ADRs)

> Tài liệu này ghi nhận các quyết định kiến trúc trọng yếu của dự án **ELP** theo chuẩn **MADR (Markdown Any Decision Records)** nhằm lưu giữ bối cảnh kỹ thuật, các phương án đã cân nhắc và hệ quả đánh đổi cho đội ngũ phát triển và bảo trì dài hạn.

---

## Danh mục ADRs

| Mã ADR | Tiêu đề quyết định | Trạng thái | Tác động chính |
| :--- | :--- | :--- | :--- |
| [ADR-001](#adr-001-kiến-trúc-lai-modular-monolith-spring-boot--2-stateless-python-ai-microservices) | Kiến trúc lai Modular Monolith (Spring Boot) + 2 Stateless Python AI Microservices | Accepted | Cấu trúc Monorepo 4 thành phần |
| [ADR-002](#adr-002-chiến-lược-local-first-ai--3-tier-fallback-cho-shadowing--hybrid-ml-cho-writing) | Chiến lược Local-First AI + 3-Tier Fallback (Shadowing) & Hybrid Local ML (Writing) | Accepted | Tiết kiệm chi phí & SLA `>= 99.5%` |
| [ADR-003](#adr-003-chuyển-mã-video-abr-hls-4-mức-bất-đồng-bộ-kèm-2-lớp-graceful-degradation) | Chuyển mã Video ABR HLS 4 mức bất đồng bộ kèm 2 lớp Graceful Degradation | Accepted | Trải nghiệm phát video & an toàn đĩa |
| [ADR-004](#adr-004-xác-thực-jwt-dual-token-httponly-cookie-rotation--proactive-pre-flight-refresh) | Xác thực JWT Dual-Token, HttpOnly Cookie Rotation & Proactive Pre-Flight Refresh | Accepted | An toàn phiên & chống đứt upload |
| [ADR-005](#adr-005-khóa-bi-quan-pessimistic_write-cho-ai-quota--quản-trị-chi-phí-finops-ai--r2) | Khóa bi quan `PESSIMISTIC_WRITE` cho AI Quota & Quản trị Chi phí FinOps (AI + R2) | Accepted | Chống race condition & kiểm soát budget |
| [ADR-006](#adr-006-kokoro-82m-neural-tts-nội-bộ-kèm-sha-256-deduplication--self-healing-audio) | Kokoro-82M Neural TTS nội bộ kèm SHA-256 Deduplication & Self-Healing Audio | Accepted | Chủ động giọng đọc & giảm lỗi 404 |

---

## ADR-001: Kiến trúc lai Modular Monolith (Spring Boot) + 2 Stateless Python AI Microservices

- **Trạng thái:** Accepted
- **Ngày ghi nhận:** 2026-11-19
- **Bối cảnh (Context):**
  Hệ thống vừa cần xử lý các nghiệp vụ giáo dục/khảo thí có tính nhất quán ACID cao (đăng ký lớp, làm bài thi CBT, tính điểm, quản lý quota, audit log), vừa cần chạy các mô hình Deep Learning và DSP đặc thù (`PyTorch`, `Wav2Vec2`, `Praat-Parselmouth`, `Kokoro-82M`, `DeBERTa-v3-small`, `LightGBM`) vốn chỉ có hệ sinh thái mạnh trên Python.
- **Quyết định (Decision):**
  Áp dụng kiến trúc lai:
  1. Toàn bộ 11 phân hệ nghiệp vụ lõi đóng gói thành một **Modular Monolith** trên Java 17 / Spring Boot 3.2.5 (`Controller -> Service Interface -> Service Impl -> Repository -> Entity`), chia sẻ một CSDL MySQL 8.0 duy nhất.
  2. Tách biệt hai năng lực tính toán AI nặng thành 2 tiến trình **Stateless FastAPI Microservices**: `phonetics-service` (`:8000`) và `writing-scorer` (`:8001`), hoàn toàn không kết nối CSDL.
- **Các phương án thay thế đã cân nhắc:**
  - *Pure Monolith (chỉ Java hoặc gọi Python subprocess từ Java):* Khởi động subprocess mỗi request mất hàng giây để nạp model PyTorch (~1–3GB RAM), không thể đáp ứng độ trễ `< 1s`.
  - *Full Microservices (tách riêng Auth, Classroom, Assignment, Submission, Analytics):* Tăng vọt độ phức tạp Distributed Transactions (Saga), network latency, observability và chi phí vận hành trong giai đoạn quy mô trung bình.
- **Hệ quả (Consequences):**
  - *Tích cực:* Giao dịch ACID đơn giản trên MySQL; nạp sẵn model AI vào RAM/VRAM một lần lúc startup; dễ tách từng package Java ra ngoài sau này vì đã tách interface-implementation rõ ràng.
  - *Tiêu cực:* Cần quản lý hợp đồng HTTP nội bộ giữa Java và 2 service Python; khi mở rộng replica Backend cần di dời các state in-memory (`AiMonitoringServiceImpl`) ra Redis.

---

## ADR-002: Chiến lược Local-First AI + 3-Tier Fallback cho Shadowing & Hybrid ML cho Writing

- **Trạng thái:** Accepted
- **Ngày ghi nhận:** 2026-11-19
- **Bối cảnh (Context):**
  Nếu phụ thuộc hoàn toàn vào Cloud AI API (Gemini, Groq) cho hàng nghìn lượt luyện phát âm và chấm bài viết hàng ngày, hệ thống đối mặt với 3 rủi ro lớn: (1) chi phí token lũy tiến, (2) lỗi `HTTP 429 Rate Limit` / nghẽn mạng quốc tế, và (3) Cloud LLM không có khả năng phân tích vật lý sóng âm (F1/F2 Formant, CTC Posterior từng âm vị).
- **Quyết định (Decision):**
  1. **Shadowing (3-Tier Fallback):** Ưu tiên Tầng 1 `phonetics-service` (`PYTHON_ACOUSTIC_ENGINE`, hiệu chuẩn `SpeechOcean762` v1.1.0). Nếu Tầng 1 gặp lỗi kỹ thuật/timeout, `ShadowingServiceImpl` tự động hạ cấp sang Tầng 2 (`Groq Whisper STT` + `Gemini 2.5 Flash`) và Tầng 3 (`Groq Chat LLM`). Nếu Tầng 1 trả lỗi `4xx` chất lượng âm thanh/nói sai câu, không gọi Cloud Fallback mà trả hướng dẫn ghi âm lại.
  2. **Writing (`writing-scorer` + Optional Hybrid/Fallback):** Ưu tiên mô hình cục bộ `hybrid` (`DeBERTa-v3-small` + TF-IDF/LightGBM, đạt Val `QWK = 0.828`, `MAE = 0.2502`), cho phép bật cờ `python.writing-service.enrich-feedback-with-llm` để làm giàu nhận xét bằng Cloud LLM trong khi vẫn giữ nguyên band điểm đã hiệu chuẩn, và fallback sang Cloud LLM (Groq -> Gemini) nếu `writing-scorer` offline.
- **Các phương án thay thế đã cân nhắc:**
  - *Gọi thẳng Cloud API (OpenAI/Gemini) cho mọi lượt:* Độ trễ `2–5s`, không đo được Formant F1/F2 thực tế, dễ chết hàng loạt khi chạm quota free/tier.
  - *Chỉ dùng Local ML không có Fallback:* Gián đoạn tính năng khi server AI cục bộ quá tải hoặc chưa triển khai đủ container.
- **Hệ quả (Consequences):**
  - *Tích cực:* Chi phí biên cho các lượt chấm chuẩn bằng `0 USD`; độ sâu phân tích ngữ âm đến từng âm vị IPA; độ sẵn sàng dịch vụ cao.
  - *Tiêu cực:* Cần dung lượng RAM/VRAM đáng kể trên node chạy AI (`~3.2 GB VRAM` hoặc RAM CPU tương ứng) và duy trì ánh xạ schema tương thích giữa Python và Java DTO.

---

## ADR-003: Chuyển mã Video ABR HLS 4 Mức Bất đồng bộ kèm 2 Lớp Graceful Degradation

- **Trạng thái:** Accepted
- **Ngày ghi nhận:** 2026-11-19
- **Bối cảnh (Context):**
  Video bài giảng MP4 thô dung lượng lớn (tối đa `500MB`) nếu phục vụ đồng bộ và stream trực tiếp toàn tệp sẽ gây nghẽn thread Tomcat, tốn băng thông mạng người học di động và làm đầy ổ đĩa máy chủ ứng dụng.
- **Quyết định (Decision):**
  1. Tách việc nén video ra khỏi luồng HTTP request thông qua **RabbitMQ** (`video.transcode.queue`), chạy FFmpeg tạo luồng **ABR HLS 4 mức chất lượng (`360p`, `480p`, `720p`, `1080p`, segment 4s)**.
  2. Đẩy HLS lên **Cloudflare R2** theo thứ tự nguyên tử (`.ts` -> variant `.m3u8` -> `master.m3u8` cuối cùng) có rollback khi lỗi và xóa ngay file tạm cục bộ sau khi upload thành công.
  3. Cài đặt 2 lớp fallback tự động: fallback sang `taskExecutor` (`afterCommit`) nếu RabbitMQ ngắt kết nối; fallback sang endpoint `/api/v1/videos/{id}/raw` (hỗ trợ HTTP `Range` `206`/`416`) nếu máy chủ chưa cài FFmpeg hoặc transcode thất bại.
- **Các phương án thay thế đã cân nhắc:**
  - *Stream trực tiếp file MP4 từ đĩa cứng backend:* Không thích ứng băng thông mạng, khó scale khi nhiều học viên tua video cùng lúc.
  - *Dùng dịch vụ transcode bên thứ 3 (Cloudflare Stream / Mux):* Tốn phí theo phút lưu trữ/encode hàng tháng.
- **Hệ quả (Consequences):**
  - *Tích cực:* Phản hồi upload tức thì; tối ưu băng thông CDN nhờ R2 zero-egress; không phụ thuộc cứng vào FFmpeg/RabbitMQ trong môi trường dev đơn giản.
  - *Tiêu cực:* Tiêu tốn CPU đáng kể trên worker chạy FFmpeg lúc cao điểm; cần bổ sung cơ chế bảo vệ truy cập cho URL HLS (xem `RISK-04`).

---

## ADR-004: Xác thực JWT Dual-Token, HttpOnly Cookie Rotation & Proactive Pre-Flight Refresh

- **Trạng thái:** Accepted
- **Ngày ghi nhận:** 2026-11-19
- **Bối cảnh (Context):**
  Ứng dụng vừa có các phiên làm bài thi CBT kéo dài và upload video MP4 hàng trăm MB, vừa cần bảo vệ token khỏi XSS và ngăn lỗi `ERR_CONNECTION_ABORTED` khi Access Token hết hạn giữa lúc đang đẩy luồng multipart.
- **Quyết định (Decision):**
  - Phát hành **Access Token** ngắn hạn (`30 phút`) lưu tại client (`useAuthStore`), kết hợp **Refresh Token Rotation** lưu DB và truyền qua **HttpOnly Cookie** (`SameSite=Strict`, `Path=/api/v1/auth`).
  - Frontend `axiosClient.ts` cài đặt đồng thời: (1) **Proactive Pre-Flight Refresh** kiểm tra `isJwtExpiringSoon(token, 60_000)` trước khi gửi `FormData`, và (2) **401 Promise Queue Mutex** (`isRefreshing`, `failedQueue`) gom toàn bộ request 401 đồng thời vào một lượt refresh duy nhất rồi replay lại.
- **Các phương án thay thế đã cân nhắc:**
  - *Lưu cả Refresh Token trong `localStorage`:* Dễ bị đánh cắp toàn bộ phiên nếu phát sinh lỗ hổng XSS.
  - *Stateful HTTP Session (`JSESSIONID`):* Kém linh hoạt khi tách rời SPA và WebSocket / Reverse Proxy.
- **Hệ quả (Consequences):**
  - *Tích cực:* Trải nghiệm học/thi và upload file lớn liền mạch không gián đoạn; chống lạm dụng refresh token bị rò rỉ nhờ cơ chế xoay vòng và thu hồi bản ghi cũ.
  - *Tiêu cực:* Cần đồng bộ cấu hình HTTPS + `cookie.secure(true)` và whitelist CORS khi triển khai production (`RISK-01`, `RISK-02`).

---

## ADR-005: Khóa Bi quan (`PESSIMISTIC_WRITE`) cho AI Quota & Quản trị Chi phí FinOps (AI + R2)

- **Trạng thái:** Accepted
- **Ngày ghi nhận:** 2026-11-19
- **Bối cảnh (Context):**
  Các tính năng gọi Cloud LLM và lưu trữ video/audio trên Object Storage tạo ra chi phí trực tiếp theo mức sử dụng. Học viên có thể gửi nhiều request chấm bài song song (hoặc spam nút bấm) làm vượt hạn mức ngày nếu chỉ đọc-kiểm tra-ghi thông thường (Lost Update / Race Condition).
- **Quyết định (Decision):**
  - Áp dụng **`@Lock(LockModeType.PESSIMISTIC_WRITE)`** tại `StudentAiQuotaRepository.findByStudentIdWithLock()` để tuần tự hóa thao tác kiểm tra và trừ quota trên từng học viên.
  - Kết hợp bộ giới hạn tần suất Sliding Window (3 req/phút cho Student, 5 req/phút cho Teacher), công tắc ngắt khẩn cấp **Global AI Kill-Switch**, và module thống kê chi phí **Cloudflare R2 FinOps** (`R2UsageTracker` + `R2CostReportDto` đối chiếu Free Tier 10GB / 1M Class A / 10M Class B).
- **Các phương án thay thế đã cân nhắc:**
  - *Optimistic Locking (`@Version`):* Yêu cầu logic retry phức tạp ở client/service và gây nhiều exception `409/500` khi học viên spam click.
  - *Không giới hạn hoặc chỉ giới hạn phía UI:* Dễ bị bypass trực tiếp qua API cURL/Postman.
- **Hệ quả (Consequences):**
  - *Tích cực:* Đảm bảo tuyệt đối không âm/lố quota ở mức DB; Admin có dashboard trực quan kiểm soát ngân sách hàng tháng cả AI token lẫn R2 storage.
  - *Tiêu cực:* Sliding window & teacher quota hiện nằm in-memory trong `AiMonitoringServiceImpl`, cần chuyển sang Redis trước khi scale đa node (`RISK-06`).

---

## ADR-006: Kokoro-82M Neural TTS Nội bộ kèm SHA-256 Deduplication & Self-Healing Audio

- **Trạng thái:** Accepted
- **Ngày ghi nhận:** 2026-11-19
- **Bối cảnh (Context):**
  Bài tập Listening và Shadowing đòi hỏi lượng lớn file âm thanh giọng đọc tự nhiên (cả đơn thoại lẫn hội thoại đa nhân vật), đồng thời phải khắc phục tình trạng file audio bị hỏng hoặc mất liên kết mà học viên hay gặp ở các LMS truyền thống.
- **Quyết định (Decision):**
  - Tích hợp **Kokoro-82M Neural TTS** (`24kHz mono WAV`) trực tiếp trong `phonetics-service` hỗ trợ cả đơn thoại (`/tts`) và hội thoại đa giọng (`/tts/dialogue` trả về timeline `segments[]`).
  - `ExerciseAudioServiceImpl` tính băm **SHA-256 `content_hash`** (văn bản + cấu hình giọng) để tái sử dụng bản ghi `READY`, khóa đồng thời theo `questionId` (`questionLocks`), cache metadata trên Redis (TTL 2h), và cung cấp endpoint **`POST /api/v1/ai/tts/questions/{questionId}/repair`** cho phép học viên trong lớp tự phục hồi audio lỗi ngay tại màn hình học.
- **Các phương án thay thế đã cân nhắc:**
  - *Dùng Google Cloud TTS / ElevenLabs:* Phát sinh chi phí cao theo ký tự và phụ thuộc key thương mại.
  - *Dùng `window.speechSynthesis` của trình duyệt:* Chất lượng giọng robot, không nhất quán giữa các trình duyệt/OS, không xuất được timeline cho hội thoại.
- **Hệ quả (Consequences):**
  - *Tích cực:* Chủ động hoàn toàn chi phí và chất lượng giọng đọc US/UK; tránh tổng hợp lại câu trùng nhờ SHA-256; giảm ticket hỗ trợ kỹ thuật nhờ tính năng tự sửa `STUDENT_REPAIR`.
  - *Tiêu cực:* Làm tăng footprint RAM của `phonetics-service` khi giữ đồng thời cả model Wav2Vec2 và Kokoro-82M.
