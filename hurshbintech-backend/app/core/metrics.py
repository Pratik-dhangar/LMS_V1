"""Metrics Collection for Monitoring
Tracks API metrics compatible with Prometheus/Grafana
"""

import threading
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from typing import Dict, List


@dataclass
class MetricCounter:
    """Simple counter metric"""

    value: int = 0

    def inc(self, amount: int = 1):
        self.value += amount


@dataclass
class MetricHistogram:
    """Histogram metric for tracking distributions"""

    observations: List[float] = field(default_factory=list)
    total: float = 0.0
    count: int = 0

    def observe(self, value: float):
        self.observations.append(value)
        self.total += value
        self.count += 1

    @property
    def average(self) -> float:
        return self.total / self.count if self.count > 0 else 0.0

    @property
    def min(self) -> float:
        return min(self.observations) if self.observations else 0.0

    @property
    def max(self) -> float:
        return max(self.observations) if self.observations else 0.0


class MetricsCollector:
    """
    Collects application metrics in memory
    Thread-safe implementation for concurrent access
    """

    def __init__(self):
        self._lock = threading.Lock()
        self.start_time = datetime.utcnow()

        # Request metrics
        self.requests_total = MetricCounter()
        self.requests_by_method: Dict[str, MetricCounter] = defaultdict(MetricCounter)
        self.requests_by_status: Dict[int, MetricCounter] = defaultdict(MetricCounter)
        self.requests_by_endpoint: Dict[str, MetricCounter] = defaultdict(MetricCounter)

        # Response time metrics (in milliseconds)
        self.response_time_histogram = MetricHistogram()
        self.response_time_by_endpoint: Dict[str, MetricHistogram] = defaultdict(MetricHistogram)

        # Error metrics
        self.errors_total = MetricCounter()
        self.errors_by_type: Dict[str, MetricCounter] = defaultdict(MetricCounter)

        # Authentication metrics
        self.auth_attempts = MetricCounter()
        self.auth_successes = MetricCounter()
        self.auth_failures = MetricCounter()

        # Database metrics
        self.db_queries = MetricCounter()
        self.db_errors = MetricCounter()

    def record_request(self, method: str, endpoint: str, status_code: int, duration_ms: float):
        """Record a completed request"""
        with self._lock:
            self.requests_total.inc()
            self.requests_by_method[method].inc()
            self.requests_by_status[status_code].inc()
            self.requests_by_endpoint[endpoint].inc()
            self.response_time_histogram.observe(duration_ms)
            self.response_time_by_endpoint[endpoint].observe(duration_ms)

            if status_code >= 400:
                self.errors_total.inc()

    def record_auth_attempt(self, success: bool):
        """Record an authentication attempt"""
        with self._lock:
            self.auth_attempts.inc()
            if success:
                self.auth_successes.inc()
            else:
                self.auth_failures.inc()

    def record_error(self, error_type: str):
        """Record an error by type"""
        with self._lock:
            self.errors_total.inc()
            self.errors_by_type[error_type].inc()

    def record_db_query(self, error: bool = False):
        """Record a database query"""
        with self._lock:
            self.db_queries.inc()
            if error:
                self.db_errors.inc()

    def get_metrics(self) -> dict:
        """Get all metrics as a dictionary"""
        with self._lock:
            uptime = (datetime.utcnow() - self.start_time).total_seconds()

            return {
                "uptime_seconds": round(uptime, 2),
                "requests": {
                    "total": self.requests_total.value,
                    "by_method": {k: v.value for k, v in self.requests_by_method.items()},
                    "by_status": {str(k): v.value for k, v in self.requests_by_status.items()},
                    "by_endpoint": {k: v.value for k, v in self.requests_by_endpoint.items()},
                },
                "response_time_ms": {
                    "average": round(self.response_time_histogram.average, 2),
                    "min": round(self.response_time_histogram.min, 2),
                    "max": round(self.response_time_histogram.max, 2),
                    "count": self.response_time_histogram.count,
                    "by_endpoint": {
                        k: {
                            "average": round(v.average, 2),
                            "min": round(v.min, 2),
                            "max": round(v.max, 2),
                            "count": v.count,
                        }
                        for k, v in self.response_time_by_endpoint.items()
                    },
                },
                "errors": {
                    "total": self.errors_total.value,
                    "by_type": {k: v.value for k, v in self.errors_by_type.items()},
                },
                "authentication": {
                    "attempts": self.auth_attempts.value,
                    "successes": self.auth_successes.value,
                    "failures": self.auth_failures.value,
                    "success_rate": round(
                        (
                            (self.auth_successes.value / self.auth_attempts.value * 100)
                            if self.auth_attempts.value > 0
                            else 0
                        ),
                        2,
                    ),
                },
                "database": {
                    "queries": self.db_queries.value,
                    "errors": self.db_errors.value,
                    "error_rate": round(
                        (
                            (self.db_errors.value / self.db_queries.value * 100)
                            if self.db_queries.value > 0
                            else 0
                        ),
                        2,
                    ),
                },
            }

    def get_prometheus_format(self) -> str:
        """Get metrics in Prometheus exposition format"""
        metrics = self.get_metrics()
        lines = []

        # Help and type declarations
        lines.append("# HELP requests_total Total number of HTTP requests")
        lines.append("# TYPE requests_total counter")
        lines.append(f"requests_total {metrics['requests']['total']}")

        lines.append("# HELP response_time_seconds Response time in seconds")
        lines.append("# TYPE response_time_seconds histogram")
        lines.append(f"response_time_seconds_sum {metrics['response_time_ms']['average'] / 1000}")
        lines.append(f"response_time_seconds_count {metrics['response_time_ms']['count']}")

        lines.append("# HELP errors_total Total number of errors")
        lines.append("# TYPE errors_total counter")
        lines.append(f"errors_total {metrics['errors']['total']}")

        lines.append("# HELP auth_attempts_total Total authentication attempts")
        lines.append("# TYPE auth_attempts_total counter")
        lines.append(f"auth_attempts_total {metrics['authentication']['attempts']}")

        lines.append("# HELP auth_successes_total Successful authentications")
        lines.append("# TYPE auth_successes_total counter")
        lines.append(f"auth_successes_total {metrics['authentication']['successes']}")

        return "\n".join(lines)

    def reset(self):
        """Reset all metrics (useful for testing)"""
        with self._lock:
            self.__init__()


# Global metrics collector instance
metrics_collector = MetricsCollector()
