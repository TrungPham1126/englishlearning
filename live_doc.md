# **BÁO CÁO ĐỒ ÁN CHUYÊN NGÀNH**

## 

HỆ THỐNG HỌC TIẾNG ANH TRỰC TUYẾN TÍCH HỢP ĐÁNH GIÁ NGỮ ÂM TÍNH TOÁN VÀ TRÍ TUỆ NHÂN TẠO ĐA TẦNG

#### 

MỤC LỤC

#### 

DANH MỤC CÁC HÌNH VẼ

####  ***Hình 1.1: Sơ đồ Use Case tổng quát mức 0 của hệ thống  Hình 1.2: Sơ đồ phân rã Use Case Xác thực và Quản lý tài khoản \- Mức 1  Hình 1.3: Sơ đồ phân rã Use Case Học tập và Luyện thi theo lộ trình ngày \- Mức 1  Hình 1.4: Sơ đồ phân rã Use Case Đánh giá Phát âm Shadowing, Speaking & Writing AI \- Mức 1  Hình 1.5: Sơ đồ phân rã Use Case Quản lý lớp học, Học liệu và Tạo bài tập đa nguồn (Teacher) \- Mức 1  Hình 1.6: Sơ đồ phân rã Use Case Quản trị hệ thống, Giám sát AI Quota và Nhật ký (Admin) \- Mức 1  Hình 1.7: Sơ đồ hoạt động của Use Case Đăng nhập và Làm mới phiên xác thực (UC-AUTH-01)  Hình 1.8: Sơ đồ hoạt động của Use Case Luyện phát âm Shadowing qua dịch vụ âm học Python và AI dự phòng (UC-AI-01)  Hình 1.9: Sơ đồ hoạt động của Use Case Khởi tạo bài tập thông minh bằng AI / Excel / TTS (UC-TEA-01)  Hình 1.10: Sơ đồ hoạt động của Use Case Làm bài tập tương tác CBT và Chấm bài tự luận/nói bằng AI (UC-STU-01)  \* Hình 1.11: Sơ đồ hoạt động của Use Case Tải lên và chuyển đổi Video bài giảng sang luồng HLS bất đồng bộ (UC-SYS-01)*** 

CHƯƠNG 1\. PHÂN TÍCH VÀ ĐẶC TẢ YÊU CẦU HỆ THỐNG

### 

1.1. Khảo sát hiện trạng và bài toán cần giải quyết

##### 

1.1.1. Bài toán quản lý dạy \- học và đánh giá kỹ năng tiếng Anh trực tuyến

######  **Ứng dụng IT trong quản lý và kiểm tra đánh giá tiếng Anh (CEFR, IELTS, TOEIC) là thiết yếu. Khảo sát thực tế chỉ ra 4 hạn chế chính ở các hệ thống hiện hành:  1\. Thiếu đánh giá ngữ âm chuyên sâu: Chưa phân tích âm học cấp âm vị (Phoneme) và Formant, phụ thuộc chấm thủ công hoặc Cloud API đắt đỏ.   2\. Phụ thuộc AI đám mây: Dễ gián đoạn khi chạm Rate Limit (429) hoặc trễ mạng, thiếu kiến trúc dự phòng đa tầng (Multi-tier Fallback).   3\. Hạn chế phân phối media: Stream MP4 thô gây nghẽn băng thông, thiếu pipeline chuyển đổi HLS và Object Storage phân tán.   4\. Hệ thống CBT và ôn tập thiếu linh hoạt: Dễ mất trạng thái khi mất kết nối; chưa áp dụng thuật toán lặp lại ngắt quãng (SM-2).** 

1.1.2. Khảo sát một số nền tảng học tiếng Anh và công cụ chấm phát âm hiện có

###### 

1.1.2. Đánh giá so sánh và định hướng giải pháp của đề tài

######  **So với các nền tảng hiện có (Duolingo, ELSA Speak, LMS truyền thống), đề tài đề xuất giải pháp toàn diện với các ưu thế kỹ thuật cốt lõi:  \* Kiến trúc Modular Monolith & Microservice: Core Spring Boot 3 quản lý giao dịch, JWT kép, hàng đợi RabbitMQ; kết hợp Acoustic Microservice (Python FastAPI) xử lý phát âm.   \* Đánh giá ngữ âm & Dự phòng AI 3 tầng: Phân tích Formant (F1, F2), gióng hàng Wav2Vec 2.0 và điểm CTC GOP (\<1s). Tự động dự phòng 3 tầng: Python Engine → Groq Whisper \+ Gemini → Groq Llama-3.   \* Phân phối Media & Thi CBT linh hoạt: Chuyển mã HLS đa phân đoạn qua RabbitMQ/FFmpeg lưu trên Cloudflare R2; Frontend React SPA hỗ trợ đệm LocalStorage chống rớt mạng và ôn tập từ vựng SM-2.** 

1.2. Xác định các tác nhân của hệ thống (Actors)

##### 

Hệ thống phân định ranh giới giữa 3 tác nhân người dùng và 3 dịch vụ ngoài:

##### ***1.3. Xác định tác nhân và Phân tích yêu cầu hệ thống***

##### 

1.3.1. Các tác nhân và Vai trò trong hệ thống

######  **Hệ thống bao gồm 3 tác nhân người dùng và 3 dịch vụ tích hợp bên ngoài:  \* Học viên (Student): Học theo lộ trình; luyện Shadowing, Speaking, Writing AI; ôn tập từ vựng SM-2; làm bài kiểm tra CBT.   \* Giảng viên (Teacher): Quản lý lớp học, phân lộ trình; tải video bài giảng HLS; tạo bài tập (thủ công, Excel, AI CEFR); tổng hợp giọng đọc Neural TTS.   \* Quản trị viên (Admin): Quản trị tài khoản (RBAC); kiểm duyệt video HLS; giám sát AI Quota; truy vết nhật ký Audit Logs.   \* Dịch vụ ngoài: Python Phonetics Service (chấm ngữ âm Tầng 1); Gemini & Groq Cloud AI (Whisper STT, chấm Writing/Speaking, dự phòng Tầng 2 & 3); Cloudflare R2 (lưu trữ video HLS và media).** 

1.3.2. Yêu cầu chức năng chính (Functional Requirements)

######  **5\. Xác thực & Phân quyền (FR-AUTH): Đăng nhập BCrypt cấp Access Token (30 phút) và Refresh Token (7 ngày); làm mới phiên tự động qua Axios Interceptor (HTTP 401); phân quyền RBAC cấp API (@PreAuthorize).   6\. Học viên & Lộ trình (FR-STU): Học theo lộ trình ngày; luyện Shadowing phản hồi trực quan âm vị; ôn tập từ vựng ngắt quãng SM-2; thi CBT đếm ngược tự lưu LocalStorage; luyện Writing chấm AI theo 4 tiêu chí IELTS.   7\. Giảng viên & Học liệu (FR-TEA): Quản lý lớp học; tải video MP4 chuyển mã HLS bất đồng bộ; tạo bài tập đa nguồn (nhập tay, Excel Apache POI, AI sinh đề CEFR); tổng hợp giọng đọc Neural TTS lên R2.   8\. Quản trị & Vận hành (FR-ADM): Quản lý người dùng; duyệt video HLS (APPROVED/REJECTED); giám sát hạn ngạch AI Quota; ghi nhật ký kiểm toán bất biến qua Spring AOP.** 

1.3.3. Yêu cầu phi chức năng và quy tắc nghiệp vụ cốt lõi

######  **Hệ thống tuân thủ các chỉ số chất lượng định lượng (NFR) và quy tắc nghiệp vụ (BR) sau:  \* Hiệu năng & Dự phòng (NFR-01, NFR-02, BR-04): Phản hồi chấm ngữ âm Python ≤ 1,0s (Tầng 1); tỷ lệ sẵn sàng ≥ 99,5%; tự động chuyển tầng AI trong ≤ 300ms khi lỗi hoặc chạm Rate Limit 429\.   \* Bảo mật & Kiểm toán (NFR-03, BR-01, BR-08): Mật khẩu băm BCrypt; Refresh Token lưu HTTP-Only Cookie (7 ngày); bản ghi AuditLog tạo qua Spring AOP chỉ cho phép ghi mới (INSERT), cấm sửa/xóa.   \* Thi CBT & Tiến trình học (BR-02, BR-03, BR-05): Mở khóa ngày học mới khi đạt ≥ 60% tiến độ ngày trước; thuật toán SM-2 điều chỉnh khoảng cách lặp từ vựng (EF ≥ 1.3); thi CBT tự động nộp bài khi hết giờ.   \* Tải & Xử lý Media (NFR-04, NFR-05, BR-06, BR-07): Chịu tải ≥ 500 request đồng thời; video ≤ 500MB được chuyển mã HLS qua RabbitMQ/FFmpeg và dọn dẹp file tạm; tệp Excel nạp đề tuân thủ đúng chuẩn schema.** 

1.4. Xây dựng biểu đồ Use Case hệ thống

##### 

1.4.1. Biểu đồ Use Case tổng quát \- Mức 0

######  **Sơ đồ Use Case mức 0 thể hiện ranh giới hệ thống, các tác nhân và các phân hệ chức năng chính:    Hình *1.1: Sơ đồ Use Case tổng quát mức 0 của hệ thống*** 

***1.4***.2. Phân rã Use Case Xác thực và Quản lý tài khoản \- Mức 1

######  **Sơ đồ phân rã Use Case Xác thực và Quản trị tài khoản (Mức 1):    Hình *1.2: Sơ đồ phân rã Use Case Xác thực và Quản lý tài khoản \- Mức 1*** 

***1.4***.3. Phân rã Use Case Học tập và Luyện thi theo lộ trình ngày \- Mức 1

######  **Sơ đồ phân rã Use Case Học tập và Luyện thi theo lộ trình ngày (Mức 1):    Hình *1.3: Sơ đồ phân rã Use Case Học tập và Luyện thi theo lộ trình ngày \- Mức 1*** 

***1.4***.4. Phân rã Use Case Đánh giá Phát âm Shadowing, Speaking & Writing AI \- Mức 1

######  **Sơ đồ phân rã Use Case Đánh giá Phát âm Shadowing, Speaking & Writing AI (Mức 1):    Hình *1.4: Sơ đồ phân rã Use Case Đánh giá Phát âm Shadowing, Speaking & Writing AI \- Mức 1*** 

***1.4***.5. Phân rã Use Case Quản lý lớp học, Học liệu và Tạo bài tập đa nguồn (Teacher) \- Mức 1

######  **Sơ đồ phân rã Use Case Quản lý lớp học, Học liệu và Tạo bài tập đa nguồn (Mức 1):    Hình *1.5: Sơ đồ phân rã Use Case Quản lý lớp học, Học liệu và Tạo bài tập đa nguồn \- Mức 1*** 

***1.4***.6. Phân rã Use Case Quản trị hệ thống, Giám sát AI Quota và Nhật ký (Admin) \- Mức 1

######  **Sơ đồ phân rã Use Case Quản trị hệ thống, Giám sát AI Quota và Nhật ký (Mức 1):    Hình *1.6: Sơ đồ phân rã Use Case Quản trị hệ thống, Giám sát AI Quota và Nhật ký \- Mức 1*** 

***1.5***. Đặc tả chi tiết các Use Case chính

##### 

1.5.1. Đặc tả Use Case Đăng nhập và Làm mới phiên xác thực (UC-AUTH-01)

