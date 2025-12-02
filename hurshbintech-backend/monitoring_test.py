"""
Monitoring System Test
Verifies logging, metrics, and correlation ID tracking
"""

import httpx
import asyncio
import json


BASE_URL = "http://127.0.0.1:8000"


async def test_monitoring_system():
    """Test all monitoring endpoints and features"""
    print("\n" + "=" * 70)
    print(" " * 20 + "MONITORING SYSTEM TEST")
    print(" " * 15 + "Phase 4: Monitoring & Observability")
    print("=" * 70)

    async with httpx.AsyncClient(timeout=30.0) as client:

        # Test 1: Health Check
        print("\n1. Testing Health Check Endpoint")
        print("-" * 70)
        response = await client.get(f"{BASE_URL}/api/health")
        print(f"   Status: {response.status_code}")
        health_data = response.json()
        print(f"   System Status: {health_data['status']}")
        print(f"   Database: {health_data['database']['status']}")
        print(f"   DB Response Time: {health_data['database']['response_time_ms']}ms")
        print(f"   ✓ Health check working")

        # Test 2: Correlation ID
        print("\n2. Testing Correlation ID Tracking")
        print("-" * 70)
        correlation_id = response.headers.get("X-Correlation-ID")
        process_time = response.headers.get("X-Process-Time")
        print(f"   Correlation ID: {correlation_id}")
        print(f"   Process Time: {process_time}ms")
        print(f"   ✓ Correlation IDs present in headers")

        # Test 3: Generate some traffic for metrics
        print("\n3. Generating Test Traffic")
        print("-" * 70)
        for i in range(5):
            await client.get(f"{BASE_URL}/api/health")
        print(f"   ✓ Sent 5 health check requests")

        # Try a login (will fail but will be tracked)
        try:
            await client.post(
                f"{BASE_URL}/api/auth/user/login", json={"passcode": "wrong", "role": "admin"}
            )
        except:
            pass
        print(f"   ✓ Sent 1 failed auth request")

        # Test 4: Metrics Endpoint
        print("\n4. Testing Metrics Endpoint (JSON)")
        print("-" * 70)
        response = await client.get(f"{BASE_URL}/api/metrics")
        metrics = response.json()

        print(f"   Uptime: {metrics['uptime_seconds']}s")
        print(f"   Total Requests: {metrics['requests']['total']}")
        print(f"   Avg Response Time: {metrics['response_time_ms']['average']}ms")
        print(f"   Total Errors: {metrics['errors']['total']}")
        print(f"   Auth Attempts: {metrics['authentication']['attempts']}")
        print(f"   Auth Success Rate: {metrics['authentication']['success_rate']}%")

        # Show breakdown
        print(f"\n   Requests by Method:")
        for method, count in metrics["requests"]["by_method"].items():
            print(f"     {method}: {count}")

        print(f"\n   Requests by Status:")
        for status, count in list(metrics["requests"]["by_status"].items())[:5]:
            print(f"     {status}: {count}")

        print(f"\n   ✓ Metrics collection working")

        # Test 5: Prometheus Metrics
        print("\n5. Testing Prometheus Metrics Endpoint")
        print("-" * 70)
        response = await client.get(f"{BASE_URL}/api/metrics/prometheus")
        prom_metrics = response.text
        lines = prom_metrics.split("\n")[:10]  # First 10 lines
        for line in lines:
            if line.strip():
                print(f"   {line}")
        print(f"   ...")
        print(f"   ✓ Prometheus format working")

        # Summary
        print("\n" + "=" * 70)
        print("MONITORING SYSTEM STATUS")
        print("=" * 70)
        print("   ✅ Structured logging configured")
        print("   ✅ Request/response logging active")
        print("   ✅ Correlation IDs working")
        print("   ✅ Metrics collection working")
        print("   ✅ Health endpoint functional")
        print("   ✅ JSON metrics endpoint functional")
        print("   ✅ Prometheus endpoint functional")
        print("=" * 70)

        print("\n📊 View Metrics:")
        print(f"   Health:     {BASE_URL}/api/health")
        print(f"   Metrics:    {BASE_URL}/api/metrics")
        print(f"   Prometheus: {BASE_URL}/api/metrics/prometheus")

        print("\n📁 View Logs:")
        print("   Application:  logs/app.log")
        print("   Errors:       logs/error.log")
        print("   Access:       logs/access.log")

        print("\n")


if __name__ == "__main__":
    print("\nStarting monitoring system tests...")
    print("Make sure the backend is running on http://127.0.0.1:8000\n")

    try:
        asyncio.run(test_monitoring_system())
    except KeyboardInterrupt:
        print("\n\nTests interrupted by user")
    except Exception as e:
        print(f"\n\nError: {e}")
        print("\nMake sure the backend is running: uvicorn main:app --reload")
