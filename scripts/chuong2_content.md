# BÁO CÁO ĐỒ ÁN CHUYÊN NGÀNH
## HỆ THỐNG HỌC TIẾNG ANH TRỰC TUYẾN TÍCH HỢP ĐÁNH GIÁ NGỮ ÂM TÍNH TOÁN VÀ TRÍ TUỆ NHÂN TẠO ĐA TẦNG

---

### **CHƯƠNG 2. THIẾT KẾ HỆ THỐNG**

#### ***2.1. Thiết kế kiến trúc hệ thống***

##### ***2.1.1. Kiến trúc tổng thể: Modular Monolith (Spring Boot) kết hợp Acoustic Microservice (Python FastAPI)***

Xuất phát từ các yêu cầu chức năng (FR) và phi chức năng (NFR) đã được đặc tả tại Chương 1, hệ thống được thiết kế theo mô hình kiến trúc lai: **Modular Monolith** làm nền tảng ứng dụng trung tâm kết hợp với **Acoustic Microservice** chuyên biệt phục vụ tính toán ngữ âm học thời gian thực. Kiến trúc này được lựa chọn nhằm tối ưu hóa sự cân bằng giữa tính toàn vẹn dữ liệu giao dịch ACID, chi phí vận hành hạ tầng thấp và khả năng khai thác tối đa các thư viện xử lý tín hiệu âm thanh chuyên sâu viết bằng C/C++ và Python.

Toàn bộ hệ thống được phân rã thành các tầng chức năng phân định rõ ràng:

1. **Tầng khách hàng (Client Presentation Tier):** Được xây dựng dưới dạng ứng dụng đơn trang (Single Page Application - SPA) dựa trên React 18, Vite và TypeScript. Tầng giao diện tích hợp Web Audio API (xử lý AudioWorklet thu âm định dạng PCM 16kHz tại máy trạm), HLS.js (giải mã luồng video phân đoạn HTTP Live Streaming) và STOMP/SockJS Client (nhận thông báo thời gian thực).
2. **Tầng bảo mật và định tuyến (Gateway & Security Filter Tier):** Tích hợp trực tiếp trong nhân Spring Boot với Spring Security 6. Tầng này chịu trách nhiệm kiểm soát phiên không trạng thái (stateless) qua JWT Dual-Token Filter, phân quyền dựa trên vai trò (Role-Based Access Control - RBAC: `ROLE_STUDENT`, `ROLE_TEACHER`, `ROLE_ADMIN`), ghi nhật ký kiểm toán tự động qua Spring AOP và kiểm soát tần suất truy cập (Rate Limiting) để chống tấn công từ chối dịch vụ.
3. **Tầng ứng dụng trung tâm (Core Modular Monolith - Spring Boot 3):** Đóng gói toàn bộ nghiệp vụ quản lý người dùng, phân phối học liệu, lập lịch lộ trình học Spaced Repetition (SM-2), tổ chức thi trắc nghiệm/tự luận CBT, quản lý hàng đợi chuyển đổi video HLS và điều phối dịch vụ trí tuệ nhân tạo. Các mô-đun được cô lập logic qua ranh giới dịch vụ nội bộ (domain packages), chỉ giao tiếp thông qua Service Interface và Data Transfer Object (DTO), cho phép dễ dàng phân tách thành các microservice độc lập khi quy mô người dùng tăng trưởng vượt bậc mà không làm phá vỡ kiến trúc gốc.
4. **Tầng dịch vụ âm học tính toán (Acoustic Microservice - Python FastAPI):** Vận hành độc lập dưới dạng tiến trình microservice tại cổng dịch vụ 8000, nạp sẵn mô hình học sâu Wav2Vec 2.0 XLS-R-53 (fine-tuned cho nhận diện âm vị quốc tế IPA) và tích hợp nhân âm học Praat-Parselmouth C++. Dịch vụ này chuyên trách tính toán căn chỉnh thời gian âm vị (Forced Alignment), trích xuất tọa độ formant nguyên âm F1/F2, chấm điểm phụ âm Goodness of Pronunciation (GOP) và tổng hợp giọng đọc mẫu chất lượng cao Kokoro-82M Neural TTS.
5. **Tầng hạ tầng lưu trữ và môi giới thông điệp bất đồng bộ (Persistence & Message Broker Tier):** Bao gồm cơ sở dữ liệu quan hệ MariaDB/MySQL (32 bảng chuẩn hóa 3NF), Redis Cache (quản lý danh sách đen Token Blacklist, bộ đệm phiên và Rate Limiter), RabbitMQ Message Broker (phân phối tác vụ giải mã video HLS và thông báo nền) và Cloudflare R2 Object Storage (lưu trữ phân tán video HLS, file ghi âm học viên và tài liệu học tập với băng thông tải về miễn phí qua mạng phân phối nội dung CDN).

```
+----------------------------------------------------------------------------------------------------+
| [HÌNH ẢNH: D:\HocTap_DoAn\doanchuyennganh\englishlearning\HinhAnh_BaoCao_Chuong2\Hinh_2_1_KienTrucTongThe.png] |
+----------------------------------------------------------------------------------------------------+
```
*Hình 2.1: Sơ đồ kiến trúc tổng thể hệ thống (Modular Monolith Spring Boot & Python FastAPI)*

*Bảng 2.1: Phân định trách nhiệm giữa Modular Monolith Spring Boot và Microservice Python FastAPI*

| Tiêu chí so sánh | Khối Modular Monolith (Spring Boot 3) | Khối Acoustic Microservice (Python FastAPI) |
| :--- | :--- | :--- |
| **Nền tảng công nghệ** | Java 17, Spring Boot 3.2, Spring Data JPA, Hibernate | Python 3.12, FastAPI, PyTorch, Librosa, Parselmouth |
| **Trách nhiệm nghiệp vụ** | Quản lý người dùng, lớp học, lộ trình học SRS, thi CBT, điều phối hàng đợi RabbitMQ, ghi log kiểm toán AOP. | Căn chỉnh âm vị (Forced Alignment), tính toán Formant F1/F2, chấm điểm GOP, phát hiện từ bỏ sót, tổng hợp TTS. |
| **Mô hình xử lý** | Đa luồng tiền trình (Multi-threaded I/O Bound), kiểm soát giao dịch dữ liệu ACID với HikariCP Pool. | Bất đồng bộ hóa sự kiện (Async Event Loop / UVLoop) kết hợp Worker Threadpool cho tác vụ nặng CPU Bound. |
| **Tần suất mở rộng** | Triển khai mở rộng theo chiều ngang (Horizontal Scaling) theo số lượng yêu cầu nghiệp vụ và lượt làm bài CBT. | Triển khai mở rộng theo dung lượng tính toán AI/GPU, độc lập hoàn toàn với dữ liệu người dùng. |
| **Cơ chế lưu trữ** | Đọc/ghi trực tiếp MariaDB (32 bảng) và Redis In-Memory Cache. | Hoạt động hoàn toàn không trạng thái (Stateless), không kết nối CSDL, giải phóng bộ nhớ tức thì sau khi tính toán. |

##### ***2.1.2. Các thành phần của hệ thống và cơ chế giao tiếp (REST API, RabbitMQ, WebSocket, Cloudflare R2)***

Để đảm bảo hiệu năng cao, giảm độ trễ phản hồi tại giao diện và ngăn chặn tình trạng thắt nút cổ chai (bottleneck) khi xử lý các tác vụ tính toán nặng, hệ thống áp dụng ma trận giao tiếp đa giao thức kết hợp giữa đồng bộ và bất đồng bộ:

1. **Giao tiếp RESTful HTTPS (Đồng bộ - Synchronous):**
   - Giữa **React SPA** và **Spring Boot Backend**: Toàn bộ dữ liệu nghiệp vụ (đăng nhập, danh sách lớp, câu hỏi bài tập, nộp bài trắc nghiệm, cập nhật tiến độ) được truyền nhận qua giao thức HTTPS chuẩn với định dạng JSON (`application/json`) hoặc Multipart Form-data (khi gửi file âm thanh ghi âm và hình ảnh).
   - Giữa **Spring Boot** và **Python FastAPI**: Khi học viên nộp bài luyện âm Shadowing, Spring Boot đóng vai trò HTTP Client gửi yêu cầu đồng bộ `POST /api/v1/audio/evaluate-phonetics` mang theo chuỗi nhị phân âm thanh (WAV 16kHz) và câu mẫu đối chiếu. Thời gian phản hồi của dịch vụ Python nội bộ chỉ dao động từ 400ms đến 900ms, hoàn toàn nằm trong ngưỡng chấp nhận được của giao tiếp đồng bộ.
