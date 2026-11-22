# 03. Đặc tả Giao diện Lập trình & Hợp đồng Giao tiếp (API Specification)

> Tài liệu này đặc tả toàn bộ hợp đồng giao tiếp ngoại vi và nội bộ của nền tảng **ELP**, bao gồm chuẩn Envelope/Exception, **23 REST Controllers (Spring Boot `:8080`)**, **2 Python AI Microservices (`:8000` & `:8001`)**, **WebSocket STOMP & Binary Audio**, và **HTTP Range Media Streaming**.

---

## 1. Quy ước Chung, Phiên bản hóa & Chuẩn Envelope

### 1.1. Định tuyến & Phiên bản hóa (API Versioning)

- **Chuẩn chính:** Tiền tố `/api/v1/*` cho hầu hết các miền (`auth`, `users`, `admin/*`, `teacher/*`, `student/*`, `ai/*`, `analytics/*`, `videos/*`, `notifications/*`, `curriculum/daily-plans/*`).
- **Đường dẫn Legacy chưa gắn `v1`:** Một số controller thuộc lớp học và học liệu hiện dùng tiền tố `/api/` trực tiếp: `/api/admin/classrooms`, `/api/teacher/classrooms`, `/api/student/classrooms`, `/api/curriculum/*`.
- **Tài liệu tương tác OpenAPI 3 / Swagger UI:** Kích hoạt tại `/swagger-ui.html` và `/v3/api-docs` (được Nginx reverse proxy từ `:3000` sang `:8080`).

### 1.2. Chuẩn Payload Thành công & Phân trang

Tất cả các API JSON thông thường đóng gói kết quả trong **`ApiResponse<T>`** (`com.englishlearning.common.dto.ApiResponse`):

```json
{
  "status": 200,
  "message": "Success",
  "data": {}
}
```

Các endpoint có phân trang sử dụng **`PageResponse<T>`** (`content`, `pageNumber`, `pageSize`, `totalElements`, `totalPages`, `last`) hoặc Spring Data `Page<T>` (tại `NotificationController`).

### 1.3. Chuẩn Phản hồi Lỗi & Ánh xạ Ngoại lệ (`GlobalExceptionHandler`)

Mọi ngoại lệ không được xử lý cục bộ đều đi qua `@RestControllerAdvice` (`GlobalExceptionHandler`) và trả về **`ErrorResponse`**:

```json
{
  "timestamp": "2026-11-19T08:30:00.000Z",
  "status": 400,
  "error": "Bad Request",
  "message": "Thông báo lỗi chi tiết",
  "path": "/api/v1/...",
  "validationErrors": {
    "fieldName": "Lý do không hợp lệ"
  }
}
```

| Ngoại lệ Backend | HTTP Status | Ngữ cảnh phát sinh |
| :--- | :---: | :--- |
| `BadRequestException`, `InvalidFileFormatException` | `400 Bad Request` | Tham số sai nghiệp vụ, file không đúng định dạng |
| `MethodArgumentNotValidException` | `400 Bad Request` | Vi phạm Jakarta Bean Validation (`@Valid`), điền `validationErrors` |
| `UnauthorizedException`, `BadCredentialsException`, `AuthenticationException` | `401 Unauthorized` | Sai email/password, thiếu/hết hạn Access/Refresh Token |
| `ForbiddenException`, `AccessDeniedException` | `403 Forbidden` | Tự đăng ký bị khóa (`/register`), sai vai trò `@PreAuthorize`, không thuộc lớp |
| `ResourceNotFoundException`, `NoResourceFoundException` | `404 Not Found` | Không tìm thấy UUID bản ghi hoặc route không tồn tại |
| `MaxUploadSizeExceededException` | `413 Payload Too Large` | Tệp tải lên vượt ngưỡng cấu hình Tomcat/Spring (`500MB` / request `520MB`) |
| `QuotaExceededException`, `ResponseStatusException(429)` | `429 Too Many Requests` | Vượt hạn mức AI ngày, vượt Sliding Window rate limit, hoặc Kill Switch đang bật |
| `Exception` (Unhandled) | `500 Internal Server Error` | Lỗi không mong đợi của máy chủ (lưu ý bảo mật tại [06-security-nfr-operations.md](./06-security-nfr-operations.md)) |

