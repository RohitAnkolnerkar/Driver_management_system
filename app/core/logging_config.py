import contextvars
import json
import logging
import os
import sys
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler

from app.config import settings

# Thread/async-safe context variable to store correlation IDs
request_id_ctx = contextvars.ContextVar("request_id", default="-")


class RequestIDFilter(logging.Filter):
    """Filter to inject request_id context attribute into LogRecord."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_ctx.get()
        return True


class JSONFormatter(logging.Formatter):
    """Structured JSON logging formatter for production ingest."""

    def format(self, record: logging.LogRecord) -> str:
        log_data = {
            "timestamp": datetime.fromtimestamp(
                record.created, timezone.utc
            ).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "request_id": getattr(record, "request_id", "-"),
        }
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_data)


def setup_logging() -> None:
    """Sets up global logging configuration with console and rotating file outputs."""
    log_level_str = settings.LOG_LEVEL.upper()
    log_level = getattr(logging, log_level_str, logging.INFO)

    # Ensure local log folder exists
    os.makedirs("logs", exist_ok=True)

    # Instantiate Request ID filter
    request_id_filter = RequestIDFilter()

    # 1. Console Handler (Plaintext with request_id for human readability)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.addFilter(request_id_filter)
    console_formatter = logging.Formatter(
        "%(asctime)s [%(levelname)s] [%(request_id)s] %(name)s - %(message)s"
    )
    console_handler.setFormatter(console_formatter)

    # 2. File Handler (JSON formatted, rotated by size for log aggregation)
    file_handler = RotatingFileHandler(
        "logs/app.log", maxBytes=10 * 1024 * 1024, backupCount=5, encoding="utf-8"
    )
    file_handler.addFilter(request_id_filter)
    file_formatter = JSONFormatter()
    file_handler.setFormatter(file_formatter)

    # Configure root logger handlers
    logging.basicConfig(
        level=log_level, handlers=[console_handler, file_handler], force=True
    )

    # Sync standard Uvicorn loggers with our custom handlers
    for uvicorn_logger_name in ("uvicorn", "uvicorn.access", "uvicorn.error"):
        uvicorn_logger = logging.getLogger(uvicorn_logger_name)
        uvicorn_logger.handlers = [console_handler, file_handler]
        uvicorn_logger.propagate = False
