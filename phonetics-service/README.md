# Speech Assessment Microservice (`phonetics-service`)

> **Production-Oriented Speech Assessment Engine with Audio-Quality Gate, Neural Forced Alignment, Praat Formant Analysis, CTC-GOP, and Pedagogical Diagnostics.**

---

## 1. Architecture
Hệ thống được thiết kế dưới dạng một **Microservice độc lập** bằng **FastAPI** phục vụ cho nền tảng học tiếng Anh backend Spring Boot. Microservice chịu trách nhiệm tiếp nhận file ghi âm giọng nói của học viên cùng câu mẫu tham chiếu (script), thực thi quy trình phân tích tín hiệu số âm thanh (DSP), bóc tách đặc trưng âm học nguyên âm ($F_1, F_2$) qua Praat, tính toán độ tin cậy âm vị phụ âm bằng CTC-based GOP, đo lường độ trôi chảy (Fluency), và sinh phản hồi có thể giải thích được (Explainable Feedback).

```
[Student Audio + Script]
         │
         ▼
┌─────────────────────────────────┐
│   Stage 1: Audio Quality Gate   │  --> Check: Duration, RMS, SNR, Clipping, Silence
└────────────────┬────────────────┘
                 ▼
┌─────────────────────────────────┐
│   Stage 2: DSP Preprocessing    │  --> 16kHz Mono, Peak Norm, Butterworth SOS Bandpass
└────────────────┬────────────────┘
                 ▼
┌─────────────────────────────────┐
│   Stage 3: VAD & Temporal Det   │  --> Speaking Time, Articulation Time, Pause Events
└────────────────┬────────────────┘
                 ▼
┌─────────────────────────────────┐
│   Stage 4: Forced Alignment     │  --> Wav2Vec2 XLSR + torchaudio.functional.forced_align
└────────┬────────────────────────┘
         ├─────────────────────────────────────────┐
         ▼ (Vowels)                                ▼ (Consonants)
┌─────────────────────────────────┐       ┌─────────────────────────────────┐
│   Stage 5A: Praat Burg LPC      │       │   Stage 5B: CTC Log-Posterior   │
│   F1/F2 Mahalanobis Distance    │       │   Goodness of Pronunciation     │
└────────┬────────────────────────┘       └────────┬────────────────────────┘
         └───────────────────┬─────────────────────┘
                             ▼
┌──────────────────────────────────────────────────┐
│   Stage 6: Hierarchical Scoring & Calibration    │  --> Stress Weights, Critical Penalties
└────────────────────────────┬─────────────────────┘
                             ▼
┌──────────────────────────────────────────────────┐
│   Stage 7: Confidence & Feedback Generation      │  --> Severity (info, minor, moderate, major)
└────────────────────────────┬─────────────────────┘
                             ▼
[Spring Boot Compatible Response (camelCase JSON)]
```

---

## 2. Pipeline
1. **Audio Ingestion**: Tiếp nhận audio `.wav`, `.mp3`, `.m4a` và script qua `multipart/form-data`.
2. **Quality Gate**: Kiểm tra các ngưỡng vật lý để phát hiện audio im lặng, vỡ tiếng (clipping), hoặc nhiễu môi trường quá cao.
3. **Preprocessing**: Chuyển đổi định dạng về 16,000 Hz, Mono, 16-bit PCM float32, lọc dải thông $80\text{ Hz} - 7500\text{ Hz}$.
4. **VAD**: Xác định ranh giới giọng nói, tách riêng khoảng ngắt nghỉ tự nhiên do dấu câu và các khoảng ngập ngừng ngắc ngứ (hesitations).
5. **Neural Alignment**: Chạy forward pass `facebook/wav2vec2-xlsr-53-espeak-cv-ft`, giải mã trellis CTC tìm ranh giới thời gian từng từ và từng âm vị.
6. **Dual Phoneme Analysis**:
   - Nguyên âm: Trích xuất $F_1, F_2$ tại vùng ổn định trung tâm (30% - 70%) bằng giải thuật Burg LPC của Praat, so sánh với phân phối chuẩn qua khoảng cách Mahalanobis.
   - Phụ âm: Tính trung bình log-posterior của token CTC trong phân đoạn âm vị.