######  **1\. Thông tin chung:  \* Mã Use Case: UC-AUTH-01   \* Tên Use Case: Đăng nhập và Làm mới phiên xác thực   \* Tác nhân chính: Mọi người dùng (Học viên, Giảng viên, Admin), Axios Interceptor   \* Mục tiêu: Xác thực người dùng, cấp cặp token xác thực và duy trì phiên làm việc liên tục không gián đoạn.   \* Tiền điều kiện: Người dùng đã có tài khoản active trong hệ thống.   \* Hậu điều kiện: Cấp Access Token hợp lệ và chuyển hướng về trang chủ tương ứng với vai trò (Role).  2\. Luồng xử lý:  9\. Luồng chính (Main Flow):   10\. Bước 1 (Actor): Người dùng nhập Email và Mật khẩu trên React SPA, bấm nút "Đăng nhập".   11\. Bước 2 (Hệ thống): Spring Security tiếp nhận request, đối soát BCrypt hash trong Database.   12\. Bước 3 (Hệ thống): Tạo cặp Token: Access Token (30 phút, chứa Claims, Role) và Refresh Token (7 ngày, lưu vào DB/Cookie HTTP-Only).   13\. Bước 4 (Actor): Client lưu Access Token vào Zustand Store, thực hiện các thao tác API kèm Header Bearer Token.   14\. Bước 5 (Hệ thống \- Silent Refresh): Khi Access Token hết hạn (Backend trả 401 Unauthorized), Axios Interceptor tự động can thiệp, gửi Refresh Token ngầm định để lấy Access Token mới và phát lại request ban đầu.   15\. Luồng ngoại lệ (Alternative / Exception Flow):   16\. 1a. Sai Email/Mật khẩu: Backend trả lỗi 401 Bad Credentials; Hệ thống hiển thị thông báo "Email hoặc mật khẩu không chính xác".   17\. 1b. Tài khoản bị khóa (Disabled/Locked): Backend trả lỗi 403 Forbidden; Hệ thống báo "Tài khoản của bạn đã bị khóa".   18\. 5a. Refresh Token hết hạn hoặc bất hợp lệ: Backend trả 403; Axios Interceptor xóa bộ nhớ đệm và cưỡng chế điều hướng về trang Login.  3\. Quy tắc nghiệp vụ (Business Rules):  \* BR-01 (Mật khẩu & Token): Mật khẩu băm chuẩn BCrypt (strength 10). Access Token hết hạn sau 30 phút, Refresh Token lưu HTTP-Only Cookie thời hạn 7 ngày.  BR-08 (Audit Log): Mọi sự kiện đăng nhập thất bại/thành công đều qua Spring AOP ghi nhận AuditLog (IP, Timestamp, UserAgent).  Sơ đồ hoạt động của Use Case Đăng nhập và Làm mới phiên xác thực (UC-AUTH-01):    Hình 1.7: Sơ đồ hoạt động của Use *Case Đăng nhập và Làm mới phiên xác thực*** 

***1.5.2. Đặc tả Use Case Luyện ph***át âm Shadowing qua dịch vụ âm học Python và AI dự phòng (UC-AI-01)

######  **1\. Thông tin chung:  \* Mã Use Case: UC-AI-01   \* Tên Use Case: Luyện phát âm Shadowing qua dịch vụ âm học Python và AI dự phòng   \* Tác nhân chính: Học viên, Python Phonetics Microservice, Groq Whisper, Gemini AI / Groq LLM   \* Mục tiêu: Phân tích giọng nói thu âm, chấm điểm phát âm cấp âm vị (Phoneme/Formant) và phản hồi sửa lỗi tức thời.   \* Tiền điều kiện: Học viên chọn câu luyện Shadowing và cấp quyền Micro cho trình duyệt.   \* Hậu điều kiện: Cập nhật bản ghi AiEvaluation, tính điểm phát âm và hiển thị biểu đồ sóng âm / âm vị tô màu trực quan.  2\. Luồng xử lý:  19\. Luồng chính (Main Flow \- Tầng 1 Phonetics Engine):   20\. Bước 1 (Actor): Học viên nghe câu mẫu và nhấn thu âm qua Web Audio API trên giao diện Shadowing Studio.   21\. Bước 2 (Actor): Hoàn thành thu âm, Client gửi tệp WAV/WEBM đến Spring Boot Backend.   22\. Bước 3 (Hệ thống): Backend gọi Python Microservice (Tầng 1). Python Engine tiến hành gióng hàng Wav2Vec 2.0, trích xuất Formant F1/F2 và tính điểm GOP (Goodness of Pronunciation) cấp âm vị trong thời gian \< 1,0s.   23\. Bước 4 (Hệ thống): Nhận kết quả JSON âm vị IPA, tô màu từ (Xanh: chuẩn, Vàng: cần cải thiện, Đỏ: phát âm sai), lưu AiEvaluation và trả về giao diện Review Mode.   24\. Luồng ngoại lệ & Dự phòng (3-Tier AI Fallback):   25\. 3a. Tầng 1 Lỗi / Timeout \> 1,0s: Backend tự động kích hoạt Tầng 2: Gửi âm thanh đến Groq Whisper STT để bóc băng chữ, sau đó gọi Gemini AI chấm điểm và nhận xét lỗi ngữ âm trong ≤ 300ms.   26\. 3b. Tầng 2 chạm Quota 429 Rate Limit / Lỗi kết nối Gemini: Hệ thống tự động chuyển sang Tầng 3 dự phòng: Sử dụng mô hình Groq Llama-3 LLM để hoàn tất chấm điểm và trả phản hồi sư phạm.  3\. Quy tắc nghiệp vụ (Business Rules):  \* BR-04 (Chuyển tầng dự phòng 3-Tier AI Fallback): Ưu tiên Tầng 1 (Python Local Engine) để đảm bảo độ trễ ≤ 1,0s. Khi xảy ra sự cố, thời gian chuyển đổi giữa các tầng AI dự phòng phải ≤ 300ms mà không gây đứt gãy trải nghiệm người dùng.  NFR-01 (Hiệu năng): Đáp ứng thời gian phản hồi chấm ngữ âm tức thời ≤ 1,0s đối với Tầng 1\.  Sơ đồ hoạt động của Use Case Luyện phát âm Shadowing (UC-AI-01):    Hình 1.8: Sơ đồ hoạt động của U*se Case Luyện phát âm Shadowing*** 

***1.5.3. Đặc tả Use Case Khởi t***ạo bài tập thông minh bằng AI / Excel / TTS và gắn vào lộ trình học (UC-TEA-01)

######  **1\. Thông tin chung:  \* Mã Use Case: UC-TEA-01   \* Tên Use Case: Khởi tạo bài tập thông minh bằng AI / Excel / TTS và gắn vào lộ trình học   \* Tác nhân chính: Giảng viên, Gemini API, Neural Edge-TTS, Cloudflare R2 Storage   \* Mục tiêu: Giúp giảng viên tạo đề bài tập đa dạng từ nhiều nguồn (thủ công, tệp Excel, AI sinh tự động) kèm âm thanh chuẩn giọng đọc Neural và gắn trực tiếp vào Lộ trình học daily.   \* Tiền điều kiện: Giảng viên đã đăng nhập và được phân công quản lý Lớp học tương ứng.   \* Hậu điều kiện: Bài tập, câu hỏi và file âm thanh audio được lưu vào hệ thống và gắn vào DailyPlanItem cho lớp.  2\. Luồng xử lý:  27\. Luồng chính (Main Flow):   28\. Bước 1 (Actor): Giảng viên chọn Lớp học, Ngày trong lộ trình (DailyStudyPlan) và hình thức tạo bài tập (Thủ công / Upload Excel / Gemini AI).   29\. Bước 2a (Thủ công): Nhập thông tin tiêu đề, danh sách câu hỏi và đáp án trực tiếp trên UI.   30\. Bước 2b (Tệp Excel): Tải lên tệp mẫu .xlsx, Backend dùng Apache POI đọc, kiểm tra cấu trúc schema và map dữ liệu.   31\. Bước 2c (Gemini AI): Nhập chủ đề/đoạn văn và cấp độ CEFR, Gemini 1.5 sinh bộ câu hỏi tự động.   32\. Bước 3 (Hệ thống): Kích hoạt Neural Edge-TTS tổng hợp audio câu đọc chuẩn, xuất tệp và tải lên Cloudflare R2 Storage lấy URL.   33\. Bước 4 (Actor): Giảng viên nghe thử audio, xem trước cấu trúc bài tập và bấm "Lưu bài tập".   34\. Bước 5 (Hệ thống): Backend lưu Assignment, Questions, AudioURL vào Database và cập nhật DailyPlanItem.   35\. Luồng ngoại lệ (Alternative / Exception Flow):   36\. 2b.1. Tệp Excel sai định dạng/schema: Backend từ chối xử lý, báo lỗi chi tiết dòng/cột sai cấu trúc cho Giảng viên.   37\. 2c.1. Lỗi gọi Gemini AI / Quota quá tải: Hiển thị thông báo sự cố AI và gợi ý Giảng viên chuyển sang nhập tay hoặc dùng file Excel.  3\. Quy tắc nghiệp vụ (Business Rules):  \* BR-07 (Tệp Excel & Schema): Tệp Excel nạp đề bắt buộc tuân thủ đúng định dạng Template chuẩn do hệ thống cung cấp (Apache POI parse validation).  NFR-05 (Lưu trữ Media): Tệp âm thanh sinh ra từ TTS phải được tự động đẩy và lưu trữ trên Object Storage phân tán Cloudflare R2.  Sơ đồ hoạt động của Use Case Khởi tạo bài tập thông minh (UC-TEA-01):    Hình 1.9: Sơ đồ hoạt động của Use *Case Khởi tạo bài tập thông minh*** 

***1.5.4. Đặc tả Use Case Làm bài t***ập tương tác CBT và Chấm bài tự luận/nói bằng AI (UC-STU-01)

######  **1\. Thông tin chung:  \* Mã Use Case: UC-STU-01   \* Tên Use Case: Làm bài tập tương tác CBT và Chấm bài tự luận/nói bằng AI   \* Tác nhân chính: Học viên, Gemini AI, Groq Whisper STT   \* Mục tiêu: Cho phép Học viên làm bài thi kiểm tra trên máy tính (CBT), bảo toàn tiến độ làm bài khi sự cố mạng và chấm bài tự động song song qua AI.   \* Tiền điều kiện: Bài kiểm tra thuộc Ngày học hợp lệ trong Lộ trình đã được mở khóa.   \* Hậu điều kiện: Bài làm được chấm điểm, lưu kết quả, mở chế độ Xem lại (Review Mode) và cập nhật Biểu đồ năng lực Radar.  2\. Luồng xử lý:  38\. Luồng chính (Main Flow):   39\. Bước 1 (Actor): Học viên mở giao diện bài thi CBT, hệ thống kích hoạt đồng hồ đếm ngược.   40\. Bước 2 (Actor & Hệ thống): Học viên thực hiện các câu hỏi (Nghe, Nói, Đọc, Viết luận). Frontend tự động lưu bản nháp vào LocalStorage mỗi 5 giây phòng ngừa mất kết nối.   41\. Bước 3 (Actor): Học viên nhấn nút "Nộp bài" (hoặc đồng hồ hết giờ).   42\. Bước 4 (Hệ thống): Backend phân loại câu trả lời và chạy quy trình chấm song song đa luồng:   43\. • Trắc nghiệm/Điền từ: So khớp đáp án chuẩn tự động tức thì.   44\. • Viết luận (Writing): Gemini AI chấm theo 4 tiêu chí chuẩn IELTS (Task Achievement, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy).   45\. • Bài nói (Speaking): Groq Whisper bóc băng chữ \+ Gemini AI chấm độ trôi chảy và từ vựng.   46\. Bước 5 (Hệ thống): Tổng hợp điểm số, hiển thị kết quả chi tiết kèm lời khuyên sửa lỗi, mở Review Mode và dọn sạch nháp LocalStorage.   47\. Luồng ngoại lệ (Alternative / Exception Flow):   48\. 2a. Mất kết nối Internet trong lúc làm bài: Trình duyệt hiển thị cảnh báo offline, tiếp tục lưu nháp vào LocalStorage. Khi có mạng lại, hệ thống tự động đồng bộ bài làm lên Server.   49\. 3a. Hết thời gian làm bài (Timeout): Hệ thống tự động khóa giao diện và thực hiện nộp bài cưỡng chế với các câu đáp án đã chọn.  3\. Quy tắc nghiệp vụ (Business Rules):  \* BR-02 (Điều kiện Tiến độ Lộ trình): Học viên bắt buộc hoàn thành bài kiểm tra ngày trước đó với kết quả đạt ≥ 60% tiến độ mới được mở khóa Ngày học kế tiếp.  BR-05 (Bài thi CBT & Tự nộp): Mọi bài thi CBT đều có đồng hồ đếm ngược tính giờ nghiêm ngặt từ Server; tự động thu bài cưỡng chế khi thời gian thi trở về 0\.  Sơ đồ hoạt động của Use Case Làm bài tập tương tác CBT (UC-STU-01):    Hình 1.10: Sơ đồ hoạt động của Use *Case Làm bài tập tương tác CBT và Chấm bài bằng AI*** 

***1.5.5. Đặc tả Use Case Tải lên và*** chuyển đổi Video bài giảng sang luồng HLS bất đồng bộ (UC-SYS-01)