---

## 2. Đặc tả RESTful API (23 Spring Boot Controllers)

### 2.1. Nhóm Xác thực & Hồ sơ Cá nhân (`AuthController`, `UserController`)

| Method | Endpoint | RBAC | Input / Payload | Output (`ApiResponse<T>`) | Status |
| :--- | :--- | :--- | :--- | :--- | :---: |
| `POST` | `/api/v1/auth/register` | Public (`permitAll` / Disabled) | `RegistrationRequest` | Ném `ForbiddenException` (tự đăng ký đã khóa) | `403` |
| `POST` | `/api/v1/auth/login` | Public | `LoginRequest {email, password}` | `AuthResponse {accessToken, expiresIn, user}` + HttpOnly Cookie `refreshToken` | `200` |
| `POST` | `/api/v1/auth/refresh-token` | Public | Cookie `refreshToken` | `AuthResponse` (xoay vòng token mới + set cookie mới) | `200`/`401` |
| `POST` | `/api/v1/auth/logout` | Authenticated | Cookie `refreshToken` | Thu hồi token & xóa cookie (`Max-Age=0`) | `200` |
| `GET` | `/api/v1/auth/me` | Authenticated | JWT Principal | `UserSummaryDto` (bao gồm `currentStreak` cho `ROLE_STUDENT`) | `200` |
| `PUT` | `/api/v1/auth/me` | Authenticated | `UpdateProfileRequest` | `UserSummaryDto` | `200` |
| `POST` | `/api/v1/auth/me/avatar` | Authenticated | `MultipartFile file` (`<=5MB`) | `UserSummaryDto` | `200` |
| `POST` | `/api/v1/users/avatar` | Authenticated | `MultipartFile file` | URL `String` ảnh đại diện | `200` |

### 2.2. Nhóm Quản trị Người dùng (`AdminUserController` — `/api/v1/admin/users`)

Toàn bộ controller yêu cầu `ROLE_ADMIN`:

| Method | Endpoint | Query / Body | Output | Status |
| :--- | :--- | :--- | :--- | :---: |
| `GET` | `/api/v1/admin/users` | Query: `role`, `keyword`, `page`, `size` | `PageResponse<UserSummaryDto>` | `200` |
| `GET` | `/api/v1/admin/users/{id}` | Path: `id` (UUID) | `UserSummaryDto` | `200` |
| `POST` | `/api/v1/admin/users` | Body: `UserCreateByAdminRequest` | `UserSummaryDto` | `200`/`201` |
| `PUT` | `/api/v1/admin/users/{id}` | Body: `UserUpdateRequest` | `UserSummaryDto` | `200` |
| `PATCH` | `/api/v1/admin/users/{id}/status` | Query: `active` (boolean) | `Void` (khóa/mở khóa) | `200` |
| `DELETE` | `/api/v1/admin/users/{id}` | Path: `id` (UUID) | `Void` | `200` |

### 2.3. Nhóm Quản lý Lớp học (`AdminClassroomController`, `TeacherClassroomController`, `StudentClassroomController`)

| Controller & Base | Method & Sub-path | RBAC | Mô tả nghiệp vụ |
| :--- | :--- | :--- | :--- |
| `AdminClassroomController` (`/api/admin/classrooms`) | `POST /` | `ROLE_ADMIN` | Tạo lớp học mới (`CreateClassroomRequest`) |
| | `GET /` | `ROLE_ADMIN` | Lấy danh sách lớp phân trang (lọc `ClassStatus`) |
| | `GET /{id}` | `ROLE_ADMIN` | Xem chi tiết lớp học |
| | `GET /{id}/students` | `ROLE_ADMIN` | Danh sách học viên & tiến độ trong lớp |
| | `POST /{id}/enroll` | `ROLE_ADMIN` | Ghi danh học viên vào lớp (`EnrollStudentRequest`) |
| | `DELETE /{id}/students/{studentId}` | `ROLE_ADMIN` | Xóa học viên khỏi lớp |
| | `PUT /{id}/status` | `ROLE_ADMIN` | Đổi trạng thái lớp (`UpdateClassStatusRequest`) |
| | `PUT /{id}/assign-teacher` | `ROLE_ADMIN` | Phân công giảng viên (`AssignTeacherRequest`) |
| | `DELETE /{id}` | `ROLE_ADMIN` | Xóa vĩnh viễn lớp học + cascade DB & R2 (`ClassroomPurgeResultDto`) |
| `TeacherClassroomController` (`/api/teacher/classrooms`) | `GET /` | `TEACHER`, `ADMIN` | Danh sách lớp giảng viên đang phụ trách |
| | `GET /{id}` | `TEACHER`, `ADMIN` | Chi tiết lớp học |
| | `GET /{id}/students` | `TEACHER`, `ADMIN` | Danh sách học viên kèm tiến độ |
| `StudentClassroomController` (`/api/student/classrooms`) | `GET /my-courses` | `STUDENT`, `ADMIN` | Danh sách khóa học đã ghi danh kèm % tiến độ |
| | `POST /{id}/leave` | `STUDENT`, `ADMIN` | Học viên tự rời lớp |