7. **Scoring & Calibration**: Tính điểm từ (nhân trọng số trọng âm và phụ âm cuối từ, trừ điểm lỗi chí mạng), điểm lưu loát, điểm tốc độ, và điểm tổng thể.
8. **Feedback**: Sinh lời khuyên giải phẫu khẩu hình (hạ hàm, đặt lưỡi) và lưu loát.

---

## 3. Installation

### Yêu cầu hệ thống:
- Python 3.10+
- `ffmpeg` và `libsndfile1` đã được cài đặt trên hệ điều hành.

```bash
# Clone hoặc điều hướng vào thư mục
cd phonetics-service

# Tạo môi trường ảo
python -m venv .venv
source .venv/bin/activate   # Linux/macOS
# Hoặc trên Windows: .venv\Scripts\activate

# Cài đặt dependencies
pip install -r requirements.txt
```

---

## 4. Docker
Khởi chạy dễ dàng bằng Docker và Docker Compose:

```bash
# Build và chạy container
docker compose up -d --build

# Kiểm tra log
docker compose logs -f phonetics-service

# Kiểm tra tình trạng health
curl http://localhost:8000/health
```

---

## 5. API

### `POST /api/v1/audio/evaluate-phonetics`
Endpoint chính nhận multipart form-data.

**Request Parameters:**
- `audio` (File): File âm thanh dạng `.wav`, `.mp3`, `.m4a`.
- `script` (String): Câu tham chiếu tiếng Anh mà học viên đọc.

**HTTP Status Codes Mapping:**
- `200 OK`: Đánh giá thành công hoặc đánh giá một phần kèm cảnh báo.
- `400 Bad Request`: Payload không hợp lệ.
- `413 Request Entity Too Large`: Dung lượng audio vượt ngưỡng cấu hình.
- `415 Unsupported Media Type`: Định dạng file không hỗ trợ.
- `422 Unprocessable Entity`: Script rỗng, audio quá ngắn/quá dài, nhiễu quá lớn, hoặc căn chỉnh âm học thất bại.
- `503 Service Unavailable`: Mô hình AI chưa sẵn sàng hoặc lỗi nạp checkpoint.

---

## 6. curl Example

```bash
curl -X POST "http://localhost:8000/api/v1/audio/evaluate-phonetics" \
     -H "Accept: application/json" \
     -F "audio=@sample_speaking.m4a;type=audio/m4a" \
     -F "script=I would like to talk about my holiday."
```

**Ví dụ JSON Response (chuẩn camelCase khớp với Spring Boot):**
```json
{
  "overallScore": 84.5,
  "pronunciationScore": 86.0,
  "fluencyScore": 80.0,
  "speedScore": 88.0,
  "articulationRate": 4.2,
  "words": [
    {
      "word": "holiday",
      "startTime": 1.25,
      "endTime": 1.82,
      "score": 83.5,
      "confidence": 0.93,
      "phonemes": [
        {
          "symbol": "h",
          "type": "consonant",
          "score": 92.0,
          "feedback": "Phát âm rõ ràng, chuẩn xác.",
          "confidence": 0.95,
          "status": "OK"
        },
        {
          "symbol": "ɒ",
          "type": "vowel",
          "score": 81.0,
          "feedback": "Khẩu hình và vị trí đặt lưỡi chuẩn xác!",
          "measuredF1": 670.0,
          "measuredF2": 1080.0,
          "targetF1": 680.0,
          "targetF2": 1050.0,
          "confidence": 0.92,
          "status": "OK"
        }
      ]
    }
  ],
  "fluencyFeedback": [
    {
      "type": "speaking_rate",
      "severity": "info",
      "message": "Tốc độ phát âm rất tốt và tự nhiên (4.2 âm tiết/giây)."
    }
  ],
  "evaluationStatus": "SUCCESS",
  "overallConfidence": 0.91
}
```

---