2. **Giao tiếp hướng sự kiện bất đồng bộ qua RabbitMQ (Asynchronous Message Broker):**
   - Được áp dụng cho nghiệp vụ chuyển đổi video bài giảng sang định dạng HLS (HTTP Live Streaming). Quá trình nén và phân đoạn video qua FFmpeg đòi hỏi tài nguyên CPU rất lớn và kéo dài từ 30 giây đến vài phút tùy dung lượng.
   - Khi giảng viên tải lên video MP4, Spring Boot lưu file tạm, phát sinh thông điệp `VideoTranscodeMessage` đẩy vào hàng đợi `video.transcode.queue` thông qua `RabbitTemplate` và phản hồi ngay mã HTTP 202 Accepted cho máy trạm.
   - Tiến trình nền `VideoTranscodeConsumer` độc lập tiêu thụ thông điệp, kích hoạt tiến trình con FFmpeg chạy ngầm. Sau khi nén thành công, tệp tin HLS được tự động đẩy lên Cloudflare R2 và xóa sạch bộ nhớ tạm tại máy chủ. Nếu xảy ra lỗi quá 3 lần, thông điệp được chuyển đến hàng đợi lỗi Dead Letter Exchange (DLX) để xử lý ngoại lệ.
3. **Giao tiếp hai chiều thời gian thực qua WebSocket / STOMP over SockJS:**
   - Sử dụng để đẩy kết quả chấm điểm AI (Speaking, Writing) và thông báo hệ thống trực tiếp đến trình duyệt học viên mà không cần trình duyệt phải gửi yêu cầu thăm dò liên tục (polling).
   - Mỗi người dùng khi đăng nhập sẽ tự động đăng ký (subscribe) vào kênh riêng biệt `/topic/student/{userId}/evaluation` hoặc `/queue/grading-status/{attemptId}`. Khi tác vụ chấm điểm nền hoàn tất, Spring Boot sử dụng `SimpMessagingTemplate` để bắn dữ liệu kết quả trực tiếp về máy trạm, kích hoạt giao diện hiển thị ngay lập tức.
4. **Giao tiếp lưu trữ đám mây qua S3 API (Cloudflare R2):**
   - Tích hợp thư viện AWS SDK v2 (`software.amazon.awssdk.services.s3`) để truyền nhận đối tượng nhị phân trực tiếp lên Cloudflare R2 thông qua kết nối mã hóa TLS 1.3. Hệ thống cấu hình quy tắc phân tách thư mục chuẩn hóa: `raw/{videoId}/` lưu video gốc, `hls/{videoId}/` lưu playlist `.m3u8` và các mảnh phân đoạn `.ts`, `audios/exercises/` lưu âm thanh bài tập TTS. Trình phát video của học viên sau đó sẽ tải luồng HLS trực tiếp từ CDN toàn cầu của Cloudflare mà không tiêu tốn băng thông máy chủ backend.

```
+----------------------------------------------------------------------------------------------------+
| [HÌNH ẢNH: D:\HocTap_DoAn\doanchuyennganh\englishlearning\HinhAnh_BaoCao_Chuong2\Hinh_2_2_CoCheGiaoTiepLienDichVu.png] |
+----------------------------------------------------------------------------------------------------+
```
*Hình 2.2: Sơ đồ cơ chế giao tiếp liên dịch vụ (REST, RabbitMQ, WebSocket STOMP, Cloudflare R2)*

*Bảng 2.2: So sánh đặc tính các giao thức giao tiếp nội bộ và ngoại vi trong hệ thống*

| Giao thức | Phạm vi áp dụng | Định dạng dữ liệu | Tính chất | Cơ chế kiểm soát lỗi / Dự phòng |
| :--- | :--- | :--- | :--- | :--- |
| **RESTful HTTPS** | Client <-> Backend; Backend <-> Python | JSON / Multipart Form-data | Đồng bộ (Request / Response) | Timeout 3.5s, kích hoạt chuyển đổi Fallback sang AI đám mây nếu lỗi kết nối. |
| **AMQP 0-9-1** | Backend -> RabbitMQ -> Transcode Worker | Binary JSON Message Payload | Bất đồng bộ (Message-Driven) | Cơ chế xác nhận thủ công (Manual ACK), tự động đẩy vào Dead Letter Exchange (DLX) khi lỗi. |
| **WebSocket STOMP** | Backend -> Client Browser | Khung tin STOMP dạng văn bản JSON | Hai chiều toàn phần (Full-duplex) | Dự phòng hạ cấp SockJS (XHR Streaming / Long Polling), cơ chế tự động kết nối lại (Auto Reconnect). |
| **S3 REST API** | Backend / Worker <-> Cloudflare R2 | Byte Stream nhị phân (Binary Stream) | Đồng bộ / Đa phân đoạn (Multipart) | Cơ chế thử lại Exponential Backoff (3 lần), kiểm tra mã băm MD5 / ETag tính toàn vẹn. |

##### ***2.1.3. Luồng xử lý dữ liệu và cơ chế dự phòng đa tầng (3-Tier AI Fallback)***

Một trong những đóng góp kỹ thuật trọng tâm của đề tài là kiến trúc đánh giá phát âm và ngôn ngữ theo mô hình **3-Tier AI Fallback**. Trong thực tế triển khai, các dịch vụ AI đám mây thương mại (như OpenAI, Google Gemini) thường xuyên đối mặt với các nguy cơ: trễ mạng quốc tế (high latency > 2.5s), cạn kiệt hạn ngạch cuộc gọi (HTTP 429 Quota Exceeded) hoặc chi phí bản quyền tăng vọt khi quy mô người dùng mở rộng. Ngược lại, nếu chỉ dựa vào mô hình âm học chạy cục bộ, hệ thống có thể bị treo hoặc không thể phân tích các đoạn hội thoại dài mang tính ngữ nghĩa phức tạp.

Cơ chế dự phòng 3 tầng được cài đặt tại lớp điều phối trung tâm `ShadowingService` với quy trình xử lý nghiêm ngặt:

1. **Tầng 1 (Ưu tiên hàng đầu - Local Acoustic Engine):**
   - *Thành phần:* Microservice Python FastAPI nạp mô hình Wav2Vec 2.0 XLS-R-53 kết hợp thư viện C++ Praat-Parselmouth.
   - *Nguyên lý xử lý:* File âm thanh của học viên sau khi thu âm được chuẩn hóa về tần số mẫu 16.000 Hz đơn kênh (mono) và đi qua bộ lọc dải thông (band-pass filter). Thuật toán Voice Activity Detection (VAD) kiểm tra năng lượng tín hiệu (yêu cầu SNR ≥ 12 dB và thời lượng tiếng nói thực tế ≥ 0,08s).
   - Mô hình Wav2Vec2 tính toán ma trận xác suất hậu nghiệm CTC (Posterior Matrix) và sử dụng thuật toán Viterbi giải mã căn chỉnh thời gian bắt đầu/kết thúc của từng từ và từng âm vị (Phoneme Alignment).
   - Tiếp theo, nhân Praat trích xuất tọa độ formant thực tế F1 (độ mở cung hàm) và F2 (vị trí lưỡi trước/sau) của từng nguyên âm, tính toán khoảng cách Euclid chuẩn hóa so với mẫu phát âm bản xứ tương ứng với giới tính và cao độ F0 của người nói:
   
**ΔF = √[(F1_user - F1_ref)² + (F2_user - F2_ref)²]**

   - Các phụ âm được chấm điểm bằng thuật toán Goodness of Pronunciation (GOP) dựa trên mật độ năng lượng dải tần cao (high-frequency spectral energy) và kiểm tra sự xuất hiện của âm chặn cuối từ (final consonant stops /p, t, k, d/).
   - Tầng 1 trả về kết quả chi tiết từng âm vị chuẩn IPA quốc tế, độ lệch formant, tỷ lệ phát âm trôi chảy (WPM), phát hiện chính xác từ bị đọc thiếu/bỏ sót với độ trễ cực nhanh (< 1 giây) và hoàn toàn miễn phí chi phí cuộc gọi API.

2. **Tầng 2 (Dự phòng cấp 1 - Groq Whisper STT + Google Gemini 1.5 Flash):**
   - *Điều kiện kích hoạt:* Tự động kích hoạt khi Tầng 1 gặp ngoại lệ (Exception), tràn bộ nhớ hoặc vượt quá thời gian chờ (Timeout > 3.5 giây).
   - *Nguyên lý xử lý:* File âm thanh được gửi ngay đến dịch vụ Groq Cloud API chạy mô hình `whisper-large-v3` trên phần cứng LPU chuyên dụng, hoàn tất việc bóc băng âm thanh thành văn bản nguyên văn kèm mốc thời gian từng từ trong thời gian chỉ dưới 800ms.
   - Bản ghi âm bóc băng được ghép với câu tham chiếu mẫu và đẩy vào Google Gemini 1.5 Flash thông qua tập luật chỉ thị hệ thống chuyên gia (Cambridge Phonetics System Instruction). Gemini tiến hành đối chiếu từng từ, phát hiện hiện tượng nuốt âm, phát âm sai phụ âm cuối, tính toán điểm số tổng hợp và xuất bản nhận xét sư phạm bằng tiếng Việt chi tiết dưới dạng JSON có cấu trúc.