### 2.4. Nhóm Học liệu, Từ vựng, Tài nguyên & Lộ trình Ngày (`CurriculumController`, `VocabularyController`, `AdminResourceController`, `DailyStudyPlanController`)

| Controller & Base | Method & Endpoint | RBAC | Mô tả & Output |
| :--- | :--- | :--- | :--- |
| `CurriculumController` (`/api/curriculum`) | `POST /lessons` | `TEACHER`, `ADMIN` | Tạo bài học (`LessonRequest -> LessonResponse`) |
| | `GET /classes/{classId}/lessons` | Authenticated | Danh sách bài học trong lớp |
| | `GET /lessons/{id}` | Authenticated | Chi tiết bài học (`LessonDetailResponse`: tài liệu, từ vựng, ngữ pháp) |
| | `PUT /lessons/{id}`, `DELETE /lessons/{id}` | `TEACHER`, `ADMIN` | Cập nhật / Xóa bài học |
| | `POST /lessons/{lessonId}/documents` | `TEACHER`, `ADMIN` | Upload tài liệu (`MultipartFile`, `fileType`: `PDF\|DOCX\|PPTX\|IMAGE\|AUDIO`) -> `DocumentResponse` |
| | `GET /lessons/{lessonId}/documents`, `PUT /documents/{documentId}`, `PUT /documents/{documentId}/file`, `DELETE /documents/{documentId}` | Auth / `TEACHER, ADMIN` | Xem, đổi tên/loại, thay thế file (`MultipartFile`) hoặc xóa tài liệu bài học |
| | `GET /lessons/{lessonId}/grammar`, `POST /lessons/{lessonId}/grammar`, `PUT /grammar/{topicId}`, `DELETE /grammar/{topicId}` | Auth / `TEACHER, ADMIN` | Xem, thêm, cập nhật & xóa chủ điểm ngữ pháp |
| `VocabularyController` (`/api/curriculum`) | `GET /lessons/{lessonId}/vocabularies` | Authenticated | Danh sách từ vựng của bài học |
| | `POST /lessons/{lessonId}/vocabularies` | `TEACHER`, `ADMIN` | Thêm từ mới (tự động tra cứu IPA & Audio qua `DictionaryLookupService`) |
| | `PUT /vocabularies/{id}`, `DELETE /vocabularies/{id}` | `TEACHER`, `ADMIN` | Cập nhật / Xóa từ vựng |
| `AdminResourceController` (`/api/v1/admin/resources`) | `GET /?type=`, `POST /upload`, `DELETE /{id}` | `ADMIN`, `TEACHER` | Quản trị kho tài nguyên dùng chung (`GlobalResource`) |
| `DailyStudyPlanController` (`/api/v1/curriculum/daily-plans`) | `GET /my-streak` | `STUDENT`, `TEACHER`, `ADMIN` | Trả về `StudentStreakResponse {currentStreak, lastActiveDate, hasHomeworkToday, completedToday, todayCompletedTasks, todayTotalTasks}` |
| | `GET /classrooms/{classroomId}/student-overview` | `STUDENT`, `TEACHER`, `ADMIN` | Tổng quan lộ trình ngày, % hoàn thành, trạng thái mở khóa & `currentStreak`/`hasHomeworkToday`/`completedToday` (`DailyHomeworkOverviewResponse`) |
| | `GET /classrooms/{classroomId}` | `STUDENT`, `TEACHER`, `ADMIN` | Danh sách ngày học (`DailyStudyPlan`) |
| | `POST /`, `PUT /{planId}`, `DELETE /{planId}` | `TEACHER`, `ADMIN` | CRUD Ngày học |
| | `GET /{planId}/assignments` | `STUDENT`, `TEACHER`, `ADMIN` | Lấy bài tập thuộc ngày học |
| | `POST /{planId}/items`, `DELETE /items/{itemId}` | `TEACHER`, `ADMIN` | Thêm / Xóa item trong ngày học |
| | `GET /classrooms/{classroomId}/progress-stats` | `TEACHER`, `ADMIN` | Ma trận tiến độ hoàn thành theo từng ngày của cả lớp |

