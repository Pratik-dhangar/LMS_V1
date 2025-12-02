# Phase 4: Monitoring & Observability - Complete

## Overview
Phase 4 implements comprehensive monitoring, logging, and metrics collection for production observability. The system now provides detailed insights into API performance, errors, and system health.

## Implemented Features

### 1. Structured Logging System ✅
**File**: `app/core/logging_config.py`

Three-tier logging system with colored console output and file rotation:

#### Log Files
- **`logs/app.log`**: All application logs (INFO and above)
- **`logs/error.log`**: Error logs only (ERROR and above)
- **`logs/access.log`**: HTTP request/response logs

#### Features
- **Color-coded console output**: Different colors for DEBUG, INFO, WARNING, ERROR, CRITICAL
- **Rotating file handlers**: 10MB max size, 5-10 backups
- **Environment-aware**: DEBUG level in development, INFO in production
- **Structured format**: Timestamp, logger name, level, message, file location

#### Configuration
```python
from app.core.logging_config import setup_logging, get_logger

# Initialize logging (done in main.py)
setup_logging()

# Get logger in any module
logger = get_logger(__name__)
logger.info("Application started")
```

### 2. Request/Response Logging Middleware ✅
**File**: `app/core/request_logging.py`

Tracks every API request with detailed metrics:

#### Captured Data
- HTTP method and endpoint
- Status code
- Response time (milliseconds)
- Client IP address
- Correlation ID (UUID)
- Error details with stack traces

#### Example Log Entry
```
2025-12-02 00:30:15 - "POST /api/auth/user/login" 200 13.45ms - 127.0.0.1 - [a1b2c3d4-e5f6-...]
```

#### Features
- **Correlation IDs**: Track requests across the system
- **Slow request detection**: Warns on requests > 1 second
- **Response headers**: Adds `X-Correlation-ID` and `X-Process-Time`
- **Error tracking**: Full exception details in logs

### 3. Metrics Collection System ✅
**File**: `app/core/metrics.py`

In-memory metrics collection compatible with Prometheus/Grafana:

#### Tracked Metrics

**Request Metrics**:
- Total requests
- Requests by HTTP method
- Requests by status code
- Requests by endpoint

**Response Time Metrics**:
- Average, min, max response times
- Response time histograms by endpoint
- Request count per endpoint

**Error Metrics**:
- Total errors
- Errors by type (exception class name)
- Error rate percentage

**Authentication Metrics**:
- Total authentication attempts
- Successful authentications
- Failed authentications
- Success rate percentage

**Database Metrics**:
- Total database queries
- Database errors
- Error rate percentage

#### Thread-Safe Implementation
```python
from app.core.metrics import metrics_collector

# Record metrics (done automatically by middleware)
metrics_collector.record_request("POST", "/api/auth/user/login", 200, 15.3)
metrics_collector.record_auth_attempt(success=True)
metrics_collector.record_error("ValueError")
```

### 4. Metrics Endpoints ✅
**File**: `app/api/endpoints/health.py`

Three monitoring endpoints:

#### `/api/health` - Health Check
```json
{
  "status": "healthy",
  "timestamp": "2025-12-02T00:30:15.123456",
  "database": {
    "status": "healthy",
    "response_time_ms": 2.45
  },
  "api": {
    "response_time_ms": 3.12
  }
}
```

#### `/api/metrics` - JSON Metrics
```json
{
  "uptime_seconds": 3600.5,
  "requests": {
    "total": 1250,
    "by_method": {"GET": 800, "POST": 450},
    "by_status": {"200": 1100, "401": 120, "500": 30},
    "by_endpoint": {"/api/health": 50, "/api/auth/user/login": 200}
  },
  "response_time_ms": {
    "average": 15.3,
    "min": 2.1,
    "max": 231.5,
    "count": 1250
  },
  "authentication": {
    "attempts": 200,
    "successes": 180,
    "failures": 20,
    "success_rate": 90.0
  }
}
```

#### `/api/metrics/prometheus` - Prometheus Format
```
# HELP requests_total Total number of HTTP requests
# TYPE requests_total counter
requests_total 1250

# HELP response_time_seconds Response time in seconds
# TYPE response_time_seconds histogram
response_time_seconds_sum 0.0153
response_time_seconds_count 1250
```

### 5. Correlation ID Tracking ✅
**Feature**: Request tracing across the system

Every request gets a unique UUID added to:
- Response headers: `X-Correlation-ID`
- All log entries: `[correlation-id]`
- Error traces

**Use Case**: Track a single request through multiple services and log files.

### 6. Production Logging Configuration ✅
**Features**:
- Automatic log rotation (10MB per file)
- Multiple backup files (5-10)
- UTF-8 encoding for international characters
- Separate error log for quick troubleshooting
- Access log for audit trails
- Suppressed noisy third-party logs in production

## Integration Points

### Main Application (`main.py`)
```python
from app.core.logging_config import setup_logging
from app.core.request_logging import RequestLoggingMiddleware

# Setup logging first
setup_logging()
logger = logging.getLogger(__name__)

# Add middleware
app.add_middleware(RequestLoggingMiddleware)
```

### Authentication Endpoints (`auth.py`)
```python
from app.core.metrics import metrics_collector

# Record successful/failed auth
metrics_collector.record_auth_attempt(success=True)
```

### Error Handling
Middleware automatically captures:
- Exception type and message
- Full stack trace
- Request context (method, URL, correlation ID)
- Response time even for errors

## Monitoring Setup