######  **1\. Thông tin chung:  \* Mã Use Case: UC-SYS-01   \* Tên Use Case: Tải lên và chuyển đổi Video bài giảng sang luồng HLS bất đồng bộ   \* Tác nhân chính: Giảng viên, Admin, RabbitMQ Message Broker, FFmpeg Worker, Cloudflare R2   \* Mục tiêu: Chuyển đổi video bài giảng thô MP4 thành luồng phân đoạn HLS (.m3u8/.ts) bất đồng bộ, giúp tối ưu băng thông phát video thích ứng và kiểm duyệt nội dung trước khi phát hành.   \* Tiền điều kiện: Giảng viên có quyền tạo nội dung bài giảng.   \* Hậu điều kiện: Folder luồng HLS lưu trên R2 Storage, bài giảng đổi trạng thái PENDING\_REVIEW chờ Admin kiểm duyệt.  2\. Luồng xử lý:  50\. Luồng chính (Main Flow):   51\. Bước 1 (Actor): Giảng viên tải lên tệp Video bài giảng (.mp4, dung lượng ≤ 500MB) trên Web UI.   52\. Bước 2 (Hệ thống): Backend lưu tệp tạm vào đĩa cứng, đẩy thông điệp chuyển mã vào hàng đợi RabbitMQ và lập tức trả về phản hồi HTTP 202 Accepted cho Client.   53\. Bước 3 (Hệ thống \- Asynchronous Processing): Worker FFmpeg lắng nghe RabbitMQ, tiến hành cắt video thành các phân đoạn 6 giây (segment\_%03d.ts) và khởi tạo tệp chỉ mục master.m3u8.   54\. Bước 4 (Hệ thống): Đẩy toàn bộ thư mục HLS lên Cloudflare R2 Storage, xóa sạch tệp tạm máy chủ và cập nhật trạng thái video thành PENDING\_REVIEW.   55\. Bước 5 (Actor \- Admin): Admin xem trước luồng video HLS và duyệt trạng thái APPROVED để chính thức phát hành cho Học viên xem bài giảng.   56\. Luồng ngoại lệ (Alternative / Exception Flow):   57\. 1a. Tệp video vượt quá 500MB: Trả về mã lỗi HTTP 413 Payload Too Large, yêu cầu nén hoặc cắt nhỏ video.   58\. 3a. Lỗi sự cố FFmpeg trong quá trình transcode: Đánh dấu trạng thái video REJECTED / FAILED, tự động xóa tệp rác tạm thời để bảo vệ dung lượng ổ cứng máy chủ.  3\. Quy tắc nghiệp vụ (Business Rules):  \* BR-06 (Quy trình HLS Transcoding & Giới hạn Video): Kích thước video tối đa 500MB; bắt buộc chuyển đổi sang chuẩn luồng phân đoạn HLS (thời lượng phân đoạn 6 giây); dọn dẹp tuyệt đối tệp tạm trên Local Disk sau khi upload R2 thành công.  NFR-04 (Xử lý hàng đợi): Tiến trình mã hóa video phải chạy bất đồng bộ qua RabbitMQ Message Broker để tránh gây nghẽn REST API chính.  Sơ đồ hoạt động của Use Case Chuyển đổi Video bài giảng (UC-SYS-01):    Hình 1.11: Sơ đồ hoạt động của U*se Case Chuyển đổi Video sang luồng HLS bất đồng bộ*** 

***1.6. Kết luận Chương 1***

 ***Chương*** 1 đã cô đọng đầy đủ các kết quả phân tích và đặc tả yêu cầu cốt lõi:  1\. Khảo sát bài toán: Làm rõ các bất cập kỹ thuật và đề xuất kiến trúc kết hợp Spring Boot 3 & Python FastAPI.   2\. Yêu cầu hệ thống: Xác định đầy đủ các danh mục FR, NFR và quy tắc nghiệp vụ BR.   3\. Mô hình Use Case: Xây dựng hoàn chỉnh sơ đồ Use Case tổng quát và 5 sơ đồ phân rã mức 1\.   4\. Đặc tả Use Case: Hoàn thiện 5 bảng đặc tả chi tiết cùng sơ đồ hoạt động Activity Diagram tương ứng.  Đây là cơ sở kỹ thuật cốt lõi để triển khai các nội dung thiết kế tại Chương 2\. 

CHƯƠNG 2\. THIẾT KẾ HỆ THỐNG

#### 

2.1. Thiết kế kiến trúc hệ thống

##### 

2.1.1. Kiến trúc tổng thể: Modular Monolith (Spring Boot) kết hợp Acoustic Microservice (Python FastAPI)

######  **Xuất phát từ các yêu cầu chức năng (FR) và phi chức năng (NFR) đã được đặc tả tại Chương 1, hệ thống được thiết kế theo mô hình kiến trúc lai: Modular Monolith làm nền tảng ứng dụng trung tâm kết hợp với Acoustic Microservice chuyên biệt phục vụ tính toán ngữ âm học thời gian thực. Kiến trúc này được lựa chọn nhằm tối ưu hóa sự cân bằng giữa tính toàn vẹn dữ liệu giao dịch ACID, chi phí vận hành hạ tầng thấp và khả năng khai thác tối đa các thư viện xử lý tín hiệu âm thanh chuyên sâu viết bằng C/C++ và Python.  Toàn bộ hệ thống được phân rã thành các tầng chức năng phân định rõ ràng:  1\. Tầng khách hàng (Client Presentation Tier): Được xây dựng dưới dạng ứng dụng đơn trang (Single Page Application \- SPA) dựa trên React 18, Vite và TypeScript. Tầng giao diện tích hợp Web Audio API (xử lý AudioWorklet thu âm định dạng PCM 16kHz tại máy trạm), HLS.js (giải mã luồng video phân đoạn HTTP Live Streaming) và STOMP/SockJS Client (nhận thông báo thời gian thực). 2\. Tầng bảo mật và định tuyến (Gateway & Security Filter Tier): Tích hợp trực tiếp trong nhân Spring Boot với Spring Security 6\. Tầng này chịu trách nhiệm kiểm soát phiên không trạng thái (stateless) qua JWT Dual-Token Filter, phân quyền dựa trên vai trò (Role-Based Access Control \- RBAC: ROLE\_S`TUDENT, ROLE`\_T`EACHER, ROLE`\_A`DMIN), ghi` nhật ký kiểm toán tự động qua Spring AOP và kiểm soát tần suất truy cập (Rate Limiting) để chống tấn công từ chối dịch vụ. 3\. Tầng ứng dụng trung tâm (Core Modular Monolith \- Spring Boot 3): Đóng gói toàn bộ nghiệp vụ quản lý người dùng, phân phối học liệu, lập lịch lộ trình học Spaced Repetition (SM-2), tổ chức thi trắc nghiệm/tự luận CBT, quản lý hàng đợi chuyển đổi video HLS và điều phối dịch vụ trí tuệ nhân tạo. Các mô-đun được cô lập logic qua ranh giới dịch vụ nội bộ (domain packages), chỉ giao tiếp thông qua Service Interface và Data Transfer Object (DTO), cho phép dễ dàng phân tách thành các microservice độc lập khi quy mô người dùng tăng trưởng vượt bậc mà không làm phá vỡ kiến trúc gốc. 4\. Tầng dịch vụ âm học tính toán (Acoustic Microservice \- Python FastAPI): Vận hành độc lập dưới dạng tiến trình microservice tại cổng dịch vụ 8000, nạp sẵn mô hình học sâu Wav2Vec 2.0 XLS-R-53 (fine-tuned cho nhận diện âm vị quốc tế IPA) và tích hợp nhân âm học Praat-Parselmouth C++. Dịch vụ này chuyên trách tính toán căn chỉnh thời gian âm vị (Forced Alignment), trích xuất tọa độ formant nguyên âm F1/F2, chấm điểm phụ âm Goodness of Pronunciation (GOP) và tổng hợp giọng đọc mẫu chất lượng cao Kokoro-82M Neural TTS. 5\. Tầng hạ tầng lưu trữ và môi giới thông điệp bất đồng bộ (Persistence & Message Broker Tier): Bao gồm cơ sở dữ liệu quan hệ MariaDB/MySQL (32 bảng chuẩn hóa 3NF), Redis Cache (quản lý danh sách đen Token Blacklist, bộ đệm phiên và Rate Limiter), RabbitMQ Message Broker (phân phối tác vụ giải mã video HLS và thông báo nền) và Cloudflare R2 Object Storage (lưu trữ phân tán video HLS, file ghi âm học viên và tài liệu học tập với băng thông tải về miễn phí qua mạng phân phối nội dung CDN).** 

 \+----------------------------------------------------------------------------------------------------+ | \[HÌNH ẢNH: D:\\HocTap\_DoAn\\doanchuyennganh\\englishlearning\\HinhAnh\_BaoCao\_Chuong2\\Hinh\_2\_1\_KienTrucTongThe.png\] | \+----------------------------------------------------------------------------------------------------+  Hình 2.1: Sơ đồ kiến trúc tổng thể hệ thống (Modular Monolith Spring Boot & Python FastAPI)  Bảng 2.1: Phân định trách nhiệm giữa Modular Monolith Spring Boot và Microservice Python FastAPI  | Tiêu chí so sánh | Khối Modular Monolith (Spring Boot 3\) | Khối Acoustic Microservice (Python FastAPI) | | :--- | :--- | :--- | | Nền tảng công nghệ | Java 17, Spring Boot 3.2, Spring Data JPA, Hibernate | Python 3.12, FastAPI, PyTorch, Librosa, Parselmouth | | Trách nhiệm nghiệp vụ | Quản lý người dùng, lớp học, lộ trình học SRS, thi CBT, điều phối hàng đợi RabbitMQ, ghi log kiểm toán AOP. | Căn chỉnh âm vị (Forced Alignment), tính toán Formant F1/F2, chấm điểm GOP, phát hiện từ bỏ sót, tổng hợp TTS. | | Mô hình xử lý | Đa luồng tiền trình (Multi-threaded I/O Bound), kiểm soát giao dịch dữ liệu ACID với HikariCP Pool. | Bất đồng bộ hóa sự kiện (Async Event Loop / UVLoop) kết hợp Worker Threadpool cho tác vụ nặng CPU Bound. | | Tần suất mở rộng | Triển khai mở rộng theo chiều ngang (Horizontal Scaling) theo số lượng yêu cầu nghiệp vụ và lượt làm bài CBT. | Triển khai mở rộng theo dung lượng tính toán AI/GPU, độc lập hoàn toàn với dữ liệu người dùng. | | Cơ chế lưu trữ | Đọc/ghi trực tiếp MariaDB (32 bảng) và Redis In-Memory Cache. | Hoạt động hoàn toàn không trạng thái (Stateless), không kết nối CSDL, giải phóng bộ nhớ tức thì sau khi tính toán. | 

2.1.2. Các thành phần của hệ thống và cơ chế giao tiếp (REST API, RabbitMQ, WebSocket, Cloudflare R2)