### 2.5. Nhóm Bài tập, Import Excel & Khảo thí CBT (`TeacherAssignmentController`, `StudentSubmissionController`, `TeacherGradingController`)

| Controller & Base | Method & Endpoint | RBAC | Mô tả |
| :--- | :--- | :--- | :--- |
| `TeacherAssignmentController` (`/api/v1/teacher`) | `POST /assignments/upload-audio` | `TEACHER`, `ADMIN` | Tải file audio bài nghe lên R2/Local -> URL `String` |
| | `POST /assignments/synthesize-audio` | `TEACHER`, `ADMIN` | Tổng hợp audio bài nghe từ text/script qua Kokoro TTS |
| | `GET /assignments/sample-excel` | `TEACHER`, `ADMIN` | Tải file mẫu `.xlsx` theo `skillType` (`byte[]`) |
| | `POST /assignments/{id}/import-excel` | `TEACHER`, `ADMIN` | Parse Excel Apache POI & nạp danh sách `AssignmentQuestion` |
| | `GET /classrooms/{classroomId}/assignments` | `TEACHER`, `ADMIN` | Danh sách bài tập lớp (lọc `gradingOnly`) |
| | `GET /classrooms/{classroomId}/exams` | `TEACHER`, `ADMIN` | Danh sách bài thi CBT (`isExam=true`) |
| | `GET /classrooms/{classroomId}/question-bank` | `TEACHER`, `ADMIN` | Ngân hàng câu hỏi tổng hợp của lớp (`QuestionBankItemDto`) |
| | `POST /assignments`, `GET /assignments/{id}`, `PUT /assignments/{id}`, `DELETE /assignments/{id}` | `TEACHER`, `ADMIN` | CRUD bài tập & câu hỏi |
| | `POST /assignments/{id}/generate-audios`, `POST /assignments/backfill-audios` | `TEACHER`, `ADMIN` | Kích hoạt job nền `@Async` sinh Kokoro TTS cho câu hỏi |
| `StudentSubmissionController` (`/api/v1/student`) | `GET /classrooms/{classId}/assignments` | `ROLE_STUDENT` | Danh sách bài tập được giao trong lớp (`StudentAssignmentSummaryResponse`) |
| | `POST /assignments/{assignmentId}/start` | `ROLE_STUDENT` | Khởi tạo lượt làm bài (`AttemptStatus.IN_PROGRESS`) |
| | `POST /assignments/{assignmentId}/attempts/{attemptId}/submit` | `ROLE_STUDENT` | Nộp bài (`SubmissionRequest`) -> chấm tự động / xếp hàng chấm AI |
| | `GET /assignments/{assignmentId}/attempts`, `GET /assignments/attempts/{attemptId}` | `ROLE_STUDENT` | Xem danh sách lượt thi và chi tiết kết quả / Review Mode |
| | `POST /assignments/attempts/{attemptId}/questions/{questionId}/audio` | `ROLE_STUDENT` | Tải lên file ghi âm trả lời câu hỏi Speaking/Audio |
| | `POST /assignments/attempts/{attemptId}/violation` | `ROLE_STUDENT` | Ghi nhận vi phạm phòng thi (`ExamViolationRequest` -> cảnh báo & khóa bài) |
| `TeacherGradingController` (`/api/v1/teacher`) | `GET /assignments/{assignmentId}/submissions` | `TEACHER`, `ADMIN` | Danh sách bài nộp của học viên (`SubmissionSummaryResponse`) |
| | `GET /submissions/{attemptId}` | `TEACHER`, `ADMIN` | Chi tiết bài làm kèm kết quả AI gợi ý (`AttemptResponse`) |
| | `POST /submissions/{attemptId}/grade` | `TEACHER`, `ADMIN` | Giảng viên chốt điểm và nhận xét (`TeacherGradeRequest`) |
| | `GET /classrooms/{classId}/students/{studentId}/submissions` | `TEACHER`, `ADMIN` | Lịch sử bài nộp của 1 học viên trong lớp |