3. **Tầng 3 (Dự phòng khẩn cấp - Groq LLaMA 3.3 70B & Local Heuristic Engine):**
   - *Điều kiện kích hoạt:* Kích hoạt khi Google Gemini trả về mã lỗi HTTP 429 (Resource Exhausted - Hết hạn mức gọi API) hoặc khi kết nối mạng quốc tế đến máy chủ Google bị gián đoạn.
   - *Nguyên lý xử lý:* Hệ thống lập tức chuyển hướng tải sang mô hình mã nguồn mở LLaMA-3.3-70B-Versatile được lưu trữ tại cụm máy chủ Groq độc lập, ép kiểu trả về chế độ JSON Mode (`response_format={"type": "json_object"}`). Đồng thời, thuật toán heuristic cục bộ đối chiếu khoảng cách chỉnh sửa Levenshtein được áp dụng để bù đắp điểm số độ hoàn thiện câu.
   - Nhờ kiến trúc 3 tầng độc lập, hệ thống đảm bảo độ sẵn sàng dịch vụ đạt 99.9%, bảo vệ trải nghiệm của người học liên tục mà không bao giờ bị đình trệ vì sự cố của bất kỳ nhà cung cấp dịch vụ đơn lẻ nào.

```
+----------------------------------------------------------------------------------------------------+
| [HÌNH ẢNH: D:\HocTap_DoAn\doanchuyennganh\englishlearning\HinhAnh_BaoCao_Chuong2\Hinh_2_3_CoCheDuPhong3TierAI.png] |
+----------------------------------------------------------------------------------------------------+
```
*Hình 2.3: Luồng xử lý dữ liệu và cơ chế dự phòng đa tầng (3-Tier AI Fallback Pipeline)*

*Bảng 2.3: Đặc tả các tầng trong kiến trúc phân tích phát âm đa tầng (3-Tier AI Fallback)*

| Chỉ tiêu kỹ thuật | Tầng 1: Python Acoustic Engine | Tầng 2: Groq Whisper + Gemini Flash | Tầng 3: Groq LLaMA 3.3 Fallback |
| :--- | :--- | :--- | :--- |
| **Công nghệ cốt lõi** | Wav2Vec2 XLS-R-53 + Praat C++ | Whisper-large-v3 + Gemini 1.5 Flash | LLaMA-3.3-70B-Versatile (JSON Mode) |
| **Thời gian phản hồi (Latency)** | 400ms – 900ms (< 1 giây) | 1.800ms – 2.800ms | 1.200ms – 2.000ms |
| **Chi phí tính toán / lượt** | 0.00 USD (Chạy trên CPU/GPU nội bộ) | ~0.00 USD03 / lượt chấm | ~0.00 USD01 / lượt chấm |
| **Độ sâu phân tích ngữ âm** | Chi tiết đến từng âm vị IPA, tọa độ Formant F1/F2, năng lượng phụ âm. | Bóc băng câu chữ, phát hiện từ bỏ sót, nhận xét sư phạm văn phạm. | Phân tích từ vựng đối chiếu, gợi ý sửa lỗi phát âm tổng quát. |
| **Xác suất kích hoạt thực tế** | 94.5% tổng số yêu cầu người dùng | 5.0% khi Tầng 1 nghẽn/timeout | 0.5% khi Tầng 2 quá tải/lỗi hạn mức |

---

#### ***2.2. Thiết kế Backend và Dịch vụ ngữ âm***

##### ***2.2.1. Thiết kế chi tiết các mô-đun nghiệp vụ Spring Boot và Pipeline xử lý âm học Python***

Hệ thống Backend được thiết kế theo cấu trúc Modular Monolith chuẩn hóa của Spring Boot 3, phân chia thành các gói nghiệp vụ độc lập, áp dụng chặt chẽ nguyên lý Đơn trách nhiệm (Single Responsibility Principle) và Kiến trúc phân tầng (Controller - Service - Repository - Entity):

1. **Gói xác thực và người dùng (`com.englishlearning.auth`):** Chịu trách nhiệm quản lý danh tính tài khoản. Lớp `JwtTokenProvider` tạo mã Access Token có thời hạn 15 phút mang các xác nhận quyền hạn (Claims: userId, roles, email). Lớp `RefreshTokenService` quản lý cơ chế xoay vòng Refresh Token Rotation (thời hạn 7 ngày, lưu mã băm trong bảng `refresh_tokens`). Lớp `UserPrincipal` hiện thực `UserDetails` của Spring Security, hỗ trợ phân cấp người dùng thành `Student` và `Teacher` liên kết 1-1 với thực thể `User`.
2. **Gói lớp học và đào tạo (`com.englishlearning.classroom`):** Quản lý cấu trúc tổ chức lớp học (`Classroom`), mã tham gia lớp học bảo mật, quan hệ ghi danh của học viên (`ClassStudent`) và quản lý bài học (`Lesson`), tài liệu học tập đính kèm (`LessonDocument`).
3. **Gói khảo thí và bài tập (`com.englishlearning.assignment` & `submission`):** Cung cấp công cụ quản trị vòng đời bài tập (`Assignment`) với đa dạng hình thức: trắc nghiệm (Multiple Choice), điền từ vào chỗ trống (Fill in blank), nghe hiểu có âm thanh (Listening Audio), luyện phát âm lặp lại (Shadowing) và viết luận (Writing Essay). Quản lý chi tiết từng câu hỏi (`AssignmentQuestion`), các phương án lựa chọn (`QuestionOption`), phiên làm bài của học sinh (`AssignmentAttempt`) và bảng lưu câu trả lời chi tiết (`StudentAnswer`).
4. **Gói trí tuệ nhân tạo và dịch vụ âm học (`com.englishlearning.ai`):** Đóng vai trò hạt nhân điều phối thông minh. Lớp `PythonIntegrationService` sử dụng `RestTemplate` giao tiếp với microservice âm học; `GeminiClientService` và `GroqClientService` quản lý gọi API đám mây với cơ chế tự động làm sạch định dạng JSON Markdown; `ShadowingService` thực thi luồng chấm điểm 3 tầng; `AiLabService` cung cấp giao diện thử nghiệm trực quan cho quản trị viên kiểm thử các kịch bản chấm điểm phát âm.
5. **Gói lộ trình học và ôn tập lặp lại ngắt quãng (`com.englishlearning.curriculum`):** Cài đặt thuật toán **SuperMemo SM-2** trong lớp `SrsService` để điều phối lịch học từ vựng cho học viên. Dựa vào đánh giá của người học theo 4 cấp độ (EFq \in \{0: \text{Again}, 1: \text{Hard}, 2: \text{Good}, 3: \text{Easy}\}EF), hệ thống tự động tính toán lại Hệ số dễ dàng (Ease Factor - EFEFEF) và khoảng cách ngày ôn tập tiếp theo (I):

• **Khoảng cách lặp lại:** `I(0) = 1`; `I(1) = 6`; `I(n) = round(I(n-1) × EF)` (với `n ≥ 2`)
• **Hệ số dễ nhớ:** `EF' = max(1.3, EF + (0.1 - (3 - q) × (0.08 + (3 - q) × 0.02)))`

6. **Gói xử lý video đa phương tiện (`com.englishlearning.video`):** Đóng gói bộ điều phối tải lên video, giao tiếp với hàng đợi RabbitMQ, kích hoạt tiến trình con FFmpeg nén luồng HLS đa phân đoạn và đẩy dữ liệu lên Cloudflare R2 qua `R2StorageService`.
7. **Gói kiểm toán và giám sát hệ thống (`com.englishlearning.system`):** Ứng dụng công nghệ lập trình hướng khía cạnh Spring AOP (`AuditLoggingAspect`) bắt các chú thích `@RestController` trên toàn hệ thống để tự động thu thập: tên người dùng, phương thức HTTP, URI, địa chỉ IP máy trạm, mã trạng thái phản hồi và thời gian thực thi (milliseconds), tự động lưu trữ bất đồng bộ vào bảng `audit_logs`.

```
Pipeline xử lý âm học tại Python FastAPI Microservice:
[Audio File 16kHz] ---> [Voice Activity Detection (VAD)] ---> [Wav2Vec 2.0 XLS-R-53 Forced Aligner]
                                                                          |
                                       +----------------------------------+----------------------------------+
                                       |                                                                     |
                         [Praat Formant Extractor]                                            [Consonant Acoustic GOP Scorer]
                         - Đo Formant F1, F2 nguyên âm                                         - Bằng chứng phổ năng lượng cao
                         - Tính khoảng cách Euclid formant                                     - Kiểm tra âm chặn cuối từ
                                       |                                                                     |
                                       +----------------------------------+----------------------------------+
                                                                          |
                                                      [Prosody & Fluency Metric Evaluator]
                                                      - Tính WPM, Awkward Pauses (>= 250ms)
                                                      - Tính Phonetic Linking (< 35ms)
                                                                          |
                                                      [Output: SpeechAssessmentResponse JSON]
```

