"""
Request/Response Logging Middleware
Tracks all API requests with timing, status codes, and error details
"""

import logging
import time
import uuid

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.core.metrics import metrics_collector

logger = logging.getLogger("access")
app_logger = logging.getLogger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware to log all incoming requests and outgoing responses
    Adds correlation ID to track requests across the system
    """

    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next):
        # Generate correlation ID
        correlation_id = str(uuid.uuid4())
        request.state.correlation_id = correlation_id

        # Record request start time
        start_time = time.time()

        # Extract request details
        method = request.method
        url = str(request.url)
        client_host = request.client.host if request.client else "unknown"

        # Log request
        app_logger.debug(f"[{correlation_id}] Incoming request: {method} {url} from {client_host}")

        # Process request
        try:
            response = await call_next(request)

            # Calculate processing time
            process_time = time.time() - start_time
            process_time_ms = round(process_time * 1000, 2)

            # Add headers
            response.headers["X-Correlation-ID"] = correlation_id
            response.headers["X-Process-Time"] = str(process_time_ms)

            # Log response
            status_code = response.status_code
            log_level = logging.INFO if status_code < 400 else logging.WARNING

            logger.log(
                log_level,
                f'"{method} {url}" {status_code} {process_time_ms}ms - {client_host} - [{correlation_id}]',
            )

            # Record metrics
            endpoint = request.url.path
            metrics_collector.record_request(method, endpoint, status_code, process_time_ms)

            # Log slow requests as warnings
            if process_time_ms > 1000:  # > 1 second
                app_logger.warning(
                    f"[{correlation_id}] Slow request: {method} {url} took {process_time_ms}ms"
                )

            return response

        except Exception as e:
            # Calculate processing time even for errors
            process_time = time.time() - start_time
            process_time_ms = round(process_time * 1000, 2)

            # Log error
            logger.error(
                f'"{method} {url}" 500 {process_time_ms}ms - {client_host} - [{correlation_id}] - ERROR: {str(e)}'
            )

            app_logger.error(f"[{correlation_id}] Request failed: {method} {url}", exc_info=True)

            # Record metrics
            endpoint = request.url.path
            metrics_collector.record_request(method, endpoint, 500, process_time_ms)
            metrics_collector.record_error(type(e).__name__)

            raise