######  **Để đảm bảo hiệu năng cao, giảm độ trễ phản hồi tại giao diện và ngăn chặn tình trạng thắt nút cổ chai (bottleneck) khi xử lý các tác vụ tính toán nặng, hệ thống áp dụng ma trận giao tiếp đa giao thức kết hợp giữa đồng bộ và bất đồng bộ:  1\. Giao tiếp RESTful HTTPS (Đồng bộ \- Synchronous):    \- Giữa React SPA và Spring Boot Backend: Toàn bộ dữ liệu nghiệp vụ (đăng nhập, danh sách lớp, câu hỏi bài tập, nộp bài trắc nghiệm, cập nhật tiến độ) được truyền nhận qua giao thức HTTPS chuẩn với định dạng JSON (appl`ication/json) ho`ặc Multipart Form-data (khi gửi file âm thanh ghi âm và hình ảnh).    \- Giữa Spring Boot và Python FastAPI: Khi học viên nộp bài luyện âm Shadowing, Spring Boot đóng vai trò HTTP Client gửi yêu cầu đồng bộ POST `/api/v1/audio/evaluate-phonetics mang` theo chuỗi nhị phân âm thanh (WAV 16kHz) và câu mẫu đối chiếu. Thời gian phản hồi của dịch vụ Python nội bộ chỉ dao động từ 400ms đến 900ms, hoàn toàn nằm trong ngưỡng chấp nhận được của giao tiếp đồng bộ. 2\. Giao tiếp hướng sự kiện bất đồng bộ qua RabbitMQ (Asynchronous Message Broker):    \- Được áp dụng cho nghiệp vụ chuyển đổi video bài giảng sang định dạng HLS (HTTP Live Streaming). Quá trình nén và phân đoạn video qua FFmpeg đòi hỏi tài nguyên CPU rất lớn và kéo dài từ 30 giây đến vài phút tùy dung lượng.    \- Khi giảng viên tải lên video MP4, Spring Boot lưu file tạm, phát sinh thông điệp VideoTra`nscodeMessage đẩy vào` hàng đợi video.tr`anscode.queue thông q`ua RabbitTe`mplate và phản` hồi ngay mã HTTP 202 Accepted cho máy trạm.    \- Tiến trình nền VideoTran`scodeConsumer độc lập` tiêu thụ thông điệp, kích hoạt tiến trình con FFmpeg chạy ngầm. Sau khi nén thành công, tệp tin HLS được tự động đẩy lên Cloudflare R2 và xóa sạch bộ nhớ tạm tại máy chủ. Nếu xảy ra lỗi quá 3 lần, thông điệp được chuyển đến hàng đợi lỗi Dead Letter Exchange (DLX) để xử lý ngoại lệ. 3\. Giao tiếp hai chiều thời gian thực qua WebSocket / STOMP over SockJS:    \- Sử dụng để đẩy kết quả chấm điểm AI (Speaking, Writing) và thông báo hệ thống trực tiếp đến trình duyệt học viên mà không cần trình duyệt phải gửi yêu cầu thăm dò liên tục (polling).    \- Mỗi người dùng khi đăng nhập sẽ tự động đăng ký (subscribe) vào kênh riêng biệt /topic/stude`nt/{userId}/evaluation hoặc /queue`/gradi`ng-status/{attemptId}. Khi tác vụ` chấm điểm nền hoàn tất, Spring Boot sử dụng SimpMessagin`gTemplate để bắn dữ l`iệu kết quả trực tiếp về máy trạm, kích hoạt giao diện hiển thị ngay lập tức. 4\. Giao tiếp lưu trữ đám mây qua S3 API (Cloudflare R2):    \- Tích hợp thư viện AWS SDK v2 (software.amazo`n.awssdk.services.s3) để truyền nh`ận đối tượng nhị phân trực tiếp lên Cloudflare R2 thông qua kết nối mã hóa TLS 1.3. Hệ thống cấu hình quy tắc phân tách thư mục chuẩn hóa: raw/{videoId}/ `lưu video gốc`, hls/{videoId}/ `lưu playlist` .m3u8 và các m`ảnh p`hân đoạn .ts, audios/ex`erc`is`es/ lưu âm thanh` bài tập TTS. Trình phát video của học viên sau đó sẽ tải luồng HLS trực tiếp từ CDN toàn cầu của Cloudflare mà không tiêu tốn băng thông máy chủ backend.** 

 \+----------------------------------------------------------------------------------------------------+ | \[HÌNH ẢNH: D:\\HocTap\_DoAn\\doanchuyennganh\\englishlearning\\HinhAnh\_BaoCao\_Chuong2\\Hinh\_2\_2\_CoCheGiaoTiepLienDichVu.png\] | \+----------------------------------------------------------------------------------------------------+  Hình 2.2: Sơ đồ cơ chế giao tiếp liên dịch vụ (REST, RabbitMQ, WebSocket STOMP, Cloudflare R2)  Bảng 2.2: So sánh đặc tính các giao thức giao tiếp nội bộ và ngoại vi trong hệ thống  | Giao thức | Phạm vi áp dụng | Định dạng dữ liệu | Tính chất | Cơ chế kiểm soát lỗi / Dự phòng | | :--- | :--- | :--- | :--- | :--- | | RESTful HTTPS | Client \<-\> Backend; Backend \<-\> Python | JSON / Multipart Form-data | Đồng bộ (Request / Response) | Timeout 3.5s, kích hoạt chuyển đổi Fallback sang AI đám mây nếu lỗi kết nối. | | AMQP 0-9-1 | Backend \-\> RabbitMQ \-\> Transcode Worker | Binary JSON Message Payload | Bất đồng bộ (Message-Driven) | Cơ chế xác nhận thủ công (Manual ACK), tự động đẩy vào Dead Letter Exchange (DLX) khi lỗi. | | WebSocket STOMP | Backend \-\> Client Browser | Khung tin STOMP dạng văn bản JSON | Hai chiều toàn phần (Full-duplex) | Dự phòng hạ cấp SockJS (XHR Streaming / Long Polling), cơ chế tự động kết nối lại (Auto Reconnect). | | S3 REST API | Backend / Worker \<-\> Cloudflare R2 | Byte Stream nhị phân (Binary Stream) | Đồng bộ / Đa phân đoạn (Multipart) | Cơ chế thử lại Exponential Backoff (3 lần), kiểm tra mã băm MD5 / ETag tính toàn vẹn. | 

2.1.3. Luồng xử lý dữ liệu và cơ chế dự phòng đa tầng (3-Tier AI Fallback)

######  **Một trong những đóng góp kỹ thuật trọng tâm của đề tài là kiến trúc đánh giá phát âm và ngôn ngữ theo mô hình 3-Tier AI Fallback. Trong thực tế triển khai, các dịch vụ AI đám mây thương mại (như OpenAI, Google Gemini) thường xuyên đối mặt với các nguy cơ: trễ mạng quốc tế (high latency \> 2.5s), cạn kiệt hạn ngạch cuộc gọi (HTTP 429 Quota Exceeded) hoặc chi phí bản quyền tăng vọt khi quy mô người dùng mở rộng. Ngược lại, nếu chỉ dựa vào mô hình âm học chạy cục bộ, hệ thống có thể bị treo hoặc không thể phân tích các đoạn hội thoại dài mang tính ngữ nghĩa phức tạp.  Cơ chế dự phòng 3 tầng được cài đặt tại lớp điều phối trung tâm Sha`dowingService vớ`i quy trình xử lý nghiêm ngặt:  1\. Tầng 1 (Ưu tiên hàng đầu \- Local Acoustic Engine):    \- Thành *phần: Micro*service Python FastAPI nạp mô hình Wav2Vec 2.0 XLS-R-53 kết hợp thư viện C++ Praat-Parselmouth.    \- Nguyên *lý xử lý: File â*m thanh của học viên sau khi thu âm được chuẩn hóa về tần số mẫu 16.000 Hz đơn kênh (mono) và đi qua bộ lọc dải thông (band-pass filter). Thuật toán Voice Activity Detection (VAD) kiểm tra năng lượng tín hiệu (yêu cầu SNR ≥ 12 dB và thời lượng tiếng nói thực tế ≥ 0,08s).    \- Mô hình Wav2Vec2 tính toán ma trận xác suất hậu nghiệm CTC (Posterior Matrix) và sử dụng thuật toán Viterbi giải mã căn chỉnh thời gian bắt đầu/kết thúc của từng từ và từng âm vị (Phoneme Alignment).    \- Tiếp theo, nhân Praat trích xuất tọa độ formant thực tế F1 (độ mở cung hàm) và F2 (vị trí lưỡi trước/sau) của từng nguyên âm, tính toán khoảng cách Euclid chuẩn hóa so với mẫu phát âm bản xứ tương ứng với giới tính và cao độ F0 của người nói:     ΔF \= √\[(F1user \- F1re*f)² \+ (F2*user \- F2re*f)²\]*     \- Các phụ âm được chấm điểm bằng thuật toán Goodness of Pronunciation (GOP) dựa trên mật độ năng lượng dải tần cao (high-frequency spectral energy) và kiểm tra sự xuất hiện của âm chặn cuối từ (final consonant stops /p, t, k, d/).    \- Tầng 1 trả về kết quả chi tiết từng âm vị chuẩn IPA quốc tế, độ lệch formant, tỷ lệ phát âm trôi chảy (WPM), phát hiện chính xác từ bị đọc thiếu/bỏ sót với độ trễ cực nhanh (\< 1 giây) và hoàn toàn miễn phí chi phí cuộc gọi API.  2\. Tầng 2 (Dự phòng cấp 1 \- Groq Whisper STT \+ Google Gemini 1.5 Flash):    \- Điều kiện kích ho*ạt: Tự động kích hoạ*t khi Tầng 1 gặp ngoại lệ (Exception), tràn bộ nhớ hoặc vượt quá thời gian chờ (Timeout \> 3.5 giây).    \- Nguyên lý xử lý: F*ile âm thanh đượ*c gửi ngay đến dịch vụ Groq Cloud API chạy mô hình whisper-large-v3 t`rên phần cứng LP`U chuyên dụng, hoàn tất việc bóc băng âm thanh thành văn bản nguyên văn kèm mốc thời gian từng từ trong thời gian chỉ dưới 800ms.    \- Bản ghi âm bóc băng được ghép với câu tham chiếu mẫu và đẩy vào Google Gemini 1.5 Flash thông qua tập luật chỉ thị hệ thống chuyên gia (Cambridge Phonetics System Instruction). Gemini tiến hành đối chiếu từng từ, phát hiện hiện tượng nuốt âm, phát âm sai phụ âm cuối, tính toán điểm số tổng hợp và xuất bản nhận xét sư phạm bằng tiếng Việt chi tiết dưới dạng JSON có cấu trúc.  3\. Tầng 3 (Dự phòng khẩn cấp \- Groq LLaMA 3.3 70B & Local Heuristic Engine):    \- Điều kiện kích hoạt: K*ích hoạt khi Google* Gemini trả về mã lỗi HTTP 429 (Resource Exhausted \- Hết hạn mức gọi API) hoặc khi kết nối mạng quốc tế đến máy chủ Google bị gián đoạn.    \- Nguyên lý xử lý: Hệ thố*ng lập tức chuyể*n hướng tải sang mô hình mã nguồn mở LLaMA-3.3-70B-Versatile được lưu trữ tại cụm máy chủ Groq độc lập, ép kiểu trả về chế độ JSON Mode (response\_format={"type"`: "json_object"}). Đồng thời, thuật toá`n heuristic cục bộ đối chiếu khoảng cách chỉnh sửa Levenshtein được áp dụng để bù đắp điểm số độ hoàn thiện câu.    \- Nhờ kiến trúc 3 tầng độc lập, hệ thống đảm bảo độ sẵn sàng dịch vụ đạt 99.9%, bảo vệ trải nghiệm của người học liên tục mà không bao giờ bị đình trệ vì sự cố của bất kỳ nhà cung cấp dịch vụ đơn lẻ nào.** 

 \+----------------------------------------------------------------------------------------------------+ | \[HÌNH ẢNH: D:\\HocTap\_DoAn\\doanchuyennganh\\englishlearning\\HinhAnh\_BaoCao\_Chuong2\\Hinh\_2\_3\_CoCheDuPhong3TierAI.png\] | \+----------------------------------------------------------------------------------------------------+  Hình 2.3: Luồng xử lý dữ liệu và cơ chế dự phòng đa tầng (3-Tier AI Fallback Pipeline)  Bảng 2.3: Đặc tả các tầng trong kiến trúc phân tích phát âm đa tầng (3-Tier AI Fallback)  | Chỉ tiêu kỹ thuật | Tầng 1: Python Acoustic Engine | Tầng 2: Groq Whisper \+ Gemini Flash | Tầng 3: Groq LLaMA 3.3 Fallback | | :--- | :--- | :--- | :--- | | Công nghệ cốt lõi | Wav2Vec2 XLS-R-53 \+ Praat C++ | Whisper-large-v3 \+ Gemini 1.5 Flash | LLaMA-3.3-70B-Versatile (JSON Mode) | | Thời gian phản hồi (Latency) | 400ms – 900ms (\< 1 giây) | 1.800ms – 2.800ms | 1.200ms – 2.000ms | | Chi phí tính toán / lượt | 0.00 USD (Chạy trên CPU/GPU nội bộ) | \~0.00 USD03 / lượt chấm | \~0.00 USD01 / lượt chấm | | Độ sâu phân tích ngữ âm | Chi tiết đến từng âm vị IPA, tọa độ Formant F1/F2, năng lượng phụ âm. | Bóc băng câu chữ, phát hiện từ bỏ sót, nhận xét sư phạm văn phạm. | Phân tích từ vựng đối chiếu, gợi ý sửa lỗi phát âm tổng quát. | | Xác suất kích hoạt thực tế | 94.5% tổng số yêu cầu người dùng | 5.0% khi Tầng 1 nghẽn/timeout | 0.5% khi Tầng 2 quá tải/lỗi hạn mức |  \--- 

2.2. Thiết kế Backend và Dịch vụ ngữ âm

##### 

2.2.1. Thiết kế chi tiết các mô-đun nghiệp vụ Spring Boot và Pipeline xử lý âm học Python

