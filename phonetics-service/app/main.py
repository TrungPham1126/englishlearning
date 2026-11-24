"""
Điểm khởi đầu (entry point) của dịch vụ web FastAPI đánh giá phát âm (`phonetics-service`).
Chịu trách nhiệm:
1. Cấu hình hệ thống ghi nhật ký (logging).
2. Khởi tạo trước mô hình TTS khi ứng dụng khởi động và dọn dẹp khi tắt.
3. Tạo ứng dụng FastAPI và mở CORS cho backend Spring Boot / giao diện Frontend.
4. Đăng ký các hàm xử lý lỗi tập trung để luôn trả về JSON lỗi chuẩn hóa.
5. Gắn các đường dẫn API (routes) vào ứng dụng.
"""

import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import router
from app.exceptions import SpeechAssessmentException
from app.schemas import ErrorResponse, ErrorDetail, ErrorCode

# Cấu hình hệ thống ghi nhật ký (logging) chuẩn theo định dạng: thời gian [MỨC_ĐỘ] tên_logger: nội dung
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("phonetics-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Hàm quản lý vòng đời (lifespan) của ứng dụng FastAPI:
    - Trước `yield`: khởi động trước (warmup) bộ tổng hợp giọng nói Kokoro-82M TTS khi bật server.
    - Sau `yield`: thực hiện giải phóng/ghi nhận khi server chuẩn bị tắt.
    """
    logger.info("Initializing Speech Assessment Engine & Kokoro-82M TTS...")
    # Nạp sẵn mô hình TTS để lượt gọi đầu tiên không bị chậm; nếu thiếu thư viện/file thì chỉ ghi cảnh báo
    # nhằm đảm bảo chức năng chấm điểm phát âm vẫn hoạt động bình thường.
    try:
        from app.services.tts_service import tts_engine
        tts_engine.initialize()
    except Exception as e:
        logger.warning("Kokoro-82M model initialization warning: %s", e)
    yield
    # Khối mã dưới đây chạy khi ứng dụng nhận tín hiệu dừng
    logger.info("Shutting down Speech Assessment Engine...")


# Khởi tạo thể hiện ứng dụng FastAPI chính kèm thông tin tài liệu Swagger/OpenAPI
app = FastAPI(
    title="Speech Assessment Microservice",
    description="High-precision phonetic pronunciation & acoustic assessment engine for English learning.",
    version="1.0.0",
    lifespan=lifespan
)

# Cấu hình CORS Middleware cho phép backend Spring Boot và Frontend gọi API từ bất kỳ nguồn nào
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(SpeechAssessmentException)
async def handle_speech_exception(request: Request, exc: SpeechAssessmentException):
    """
    Bộ xử lý tập trung cho các ngoại lệ nghiệp vụ có kiểm soát (`SpeechAssessmentException`):
    - Ghi lại lý do chi tiết và lỗi gốc (nếu có) vào log phía máy chủ để phục vụ tra cứu.
    - Trả về JSON theo cấu trúc chuẩn `ErrorDetail` cho client mà không làm lộ stack trace nội bộ.
    """
    logger.warning(
        "SpeechAssessmentException [%s] on %s: %s (Reason: %s)",
        exc.code,
        request.url.path,
        exc.message,
        exc.reason,
        exc_info=exc.internal_error
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.to_detail().model_dump()}
    )


@app.exception_handler(Exception)
async def handle_unhandled_exception(request: Request, exc: Exception):
    """
    Bộ xử lý dự phòng cho mọi ngoại lệ hệ thống ngoài dự kiến (unhandled exceptions):
    - Ghi đầy đủ dấu vết lỗi (stack trace) vào log máy chủ và console để lập trình viên gỡ lỗi.
    - Trả về mã HTTP 500 cùng thông báo lỗi chung an toàn cho phía client.
    """
    import traceback
    error_trace = traceback.format_exc()
    logger.error(f"[ACOUSTIC_CRASH_TRACE] Chi tiết ngoại lệ trên {request.url.path}:\n{error_trace}")
    print(f"=== CHI TIẾT LỖI XỬ LÝ ÂM HỌC ===\n{error_trace}", flush=True)

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": {
                "code": ErrorCode.INTERNAL_ERROR,
                "message": "Đã xảy ra lỗi nội bộ trong quá trình xử lý âm học.",
                "reason": str(exc) if str(exc) else "Internal server processing failure",
                "suggestion": "Vui lòng thử lại sau hoặc liên hệ bộ phận hỗ trợ kỹ thuật."
            }
        }
    )


# Gắn toàn bộ các endpoint API từ router vào ứng dụng FastAPI
app.include_router(router)
