"""
Performance Testing Script
Tests API response times before and after Phase 3 optimizations
"""

import httpx
import asyncio
import time
from statistics import mean, median


BASE_URL = "http://127.0.0.1:8000"

# Test credentials
ADMIN_CREDS = {"passcode": "123456", "role": "admin"}
HEAD_CREDS = {"passcode": "703038", "role": "head"}
LEARNER_CREDS = {"passcode": "543005", "role": "learner"}


async def measure_endpoint(client: httpx.AsyncClient, method: str, url: str, **kwargs):
    """Measure response time for a single request"""
    start = time.time()
    try:
        if method == "GET":
            response = await client.get(url, **kwargs)
        elif method == "POST":
            response = await client.post(url, **kwargs)

        elapsed = (time.time() - start) * 1000  # Convert to ms
        return {
            "success": response.status_code < 400,
            "status_code": response.status_code,
            "response_time_ms": round(elapsed, 2),
        }
    except Exception as e:
        elapsed = (time.time() - start) * 1000
        return {"success": False, "error": str(e), "response_time_ms": round(elapsed, 2)}


async def test_health_endpoint(client: httpx.AsyncClient, iterations=10):
    """Test health check endpoint performance"""
    print("\n" + "=" * 60)
    print("Testing /api/health endpoint")
    print("=" * 60)

    times = []
    for i in range(iterations):
        result = await measure_endpoint(client, "GET", f"{BASE_URL}/api/health")
        times.append(result["response_time_ms"])
        print(f"  Request {i+1}: {result['response_time_ms']}ms - Status: {result['status_code']}")

    print(f"\n  Average: {round(mean(times), 2)}ms")
    print(f"  Median:  {round(median(times), 2)}ms")
    print(f"  Min:     {round(min(times), 2)}ms")
    print(f"  Max:     {round(max(times), 2)}ms")

    return times


async def test_login_endpoint(client: httpx.AsyncClient, creds: dict, iterations=10):
    """Test login endpoint performance"""
    role = creds["role"]
    print("\n" + "=" * 60)
    print(f"Testing /api/auth/user/login endpoint ({role} role)")
    print("=" * 60)

    times = []
    success_count = 0
    for i in range(iterations):
        result = await measure_endpoint(
            client, "POST", f"{BASE_URL}/api/auth/user/login", json=creds
        )
        times.append(result["response_time_ms"])
        status = "✓" if result["success"] else "✗"
        if result["success"]:
            success_count += 1
        print(f"  Request {i+1}: {result['response_time_ms']}ms {status}")

    print(f"\n  Average: {round(mean(times), 2)}ms")
    print(f"  Median:  {round(median(times), 2)}ms")
    print(f"  Min:     {round(min(times), 2)}ms")
    print(f"  Max:     {round(max(times), 2)}ms")
    print(f"  Success Rate: {success_count}/{iterations}")

    return times


async def test_compression(client: httpx.AsyncClient):
    """Test GZip compression is working"""
    print("\n" + "=" * 60)
    print("Testing GZip Compression")
    print("=" * 60)

    # Request with gzip accepted
    response = await client.get(f"{BASE_URL}/api/health", headers={"Accept-Encoding": "gzip"})

    content_encoding = response.headers.get("Content-Encoding", "none")
    content_length = len(response.content)

    print(f"  Content-Encoding: {content_encoding}")
    print(f"  Response Size: {content_length} bytes")
    print(f"  Compression: {'✓ Active' if content_encoding == 'gzip' else '✗ Not active'}")


async def run_all_tests():
    """Run all performance tests"""
    print("\n" + "=" * 70)
    print(" " * 20 + "PERFORMANCE TEST SUITE")
    print(" " * 15 + "Phase 3: Performance Optimizations")
    print("=" * 70)

    async with httpx.AsyncClient(timeout=30.0) as client:
        # Test health endpoint
        health_times = await test_health_endpoint(client, iterations=10)

        # Test authentication endpoints
        await asyncio.sleep(1)  # Brief pause
        admin_times = await test_login_endpoint(client, ADMIN_CREDS, iterations=10)

        await asyncio.sleep(1)
        head_times = await test_login_endpoint(client, HEAD_CREDS, iterations=10)

        await asyncio.sleep(1)
        learner_times = await test_login_endpoint(client, LEARNER_CREDS, iterations=10)

        # Test compression
        await asyncio.sleep(1)
        await test_compression(client)

    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print(f"  Health Check:  {round(mean(health_times), 2)}ms avg")
    print(f"  Admin Login:   {round(mean(admin_times), 2)}ms avg")
    print(f"  Head Login:    {round(mean(head_times), 2)}ms avg")
    print(f"  Learner Login: {round(mean(learner_times), 2)}ms avg")
    print("=" * 70)

    print("\nOptimizations Applied:")
    print("  ✓ Database indexes on users table (role, is_active, role+is_active)")
    print("  ✓ GZip compression for responses > 1KB")
    print("  ✓ Connection pool: 20 persistent + 40 overflow connections")
    print("  ✓ Connection recycling after 1 hour")
    print("  ✓ Eager loading with joinedload/selectinload")
    print("  ✓ Health monitoring endpoint")
    print("\n")


if __name__ == "__main__":
    print("\nStarting performance tests...")
    print("Make sure the backend is running on http://127.0.0.1:8000\n")

    try:
        asyncio.run(run_all_tests())
    except KeyboardInterrupt:
        print("\n\nTests interrupted by user")
    except Exception as e:
        print(f"\n\nError: {e}")