### 2.6. Nhóm AI Lab, Kokoro TTS & Giám sát AI (`AiLabController`, `AiTtsController`, `AdminAiMonitoringController`)

| Controller & Base | Method & Endpoint | RBAC | Mô tả |
| :--- | :--- | :--- | :--- |
| `AiLabController` (`/api/v1/ai`) | `POST /speaking/shadowing-evaluate` | `ROLE_STUDENT` | Multipart `audio`, `referenceSentence`, `studentAnswerId` -> `ShadowingEvaluationResponse` (3-Tier Fallback) |
| | `POST /speaking/evaluate` | `ROLE_STUDENT` | Multipart `topic`, `audio`, `speakingMode`, `keyPoints`, `studentAnswerId` -> IELTS Speaking JSON |
| | `POST /pronunciation/whisper-evaluate` | `ROLE_STUDENT` | Multipart `audio`, `referenceText` -> `PhoneticEvaluationResponse` |
| | `POST /writing/evaluate` | `STUDENT`, `TEACHER` | Query `topic`, `writingTask`, `studentAnswerId`; Body `essayText` -> IELTS Writing JSON |
| | `POST /reading/evaluate-short-answer` | `STUDENT`, `TEACHER`, `ADMIN` | `ReadingEvaluationRequest` -> Chấm câu trả lời đọc hiểu ngắn |
| | `POST /exercise/generate-quiz` | `TEACHER`, `ADMIN` | Sinh bộ câu hỏi trắc nghiệm / Matching CEFR -> `AiGeneratedExercise` |
| | `POST /exercise/{id}/publish` | `TEACHER`, `ADMIN` | Xuất bản đề nháp AI thành `Assignment` cho `classroomId` |
| | `POST /exam/generate-draft` | `TEACHER`, `ADMIN` | Sinh bản nháp đề thi tổng hợp (`AiExamGenerateRequest -> AiExamDraftResponse`) |
| `AiTtsController` (`/api/v1/ai/tts`) | `POST /` | `STUDENT`, `TEACHER`, `ADMIN` | Tổng hợp nhanh speech từ text (`TtsRequest -> TtsResponse`) |
| | `POST /questions/{questionId}/repair` | `STUDENT`, `TEACHER`, `ADMIN` | Học viên/GV tái tạo nguyên tử audio bị lỗi cho câu hỏi (`ExerciseAudioResponseDto`) |
| | `GET /questions/{questionId}/status` | `STUDENT`, `TEACHER`, `ADMIN` | Kiểm tra trạng thái sinh audio câu hỏi |
| | `GET /voices` | `STUDENT`, `TEACHER`, `ADMIN` | Danh sách giọng đọc Kokoro-82M US/UK (`KokoroVoiceDto[]`) |
| `AdminAiMonitoringController` (`/api/v1/admin/ai-monitoring`) | `GET /stats`, `GET /quotas` | `ADMIN`, `TEACHER` | Thống kê token, chi phí Gemini/Groq 7 ngày & quota từng tài khoản |
| | `PUT /quotas/{studentId}` | `ROLE_ADMIN` | Cập nhật `dailyLimit` hoặc khóa/mở khóa quyền AI (`UpdateQuotaRequest`) |
| | `POST /kill-switch/toggle` | `ROLE_ADMIN` | Bật/tắt Global AI Kill-Switch khẩn cấp toàn hệ thống |

### 2.7. Nhóm Video HLS, Thông báo, Phân tích & Quản trị Hệ thống (`VideoController`, `NotificationController`, `AnalyticsController`, `TeacherDashboardController`, `AdminDashboardController`, `AdminDatabaseController`, `AuditLogController`)