### Local Development
```bash
# Logs are written to logs/ directory
tail -f logs/app.log      # All logs
tail -f logs/error.log    # Errors only
tail -f logs/access.log   # HTTP requests
```

### Viewing Metrics
```bash
# Health check
curl http://127.0.0.1:8000/api/health

# JSON metrics
curl http://127.0.0.1:8000/api/metrics

# Prometheus format
curl http://127.0.0.1:8000/api/metrics/prometheus
```

### Prometheus Integration
**prometheus.yml**:
```yaml
scrape_configs:
  - job_name: 'hurshbintech-backend'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:8000']
    metrics_path: '/api/metrics/prometheus'
```

### Grafana Dashboard
Create panels for:
- Request rate (requests per second)
- Response time (95th percentile)
- Error rate (percentage)
- Authentication success rate
- Database query performance

## Alert Recommendations

### Critical Alerts
1. **Service Down**: `/api/health` returns non-200 status
2. **High Error Rate**: Error rate > 5% for 5 minutes
3. **Database Unavailable**: Database status = "unhealthy"
4. **High Response Time**: 95th percentile > 500ms for 5 minutes

### Warning Alerts
1. **Increased Error Rate**: Error rate > 2% for 10 minutes
2. **Slow Requests**: Average response time > 200ms for 5 minutes
3. **High Auth Failures**: Auth failure rate > 20% for 5 minutes
4. **Database Slow**: Database response > 50ms for 5 minutes

### Info Alerts
1. **Service Restart**: Uptime < 5 minutes
2. **High Load**: Request rate > 100 requests/second
3. **Authentication Spike**: Auth attempts 2x normal

## Log Analysis Examples

### Finding Slow Requests
```bash
grep "Slow request" logs/app.log | tail -20
```

### Finding Errors
```bash
grep "ERROR" logs/error.log | tail -50
```

### Finding Failed Logins
```bash
grep "Failed login attempt" logs/app.log
```

### Request by Correlation ID
```bash
grep "a1b2c3d4-e5f6-..." logs/app.log logs/access.log
```

### Response Time Analysis
```bash
grep "Process-Time" logs/access.log | awk '{print $5}' | sort -n
```

## Production Best Practices

### Log Retention
- **Application logs**: 30 days
- **Access logs**: 90 days (compliance)
- **Error logs**: 90 days (troubleshooting)

### Log Aggregation
Consider using:
- **ELK Stack** (Elasticsearch, Logstash, Kibana)
- **Grafana Loki** (lightweight alternative)
- **Cloud logging** (AWS CloudWatch, Azure Monitor)

### Monitoring Tools
- **Prometheus + Grafana**: Metrics and dashboards
- **Sentry**: Error tracking and alerting
- **Datadog/New Relic**: Full-stack APM

### Security Considerations
- Don't log sensitive data (passwords, tokens, PII)
- Implement log access controls
- Encrypt logs at rest (production)
- Set up log forwarding to secure storage

## Metrics Interpretation

### Request Metrics
- **Total requests**: Overall traffic
- **By method**: GET vs POST ratio
- **By endpoint**: Most/least used endpoints
- **By status**: Success (2xx) vs error (4xx, 5xx) ratio

### Response Time Metrics
- **Average**: General performance indicator
- **Min/Max**: Identify outliers
- **By endpoint**: Find slow endpoints
- **Histogram**: Distribution analysis

### Error Metrics
- **Total errors**: System stability
- **By type**: Common error patterns
- **Error rate**: Percentage of failing requests

### Authentication Metrics
- **Attempts**: Login traffic
- **Success rate**: Security indicator
- **Failures**: Potential attacks or UX issues

## Troubleshooting Guide

### High Response Times
1. Check `/api/metrics` for slow endpoints
2. Review `logs/app.log` for "Slow request" warnings
3. Check database response times in `/api/health`
4. Review connection pool usage

### High Error Rate
1. Check `logs/error.log` for stack traces
2. Review `/api/metrics` for error types
3. Check correlation IDs to trace errors
4. Verify database connectivity

### Memory Issues
1. Check metrics collector size (reset if needed)
2. Review log file sizes
3. Monitor file handler count
4. Check for resource leaks

### Missing Logs
1. Verify `logs/` directory exists and is writable
2. Check log level configuration
3. Verify logger initialization in `main.py`
4. Check file handler permissions

## Phase 4 Summary

### Files Created/Modified
- ✅ `app/core/logging_config.py` - Structured logging setup
- ✅ `app/core/request_logging.py` - Request/response middleware
- ✅ `app/core/metrics.py` - Metrics collection system
- ✅ `app/api/endpoints/health.py` - Metrics endpoints
- ✅ `app/api/endpoints/auth.py` - Auth metrics integration
- ✅ `main.py` - Logging and middleware setup

### Capabilities Added
- ✅ Colored console logging
- ✅ Rotating file logs (app, error, access)
- ✅ Request/response tracking
- ✅ Correlation ID tracing
- ✅ Metrics collection (requests, errors, auth, DB)
- ✅ Health check endpoint
- ✅ JSON metrics endpoint
- ✅ Prometheus metrics endpoint
- ✅ Slow request detection
- ✅ Error tracking with stack traces

### Production Ready
The monitoring system is production-ready with:
- Thread-safe metrics collection
- Automatic log rotation
- Multiple output formats
- Comprehensive error tracking
- Performance monitoring
- Security audit capabilities

**Phase 4: Monitoring complete!** 🎉
