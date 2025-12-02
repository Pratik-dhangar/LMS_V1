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

router = APIRouter()


@router.get("/health", tags=["monitoring"])
async def health_check(db: AsyncSession = Depends(get_db)):
    """
    Health check endpoint with database connectivity and response time
    Returns system status and performance metrics
    """
    start_time = time.time()

    try:
        # Test database connectivity
        await db.execute(text("SELECT 1"))
        db_status = "healthy"
        db_response_ms = round((time.time() - start_time) * 1000, 2)
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"
        db_response_ms = None

    total_response_ms = round((time.time() - start_time) * 1000, 2)

    return {
        "status": "healthy" if db_status == "healthy" else "degraded",
        "timestamp": datetime.utcnow().isoformat(),
        "database": {"status": db_status, "response_time_ms": db_response_ms},
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
