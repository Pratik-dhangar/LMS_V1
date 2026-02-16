"""
Performance monitoring and health check endpoint
"""

import time
from datetime import datetime

from fastapi import APIRouter, Depends, Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.metrics import metrics_collector
from app.db.session import get_db
from app.services.cache_service import cache_service

router = APIRouter()


@router.get("/health", tags=["monitoring"])
async def health_check(db: AsyncSession = Depends(get_db)):
    """
    Health check endpoint with database connectivity, Redis cache, and response time
    Returns system status and performance metrics
    """
    start_time = time.time()

    # Test database connectivity
    try:
        await db.execute(text("SELECT 1"))
        db_status = "healthy"
        db_response_ms = round((time.time() - start_time) * 1000, 2)
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"
        db_response_ms = None

    # Test Redis connectivity and get stats
    redis_start = time.time()
    redis_stats = await cache_service.get_health_stats()
    redis_response_ms = round((time.time() - redis_start) * 1000, 2)

    total_response_ms = round((time.time() - start_time) * 1000, 2)

    # Determine overall status
    overall_status = "healthy"
    if db_status != "healthy":
        overall_status = "degraded"
    elif redis_stats and redis_stats.get("status") == "error":
        overall_status = "degraded"  # Redis down, but app still works

    return {
        "status": overall_status,
        "timestamp": datetime.utcnow().isoformat(),
        "database": {"status": db_status, "response_time_ms": db_response_ms},
        "redis": {
            "response_time_ms": redis_response_ms,
            **redis_stats
        } if redis_stats else {"status": "disabled"},
        "api": {"response_time_ms": total_response_ms},
    }


@router.get("/metrics", tags=["monitoring"])
async def get_metrics():
    """
    Get application metrics in JSON format
    Includes request counts, response times, errors, and authentication stats
    """
    return metrics_collector.get_metrics()


@router.get("/metrics/prometheus", tags=["monitoring"])
async def get_prometheus_metrics():
    """
    Get application metrics in Prometheus exposition format
    Compatible with Prometheus scraping
    """
    metrics_text = metrics_collector.get_prometheus_format()
    return Response(content=metrics_text, media_type="text/plain")