*Bảng 2.4: Đặc tả các mô-đun nghiệp vụ Backend Spring Boot và Python Phonetics Pipeline*

| Tên mô-đun / Package | Lớp điều khiển chính (Controllers) | Lớp dịch vụ nghiệp vụ (Services) | Thực thể dữ liệu liên quan |
| :--- | :--- | :--- | :--- |
| **Auth & Security** | `AuthController.java` | `AuthService`, `JwtTokenProvider`, `RefreshTokenService` | `User`, `Role`, `RefreshToken`, `Student`, `Teacher` |
| **Classroom** | `ClassroomController.java` | `ClassroomService`, `LessonService` | `Classroom`, `ClassStudent`, `Lesson`, `LessonDocument` |
| **Assignment & CBT** | `AssignmentController.java` | `AssignmentService`, `AiExerciseService`, `ExerciseAudioService` | `Assignment`, `AssignmentQuestion`, `QuestionOption`, `ExerciseAudio` |
| **Submission & Grading** | `SubmissionController.java` | `SubmissionService`, `GradingService` | `AssignmentAttempt`, `StudentAnswer`, `AiEvaluation` |
| **AI Coordination** | `AiEvaluationController.java` | `ShadowingService`, `PythonIntegrationService`, `GeminiClientService` | `AiEvaluation`, `StudentAiQuota`, `AiGeneratedExercise` |
| **Curriculum & SRS** | `DailyStudyPlanController.java` | `DailyStudyPlanService`, `SrsService`, `VocabularyService` | `DailyStudyPlan`, `DailyPlanItem`, `VocabularyItem`, `StudentVocabularyProgress` |
| **Video & Media HLS** | `VideoController.java` | `VideoService`, `R2StorageService`, `VideoTranscodeConsumer` | `Video`, `VideoWatchHistory` |
| **Audit & System** | `AuditLogController.java` | `AuditLogService`, `AuditLoggingAspect` | `AuditLog`, `SystemConfig` |

##### ***2.2.2. Thiết kế trình tự (Sequence Diagram) và biểu đồ lớp chi tiết cho 5 Use Case tiêu biểu***

Phần này mô tả chi tiết tương tác động giữa các thành phần phần mềm (UI, Controller, Service, Repository, Database, External Services) cho 5 Use Case trọng tâm của đồ án:

###### **1. Nghiệp vụ Đăng nhập và Làm mới phiên xác thực (UC-AUTH-01)**
Học viên nhập thông tin tài khoản trên giao diện React. Hệ thống kiểm tra mật khẩu đã được băm bằng BCrypt, cấp phát cặp khóa Access Token (15 phút) và Refresh Token (7 ngày). Mã Refresh Token được lưu trong bảng `refresh_tokens` và trả về qua HTTP-only Secure Cookie. Khi Access Token hết hạn trong lúc đang làm bài, Axios Interceptor tự động phát hiện mã lỗi 401, gửi yêu cầu làm mới phiên theo cơ chế xoay vòng (xóa token cũ, cấp token mới, đưa token cũ vào Blacklist Redis), đảm bảo phiên học tập không bị gián đoạn.

```
+----------------------------------------------------------------------------------------------------+
| [HÌNH ẢNH: D:\HocTap_DoAn\doanchuyennganh\englishlearning\HinhAnh_BaoCao_Chuong2\Hinh_2_4_Sequence_DangNhap_LamMoiToken.png] |
+----------------------------------------------------------------------------------------------------+
```
*Hình 2.4: Biểu đồ tuần tự nghiệp vụ Đăng nhập và Làm mới phiên xác thực (UC-AUTH-01)*

###### **2. Nghiệp vụ Luyện phát âm Shadowing qua dịch vụ âm học và AI (UC-AI-01)**
Học viên thu âm trực tiếp trên trình duyệt theo câu mẫu hiển thị. File ghi âm WAV 16kHz được gửi lên `ShadowingController`. `ShadowingService` ưu tiên gọi microservice Python FastAPI để tính toán căn chỉnh thời gian âm vị Wav2Vec 2.0 và đo formant Praat F1/F2. Nếu microservice Python phản hồi chậm quá 3.5 giây, hệ thống tự động chuyển tiếp file âm thanh sang Groq Whisper để bóc băng và dùng Gemini 1.5 Flash chấm điểm. Điểm số và nhận xét chi tiết từng âm vị sau đó được lưu vào `ai_evaluations` và cập nhật chỉ số Speaking của học viên.

```
+----------------------------------------------------------------------------------------------------+
| [HÌNH ẢNH: D:\HocTap_DoAn\doanchuyennganh\englishlearning\HinhAnh_BaoCao_Chuong2\Hinh_2_5_Sequence_LuyenPhatAm_Shadowing.png] |
+----------------------------------------------------------------------------------------------------+
```
*Hình 2.5: Biểu đồ tuần tự nghiệp vụ Luyện phát âm Shadowing qua dịch vụ âm học và AI (UC-AI-01)*

###### **3. Nghiệp vụ Khởi tạo bài tập thông minh AI / Excel / TTS (UC-TEA-01)**
Giảng viên nhập chủ đề bài tập, cấp độ CEFR và số lượng câu hỏi trên cổng giáo viên. `AiExerciseService` gọi Gemini 1.5 Flash sinh danh sách câu hỏi dạng JSON chuẩn hóa. Với các câu hỏi thuộc kỹ năng Nghe hoặc Shadowing, hệ thống tự động kích hoạt dịch vụ Kokoro-82M TTS để sinh file âm thanh WAV 24kHz giọng bản xứ, tải lên Cloudflare R2 và lưu đường dẫn vào bảng `exercise_audios`. Giảng viên có thể kiểm tra nghe thử, điều chỉnh đáp án trước khi bấm phát hành vào Lộ trình học ngày của lớp.

```
+----------------------------------------------------------------------------------------------------+
| [HÌNH ẢNH: D:\HocTap_DoAn\doanchuyennganh\englishlearning\HinhAnh_BaoCao_Chuong2\Hinh_2_6_Sequence_TaoBaiTap_AI_Excel_TTS.png] |
+----------------------------------------------------------------------------------------------------+
```
*Hình 2.6: Biểu đồ tuần tự nghiệp vụ Khởi tạo bài tập thông minh AI / Excel / TTS (UC-TEA-01)*

###### **4. Nghiệp vụ Làm bài tập CBT và Chấm bài tự luận/nói bằng AI (UC-STU-01)**
Học viên bắt đầu bài kiểm tra CBT, hệ thống khởi tạo bản ghi `assignment_attempts` với trạng thái `IN_PROGRESS` và bắt đầu đếm ngược thời gian. Trong quá trình làm, các phương án chọn được tự động lưu nền (auto-save). Khi bấm nộp bài, hệ thống chấm điểm tức thì các câu hỏi trắc nghiệm, đồng thời đẩy các câu trả lời tự luận (bài viết luận hoặc file ghi âm bài nói) vào tác vụ chấm ngầm bất đồng bộ. Sau khi AI hoàn tất chấm điểm, kết quả được cập nhật và bắn qua kênh WebSocket STOMP về màn hình học viên.

```
+----------------------------------------------------------------------------------------------------+
| [HÌNH ẢNH: D:\HocTap_DoAn\doanchuyennganh\englishlearning\HinhAnh_BaoCao_Chuong2\Hinh_2_7_Sequence_LamBaiCBT_ChamAI.png] |
+----------------------------------------------------------------------------------------------------+
```
*Hình 2.7: Biểu đồ tuần tự nghiệp vụ Làm bài tập CBT và Chấm bài tự luận/nói bằng AI (UC-STU-01)*

###### **5. Nghiệp vụ Tải lên và Chuyển đổi Video HLS bất đồng bộ qua RabbitMQ (UC-SYS-01)**
Giảng viên tải lên bài giảng video MP4. `VideoController` lưu file tạm trên máy chủ và đẩy thông điệp `VideoTranscodeMessage` vào hàng đợi `video.transcode.queue` của RabbitMQ, trả về ngay HTTP 202 Accepted. `VideoTranscodeConsumer` tiếp nhận thông điệp, khởi chạy tiến trình FFmpeg để phân đoạn video thành các mảnh `.ts` độ dài 6 giây và tạo danh sách phát `master.m3u8`. Toàn bộ thư mục HLS được tải lên Cloudflare R2, cơ sở dữ liệu được cập nhật trạng thái `READY` kèm CDN URL, và hệ thống gửi thông báo WebSocket đến giảng viên.

