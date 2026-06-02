"""
Logging Configuration for Hurshbin Backend
Provides structured logging with different handlers for development and production
"""

import logging
import os
import sys
from logging.handlers import RotatingFileHandler
from pathlib import Path

# Create logs directory if it doesn't exist
LOGS_DIR = Path(__file__).parent.parent.parent / "logs"
LOGS_DIR.mkdir(exist_ok=True)


class ColoredFormatter(logging.Formatter):
    """Colored formatter for console output"""

    grey = "\x1b[38;21m"
    blue = "\x1b[38;5;39m"
    yellow = "\x1b[38;5;226m"
    red = "\x1b[38;5;196m"
    bold_red = "\x1b[31;1m"
    reset = "\x1b[0m"

    format_str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s (%(filename)s:%(lineno)d)"

    FORMATS = {
        logging.DEBUG: grey + format_str + reset,
        logging.INFO: blue + format_str + reset,
        logging.WARNING: yellow + format_str + reset,
        logging.ERROR: red + format_str + reset,
        logging.CRITICAL: bold_red + format_str + reset,
    }

    def format(self, record):
        log_fmt = self.FORMATS.get(record.levelno)
        formatter = logging.Formatter(log_fmt, datefmt="%Y-%m-%d %H:%M:%S")
        return formatter.format(record)


def setup_logging():
    """Configure logging for the application"""

    environment = os.getenv("ENVIRONMENT", "development")

    # Root logger configuration
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG if environment == "development" else logging.INFO)

    # Remove existing handlers
    root_logger.handlers.clear()

    # Console handler with colored output
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.DEBUG if environment == "development" else logging.INFO)
    console_handler.setFormatter(ColoredFormatter())
    root_logger.addHandler(console_handler)

    # File handler for all logs (rotating)
    file_handler = RotatingFileHandler(
        LOGS_DIR / "app.log", maxBytes=10 * 1024 * 1024, backupCount=5, encoding="utf-8"  # 10MB
    )
    file_handler.setLevel(logging.INFO)
    file_formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s - [%(pathname)s:%(lineno)d]",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    file_handler.setFormatter(file_formatter)
    root_logger.addHandler(file_handler)

    # Error file handler (errors only)
    error_handler = RotatingFileHandler(
        LOGS_DIR / "error.log", maxBytes=10 * 1024 * 1024, backupCount=5, encoding="utf-8"  # 10MB
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(file_formatter)
    root_logger.addHandler(error_handler)

    # Access log handler (for request/response logging)
    access_handler = RotatingFileHandler(
        LOGS_DIR / "access.log", maxBytes=10 * 1024 * 1024, backupCount=10, encoding="utf-8"  # 10MB
    )
    access_handler.setLevel(logging.INFO)
    access_formatter = logging.Formatter("%(asctime)s - %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
    access_handler.setFormatter(access_formatter)

    # Create access logger
    access_logger = logging.getLogger("access")
    access_logger.setLevel(logging.INFO)
    access_logger.addHandler(access_handler)
    access_logger.propagate = False  # Don't propagate to root logger

    # Suppress noisy third-party loggers in production
    if environment == "production":
        logging.getLogger("uvicorn").setLevel(logging.WARNING)
        logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
        logging.getLogger("sqlalchemy").setLevel(logging.WARNING)

    logging.info(f"Logging configured for environment: {environment}")
    logging.info(f"Logs directory: {LOGS_DIR}")


def get_logger(name: str) -> logging.Logger:
    """Get a logger instance for a module"""
    return logging.getLogger(name)