######  **Hệ thống Backend được thiết kế theo cấu trúc Modular Monolith chuẩn hóa của Spring Boot 3, phân chia thành các gói nghiệp vụ độc lập, áp dụng chặt chẽ nguyên lý Đơn trách nhiệm (Single Responsibility Principle) và Kiến trúc phân tầng (Controller \- Service \- Repository \- Entity):  1\. Gói xác thực và người dùng (com`.englishlearning.auth):` Chịu trách nhiệm quản lý danh tính tài khoản. Lớp Jwt`TokenProvider tạ`o mã Access Token có thời hạn 15 phút mang các xác nhận quyền hạn (Claims: userId, roles, email). Lớp Ref`reshTokenService qu`ản lý cơ chế xoay vòng Refresh Token Rotation (thời hạn 7 ngày, lưu mã băm trong bảng ref`resh_tokens).` Lớp Use`rPrincipal hi`ện thực Use`rDetails củ`a Spring Security, hỗ trợ phân cấp người dùng thành Stu`dent và` Tea`cher li`ên kết 1-1 với thực thể Use`r. 2`. Gói lớp học và đào tạo (com.`englishlearning.classroom): Q`uản lý cấu trúc tổ chức lớp học (Clas`sroom), m`ã tham gia lớp học bảo mật, quan hệ ghi danh của học viên (Clas`sStudent) và` quản lý bài học (Less`on), t`ài liệu học tập đính kèm (Less`onDocument). 3`. Gói khảo thí và bài tập (com.e`nglishlearning.assignment & su`bmi`ssion): Cu`ng cấp công cụ quản trị vòng đời bài tập (Assig`nment) với` đa dạng hình thức: trắc nghiệm (Multiple Choice), điền từ vào chỗ trống (Fill in blank), nghe hiểu có âm thanh (Listening Audio), luyện phát âm lặp lại (Shadowing) và viết luận (Writing Essay). Quản lý chi tiết từng câu hỏi (Assig`nmentQuestion), cá`c phương án lựa chọn (Quest`ionOption), ph`iên làm bài của học sinh (Assig`nmentAttempt) và` bảng lưu câu trả lời chi tiết (Stude`ntAnswer). 4.` Gói trí tuệ nhân tạo và dịch vụ âm học (com.en`glishlearning.ai): Đón`g vai trò hạt nhân điều phối thông minh. Lớp Python`IntegrationService sử dụ`ng RestTe`mplate giao` tiếp với microservice âm học; Gemini`ClientService và Gr`oqCl`ientService quản` lý gọi API đám mây với cơ chế tự động làm sạch định dạng JSON Markdown; Shadow`ingService thực` thi luồng chấm điểm 3 tầng; AiLabS`ervice cung` cấp giao diện thử nghiệm trực quan cho quản trị viên kiểm thử các kịch bản chấm điểm phát âm. 5\. Gói lộ trình học và ôn tập lặp lại ngắt quãng (com.eng`lishlearning.curriculum): Cài` đặt thuật toán SuperMemo SM-2 trong lớp SrsServ`ice để điề`u phối lịch học từ vựng cho học viên. Dựa vào đánh giá của người học theo 4 cấp độ (EFq \\in {0: \\text{Again}, 1: \\text{Hard}, 2: \\text{Good}, 3: \\text{Easy}}EF), hệ thống tự động tính toán lại Hệ số dễ dàng (Ease Factor \- EFEFEF) và khoảng cách ngày ôn tập tiếp theo (I):  • Khoảng cách lặp lại: I(0) \= 1; `I(1) =` 6; `I(n) =` ro`und(I(n-1) × EF) (với n ≥` 2\) • `Hệ số` dễ nhớ: EF' \= max(`1.3, EF + (0.1 - (3 - q) × (0.08 + (3 - q) × 0.02)))  6. Gói x`ử lý video đa phương tiện (com.englishl`earning.video): Đóng gói` bộ điều phối tải lên video, giao tiếp với hàng đợi RabbitMQ, kích hoạt tiến trình con FFmpeg nén luồng HLS đa phân đoạn và đẩy dữ liệu lên Cloudflare R2 qua R2StorageSer`vice. 7. Gói kiể`m toán và giám sát hệ thống (com.englishle`arning.system): Ứng dụng c`ông nghệ lập trình hướng khía cạnh Spring AOP (AuditLoggingA`spect) bắt các chú` thích @RestControll`er trên toàn hệ` thống để tự động thu thập: tên người dùng, phương thức HTTP, URI, địa chỉ IP máy trạm, mã trạng thái phản hồi và thời gian thực thi (milliseconds), tự động lưu trữ bất đồng bộ vào bảng audit\_logs.** 