| Controller & Base | Method & Endpoint | RBAC | Mô tả |
| :--- | :--- | :--- | :--- |
| `VideoController` (`/api/v1/videos`) | `POST /` | `ADMIN`, `TEACHER` | Upload MP4 (`<=500MB`), đẩy RabbitMQ/Executor transcode HLS (`VideoUploadResponse`, HTTP `200 OK`) |
| | `GET /{id}`, `GET /lesson/{lessonId}` | Authenticated | Lấy thông tin video theo ID hoặc bài học |
| | `GET /{id}/raw`, `GET /{id}/hls/{fileName}` | Public (`permitAll` trong `SecurityConfig`) | Stream video gốc hoặc tệp `.m3u8`/`.ts` hỗ trợ HTTP `Range` (`206` / `416`) |
| | `POST /{id}/progress`, `GET /{id}/progress` | `ROLE_STUDENT` | Cập nhật & đọc tiến độ xem video (`VideoWatchHistory`) |
| | `PATCH /{id}/review`, `DELETE /{id}`, `GET /`, `GET /my-uploads` | `ADMIN`, `TEACHER` | Kiểm duyệt video (`approved=true/false`), xóa video, lọc theo `VideoStatus` hoặc lấy danh sách video do chính giảng viên/admin đã đăng tải |
| `NotificationController` (`/api/v1/notifications`) | `GET /`, `GET /classrooms/{classId}` | Authenticated | Lấy danh sách thông báo cá nhân / lớp học (phân trang `Page<Notification>`) |
| | `GET /broadcast-history` | `ROLE_ADMIN` | Lịch sử các thông báo phát sóng toàn hệ thống |
| | `GET /recipients`, `GET /classrooms` | `ADMIN`, `TEACHER` | Tra cứu danh sách người nhận & lớp khả dụng để gửi thông báo |
| | `POST /self`, `POST /broadcast` | `ALL` / `ADMIN, TEACHER` | Gửi thông báo tự nhắc hoặc phát sóng lớp/toàn hệ thống |
| | `PATCH\|PUT /{id}/read`, `PATCH\|PUT /read-all` | Authenticated | Đánh dấu đã đọc 1 hoặc toàn bộ thông báo |
| `AnalyticsController` (`/api/v1/analytics`) | `GET /my-profile`, `GET /student/me` | `ROLE_STUDENT` | Hồ sơ radar 8 chỉ số kỹ năng (`StudentSkillProfile`) |
| `TeacherDashboardController` (`/api/v1/teacher/dashboard`) | `GET /stats` | `TEACHER`, `ADMIN` | Thống kê lớp phụ trách, bài chờ chấm (`TeacherDashboardResponse`) |
| `AdminDashboardController` (`/api/v1/admin/dashboard`) | `GET /stats` | `ROLE_ADMIN` | Thống kê tổng quan toàn hệ thống (`AdminDashboardStats`) |
| `AdminDatabaseController` (`/api/v1/admin/database`) | `GET /overview` | `ROLE_ADMIN` | Tổng quan bảng/dung lượng DB theo lớp (`AdminDatabaseOverviewDto`) |
| | `POST /classrooms/{classroomId}/purge-submissions` | `ROLE_ADMIN` | Xóa sạch bài nộp & audio R2 của lớp học (`ClassroomPurgeResultDto`) |
| | `DELETE /classrooms/{classroomId}` | `ROLE_ADMIN` | Xóa toàn bộ lớp học + cascade DB & R2 |
| | `GET /classrooms/{classroomId}/report-summary` | `ROLE_ADMIN` | Dữ liệu tổng hợp báo cáo lớp (`ClassroomDetailedReportDto`) |
| | `GET /classrooms/{classroomId}/report`, `GET /export-center-report` | `ROLE_ADMIN` | Tải báo cáo `.xlsx` chi tiết lớp / toàn trung tâm (Apache POI) |
| | `GET /r2-report` | `ROLE_ADMIN` | Báo cáo chi phí Cloudflare R2 (`R2CostReportDto`, Free Tier & VND) |
| `AuditLogController` (`/api/v1/admin/audit-logs`) | `GET /` | `ROLE_ADMIN` | Tra cứu nhật ký kiểm toán phân trang (`PageResponse<AuditLogDto>`) |