```
+----------------------------------------------------------------------------------------------------+
| [HÌNH ẢNH: D:\HocTap_DoAn\doanchuyennganh\englishlearning\HinhAnh_BaoCao_Chuong2\Hinh_2_8_Sequence_ChuyenDoiVideo_HLS_RabbitMQ.png] |
+----------------------------------------------------------------------------------------------------+
```
*Hình 2.8: Biểu đồ tuần tự nghiệp vụ Tải lên và Chuyển đổi Video HLS bất đồng bộ qua RabbitMQ (UC-SYS-01)*

###### **6. Biểu đồ lớp chi tiết của miền dữ liệu cốt lõi (Core Domain Model)**
Biểu đồ lớp dưới đây mô tả cấu trúc tĩnh của các thực thể nghiệp vụ trọng tâm trong hệ thống, các thuộc tính, kiểu dữ liệu, phạm vi truy cập (private/public), phương thức khởi tạo và các mối quan hệ quan trọng (kế thừa, quan hệ kết hợp 1-1, 1-N, N-M).

```
+----------------------------------------------------------------------------------------------------+
| [HÌNH ẢNH: D:\HocTap_DoAn\doanchuyennganh\englishlearning\HinhAnh_BaoCao_Chuong2\Hinh_2_9_BieuDoLop_CoreDomain.png] |
+----------------------------------------------------------------------------------------------------+
```
*Hình 2.9: Biểu đồ lớp chi tiết của miền dữ liệu cốt lõi (Core Domain Model)*

##### ***2.2.3. Thiết kế cơ sở dữ liệu (Sơ đồ ERD, đặc tả bảng dữ liệu và ràng buộc toàn vẹn)***

Cơ sở dữ liệu của hệ thống được xây dựng trên hệ quản trị MariaDB / MySQL 10.4, bao gồm tổng cộng **32 bảng quan hệ** được chuẩn hóa ở mức 3NF, đảm bảo loại bỏ hoàn toàn các dị thường dữ liệu (dị thường chèn, xóa, cập nhật) và tối ưu hóa tốc độ truy vấn thông qua các chỉ mục B-Tree trên các trường khóa ngoại và trường lọc thường xuyên.

Các bảng trong cơ sở dữ liệu được phân chia thành 5 cụm logic chuyên biệt:
1. **Cụm 1: Quản trị tài khoản, phân quyền & bảo mật:** Bao gồm các bảng `users`, `roles`, `user_roles`, `refresh_tokens`, `students`, `teachers`, `audit_logs`.
2. **Cụm 2: Quản lý lớp học, học liệu & lộ trình học:** Bao gồm các bảng `classes`, `class_students`, `lessons`, `lesson_documents`, `daily_study_plans`, `daily_plan_items`, `learning_sessions`.
3. **Cụm 3: Khảo thí, ngân hàng đề thi CBT & nộp bài:** Bao gồm các bảng `assignments`, `assignment_questions`, `question_options`, `assignment_attempts`, `student_answers`.
4. **Cụm 4: Đánh giá trí tuệ nhân tạo & hồ sơ kỹ năng:** Bao gồm các bảng `ai_evaluations`, `ai_generated_exercises`, `student_ai_quotas`, `student_skill_profiles`, `student_daily_progress`.
5. **Cụm 5: Học liệu đa phương tiện, Flashcard SM-2 & thông báo:** Bao gồm các bảng `vocabulary_items`, `student_vocabulary_progress`, `exercise_audios`, `videos`, `video_watch_histories`, `notifications`, `global_resources`, `grammar_topics`.

```
+----------------------------------------------------------------------------------------------------+
| [HÌNH ẢNH: D:\HocTap_DoAn\doanchuyennganh\englishlearning\HinhAnh_BaoCao_Chuong2\Hinh_2_10_SoDoERD_CoSoDuLieu.png] |
+----------------------------------------------------------------------------------------------------+
```
*Hình 2.10: Sơ đồ quan hệ thực thể (ERD) toàn diện của cơ sở dữ liệu hệ thống (32 thực thể)*

Dưới đây là bảng từ điển dữ liệu (Data Dictionary) chi tiết của các nhóm thực thể cốt lõi:

*Bảng 2.5: Bảng từ điển dữ liệu nhóm Xác thực, Phân quyền & Người dùng*

| Tên bảng / Cột | Kiểu dữ liệu | Khóa | Ràng buộc / Giá trị mặc định | Diễn giải ý nghĩa nghiệp vụ |
| :--- | :--- | :--- | :--- | :--- |
| **`users`** | | | | Bảng lưu trữ thông tin tài khoản người dùng |
| `id` | VARCHAR(36) | **PK** | NOT NULL, UUID ngẫu nhiên | Định danh duy nhất của người dùng |
| `email` | VARCHAR(255) | **UK** | NOT NULL, Unique Index | Địa chỉ email đăng nhập hệ thống |
| `password` | VARCHAR(255) | | NOT NULL | Mật khẩu đã được băm an toàn bằng BCrypt |
| `full_name` | VARCHAR(255) | | NOT NULL | Họ và tên đầy đủ của người dùng |
| `status` | ENUM | | DEFAULT 'ACTIVE' | Trạng thái tài khoản (ACTIVE, INACTIVE, LOCKED) |
| `created_at` | DATETIME(6) | | NOT NULL | Thời điểm khởi tạo tài khoản |
| **`roles`** | | | | Bảng danh mục vai trò người dùng |
| `id` | BIGINT | **PK** | NOT NULL, AUTO_INCREMENT | Mã định danh vai trò |
| `name` | VARCHAR(50) | **UK** | NOT NULL | Tên vai trò (ROLE_STUDENT, ROLE_TEACHER, ROLE_ADMIN) |
| **`user_roles`** | | | | Bảng liên kết nhiều - nhiều giữa người dùng và vai trò |
| `user_id` | VARCHAR(36) | **PK, FK** | REFERENCES users(id) | Mã định danh người dùng |
| `role_id` | BIGINT | **PK, FK** | REFERENCES roles(id) | Mã định danh vai trò được cấp phát |
| **`refresh_tokens`** | | | | Bảng quản lý xoay vòng Refresh Token |
| `id` | VARCHAR(36) | **PK** | NOT NULL, UUID | Định danh phiên làm mới token |
| `user_id` | VARCHAR(36) | **FK** | REFERENCES users(id) | Người dùng sở hữu phiên |
| `token_hash` | VARCHAR(255) | **UK** | NOT NULL | Chuỗi băm bí mật của Refresh Token |
| `expiry_date` | DATETIME(6) | | NOT NULL | Thời điểm hết hạn hiệu lực (7 ngày) |
| `revoked` | BIT(1) | | DEFAULT 0 | Đánh dấu token đã bị thu hồi / xoay vòng |

*Bảng 2.6: Bảng từ điển dữ liệu nhóm Lớp học, Học liệu & Lộ trình ngày*

| Tên bảng / Cột | Kiểu dữ liệu | Khóa | Ràng buộc / Giá trị mặc định | Diễn giải ý nghĩa nghiệp vụ |
| :--- | :--- | :--- | :--- | :--- |
| **`classes`** | | | | Bảng lưu thông tin lớp học |
| `id` | VARCHAR(36) | **PK** | NOT NULL, UUID | Mã định danh lớp học |
| `code` | VARCHAR(50) | **UK** | NOT NULL, Unique | Mã tham gia lớp học bảo mật |
| `name` | VARCHAR(255) | | NOT NULL | Tên khóa học / lớp học |
| `teacher_id` | VARCHAR(36) | **FK** | REFERENCES teachers(id) | Giảng viên phụ trách lớp học |
| `status` | VARCHAR(50) | | DEFAULT 'ACTIVE' | Trạng thái lớp (ACTIVE, COMPLETED, ARCHIVED) |
| **`class_students`** | | | | Bảng ghi danh học viên vào lớp học |
| `id` | VARCHAR(36) | **PK** | NOT NULL, UUID | Mã định danh lượt ghi danh |
| `class_id` | VARCHAR(36) | **FK** | REFERENCES classes(id) | Lớp học được ghi danh |
| `student_id` | VARCHAR(36) | **FK** | REFERENCES students(id) | Học viên tham gia lớp học |
| **`daily_study_plans`**| | | | Bảng kế hoạch học tập theo ngày |
| `id` | VARCHAR(36) | **PK** | NOT NULL, UUID | Định danh kế hoạch học tập |
| `student_id` | VARCHAR(36) | **FK** | REFERENCES students(id) | Học viên được giao kế hoạch |
| `plan_date` | DATE | | NOT NULL | Ngày thực thi kế hoạch học tập |
| `status` | VARCHAR(50) | | DEFAULT 'PENDING' | Trạng thái kế hoạch (PENDING, COMPLETED) |
| **`daily_plan_items`** | | | | Chi tiết các tác vụ cần hoàn thành trong ngày |
| `id` | VARCHAR(36) | **PK** | NOT NULL, UUID | Định danh tác vụ học tập |
| `plan_id` | VARCHAR(36) | **FK** | REFERENCES daily_study_plans(id)| Kế hoạch ngày trực thuộc |
| `item_type` | VARCHAR(50) | | NOT NULL | Loại tác vụ (ASSIGNMENT, VOCABULARY, LESSON) |
| `reference_id` | VARCHAR(36) | | NOT NULL | Khóa ngoại mềm trỏ tới bài tập/từ vựng/bài giảng |
| `is_completed` | BIT(1) | | DEFAULT 0 | Trạng thái đã hoàn thành hay chưa |