```` ``` Pipeli ````ne xử lý âm học tại Python FastAPI Microservice: \[Audio File 16kHz\] \---\> \[Voice Activity Detection (VAD)\] \---\> \[Wav2Vec 2.0 XLS-R-53 Forced Aligner\]                                                                           |                                        \+----------------------------------+----------------------------------+                                        |                                                                     |                          \[Praat Formant Extractor\]                                            \[Consonant Acoustic GOP Scorer\]

                     \- Đo Formant F1, F2 nguyên âm                                         \- Bằng chứng phổ năng lượng cao

                     `- Tính khoảng cách Euclid formant                                     - Kiểm tra âm chặn cuối từ`  
                                   `|                                                                     |`  
                                   `+----------------------------------+----------------------------------+`  
                                                                      `|`  
                                                  `[Prosody & Fluency Metric Evaluator]`

                                                  `- Tính WPM, Awkward Pauses (>= 250ms)`  
                                                  `- Tính Phonetic Linking (< 35ms)`  
                                                                      `|`  
                                                  `[Output: SpeechAssessmentResponse JSON]`

``` ``  *Bảng ``` 2.4: Đặc tả các mô-đun nghiệp vụ Backend Spring Boot và Python Phonetics Pipeline\*  | Tên mô-đun / Package | Lớp điều khiển chính (Controllers) | Lớp dịch vụ nghiệp vụ (Services) | Thực thể dữ liệu liên quan | | :--- | :--- | :--- | :--- | | \*\*Auth & Security\*\* |AuthController.java|AuthService,JwtTokenProvider,RefreshTokenService|User,Role,RefreshToken,Student,Teacher| | \*\*Classroom\*\* |ClassroomController.java|ClassroomService,LessonService|Classroom,ClassStudent,Lesson,LessonDocument| | \*\*Assignment & CBT\*\* |AssignmentController.java|AssignmentService,AiExerciseService,ExerciseAudioService|Assignment,AssignmentQuestion,QuestionOption,ExerciseAudio| | \*\*Submission & Grading\*\* |SubmissionController.java|SubmissionService,GradingService|AssignmentAttempt,StudentAnswer,AiEvaluation| | \*\*AI Coordination\*\* |AiEvaluationController.java|ShadowingService,PythonIntegrationService,GeminiClientService|AiEvaluation,StudentAiQuota,AiGeneratedExercise| | \*\*Curriculum & SRS\*\* |DailyStudyPlanController.java|DailyStudyPlanService,SrsService,VocabularyService|DailyStudyPlan,DailyPlanItem,VocabularyItem,StudentVocabularyProgress| | \*\*Video & Media HLS\*\* |VideoController.java|VideoService,R2StorageService,VideoTranscodeConsumer|Video,VideoWatchHistory| | \*\*Audit & System\*\* |AuditLogController.java|AuditLogService,AuditLoggingAspect|AuditLog,SystemConfig\` | 

2.2.2. Thiết kế trình tự (Sequence Diagram) và biểu đồ lớp chi tiết cho 5 Use Case tiêu biểu

######  **Phần này mô tả chi tiết tương tác động giữa các thành phần phần mềm (UI, Controller, Service, Repository, Database, External Services) cho 5 Use Case trọng tâm của đồ án:** 

1\. Nghiệp vụ Đăng nhập và Làm mới phiên xác thực (UC-AUTH-01)

###### *Học viên nhập thông tin tài khoản trên giao diện React. Hệ thống kiểm tra mật khẩu đã được băm bằng BCrypt, cấp phát cặp khóa Access Token (15 phút) và Refresh Token (7 ngày). Mã Refresh Token được lưu trong bảng `refresh_tokens` và trả về qua HTTP-only Secure Cookie. Khi Access Token hết hạn trong lúc đang làm bài, Axios Interceptor tự động phát hiện mã lỗi 401, gửi yêu cầu làm mới phiên theo cơ chế xoay vòng (xóa token cũ, cấp token mới, đưa token cũ vào Blacklist Redis), đảm bảo phiên học tập không bị gián đoạn.* 

 \+----------------------------------------------------------------------------------------------------+ | \[HÌNH ẢNH: D:\\HocTap\_DoAn\\doanchuyennganh\\englishlearning\\HinhAnh\_BaoCao\_Chuong2\\Hinh\_2\_4\_Sequence\_DangNhap\_LamMoiToken.png\] | \+----------------------------------------------------------------------------------------------------+  Hình 2.4: Biểu đồ tuần tự nghiệp vụ Đăng nhập và Làm mới phiên xác thực (UC-AUTH-01) 

*2\.* Nghiệp vụ Luyện phát âm Shadowing qua dịch vụ âm học và AI (UC-AI-01)

###### *Học viên thu âm trực tiếp trên trình duyệt theo câu mẫu hiển thị. File ghi âm WAV 16kHz được gửi lên `ShadowingController`. `ShadowingService` ưu tiên gọi microservice Python FastAPI để tính toán căn chỉnh thời gian âm vị Wav2Vec 2.0 và đo formant Praat F1/F2. Nếu microservice Python phản hồi chậm quá 3.5 giây, hệ thống tự động chuyển tiếp file âm thanh sang Groq Whisper để bóc băng và dùng Gemini 1.5 Flash chấm điểm. Điểm số và nhận xét chi tiết từng âm vị sau đó được lưu vào `ai_evaluations` và cập nhật chỉ số Speaking của học viên.* 

 \+----------------------------------------------------------------------------------------------------+ | \[HÌNH ẢNH: D:\\HocTap\_DoAn\\doanchuyennganh\\englishlearning\\HinhAnh\_BaoCao\_Chuong2\\Hinh\_2\_5\_Sequence\_LuyenPhatAm\_Shadowing.png\] | \+----------------------------------------------------------------------------------------------------+  Hình 2.5: Biểu đồ tuần tự nghiệp vụ Luyện phát âm Shadowing qua dịch vụ âm học và AI (UC-AI-01) 

*3\.* Nghiệp vụ Khởi tạo bài tập thông minh AI / Excel / TTS (UC-TEA-01)

###### *Giảng viên nhập chủ đề bài tập, cấp độ CEFR và số lượng câu hỏi trên cổng giáo viên. `AiExerciseService` gọi Gemini 1.5 Flash sinh danh sách câu hỏi dạng JSON chuẩn hóa. Với các câu hỏi thuộc kỹ năng Nghe hoặc Shadowing, hệ thống tự động kích hoạt dịch vụ Kokoro-82M TTS để sinh file âm thanh WAV 24kHz giọng bản xứ, tải lên Cloudflare R2 và lưu đường dẫn vào bảng `exercise_audios`. Giảng viên có thể kiểm tra nghe thử, điều chỉnh đáp án trước khi bấm phát hành vào Lộ trình học ngày của lớp.* 

 \+----------------------------------------------------------------------------------------------------+ | \[HÌNH ẢNH: D:\\HocTap\_DoAn\\doanchuyennganh\\englishlearning\\HinhAnh\_BaoCao\_Chuong2\\Hinh\_2\_6\_Sequence\_TaoBaiTap\_AI\_Excel\_TTS.png\] | \+----------------------------------------------------------------------------------------------------+  Hình 2.6: Biểu đồ tuần tự nghiệp vụ Khởi tạo bài tập thông minh AI / Excel / TTS (UC-TEA-01) 

*4\.* Nghiệp vụ Làm bài tập CBT và Chấm bài tự luận/nói bằng AI (UC-STU-01)

###### *Học viên bắt đầu bài kiểm tra CBT, hệ thống khởi tạo bản ghi `assignment_attempts` với trạng thái `IN_PROGRESS` và bắt đầu đếm ngược thời gian. Trong quá trình làm, các phương án chọn được tự động lưu nền (auto-save). Khi bấm nộp bài, hệ thống chấm điểm tức thì các câu hỏi trắc nghiệm, đồng thời đẩy các câu trả lời tự luận (bài viết luận hoặc file ghi âm bài nói) vào tác vụ chấm ngầm bất đồng bộ. Sau khi AI hoàn tất chấm điểm, kết quả được cập nhật và bắn qua kênh WebSocket STOMP về màn hình học viên.* 

 \+----------------------------------------------------------------------------------------------------+ | \[HÌNH ẢNH: D:\\HocTap\_DoAn\\doanchuyennganh\\englishlearning\\HinhAnh\_BaoCao\_Chuong2\\Hinh\_2\_7\_Sequence\_LamBaiCBT\_ChamAI.png\] | \+----------------------------------------------------------------------------------------------------+  Hình 2.7: Biểu đồ tuần tự nghiệp vụ Làm bài tập CBT và Chấm bài tự luận/nói bằng AI (UC-STU-01) 

*5\.* Nghiệp vụ Tải lên và Chuyển đổi Video HLS bất đồng bộ qua RabbitMQ (UC-SYS-01)

###### *Giảng viên tải lên bài giảng video MP4. `VideoController` lưu file tạm trên máy chủ và đẩy thông điệp `VideoTranscodeMessage` vào hàng đợi `video.transcode.queue` của RabbitMQ, trả về ngay HTTP 202 Accepted. `VideoTranscodeConsumer` tiếp nhận thông điệp, khởi chạy tiến trình FFmpeg để phân đoạn video thành các mảnh `.ts` độ dài 6 giây và tạo danh sách phát `master.m3u8`. Toàn bộ thư mục HLS được tải lên Cloudflare R2, cơ sở dữ liệu được cập nhật trạng thái `READY` kèm CDN URL, và hệ thống gửi thông báo WebSocket đến giảng viên.* 

 \+----------------------------------------------------------------------------------------------------+ | \[HÌNH ẢNH: D:\\HocTap\_DoAn\\doanchuyennganh\\englishlearning\\HinhAnh\_BaoCao\_Chuong2\\Hinh\_2\_8\_Sequence\_ChuyenDoiVideo\_HLS\_RabbitMQ.png\] | \+----------------------------------------------------------------------------------------------------+  Hình 2.8: Biểu đồ tuần tự nghiệp vụ Tải lên và Chuyển đổi Video HLS bất đồng bộ qua RabbitMQ (UC-SYS-01) 

*6\.* Biểu đồ lớp chi tiết của miền dữ liệu cốt lõi (Core Domain Model)

###### *Biểu đồ lớp dưới đây mô tả cấu trúc tĩnh của các thực thể nghiệp vụ trọng tâm trong hệ thống, các thuộc tính, kiểu dữ liệu, phạm vi truy cập (private/public), phương thức khởi tạo và các mối quan hệ quan trọng (kế thừa, quan hệ kết hợp 1-1, 1-N, N-M).* 

 \+----------------------------------------------------------------------------------------------------+ | \[HÌNH ẢNH: D:\\HocTap\_DoAn\\doanchuyennganh\\englishlearning\\HinhAnh\_BaoCao\_Chuong2\\Hinh\_2\_9\_BieuDoLop\_CoreDomain.png\] | \+----------------------------------------------------------------------------------------------------+  Hình 2.9: Biểu đồ lớp chi tiết của miền dữ liệu cốt lõi (Core Domain Model) 

*2.2*.3. Thiết kế cơ sở dữ liệu (Sơ đồ ERD, đặc tả bảng dữ liệu và ràng buộc toàn vẹn)

######  **Cơ sở dữ liệu của hệ thống được xây dựng trên hệ quản trị MariaDB / MySQL 10.4, bao gồm tổng cộng 32 bảng quan hệ được chuẩn hóa ở mức 3NF, đảm bảo loại bỏ hoàn toàn các dị thường dữ liệu (dị thường chèn, xóa, cập nhật) và tối ưu hóa tốc độ truy vấn thông qua các chỉ mục B-Tree trên các trường khóa ngoại và trường lọc thường xuyên.  Các bảng trong cơ sở dữ liệu được phân chia thành 5 cụm logic chuyên biệt:**

Cụm 1: Quản trị tài khoản, phân quyền & bảo mật: Bao gồm các bảng users, roles, user\_roles, refresh\_tokens, students, teachers, audit\_logs.

1. Cụm 2: Quản lý lớp học, học liệu & lộ trình học: Bao gồm các bảng classes, class\_students, lessons, lesson\_documents, daily\_study\_plans, daily\_plan\_items, learning\_sessions.  
2. Cụm 3: Khảo thí, ngân hàng đề thi CBT & nộp bài: Bao gồm các bảng assignments, assignment\_questions, question\_options, assignment\_attempts, student\_answers.  
3. Cụm 4: Đánh giá trí tuệ nhân tạo & hồ sơ kỹ năng: Bao gồm các bảng ai\_evaluations, ai\_generated\_exercises, student\_ai\_quotas, student\_skill\_profiles, student\_daily\_progress.  
4. Cụm 5: Học liệu đa phương tiện, Flashcard SM-2 & thông báo: Bao gồm các bảng vocabulary\_items, student\_vocabulary\_progress, exercise\_audios, videos, video\_watch\_histories, notifications, global\_resources, grammar\_topics.   
5.  \+----------------------------------------------------------------------------------------------------+ | \[HÌNH ẢNH: D:\\HocTap\_DoAn\\doanchuyennganh\\englishlearning\\HinhAnh\_BaoCao\_Chuong2\\Hinh\_2\_10\_SoDoERD\_CoSoDuLieu.png\] | \+----------------------------------------------------------------------------------------------------+  Hình 2.10: Sơ đồ quan hệ thực thể (ERD) toàn diện của cơ sở dữ liệu hệ thống (32 thực thể)  Dưới đây là bảng từ điển dữ liệu (Data Dictionary) chi tiết của các nhóm thực thể cốt lõi:  Bảng 2.5: Bảng từ điển dữ liệu nhóm Xác thực, Phân quyền & Người dùng  | Tên bảng / Cột | Kiểu dữ liệu | Khóa | Ràng buộc / Giá trị mặc định | Diễn giải ý nghĩa nghiệp vụ | | :--- | :--- | :--- | :--- | :--- | | users | | | | Bảng lưu trữ thông tin tài khoản người dùng | | id | VARCHAR(36) | PK | NOT NULL, UUID ngẫu nhiên | Định danh duy nhất của người dùng | | email | VARCHAR(255) | UK | NOT NULL, Unique Index | Địa chỉ email đăng nhập hệ thống | | password | VARCHAR(255) | | NOT NULL | Mật khẩu đã được băm an toàn bằng BCrypt | | full\_name | VARCHAR(255) | | NOT NULL | Họ và tên đầy đủ của người dùng | | status | ENUM | | DEFAULT 'ACTIVE' | Trạng thái tài khoản (ACTIVE, INACTIVE, LOCKED) | | created\_at | DATETIME(6) | | NOT NULL | Thời điểm khởi tạo tài khoản | | roles | | | | Bảng danh mục vai trò người dùng | | id | BIGINT | PK | NOT NULL, AUTOINCREMENT | Mã định danh vai trò | | name | VARCHAR(50) | UK | NOT NULL | Tên vai trò (ROLESTUDENT, ROLETEACHER, ROLEADMIN) | | user\_roles | | | | Bảng liên kết nhiều \- nhiều giữa người dùng và vai trò | | user\_id | VARCHAR(36) | PK, FK | REFERENCES users(id) | Mã định danh người dùng | | role\_id | BIGINT | PK, FK | REFERENCES roles(id) | Mã định danh vai trò được cấp phát | | refresh\_tokens | | | | Bảng quản lý xoay vòng Refresh Token | | id | VARCHAR(36) | PK | NOT NULL, UUID | Định danh phiên làm mới token | | user\_id | VARCHAR(36) | FK | REFERENCES users(id) | Người dùng sở hữu phiên | | token\_hash | VARCHAR(255) | UK | NOT NULL | Chuỗi băm bí mật của Refresh Token | | expiry\_date | DATETIME(6) | | NOT NULL | Thời điểm hết hạn hiệu lực (7 ngày) | | revoked | BIT(1) | | DEFAULT 0 | Đánh dấu token đã bị thu hồi / xoay vòng |  Bảng 2.6: Bảng từ điển dữ liệu nhóm Lớp học, Học liệu & Lộ trình ngày  | Tên bảng / Cột | Kiểu dữ liệu | Khóa | Ràng buộc / Giá trị mặc định | Diễn giải ý nghĩa nghiệp vụ | | :--- | :--- | :--- | :--- | :--- | | classes | | | | Bảng lưu thông tin lớp học | | id | VARCHAR(36) | PK | NOT NULL, UUID | Mã định danh lớp học | | code | VARCHAR(50) | UK | NOT NULL, Unique | Mã tham gia lớp học bảo mật | | name | VARCHAR(255) | | NOT NULL | Tên khóa học / lớp học | | teacher\_id | VARCHAR(36) | FK | REFERENCES teachers(id) | Giảng viên phụ trách lớp học | | status | VARCHAR(50) | | DEFAULT 'ACTIVE' | Trạng thái lớp (ACTIVE, COMPLETED, ARCHIVED) | | class\_students | | | | Bảng ghi danh học viên vào lớp học | | id | VARCHAR(36) | PK | NOT NULL, UUID | Mã định danh lượt ghi danh | | class\_id | VARCHAR(36) | FK | REFERENCES classes(id) | Lớp học được ghi danh | | student\_id | VARCHAR(36) | FK | REFERENCES students(id) | Học viên tham gia lớp học | | daily\_study\_plans| | | | Bảng kế hoạch học tập theo ngày | | id | VARCHAR(36) | PK | NOT NULL, UUID | Định danh kế hoạch học tập | | student\_id | VARCHAR(36) | FK | REFERENCES students(id) | Học viên được giao kế hoạch | | plan\_date | DATE | | NOT NULL | Ngày thực thi kế hoạch học tập | | status | VARCHAR(50) | | DEFAULT 'PENDING' | Trạng thái kế hoạch (PENDING, COMPLETED) | | daily\_plan\_items | | | | Chi tiết các tác vụ cần hoàn thành trong ngày | | id | VARCHAR(36) | PK | NOT NULL, UUID | Định danh tác vụ học tập | | plan\_id | VARCHAR(36) | FK | REFERENCES dailystudyplans(id)| Kế hoạch ngày trực thuộc | | item\_type | VARCHAR(50) | | NOT NULL | Loại tác vụ (ASSIGNMENT, VOCABULARY, LESSON) | | reference\_id | VARCHAR(36) | | NOT NULL | Khóa ngoại mềm trỏ tới bài tập/từ vựng/bài giảng | | is\_completed | BIT(1) | | DEFAULT 0 | Trạng thái đã hoàn thành hay chưa |  Bảng 2.7: Bảng từ điển dữ liệu nhóm Khảo thí CBT & Lượt làm bài  | Tên bảng / Cột | Kiểu dữ liệu | Khóa | Ràng buộc / Giá trị mặc định | Diễn giải ý nghĩa nghiệp vụ | | :--- | :--- | :--- | :--- | :--- | | assignments | | | | Bảng lưu trữ đề bài tập / bài thi CBT | | id | VARCHAR(36) | PK | NOT NULL, UUID | Định danh đề bài tập | | title | VARCHAR(255) | | NOT NULL | Tiêu đề bài tập | | type | VARCHAR(50) | | NOT NULL | Dạng bài tập (CBTEXAM, HOMEWORK, SHADOWING) | | total\_points | DOUBLE | | NOT NULL, DEFAULT 10.0 | Tổng điểm của bài kiểm tra | | duration\_minutes | INT | | NOT NULL | Thời gian làm bài tối đa (phút) | | deadline | DATETIME(6) | | NULLABLE | Thời hạn cuối cùng nộp bài | | class\_id | VARCHAR(36) | FK | REFERENCES classes(id) | Lớp học được giao bài tập | | assignment\_questions | | | | Chi tiết câu hỏi trong bài tập | | id | VARCHAR(36) | PK | NOT NULL, UUID | Định danh câu hỏi | | assignment\_id | VARCHAR(36) | FK | REFERENCES assignments(id) | Bài tập chứa câu hỏi | | content | TEXT | | NOT NULL | Nội dung câu hỏi (hỗ trợ văn bản/HTML) | | type | VARCHAR(50) | | NOT NULL | Loại câu hỏi (MULTIPLECHOICE, FILLBLANK, SPEAKING, WRITING) | | points | DOUBLE | | NOT NULL, DEFAULT 1.0 | Điểm số của câu hỏi | | order\_index | INT | | NOT NULL | Thứ tự hiển thị trong đề thi | | assignment\_attempts | | | | Lượt làm bài của học viên | | id | VARCHAR(36) | PK | NOT NULL, UUID | Định danh lượt làm bài | | assignment\_id | VARCHAR(36) | FK | REFERENCES assignments(id) | Bài kiểm tra được thực hiện | | student\_id | VARCHAR(36) | FK | REFERENCES students(id) | Học viên thực hiện lượt làm bài | | started\_at | DATETIME(6) | | NOT NULL | Thời điểm bắt đầu tính giờ | | submitted\_at | DATETIME(6) | | NULLABLE | Thời điểm bấm nộp bài | | total\_score | DOUBLE | | NULLABLE | Điểm số tổng kết cuối cùng | | status | VARCHAR(50) | | DEFAULT 'INPROGRESS' | Trạng thái (INPROGRESS, SUBMITTED, GRADED) | | student\_answers | | | | Chi tiết câu trả lời của từng câu hỏi | | id | VARCHAR(36) | PK | NOT NULL, UUID | Định danh câu trả lời | | attempt\_id | VARCHAR(36) | FK | REFERENCES assignmentattempts(id) | Lượt làm bài chứa câu trả lời | | question\_id | VARCHAR(36) | FK | REFERENCES assignmentquestions(id)| Câu hỏi được trả lời | | selected\_option\_id| VARCHAR(36)| | NULLABLE | Phương án trắc nghiệm được chọn | | text\_response | TEXT | | NULLABLE | Nội dung trả lời tự luận / điền khuyết | | audio\_response\_url| VARCHAR(500)| | NULLABLE | Đường dẫn file ghi âm câu trả lời nói | | earned\_points | DOUBLE | | NULLABLE | Điểm số đạt được của câu trả lời | | is\_correct | BIT(1) | | NULLABLE | Đánh giá đúng/sai |  Bảng 2.8: Bảng từ điển dữ liệu nhóm Đánh giá AI, Kỹ năng CEFR & Media  | Tên bảng / Cột | Kiểu dữ liệu | Khóa | Ràng buộc / Giá trị mặc định | Diễn giải ý nghĩa nghiệp vụ | | :--- | :--- | :--- | :--- | :--- | | ai\_evaluations| | | | Kết quả phân tích âm học và trí tuệ nhân tạo | | id | VARCHAR(36) | PK | NOT NULL, UUID | Định danh kết quả đánh giá AI | | student\_answer\_id| VARCHAR(36) | UK, FK | REFERENCES studentanswers(id) | Câu trả lời của học viên được đánh giá | | eval\_type | ENUM | | NOT NULL | Dạng đánh giá (SPEAKING, WRITING) | | overall\_score | DOUBLE | | NOT NULL | Điểm tổng quát (thang 10 hoặc 100\) | | pronunciation\_score| DOUBLE | | NULLABLE | Điểm phát âm trích xuất âm học | | fluency\_score | DOUBLE | | NULLABLE | Điểm lưu loát và ngắt nghỉ tự nhiên | | grammar\_score | DOUBLE | | NULLABLE | Điểm ngữ pháp câu văn | | vocabulary\_score| DOUBLE | | NULLABLE | Điểm mức độ phong phú từ vựng | | evaluation\_engine| VARCHAR(50) | | NOT NULL | Tên engine đánh giá (PYTHON, GEMINI, GROQ) | | stt\_transcript | TEXT | | NULLABLE | Văn bản bóc băng âm thanh nguyên văn | | suggestions\_json| LONGTEXT | | NULLABLE | Toàn bộ dữ liệu JSON chi tiết từng âm vị IPA | | student\_vocabulary\_progress| | | Bảng theo dõi Flashcard Spaced Repetition (SM-2) | | id | VARCHAR(36) | PK | NOT NULL, UUID | Định danh tiến trình từ vựng | | student\_id | VARCHAR(36) | FK | REFERENCES students(id) | Học viên sở hữu thẻ từ vựng | | vocabulary\_id | VARCHAR(36) | FK | REFERENCES vocabulary\_items(id)| Từ vựng tiếng Anh được ôn tập | | stage | ENUM | | DEFAULT 'LEARNING' | Giai đoạn nhớ (LEARNING, REVIEWING, MASTERED) | | ease\_factor | DOUBLE | | NOT NULL, DEFAULT 2.5 | Hệ số dễ nhớ EFEFEF của thuật toán SM-2 | | interval\_days | INT | | NOT NULL, DEFAULT 1 | Khoảng thời gian số ngày cần ôn lại tiếp theo | | repetitions | INT | | NOT NULL, DEFAULT 0 | Số lần học viên ôn tập liên tục thành công | | next\_review\_at | DATETIME(6) | | NOT NULL | Mốc thời gian chính xác cần kích hoạt ôn lại | | videos | | | | Bảng quản lý video bài giảng nén HLS | | id | VARCHAR(36) | PK | NOT NULL, UUID | Định danh video bài giảng | | lesson\_id | VARCHAR(36) | FK | REFERENCES lessons(id) | Bài học chứa video | | title | VARCHAR(255) | | NOT NULL | Tiêu đề video bài giảng | | duration | INT | | NOT NULL, DEFAULT 0 | Thời lượng video (giây) | | status | ENUM | | DEFAULT 'UPLOADED' | Trạng thái (UPLOADED, PROCESSING, READY) | | hls\_playlist\_url | VARCHAR(500) | | NULLABLE | Đường dẫn phát CDN playlist master.m3u8 | | raw\_storage\_url | VARCHAR(500) | | NULLABLE | Đường dẫn lưu trữ file gốc trên Cloudflare R2 | 

2.2.4. Thiết kế `hợp đồng gi`ao tiế`p RESTful API v`à DTO

 Hệ thống tuân thủ nghiêm ngặt chuẩn kiến trúc RESTful. Mọi yêu cầu đều được định tuyến qua tiền tố phiên bản /`api/v1/.` Kết quả trả về được đóng gói thống nhất trong lớp chuẩn hóa A`piResponse<T>:` 

json {   "success": true,   "message": "Thông báo trạng thái thực thi nghiệp vụ",   "data": { ... },   "timestamp": "2026-10-17T12:00:00.000Z" }   Bảng 2.9: Đặc tả hợp đồng giao tiếp RESTful API cốt lõi  | Phương thức HTTP | Điểm cuối (Endpoint) | Quyền hạn (RBAC) | Payload yêu cầu (Request DTO) | Dữ liệu phản hồi (Response DTO) | Mã trạng thái | | :--- | :--- | :--- | :--- | :--- | :--- | | POST | /api/v1/auth/login | Công khai (Public) | LoginRequest {email, password} | AuthResponse {accessToken, userDto} | 200 OK | | POST | /api/v1/auth/refresh-token | Công khai (Public) | Cookie: refreshToken | AuthResponse {newAccessToken} | 200 OK | | POST | /api/v1/ai/shadowing/evaluate| ROLE\_STUDENT | MultipartFile audio, script, answerId | ShadowingEvaluationResponse (IPA, F1/F2, KPI) | 200 OK | | POST | /api/v1/teacher/assignments/generate-ai | ROLE\_TEACHER | AiGenerateExerciseRequest {topic, cefr, count} | AssignmentResponse (Danh sách câu hỏi & audio TTS) | 201 Created | | POST | /api/v1/teacher/videos/upload | ROLE\_TEACHER | MultipartFile video, title, lessonId | VideoResponse {id, status="QUEUED"} | 202 Accepted | | POST | /api/v1/student/assignments/{id}/start | ROLE\_STUDENT | Path Variable id | AttemptStartResponse {attemptId, questionsList} | 200 OK | | PUT | /api/v1/student/attempts/{id}/save-answer | ROLE\_STUDENT | SaveAnswerRequest {questionId, optionId, text} | ApiResponse\<Void\> | 200 OK | | POST | /api/v1/student/attempts/{id}/submit | ROLE\_STUDENT | Path Variable id | SubmitAttemptResponse {totalScore, status} | 200 OK | | POST | /api/v1/student/srs/review | ROLE\_STUDENT | SrsReviewRequest {vocabularyId, grade: 0..3} | SrsReviewResponse {nextReviewAt, stage} | 200 OK | | GET | /api/v1/admin/ai/monitoring | ROLE\_ADMIN | Query Params: from, to, engine | AiMonitoringDto {totalCalls, totalTokens, cost} | 200 OK |  \--- 

2.3. Th`iết kế` Frontend

2.3.1. Kiến trúc giao diện React SPA, phân quyền định tuyến và quản lý trạng thái

######  **Frontend được thiết kế theo mô hình Component-Based Architecture hiện đại sử dụng React 18 và công cụ đóng gói siêu tốc Vite. Kiến trúc bao gồm các lớp:  1\. Hệ thống định tuyến và phân quyền người dùng (Routing & Protected Routes):     Sử dụng thư viện reac`t-router-dom v6` kết hợp component bọc bảo vệ Prot`ectedRoute. Kh`i người dùng truy cập một liên kết, Prot`ectedRoute kiể`m tra trạng thái xác thực từ Zustand Store (useA`uthStore). N`ếu chưa đăng nhập, tự động lưu lại đường dẫn hiện tại và chuyển hướng về /log`in. Nế`u đã đăng nhập, component kiểm tra danh sách vai trò (user`.roles) đố`i chiếu với quyền hạn yêu cầu của trang. Nếu không thỏa mãn, hiển thị trang lỗi 403 Forbidden.  2\. Quản lý trạng thái toàn cục với Zustand (Global State Management):     Thay vì sử dụng Redux vốn cồng kềnh với nhiều boilerplate code, đề tài sử dụng Zustand làm thư viện quản lý trạng thái chính. useAuth`Store chịu t`rách nhiệm lưu trữ thông tin tài khoản hiện hành, danh sách quyền và chuỗi khóa Access Token. Trạng thái được tự động đồng bộ hóa với LocalStorage thông qua middleware persist `của Zu`stand, giúp bảo toàn phiên đăng nhập khi người dùng tải lại trang.  3\. Cơ chế đánh chặn HTTP hai tầng với Axios Interceptor:     Để đảm bảo tính thông suốt khi người dùng đang học bài hoặc thi cử, hệ thống cài đặt bộ đánh chặn kép:**

Request Interceptor: Tự động trích xuất Access Token hợp lệ từ useAuthStore và gắn vào tiêu đề Authorization: Bearer \<token\> trước khi bất kỳ yêu cầu nào rời khỏi trình duyệt.

* Response Interceptor: Đăng ký bộ lắng nghe phản hồi toàn cục. Khi máy chủ trả về mã lỗi 401 Unauthorized (do Access Token hết hạn sau 15 phút), Axios tạm dừng toàn bộ các yêu cầu đang gửi đồng thời và đưa vào một hàng đợi chờ (Promise Queue Mutex). Một yêu cầu duy nhất POST /api/v1/auth/refresh-token được tự động gửi đi để xin cấp Access Token mới. Sau khi nhận được token mới, hệ thống cập nhật lại Store và tự động phát lại (replay) toàn bộ các yêu cầu đang chờ trong hàng đợi một cách trong suốt với người dùng.   
*  \+----------------------------------------------------------------------------------------------------+ | \[HÌNH ẢNH: D:\\HocTap\_DoAn\\doanchuyennganh\\englishlearning\\HinhAnh\_BaoCao\_Chuong2\\Hinh\_2\_11\_KienTrucFrontend\_ReactZustand.png\] | \+----------------------------------------------------------------------------------------------------+  Hình 2.11: Kiến trúc Frontend React SPA, phân quyền định tuyến và quản lý trạng thái Zustand 

*2.3*.2. Thiết kế các màn hình chính của Học viên, Giảng viên và Quản trị viên

######  **Giao diện người dùng được tối ưu hóa theo trải nghiệm người dùng (UX/UI) với thư viện kiểu dáng TailwindCSS, đảm bảo tính đáp ứng (Responsive) trên cả màn hình máy tính để bàn (Desktop), máy tính bảng (Tablet) và điện thoại thông minh (Mobile):  Bản*g 2.10: Đặc tả các luồng màn hình chính và thành phần giao diện Frontend React theo vai trò  |* Phân hệ người dùng | Tên màn hình / Tệp nguồn Component | Chức năng và thành phần giao diện chính | | :--- | :--- | :--- | | Học viên (Student) | DailyHo`meworkPage.tsx | Lộ t`rình học ngày hiển thị danh sách công việc cần làm: bài tập chưa nộp, thẻ từ vựng cần ôn hôm nay, bài giảng cần xem. Tích hợp thanh tiến độ phần trăm và số ngày duy trì chuỗi học tập liên tục (Streak). | | | Speaking`AiEvaluationPage.tsx | Màn h`ình luyện phát âm Shadowing AI: Hiển thị câu mẫu, nút phát âm thanh mẫu chuẩn, nút ghi âm trực quan kèm biểu đồ sóng âm (Waveform Canvas). Sau khi ghi âm, hệ thống tô màu câu nói (Xanh lá: Chuẩn, Vàng: Cần sửa, Đỏ: Phát âm sai, Xám: Bỏ sót), kèm bảng giải phẫu từng âm vị IPA và biểu đồ Formant F1/F2 Praat. | | | Assignmen`tTakePage.tsx | Giao d`iện phòng thi trực tuyến CBT: Bộ đếm ngược thời gian làm bài, bảng lưới câu hỏi hỗ trợ đánh dấu câu hỏi cần xem lại, tự động lưu câu trả lời ngầm, chống gian lận khi chuyển tab trình duyệt. | | | StudentFla`shcardsPage.tsx | Màn hìn`h ôn tập từ vựng Spaced Repetition (SM-2): Thẻ lật 2 mặt (Flashcard Flip) hiển thị từ vựng, phiên âm IPA, nghĩa tiếng Việt, câu ví dụ và âm thanh phát âm. 4 nút bấm chấm điểm khả năng nhớ: Again, Hard, Good, Easy. | | | StudentProf`ilePage.tsx | Hồ sơ nă`ng lực cá nhân: Biểu đồ mạng nhện Radar Chart thể hiện điểm số 4 kỹ năng Nghe \- Nói \- Đọc \- Viết quy đổi theo khung tham chiếu châu Âu CEFR (A1 \- C2), lịch sử điểm thi và biểu đồ tăng trưởng từ vựng. | | Giảng viên (Teacher) | TeacherDashb`oardPage.tsx | Tổng quan` giảng dạy: Thống kê số lượng lớp phụ trách, số bài tập cần chấm điểm, biểu đồ phân bố điểm số trung bình của các lớp học. | | | TeacherClassD`etailPage.tsx | Quản lý ch`i tiết lớp học: Danh sách học viên, quản lý bài giảng video, giao bài tập theo lớp và theo dõi tỷ lệ hoàn thành bài tập của từng học viên. | | | TeacherDailyPl`anPage.tsx | Khởi tạo bà`i tập đa nguồn: Tích hợp trình soạn thảo bài tập AI (nhập Prompt sinh câu hỏi), nhập liệu hàng loạt từ file Excel (.xlsx), cấu hì`nh gi`ọng đọc TTS mẫu và thiết lập lộ trình học ngày. | | | TeacherGradingP`age.tsx | Bàn làm việc` chấm bài: Chấm bài viết luận và bài nói tự luận, nghe lại file ghi âm của học viên, xem gợi ý điểm số và nhận xét tự động từ AI, ghi nhận điểm số chính thức và phản hồi cá nhân hóa. | | Quản trị (Admin) | AdminDashboardPa`ge.tsx | Bảng điều khi`ển quản trị trung tâm: Thống kê số lượng người dùng đang hoạt động, biểu đồ lượng yêu cầu API và tỷ lệ phân bổ vai trò. | | | AiMonitoringPage.`tsx | Giám sát chi p`hí và hạn ngạch AI: Thống kê số lượt gọi, dung lượng token sử dụng theo từng mô hình (Gemini, Groq, Whisper, Python), tỷ lệ kích hoạt cơ chế dự phòng Fallback và cảnh báo vượt ngưỡng ngân sách. | | | AuditLogPage.tsx | `Nhật ký kiểm to`án hệ thống: Bảng tra cứu lịch sử thao tác người dùng theo thời gian thực (đăng nhập, sửa điểm, xóa học liệu, cấp quyền), hỗ trợ tìm kiếm theo IP, User ID và Endpoint. | | | VideoModerationPage`.tsx | Quản lý và kiểm` duyệt video bài giảng: Theo dõi trạng thái tiến trình nén HLS của FFmpeg qua RabbitMQ, xem trước luồng HLS trực tiếp từ Cloudflare R2 CDN và phê duyệt nội dung số. |** 

2.3.3. Thiết kế luồng tương tác người dùng và xử lý bất đồng bộ trên giao diện

######  **Để tạo cảm giác phản hồi mượt mà cho các tác vụ âm thanh và chấm điểm AI vốn tiêu tốn thời gian tính toán, giao diện áp dụng mô hình thiết kế phản ứng bất đồng bộ (Reactive Asynchronous Pattern):  1\. Luồng thu âm thời gian thực với Web Audio API:    Khi học viên bấm nút "Bắt đầu nói", trình duyệt yêu cầu quyền truy cập thiết bị thông qua navi`gator.mediaDevices.getUserMedia({ audio: true }). Lu`ồng tín hiệu âm thanh thu được đưa vào Audi`oContext. Th`ay vì sử dụng bộ mã hóa mặc định của trình duyệt vốn cho ra các định dạng nén suy giảm chất lượng (như WebM hoặc OGG), hệ thống sử dụng một Audi`oWorkletNode để` can thiệp trực tiếp vào mảng mẫu PCM, tự động chuyển đổi tần số mẫu xuống 16.000 Hz đơn kênh (mono) và đóng gói thành chuỗi byte định dạng WAV chuẩn (RIFF Header 44 bytes). Song song với quá trình thu âm, một đối tượng Anal`yserNode tín`h toán biến đổi Fourier nhanh (FFT) để vẽ biểu đồ dạng sóng âm dao động sống động trên thẻ \<can`vas>, gi`úp học viên nhận biết ngay cường độ giọng nói của mình có đủ rõ ràng hay không.  2\. Cơ chế cập nhật trạng thái chấm điểm hai giai đoạn (Two-Phase Feedback):    \- Giai đo*ạn 1 (Lạc quan \- Optimistic UI): Ngay k*hi học viên nhấn "Nộp bài", giao diện khóa nút bấm để chống bấm đúp, hiển thị biểu tượng tiến trình xoay kèm thông báo "Hệ thố*ng đang phân tích ngữ âm...". Đối v*ới các bài tập trắc nghiệm, các câu trả lời đúng/sai được tính toán cục bộ và hiển thị điểm tạm thời ngay lập tức (\< 100ms).    \- Giai đoạ*n 2 (Đẩy dữ liệu thời gian thực qua WebSocket): Đối với* các câu hỏi tự luận và bài tập Shadowing phức tạp cần xử lý qua các tầng AI, trình duyệt duy trì kết nối WebSocket STOMP. Khi tác vụ nền trên Spring Boot hoàn tất, máy chủ phát tín hiệu cập nhật trạng thái trực tiếp về máy trạm. Trình duyệt nhận được gói tin JSON sẽ tự động kích hoạt hiệu ứng chuyển cảnh mượt mà, gỡ bỏ biểu tượng chờ và hiển thị toàn bộ kết quả phân tích: tô màu câu chữ, hiển thị nhận xét sư phạm và phát âm thanh chúc mừng nếu đạt chuẩn mà người dùng hoàn toàn không cần phải tải lại trang (zero page-reload).** 

 \+----------------------------------------------------------------------------------------------------+ | \[HÌNH ẢNH: D:\\HocTap\_DoAn\\doanchuyennganh\\englishlearning\\HinhAnh\_BaoCao\_Chuong2\\Hinh\_2\_12\_LuongTuongTacAudio\_WebSocket.png\] | \+----------------------------------------------------------------------------------------------------+  Hình 2.12: Sơ đồ luồng tương tác thời gian thực thu âm Audio và phản hồi WebSocket  \--- 

2.4. Kết luận Chương 2

#####  ***Chương 2 đã hoàn thành toàn diện và chi tiết công tác thiết kế hệ thống học tiếng Anh trực tuyến tích hợp trí tuệ nhân tạo và đánh giá ngữ âm tính toán, cụ thể đạt được các kết quả kỹ thuật cốt lõi sau:  1\. Thiết kế kiến trúc hệ thống tổng thể vững chắc: Đề xuất và đặc tả thành công mô hình kiến trúc lai Modular Monolith (Spring Boot 3\) kết hợp Acoustic Microservice (Python FastAPI), tận dụng triệt để sức mạnh giao dịch toàn vẹn ACID của nền tảng Java và năng lực tính toán học sâu/ngữ âm học chuyên sâu của Python. 2\. Hiện thực hóa cơ chế dự phòng đa tầng 3-Tier AI Fallback: Xây dựng giải pháp kỹ thuật hoàn chỉnh kết hợp giữa dịch vụ âm học tính toán nội bộ (Wav2Vec2 \+ Praat C++), mô hình STOMP tốc độ cao Groq Whisper \+ Gemini 1.5 Flash và dự phòng khẩn cấp Groq LLaMA 3.3 70B, đảm bảo thời gian phản hồi dưới 1 giây, tiết kiệm tối đa chi phí vận hành và nâng cao độ sẵn sàng dịch vụ lên 99.9%. 3\. Mô hình hóa động và tĩnh chi tiết cho các nghiệp vụ trọng tâm: Xây dựng đầy đủ 5 biểu đồ tuần tự (Sequence Diagram) chuẩn UML cho các ca sử dụng cốt lõi (Đăng nhập xoay vòng Token, Luyện Shadowing, Soạn bài tập AI/TTS, Khảo thí CBT và Chuyển đổi Video HLS qua RabbitMQ) cùng biểu đồ lớp (Class Diagram) chi tiết cho miền dữ liệu cốt lõi. 4\. Chuẩn hóa cơ sở dữ liệu quan hệ toàn diện: Thiết kế sơ đồ quan hệ thực thể (ERD) hoàn chỉnh với 32 bảng chuẩn hóa 3NF, phân bổ thành 5 cụm logic chặt chẽ, đi kèm bảng từ điển dữ liệu đặc tả chính xác từng trường khóa chính, khóa ngoại, kiểu dữ liệu và ràng buộc toàn vẹn. 5\. Thiết kế giao diện hiện đại và tối ưu hóa trải nghiệm người dùng: Xây dựng kiến trúc Frontend React SPA hoàn chỉnh, bảo vệ phân quyền chặt chẽ theo vai trò (Student, Teacher, Admin), quản lý trạng thái tập trung với Zustand, cơ chế tự động làm mới Access Token trong suốt qua Axios Interceptor và luồng tương tác thu âm/phản hồi thời gian thực qua Web Audio API và WebSocket STOMP.  Toàn bộ các bản vẽ kỹ thuật, hợp đồng API và thông số thiết kế được xác lập trong Chương 2 là kim chỉ nam trực tiếp để tiến hành công tác cài đặt mã nguồn, cấu hình hạ tầng và triển khai các thuật toán tại Chương 3: Xây dựng và cài đặt hệ thống.*** 

**CHƯƠNG** 3\. XÂY DỰNG VÀ CÀI ĐẶT HỆ THỐNG

#### 

3.1. Môi trường phát triển, công cụ và tổ chức mã nguồn

##### 

3.1.1. Môi trường phát triển và các thư viện trọng tâm

###### 

3.1.2. Cấu trúc cây thư mục mã nguồn 3 thành phần (Backend, Python Service, Frontend)

###### 

3.2. Cài đặt cơ sở dữ liệu và hạ tầng tích hợp

##### 

3.2.1. Cài đặt cơ sở dữ liệu MySQL và cấu hình kết nối HikariCP

###### 

3.2.2. Cấu hình Redis Cache, RabbitMQ Message Broker và Cloudflare R2 Storage

###### 

3.3. Xây dựng các chức năng Backend và Dịch vụ AI / Ngữ âm

##### 

3.3.1. Cài đặt xác thực JWT, phân quyền Role-based và ghi nhật ký tự động Spring AOP

###### 

3.3.2. Cài đặt Pipeline đánh giá ngữ âm chuyên sâu trên Python

###### 

3.3.3. Cài đặt dịch vụ điều phối chấm điểm AI đa tầng (3-Tier AI Fallback)

###### 

3.3.4. Cài đặt sinh bài tập tự động, tổng hợp Neural Edge-TTS và lập lịch lộ trình học

###### 

3.3.5. Cài đặt xử lý chuyển đổi Video HLS qua RabbitMQ & FFmpeg và ôn tập SM-2 SRS

###### 

3.4. Xây dựng giao diện Frontend và minh họa kết quả thực thi

##### 

3.4.1. Cài đặt Axios Interceptor tự động làm mới Token và điều hướng theo vai trò

###### 

3.4.2. Minh họa giao diện phân hệ Học viên

###### 

3.4.3. Minh họa giao diện phân hệ Giảng viên

###### 

3.4.4. Minh họa giao diện phân hệ Quản trị viên

###### 

3.5. Kết luận Chương 3

##### 

CHƯƠNG 4\. KIỂM THỬ VÀ ĐÁNH GIÁ HỆ THỐNG

#### 

4.1. Mục tiêu, phương pháp và phạm vi kiểm thử

##### 

4.1.1. Mục tiêu kiểm thử

###### 

4.1.2. Phương pháp kiểm thử (Hộp đen API/UI, Đơn vị JUnit/Mockito, Tích hợp liên dịch vụ)

###### 

4.1.3. Ma trận truy vết yêu cầu và kiểm soát rủi ro

###### 

4.1.4. Môi trường và bộ dữ liệu kiểm thử đại diện

###### 

4.2. Thiết kế các ca kiểm thử và kết quả thực thi

##### 

4.2.1. Kiểm thử chức năng Xác thực, Phân quyền và Làm mới Token (TC-AUTH)

###### 

4.2.2. Kiểm thử Dịch vụ đánh giá ngữ âm Python và Cơ chế dự phòng 3 tầng (TC-PHONETICS)

###### 

4.2.3. Kiểm thử Khởi tạo bài tập AI, nhập Excel và tổng hợp giọng đọc Edge-TTS (TC-ASSIGN)

###### 

4.2.4. Kiểm thử luồng Làm bài tập CBT và Chấm bài Writing/Speaking bằng AI (TC-SUBMISSION)

###### 

4.2.5. Kiểm thử luồng Tải lên tài liệu R2 và Xử lý Video HLS qua RabbitMQ (TC-MEDIA)

###### 

4.3. Tổng hợp kết quả và đánh giá hệ thống

##### 

4.3.1. Bảng tổng hợp kết quả thực thi kiểm thử

###### 

4.3.2. Đánh giá mức độ đáp ứng yêu cầu chức năng và phi chức năng

###### 

4.3.3. Nhận xét về tính đúng đắn, độ ổn định, tính tin cậy và khả năng vận hành

###### 

4.4. Kết luận Chương 4

##### 

KẾT LUẬN VÀ HƯỚNG PHÁT TRIỂN

#### 

1\. Tóm tắt các kết quả đạt được

##### 

2\. Ưu điểm và hạn chế của hệ thống

##### 

3\. Hướng phát triển và mở rộng trong tương lai

##### 

TÀI LIỆU THAM KHẢO