---

## 3. Hợp đồng Giao tiếp Nội bộ với 2 Python AI Microservices

### 3.1. `phonetics-service` (`http://localhost:8000` / `http://phonetics-service:8000`)

| Endpoint | Method | Request | Response Schema & Mã lỗi |
| :--- | :---: | :--- | :--- |
| `/health` | `GET` | — | `{ status: "healthy", service: "phonetics-service", version: "1.0.0", sampleRate: 16000, device }` |
| `/api/v1/audio/evaluate-phonetics` | `POST` | Multipart: `audio` (`.wav`/`.mp3`/`.m4a`, `<=15MB`), `script` (`str`) | `SpeechAssessmentResponse` (`camelCase`): `overallScore`, `pronunciationScore`, `fluencyScore`, `speedScore`, `articulationRate`, `words[]`, `fluencyFeedback[]`, `evaluationStatus` (`SUCCESS`, `REJECTED_MISMATCH`, ...), `overallConfidence`, `audioQuality`, `isPassed`, `passScore=80`, `kpi`, `sentenceTokens[]`, `wordRows[]` |
| `/tts` (alias `/api/v1/audio/tts`) | `POST` | JSON `TtsRequest {text (1..2000), voice ("af_heart"), speed (0.5..2.0)}` | Binary `audio/wav` (24kHz mono PCM), header `X-Audio-Duration` |
| `/tts/dialogue` (alias `/api/v1/audio/tts/dialogue`) | `POST` | JSON `DialogueTtsRequest {turns[] (1..50), speakerMap, interTurnPauseMs (100..2000)}` | `DialogueTtsResponse {durationMs, sampleRate: 24000, segments[], audioBase64}` |
| `/tts/voices` (alias `/api/v1/audio/tts/voices`) | `GET` | — | `VoiceInfo[]` (`id`, `name`, `accent`, `gender`, `description`, `pipeline`, `isDefault`) |

**Bảng mã lỗi chuẩn hóa `phonetics-service` (`ErrorResponse.detail.code`):**
- `413 AUDIO_TOO_LARGE` (`>15MB`) · `415 UNSUPPORTED_AUDIO_FORMAT` · `422 AUDIO_TOO_SHORT` (`<0.4s`) · `422 AUDIO_TOO_LONG` (`>180s`) · `422 AUDIO_QUALITY_TOO_LOW` · `422 EMPTY_SPEECH` · `422 INVALID_SCRIPT` · `422 ALIGNMENT_FAILED` · `422 ALIGNMENT_LOW_CONFIDENCE` (`<0.15`) · `500 INTERNAL_ERROR`.
- Khi `phonetics-service` trả `4xx` cho lỗi chất lượng thu âm, `PythonIntegrationServiceImpl` chuyển sang `buildLowConfidenceResponse()` trả thẳng điểm `0` + hướng dẫn thu lại bằng tiếng Việt thay vì tiêu tốn quota gọi Fallback Cloud LLM.

### 3.2. `writing-scorer` (`http://localhost:8001`)

| Endpoint | Method | Request JSON (`WritingEvaluateRequest`) | Response Schema (`WritingEvaluateResponse`) |
| :--- | :---: | :--- | :--- |
| `/health` | `GET` | — | `{ status: "healthy"\|"degraded", service: "writing-scorer", version: "1.0.0", modelType, requestedModelType, device, modelLoaded, supportedTasks: ["TASK_2","TASK_1","PARAGRAPH"] }` |
| `/api/v1/writing/evaluate` | `POST` | `topic`, `essayText` (`<=30,000` chars), `writingTask` (`TASK_1` \| `TASK_2` \| `PARAGRAPH` \| `AUTO`), `assignmentTitle`, `keyPoints`, `rubrics`, `modelType` | `writingTask`, `writingSubType`, `wordCount`, `correctedWordCount`, `isOffTopic`, `taskAchievement {score, addressedPoints, missingPoints}`, `taskResponseScore`, `overallBand`, `overallScore` (`0..100`), `isPassed` (`>=5.0`), `estimatedCefr`, `grammarScore`, `vocabularyScore`, `coherenceScore`, `correctedText`, `generalFeedback`, `mistakes[]`, `suggestions[]`, `criteriaDetails{}`, `suggestedVocabulary[]`, `evaluatedBy: "PYTHON_WRITING_SCORER"`, `modelType`, `subcriteria`, `diagnostics` |