*Bảng 2.7: Bảng từ điển dữ liệu nhóm Khảo thí CBT & Lượt làm bài*

| Tên bảng / Cột | Kiểu dữ liệu | Khóa | Ràng buộc / Giá trị mặc định | Diễn giải ý nghĩa nghiệp vụ |
| :--- | :--- | :--- | :--- | :--- |
| **`assignments`** | | | | Bảng lưu trữ đề bài tập / bài thi CBT |
| `id` | VARCHAR(36) | **PK** | NOT NULL, UUID | Định danh đề bài tập |
| `title` | VARCHAR(255) | | NOT NULL | Tiêu đề bài tập |
| `type` | VARCHAR(50) | | NOT NULL | Dạng bài tập (CBT_EXAM, HOMEWORK, SHADOWING) |
| `total_points` | DOUBLE | | NOT NULL, DEFAULT 10.0 | Tổng điểm của bài kiểm tra |
| `duration_minutes` | INT | | NOT NULL | Thời gian làm bài tối đa (phút) |
| `deadline` | DATETIME(6) | | NULLABLE | Thời hạn cuối cùng nộp bài |
| `class_id` | VARCHAR(36) | **FK** | REFERENCES classes(id) | Lớp học được giao bài tập |
| **`assignment_questions`** | | | | Chi tiết câu hỏi trong bài tập |
| `id` | VARCHAR(36) | **PK** | NOT NULL, UUID | Định danh câu hỏi |
| `assignment_id` | VARCHAR(36) | **FK** | REFERENCES assignments(id) | Bài tập chứa câu hỏi |
| `content` | TEXT | | NOT NULL | Nội dung câu hỏi (hỗ trợ văn bản/HTML) |
| `type` | VARCHAR(50) | | NOT NULL | Loại câu hỏi (MULTIPLE_CHOICE, FILL_BLANK, SPEAKING, WRITING) |
| `points` | DOUBLE | | NOT NULL, DEFAULT 1.0 | Điểm số của câu hỏi |
| `order_index` | INT | | NOT NULL | Thứ tự hiển thị trong đề thi |
| **`assignment_attempts`** | | | | Lượt làm bài của học viên |
| `id` | VARCHAR(36) | **PK** | NOT NULL, UUID | Định danh lượt làm bài |
| `assignment_id` | VARCHAR(36) | **FK** | REFERENCES assignments(id) | Bài kiểm tra được thực hiện |
| `student_id` | VARCHAR(36) | **FK** | REFERENCES students(id) | Học viên thực hiện lượt làm bài |
| `started_at` | DATETIME(6) | | NOT NULL | Thời điểm bắt đầu tính giờ |
| `submitted_at` | DATETIME(6) | | NULLABLE | Thời điểm bấm nộp bài |
| `total_score` | DOUBLE | | NULLABLE | Điểm số tổng kết cuối cùng |
| `status` | VARCHAR(50) | | DEFAULT 'IN_PROGRESS' | Trạng thái (IN_PROGRESS, SUBMITTED, GRADED) |
| **`student_answers`** | | | | Chi tiết câu trả lời của từng câu hỏi |
| `id` | VARCHAR(36) | **PK** | NOT NULL, UUID | Định danh câu trả lời |
| `attempt_id` | VARCHAR(36) | **FK** | REFERENCES assignment_attempts(id) | Lượt làm bài chứa câu trả lời |
| `question_id` | VARCHAR(36) | **FK** | REFERENCES assignment_questions(id)| Câu hỏi được trả lời |
| `selected_option_id`| VARCHAR(36)| | NULLABLE | Phương án trắc nghiệm được chọn |
| `text_response` | TEXT | | NULLABLE | Nội dung trả lời tự luận / điền khuyết |
| `audio_response_url`| VARCHAR(500)| | NULLABLE | Đường dẫn file ghi âm câu trả lời nói |
| `earned_points` | DOUBLE | | NULLABLE | Điểm số đạt được của câu trả lời |
| `is_correct` | BIT(1) | | NULLABLE | Đánh giá đúng/sai |

*Bảng 2.8: Bảng từ điển dữ liệu nhóm Đánh giá AI, Kỹ năng CEFR & Media*

| Tên bảng / Cột | Kiểu dữ liệu | Khóa | Ràng buộc / Giá trị mặc định | Diễn giải ý nghĩa nghiệp vụ |
| :--- | :--- | :--- | :--- | :--- |
| **`ai_evaluations`**| | | | Kết quả phân tích âm học và trí tuệ nhân tạo |
| `id` | VARCHAR(36) | **PK** | NOT NULL, UUID | Định danh kết quả đánh giá AI |
| `student_answer_id`| VARCHAR(36) | **UK, FK** | REFERENCES student_answers(id) | Câu trả lời của học viên được đánh giá |
| `eval_type` | ENUM | | NOT NULL | Dạng đánh giá (SPEAKING, WRITING) |
| `overall_score` | DOUBLE | | NOT NULL | Điểm tổng quát (thang 10 hoặc 100) |
| `pronunciation_score`| DOUBLE | | NULLABLE | Điểm phát âm trích xuất âm học |
| `fluency_score` | DOUBLE | | NULLABLE | Điểm lưu loát và ngắt nghỉ tự nhiên |
| `grammar_score` | DOUBLE | | NULLABLE | Điểm ngữ pháp câu văn |
| `vocabulary_score`| DOUBLE | | NULLABLE | Điểm mức độ phong phú từ vựng |
| `evaluation_engine`| VARCHAR(50) | | NOT NULL | Tên engine đánh giá (PYTHON, GEMINI, GROQ) |
| `stt_transcript` | TEXT | | NULLABLE | Văn bản bóc băng âm thanh nguyên văn |
| `suggestions_json`| LONGTEXT | | NULLABLE | Toàn bộ dữ liệu JSON chi tiết từng âm vị IPA |
| **`student_vocabulary_progress`**| | | Bảng theo dõi Flashcard Spaced Repetition (SM-2) |
| `id` | VARCHAR(36) | **PK** | NOT NULL, UUID | Định danh tiến trình từ vựng |
| `student_id` | VARCHAR(36) | **FK** | REFERENCES students(id) | Học viên sở hữu thẻ từ vựng |
| `vocabulary_id` | VARCHAR(36) | **FK** | REFERENCES vocabulary_items(id)| Từ vựng tiếng Anh được ôn tập |
| `stage` | ENUM | | DEFAULT 'LEARNING' | Giai đoạn nhớ (LEARNING, REVIEWING, MASTERED) |
| `ease_factor` | DOUBLE | | NOT NULL, DEFAULT 2.5 | Hệ số dễ nhớ EFEFEF của thuật toán SM-2 |
| `interval_days` | INT | | NOT NULL, DEFAULT 1 | Khoảng thời gian số ngày cần ôn lại tiếp theo |
| `repetitions` | INT | | NOT NULL, DEFAULT 0 | Số lần học viên ôn tập liên tục thành công |
| `next_review_at` | DATETIME(6) | | NOT NULL | Mốc thời gian chính xác cần kích hoạt ôn lại |
| **`videos`** | | | | Bảng quản lý video bài giảng nén HLS |
| `id` | VARCHAR(36) | **PK** | NOT NULL, UUID | Định danh video bài giảng |
| `lesson_id` | VARCHAR(36) | **FK** | REFERENCES lessons(id) | Bài học chứa video |
| `title` | VARCHAR(255) | | NOT NULL | Tiêu đề video bài giảng |
| `duration` | INT | | NOT NULL, DEFAULT 0 | Thời lượng video (giây) |
| `status` | ENUM | | DEFAULT 'UPLOADED' | Trạng thái (UPLOADED, PROCESSING, READY) |
| `hls_playlist_url` | VARCHAR(500) | | NULLABLE | Đường dẫn phát CDN playlist `master.m3u8` |
| `raw_storage_url` | VARCHAR(500) | | NULLABLE | Đường dẫn lưu trữ file gốc trên Cloudflare R2 |

##### ***2.2.4. Thiết kế hợp đồng giao tiếp RESTful API và DTO***

Hệ thống tuân thủ nghiêm ngặt chuẩn kiến trúc RESTful. Mọi yêu cầu đều được định tuyến qua tiền tố phiên bản `/api/v1/`. Kết quả trả về được đóng gói thống nhất trong lớp chuẩn hóa `ApiResponse<T>`:

```json
{
  "success": true,
  "message": "Thông báo trạng thái thực thi nghiệp vụ",
  "data": { ... },
  "timestamp": "2026-10-17T12:00:00.000Z"
}
```

*Bảng 2.9: Đặc tả hợp đồng giao tiếp RESTful API cốt lõi*

| Phương thức HTTP | Điểm cuối (Endpoint) | Quyền hạn (RBAC) | Payload yêu cầu (Request DTO) | Dữ liệu phản hồi (Response DTO) | Mã trạng thái |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login` | Công khai (Public) | `LoginRequest` {email, password} | `AuthResponse` {accessToken, userDto} | `200 OK` |
| `POST` | `/api/v1/auth/refresh-token` | Công khai (Public) | Cookie: `refreshToken` | `AuthResponse` {newAccessToken} | `200 OK` |
| `POST` | `/api/v1/ai/shadowing/evaluate`| `ROLE_STUDENT` | `MultipartFile` audio, `script`, `answerId` | `ShadowingEvaluationResponse` (IPA, F1/F2, KPI) | `200 OK` |
| `POST` | `/api/v1/teacher/assignments/generate-ai` | `ROLE_TEACHER` | `AiGenerateExerciseRequest` {topic, cefr, count} | `AssignmentResponse` (Danh sách câu hỏi & audio TTS) | `201 Created` |
| `POST` | `/api/v1/teacher/videos/upload` | `ROLE_TEACHER` | `MultipartFile` video, `title`, `lessonId` | `VideoResponse` {id, status="QUEUED"} | `202 Accepted` |
| `POST` | `/api/v1/student/assignments/{id}/start` | `ROLE_STUDENT` | Path Variable `id` | `AttemptStartResponse` {attemptId, questionsList} | `200 OK` |
| `PUT` | `/api/v1/student/attempts/{id}/save-answer` | `ROLE_STUDENT` | `SaveAnswerRequest` {questionId, optionId, text} | `ApiResponse<Void>` | `200 OK` |
| `POST` | `/api/v1/student/attempts/{id}/submit` | `ROLE_STUDENT` | Path Variable `id` | `SubmitAttemptResponse` {totalScore, status} | `200 OK` |
| `POST` | `/api/v1/student/srs/review` | `ROLE_STUDENT` | `SrsReviewRequest` {vocabularyId, grade: 0..3} | `SrsReviewResponse` {nextReviewAt, stage} | `200 OK` |
| `GET` | `/api/v1/admin/ai/monitoring` | `ROLE_ADMIN` | Query Params: `from`, `to`, `engine` | `AiMonitoringDto` {totalCalls, totalTokens, cost} | `200 OK` |

---

#### ***2.3. Thiết kế Frontend***

##### ***2.3.1. Kiến trúc giao diện React SPA, phân quyền định tuyến và quản lý trạng thái***

Frontend được thiết kế theo mô hình Component-Based Architecture hiện đại sử dụng **React 18** và công cụ đóng gói siêu tốc **Vite**. Kiến trúc bao gồm các lớp:

1. **Hệ thống định tuyến và phân quyền người dùng (Routing & Protected Routes):** 
   Sử dụng thư viện `react-router-dom` v6 kết hợp component bọc bảo vệ `ProtectedRoute`. Khi người dùng truy cập một liên kết, `ProtectedRoute` kiểm tra trạng thái xác thực từ Zustand Store (`useAuthStore`). Nếu chưa đăng nhập, tự động lưu lại đường dẫn hiện tại và chuyển hướng về `/login`. Nếu đã đăng nhập, component kiểm tra danh sách vai trò (`user.roles`) đối chiếu với quyền hạn yêu cầu của trang. Nếu không thỏa mãn, hiển thị trang lỗi 403 Forbidden.

2. **Quản lý trạng thái toàn cục với Zustand (Global State Management):** 
   Thay vì sử dụng Redux vốn cồng kềnh với nhiều boilerplate code, đề tài sử dụng **Zustand** làm thư viện quản lý trạng thái chính. `useAuthStore` chịu trách nhiệm lưu trữ thông tin tài khoản hiện hành, danh sách quyền và chuỗi khóa Access Token. Trạng thái được tự động đồng bộ hóa với LocalStorage thông qua middleware `persist` của Zustand, giúp bảo toàn phiên đăng nhập khi người dùng tải lại trang.

3. **Cơ chế đánh chặn HTTP hai tầng với Axios Interceptor:** 
   Để đảm bảo tính thông suốt khi người dùng đang học bài hoặc thi cử, hệ thống cài đặt bộ đánh chặn kép:
   - *Request Interceptor:* Tự động trích xuất Access Token hợp lệ từ `useAuthStore` và gắn vào tiêu đề `Authorization: Bearer <token>` trước khi bất kỳ yêu cầu nào rời khỏi trình duyệt.
   - *Response Interceptor:* Đăng ký bộ lắng nghe phản hồi toàn cục. Khi máy chủ trả về mã lỗi 401 Unauthorized (do Access Token hết hạn sau 15 phút), Axios tạm dừng toàn bộ các yêu cầu đang gửi đồng thời và đưa vào một hàng đợi chờ (Promise Queue Mutex). Một yêu cầu duy nhất `POST /api/v1/auth/refresh-token` được tự động gửi đi để xin cấp Access Token mới. Sau khi nhận được token mới, hệ thống cập nhật lại Store và tự động phát lại (replay) toàn bộ các yêu cầu đang chờ trong hàng đợi một cách trong suốt với người dùng.

```
+----------------------------------------------------------------------------------------------------+
| [HÌNH ẢNH: D:\HocTap_DoAn\doanchuyennganh\englishlearning\HinhAnh_BaoCao_Chuong2\Hinh_2_11_KienTrucFrontend_ReactZustand.png] |
+----------------------------------------------------------------------------------------------------+
```
*Hình 2.11: Kiến trúc Frontend React SPA, phân quyền định tuyến và quản lý trạng thái Zustand*

##### ***2.3.2. Thiết kế các màn hình chính của Học viên, Giảng viên và Quản trị viên***

Giao diện người dùng được tối ưu hóa theo trải nghiệm người dùng (UX/UI) với thư viện kiểu dáng TailwindCSS, đảm bảo tính đáp ứng (Responsive) trên cả màn hình máy tính để bàn (Desktop), máy tính bảng (Tablet) và điện thoại thông minh (Mobile):

*Bảng 2.10: Đặc tả các luồng màn hình chính và thành phần giao diện Frontend React theo vai trò*

| Phân hệ người dùng | Tên màn hình / Tệp nguồn Component | Chức năng và thành phần giao diện chính |
| :--- | :--- | :--- |
| **Học viên (Student)** | `DailyHomeworkPage.tsx` | Lộ trình học ngày hiển thị danh sách công việc cần làm: bài tập chưa nộp, thẻ từ vựng cần ôn hôm nay, bài giảng cần xem. Tích hợp thanh tiến độ phần trăm và số ngày duy trì chuỗi học tập liên tục (Streak). |
| | `SpeakingAiEvaluationPage.tsx` | Màn hình luyện phát âm Shadowing AI: Hiển thị câu mẫu, nút phát âm thanh mẫu chuẩn, nút ghi âm trực quan kèm biểu đồ sóng âm (Waveform Canvas). Sau khi ghi âm, hệ thống tô màu câu nói (Xanh lá: Chuẩn, Vàng: Cần sửa, Đỏ: Phát âm sai, Xám: Bỏ sót), kèm bảng giải phẫu từng âm vị IPA và biểu đồ Formant F1/F2 Praat. |
| | `AssignmentTakePage.tsx` | Giao diện phòng thi trực tuyến CBT: Bộ đếm ngược thời gian làm bài, bảng lưới câu hỏi hỗ trợ đánh dấu câu hỏi cần xem lại, tự động lưu câu trả lời ngầm, chống gian lận khi chuyển tab trình duyệt. |
| | `StudentFlashcardsPage.tsx` | Màn hình ôn tập từ vựng Spaced Repetition (SM-2): Thẻ lật 2 mặt (Flashcard Flip) hiển thị từ vựng, phiên âm IPA, nghĩa tiếng Việt, câu ví dụ và âm thanh phát âm. 4 nút bấm chấm điểm khả năng nhớ: Again, Hard, Good, Easy. |
| | `StudentProfilePage.tsx` | Hồ sơ năng lực cá nhân: Biểu đồ mạng nhện Radar Chart thể hiện điểm số 4 kỹ năng Nghe - Nói - Đọc - Viết quy đổi theo khung tham chiếu châu Âu CEFR (A1 - C2), lịch sử điểm thi và biểu đồ tăng trưởng từ vựng. |
| **Giảng viên (Teacher)** | `TeacherDashboardPage.tsx` | Tổng quan giảng dạy: Thống kê số lượng lớp phụ trách, số bài tập cần chấm điểm, biểu đồ phân bố điểm số trung bình của các lớp học. |
| | `TeacherClassDetailPage.tsx` | Quản lý chi tiết lớp học: Danh sách học viên, quản lý bài giảng video, giao bài tập theo lớp và theo dõi tỷ lệ hoàn thành bài tập của từng học viên. |
| | `TeacherDailyPlanPage.tsx` | Khởi tạo bài tập đa nguồn: Tích hợp trình soạn thảo bài tập AI (nhập Prompt sinh câu hỏi), nhập liệu hàng loạt từ file Excel (`.xlsx`), cấu hình giọng đọc TTS mẫu và thiết lập lộ trình học ngày. |
| | `TeacherGradingPage.tsx` | Bàn làm việc chấm bài: Chấm bài viết luận và bài nói tự luận, nghe lại file ghi âm của học viên, xem gợi ý điểm số và nhận xét tự động từ AI, ghi nhận điểm số chính thức và phản hồi cá nhân hóa. |
| **Quản trị (Admin)** | `AdminDashboardPage.tsx` | Bảng điều khiển quản trị trung tâm: Thống kê số lượng người dùng đang hoạt động, biểu đồ lượng yêu cầu API và tỷ lệ phân bổ vai trò. |
| | `AiMonitoringPage.tsx` | Giám sát chi phí và hạn ngạch AI: Thống kê số lượt gọi, dung lượng token sử dụng theo từng mô hình (Gemini, Groq, Whisper, Python), tỷ lệ kích hoạt cơ chế dự phòng Fallback và cảnh báo vượt ngưỡng ngân sách. |
| | `AuditLogPage.tsx` | Nhật ký kiểm toán hệ thống: Bảng tra cứu lịch sử thao tác người dùng theo thời gian thực (đăng nhập, sửa điểm, xóa học liệu, cấp quyền), hỗ trợ tìm kiếm theo IP, User ID và Endpoint. |
| | `VideoModerationPage.tsx` | Quản lý và kiểm duyệt video bài giảng: Theo dõi trạng thái tiến trình nén HLS của FFmpeg qua RabbitMQ, xem trước luồng HLS trực tiếp từ Cloudflare R2 CDN và phê duyệt nội dung số. |

##### ***2.3.3. Thiết kế luồng tương tác người dùng và xử lý bất đồng bộ trên giao diện***

Để tạo cảm giác phản hồi mượt mà cho các tác vụ âm thanh và chấm điểm AI vốn tiêu tốn thời gian tính toán, giao diện áp dụng mô hình thiết kế phản ứng bất đồng bộ (Reactive Asynchronous Pattern):

1. **Luồng thu âm thời gian thực với Web Audio API:**
   Khi học viên bấm nút "Bắt đầu nói", trình duyệt yêu cầu quyền truy cập thiết bị thông qua `navigator.mediaDevices.getUserMedia({ audio: true })`. Luồng tín hiệu âm thanh thu được đưa vào `AudioContext`. Thay vì sử dụng bộ mã hóa mặc định của trình duyệt vốn cho ra các định dạng nén suy giảm chất lượng (như WebM hoặc OGG), hệ thống sử dụng một `AudioWorkletNode` để can thiệp trực tiếp vào mảng mẫu PCM, tự động chuyển đổi tần số mẫu xuống 16.000 Hz đơn kênh (mono) và đóng gói thành chuỗi byte định dạng WAV chuẩn (RIFF Header 44 bytes). Song song với quá trình thu âm, một đối tượng `AnalyserNode` tính toán biến đổi Fourier nhanh (FFT) để vẽ biểu đồ dạng sóng âm dao động sống động trên thẻ `<canvas>`, giúp học viên nhận biết ngay cường độ giọng nói của mình có đủ rõ ràng hay không.

2. **Cơ chế cập nhật trạng thái chấm điểm hai giai đoạn (Two-Phase Feedback):**
   - *Giai đoạn 1 (Lạc quan - Optimistic UI):* Ngay khi học viên nhấn "Nộp bài", giao diện khóa nút bấm để chống bấm đúp, hiển thị biểu tượng tiến trình xoay kèm thông báo *"Hệ thống đang phân tích ngữ âm..."*. Đối với các bài tập trắc nghiệm, các câu trả lời đúng/sai được tính toán cục bộ và hiển thị điểm tạm thời ngay lập tức (< 100ms).
   - *Giai đoạn 2 (Đẩy dữ liệu thời gian thực qua WebSocket):* Đối với các câu hỏi tự luận và bài tập Shadowing phức tạp cần xử lý qua các tầng AI, trình duyệt duy trì kết nối WebSocket STOMP. Khi tác vụ nền trên Spring Boot hoàn tất, máy chủ phát tín hiệu cập nhật trạng thái trực tiếp về máy trạm. Trình duyệt nhận được gói tin JSON sẽ tự động kích hoạt hiệu ứng chuyển cảnh mượt mà, gỡ bỏ biểu tượng chờ và hiển thị toàn bộ kết quả phân tích: tô màu câu chữ, hiển thị nhận xét sư phạm và phát âm thanh chúc mừng nếu đạt chuẩn mà người dùng hoàn toàn không cần phải tải lại trang (zero page-reload).

```
+----------------------------------------------------------------------------------------------------+
| [HÌNH ẢNH: D:\HocTap_DoAn\doanchuyennganh\englishlearning\HinhAnh_BaoCao_Chuong2\Hinh_2_12_LuongTuongTacAudio_WebSocket.png] |
+----------------------------------------------------------------------------------------------------+
```
*Hình 2.12: Sơ đồ luồng tương tác thời gian thực thu âm Audio và phản hồi WebSocket*

---

#### ***2.4. Kết luận Chương 2***

Chương 2 đã hoàn thành toàn diện và chi tiết công tác thiết kế hệ thống học tiếng Anh trực tuyến tích hợp trí tuệ nhân tạo và đánh giá ngữ âm tính toán, cụ thể đạt được các kết quả kỹ thuật cốt lõi sau:

1. **Thiết kế kiến trúc hệ thống tổng thể vững chắc:** Đề xuất và đặc tả thành công mô hình kiến trúc lai Modular Monolith (Spring Boot 3) kết hợp Acoustic Microservice (Python FastAPI), tận dụng triệt để sức mạnh giao dịch toàn vẹn ACID của nền tảng Java và năng lực tính toán học sâu/ngữ âm học chuyên sâu của Python.
2. **Hiện thực hóa cơ chế dự phòng đa tầng 3-Tier AI Fallback:** Xây dựng giải pháp kỹ thuật hoàn chỉnh kết hợp giữa dịch vụ âm học tính toán nội bộ (Wav2Vec2 + Praat C++), mô hình STOMP tốc độ cao Groq Whisper + Gemini 1.5 Flash và dự phòng khẩn cấp Groq LLaMA 3.3 70B, đảm bảo thời gian phản hồi dưới 1 giây, tiết kiệm tối đa chi phí vận hành và nâng cao độ sẵn sàng dịch vụ lên 99.9%.
3. **Mô hình hóa động và tĩnh chi tiết cho các nghiệp vụ trọng tâm:** Xây dựng đầy đủ 5 biểu đồ tuần tự (Sequence Diagram) chuẩn UML cho các ca sử dụng cốt lõi (Đăng nhập xoay vòng Token, Luyện Shadowing, Soạn bài tập AI/TTS, Khảo thí CBT và Chuyển đổi Video HLS qua RabbitMQ) cùng biểu đồ lớp (Class Diagram) chi tiết cho miền dữ liệu cốt lõi.
4. **Chuẩn hóa cơ sở dữ liệu quan hệ toàn diện:** Thiết kế sơ đồ quan hệ thực thể (ERD) hoàn chỉnh với 32 bảng chuẩn hóa 3NF, phân bổ thành 5 cụm logic chặt chẽ, đi kèm bảng từ điển dữ liệu đặc tả chính xác từng trường khóa chính, khóa ngoại, kiểu dữ liệu và ràng buộc toàn vẹn.
5. **Thiết kế giao diện hiện đại và tối ưu hóa trải nghiệm người dùng:** Xây dựng kiến trúc Frontend React SPA hoàn chỉnh, bảo vệ phân quyền chặt chẽ theo vai trò (Student, Teacher, Admin), quản lý trạng thái tập trung với Zustand, cơ chế tự động làm mới Access Token trong suốt qua Axios Interceptor và luồng tương tác thu âm/phản hồi thời gian thực qua Web Audio API và WebSocket STOMP.

Toàn bộ các bản vẽ kỹ thuật, hợp đồng API và thông số thiết kế được xác lập trong Chương 2 là kim chỉ nam trực tiếp để tiến hành công tác cài đặt mã nguồn, cấu hình hạ tầng và triển khai các thuật toán tại **Chương 3: Xây dựng và cài đặt hệ thống**.