## 7. Configuration
Mọi tham số đều được quản lý tập trung trong [`app/config.py`](file:///d:/codes/doanchuyennganh/phonetics-service/app/config.py) qua biến môi trường hoặc file `.env`:

| Biến môi trường | Giá trị mặc định | Giải thích ý nghĩa |
| :--- | :--- | :--- |
| `MODEL_NAME` | `facebook/wav2vec2-xlsr-53-espeak-cv-ft` | Checkpoint CTC cho forced alignment |
| `MODEL_DEVICE` | `cpu` (hoặc `cuda`) | Thiết bị chạy suy luận |
| `SAMPLE_RATE` | `16000` | Tần số lấy mẫu chuẩn hóa |
| `MIN_AUDIO_DURATION` | `0.4` (giây) | Thời lượng tối thiểu |
| `MAX_AUDIO_DURATION` | `45.0` (giây) | Thời lượng tối đa |
| `PAUSE_THRESHOLD_MS` | `250.0` (ms) | Ngưỡng ngắt nghỉ phát hiện ngập ngừng |
| `PRONUNCIATION_WEIGHT`| `0.50` | Trọng số phát âm trong điểm tổng |
| `FLUENCY_WEIGHT` | `0.30` | Trọng số lưu loát trong điểm tổng |
| `SPEED_WEIGHT` | `0.20` | Trọng số tốc độ trong điểm tổng |
| `SPEED_TARGET_MIN` | `3.5` (syl/sec) | Tốc độ tối ưu tối thiểu |
| `SPEED_TARGET_MAX` | `5.0` (syl/sec) | Tốc độ tối ưu tối đa |

---

## 8. Model
* **Model Checkpoint**: `facebook/wav2vec2-xlsr-53-espeak-cv-ft`.
* **Cơ chế Singleton & Cache**: Class `ModelManager` nạp model một lần duy nhất, cache vào ổ cứng (`MODEL_CACHE_DIR`), thực hiện warmup tensor giả lập để tối ưu độ trễ cho request đầu tiên.
* **Hỗ trợ thiết bị**: Tự động chuyển đổi giữa CPU và CUDA khi có GPU.

---

## 9. Forced Alignment
* Sử dụng `torchaudio.functional.forced_align`.
* **Xử lý bất tương thích**: Lớp `IPASanitizer` bóc tách trọng âm, làm sạch Unicode NFD/NFC và ánh xạ về đúng từ vựng CTC.
* **Xử lý ngoại lệ**: Kiểm tra tỷ lệ khung hình $T \ge U$ trước khi gọi trellis để triệt tiêu lỗi empty path.

---

## 10. Formant Analysis
* **Thuật toán Burg LPC**: Sử dụng engine C++ Praat qua `praat-parselmouth` (5 formants, trần 5500Hz).
* **Vùng phân tích ổn định**: Lấy mẫu $F_1, F_2$ tại khoảng 30% - 70% thời lượng nguyên âm, loại bỏ frame vô thanh và mẫu dị biệt.
* **Xử lý biên**: Nếu nguyên âm $< 30\text{ms}$ hoặc giải nghiệm LPC thất bại, gán trạng thái `FORMANT_NOT_RELIABLE` thay vì tạo số ảo.

---

## 11. Goodness of Pronunciation (GOP)
* **CTC-based Posterior GOP Approximation**:
  $$GOP_{\text{CTC}} = \frac{1}{|I_p|} \sum_{t \in I_p} \log P(\text{target\_phoneme} \mid x_t)$$
* Áp dụng cận dưới $\epsilon = 10^{-7}$ ngăn ngừa $\log(0)$, tính toán độ tin cậy kết hợp thời lượng thực tế của phụ âm.

---

## 12. Fluency Analysis
* **Không chỉ dừng ở việc đếm khoảng nghỉ**:
  * Phân biệt rõ giữa *khoảng dừng tự nhiên do dấu câu* (`punctuation` - không bị phạt điểm) và *ngập ngừng bất thường* (`hesitation` - bị trừ điểm theo thời lượng).
  * Phát hiện các khoảng dừng kéo dài bất thường (`long_pause` $> 1000\text{ms}$).
  * Đo lường tính liên tục của chuỗi âm thanh (Continuity ratio).

---

## 13. Confidence Estimation
* **Triết lý thiết kế**: *Score là thước đo thực thi; Confidence là độ tin cậy của thuật toán*.
* Tổng hợp đa tầng từ $C_{\text{audio}}$ (SNR, clipping), $C_{\text{align}}$ (Viterbi path probability), $C_{\text{phoneme}}$ và $C_{\text{formant}}$.
* Khi confidence $< 0.40$, gán trạng thái `LOW_CONFIDENCE`, ẩn các feedback mang tính khẳng định tuyệt đối để bảo vệ trải nghiệm người học.

---

## 14. Scoring Formulas
* **Nguyên âm**: $VowelScore = 0.75 \times S_{\text{formant}} + 0.15 \times C_{\text{acoustic}} \times 100 + 0.10 \times C_{\text{align}} \times 100$.
* **Từ**: Trung bình có trọng số âm vị ($\text{Stress} = 1.3$, $\text{Final} = 1.2$, $\text{Schwa} = 0.8$). Áp dụng hàm phạt phi tuyến `Critical Phoneme Penalty` nếu có âm vị $< 35$ điểm.
* **Điểm tổng**: $Overall = 0.50 \times \text{Pronunciation} + 0.30 \times \text{Fluency} + 0.20 \times \text{Speed}$ (kẹp trong thang $0 - 100$).

---

## 15. Calibration Layer
* Lớp `ScoringCalibrator` cung cấp kiến trúc Plug-and-play.
* Phiên bản MVP sử dụng ánh xạ Identity ($calibrated = raw$).
* Sẵn sàng chuyển giao sang mô hình hồi quy đẳng trương (**Isotonic Regression**) hoặc mô hình tuyến tính khi có bộ dữ liệu giáo viên chấm thực tế.

---

## 16. Dataset Strategy
Để xây dựng bộ dữ liệu huấn luyện calibration cho các phiên bản tiếp theo:
1. Thu thập bộ dữ liệu gồm: `(audio, script, speaker_id, native_accent, gender)`.
2. Gán nhãn điểm số từ 3 chuyên gia/giáo viên độc lập cho từng từ và bài nói: Pronunciation, Fluency, Speed (thang 0-100).
3. **Quy tắc phân chia**: Chia tập `train / validation / test` nghiêm ngặt theo **Speaker ID** (tuyệt đối không chia ngẫu nhiên theo audio để tránh rò rỉ đặc trưng người nói - speaker leakage).

---

## 17. Testing
Toàn bộ unit test và integration test đều tuân thủ nguyên tắc **Mock toàn bộ neural network**, không tải model nặng trong quá trình chạy test tự động:

```bash
# Chạy toàn bộ test suite
pytest -v tests/
```

Các kịch bản kiểm thử:
- `test_audio_quality.py`: Kiểm thử âm thanh chuẩn, audio ngắn, audio im lặng, audio bị clipping.
- `test_scorer.py`: Kiểm thử công thức Mahalanobis, GOP, hệ số trọng âm và critical phoneme penalty.
- `test_confidence.py`: Kiểm thử tính toán độ tin cậy đa tầng.
- `test_api.py`: Kiểm thử 4 kịch bản API chính: `SUCCESS`, `ALIGNMENT_FAILED`, `AUDIO_TOO_SHORT`, `PARTIAL_EVALUATION`.

---

## 18. Limitations
1. Dữ liệu formant tham chiếu trong `reference_profiles/vowels.json` hiện tại là cấu hình mẫu derived từ Hillenbrand et al. Để đạt độ chính xác tối ưu trong production quy mô lớn, cần nạp thêm phân phối thống kê đa dạng lứa tuổi và giới tính.
2. CTC forced alignment phụ thuộc vào chất lượng mô hình âm học nền tảng đối với giọng phi bản xứ (non-native accents) nặng.

---

## 19. Production Deployment
* **Tối ưu hóa GPU/CPU**: Microservice hỗ trợ chạy multi-worker uvicorn trên CPU với `asyncio.to_thread` cho tác vụ inference.
* **Bảo mật**: Không log raw audio, dọn dẹp file tạm ngay lập tức trong khối `finally`, không bao giờ để lộ đường dẫn tệp nội bộ hoặc stack trace ra response client.