**Mã lỗi chuẩn `writing-scorer`:** `422 UNSUPPORTED_WRITING_TASK`, `422 INVALID_ESSAY`, `422 ESSAY_TOO_LONG`, `503 MODEL_UNAVAILABLE`, `500 INTERNAL_ERROR`.

---

## 4. Đặc tả Giao tiếp Thời gian thực (WebSocket Protocols)

Hệ thống vận hành **2 cấu hình WebSocket độc lập** trên Backend:

### 4.1. Kênh Thông báo & Cảnh báo Thời gian thực — STOMP (`/ws`)

- **Cấu hình:** `WebSocketConfig.java` (`@EnableWebSocketMessageBroker`, `@Order(HIGHEST_PRECEDENCE + 99)`).
- **Endpoints:** `/ws` hỗ trợ cả WebSocket thuần và SockJS fallback (`withSockJS()`).
- **Xác thực:** `ChannelInterceptor.preSend` đọc header `Authorization: Bearer <jwt>` hoặc `token` tại frame `STOMP CONNECT`, xác thực qua `JwtService` và gán `Principal.name = customUser.getId().toString()`.
- **Prefixes & Destinations thực tế (`NotificationServiceImpl`):**
  - Application destination prefix: `/app` · Broker prefixes: `/topic`, `/queue` · User prefix: `/user`.
  - `/user/{userId}/queue/notifications`: Thông báo đích danh người dùng (`NEW_GRADE`, `VIDEO_APPROVED`, `VIDEO_REJECTED`, `CHEATING_ALERT`, `SYSTEM_ALERT`).
  - `/topic/classroom.{classroomId}`: Thông báo phát tới toàn bộ học viên một lớp (`NEW_ASSIGNMENT`, `ANNOUNCEMENT`).
  - `/topic/system-announcements` & `/topic/public`: Phát sóng thông báo toàn hệ thống từ Admin.

### 4.2. Kênh Thu âm Streaming Thô — Raw Binary WebSocket (`/ws/audio`)

- **Cấu hình:** `AudioWebSocketConfig.java` đăng ký `AudioWebSocketHandler` tại `/ws/audio`.
- **Giao thức truyền thông điệp hai bước:**
  1. Client gửi `TextMessage` chứa JSON metadata: `{"referenceText": "The quick brown fox..."}` (mặc định `"Hello world"` nếu chưa gửi).
  2. Client gửi các `BinaryMessage` chứa PCM audio bytes -> Handler gọi `ShadowingPracticeService.processAudioChunk(sessionId, audioBytes, referenceText)` và trả kết quả `ShadowingEvaluationResponse` dạng JSON `TextMessage`.

---

## 5. Đặc tả Truyền phát Media & HTTP Byte-Range Streaming

`VideoController` cung cấp cơ chế proxy phát video từ hai nguồn (Local disk `./uploads/videos/` hoặc Cloudflare R2 qua `R2StorageService.openObjectStream`):

- **Headers phản hồi chuẩn:** `Accept-Ranges: bytes`, `Content-Range: bytes <start>-<end>/<total>`, `Content-Length`, `Content-Disposition: inline`.
- **Caching Headers:**
  - Playlist động `.m3u8`: `Content-Type: application/vnd.apple.mpegurl`, `Cache-Control: public, max-age=60`.
  - Phân đoạn `.ts`: `Content-Type: video/MP2T`, `Cache-Control: public, max-age=86400`.
  - Video MP4 gốc (`/raw`): `Content-Type: video/mp4`, đọc chunk `8MB` (`CHUNK_SIZE`), trả `206 Partial Content` hoặc `416 Requested Range Not Satisfiable` khi dải byte không hợp lệ.
- **Bảo mật đường dẫn:** Kiểm tra `fileName` chống Path Traversal (chặn `..`, `/`, `\`, và xác minh `filePath.startsWith(hlsDir)`).
