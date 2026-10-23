import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import router
from app.exceptions import SpeechAssessmentException
from app.schemas import ErrorResponse, ErrorDetail, ErrorCode

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("phonetics-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for model warmups and resource cleanup."""
    logger.info("Initializing Speech Assessment Engine & Kokoro-82M TTS...")
    try:
        from app.services.tts_service import tts_engine
        tts_engine.initialize()
    except Exception as e:
        logger.warning("Kokoro-82M model initialization warning: %s", e)
    yield
    logger.info("Shutting down Speech Assessment Engine...")


app = FastAPI(
    title="Speech Assessment Microservice",
    description="High-precision phonetic pronunciation & acoustic assessment engine for English learning.",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS Middleware for Spring Boot & Frontend consumption
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
    Handles custom domain exceptions:
    - Logs detailed reason and internal error on server
    - Returns structured ErrorDetail JSON to client without exposing stack traces.
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
    Catches all unexpected internal errors:
    - Full stack trace logged to server logger
    - Safe generic 500 error returned to client.
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


# Mount API Routes
app.include_router(router)
