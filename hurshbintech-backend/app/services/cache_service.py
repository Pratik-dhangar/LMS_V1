"""
Redis Cache Service for Performance Optimization

Cache Strategy:
- TTL-based expiration (5-60 minutes depending on data type)
- Automatic cache invalidation on data mutations
- JSON serialization for complex objects
"""

import json
import logging
import random
import time
import asyncio
from typing import Any, Optional, Union, Dict
from datetime import timedelta
from functools import wraps

import redis.asyncio as redis
from redis.asyncio import Redis
from fastapi import HTTPException

from app.core.config import settings

logger = logging.getLogger(__name__)


class CacheService:
    """Async Redis cache service with connection pooling"""
    
    def __init__(self):
        self.redis_client: Optional[Redis] = None
        self.enabled = settings.REDIS_ENABLED
        
        # Circuit breaker state
        self._failure_count: int = 0
        self._failure_threshold: int = 5          # Trip after 5 consecutive failures
        self._recovery_timeout: int = 30          # Wait 30s before retrying Redis
        self._circuit_opened_at: Optional[float] = None  # Timestamp when circuit opened
        self._half_open_probe_in_progress: bool = False   # Guard: only ONE probe at a time
        
        # Request coalescing (prevent cache stampede)
        self._pending_requests: Dict[str, asyncio.Lock] = {}
        self._locks_lock = asyncio.Lock()  # Protect the locks dictionary itself
        
        # Cache TTL constants (in seconds)
        self.TTL_PRODUCT_METADATA = 3600  # 1 hour for categories/age_groups/skills
        self.TTL_PRODUCT_CATALOG = 300    # 5 minutes for product listings
        self.TTL_PRODUCT_DETAIL = 900     # 15 minutes for individual product details
        self.TTL_LEARNING_CONTENT = 3600  # 1 hour for learning content
        self.TTL_LEARNING_CONTENT_DETAIL = 900  # 15 minutes for individual content
        self.TTL_LEARNING_GOALS = 3600    # 1 hour for learning goals
        self.TTL_USER_PROFILE = 1800      # 30 minutes for user profiles (deprecated - use specific below)
        self.TTL_USER_PROFILE_ME = 900    # 15 minutes for current user profile
        self.TTL_COACH_PROFILES = 3600    # 1 hour for coach profiles list
        self.TTL_FEATURED_COACH = 3600    # 1 hour for featured coach data
        self.TTL_BLOGS_LIST = 900         # 15 minutes for blog listings
        self.TTL_BLOG_DETAIL = 1800       # 30 minutes for individual blog
        self.TTL_VLOGS_LIST = 900         # 15 minutes for vlog listings
        self.TTL_VLOG_DETAIL = 1800       # 30 minutes for individual vlog
        self.TTL_ABOUT_US = 3600          # 1 hour for about us page
        self.TTL_ORDER = 600              # 10 minutes for order data
        self.TTL_SUBSCRIPTION_PACKAGES = 3600  # 1 hour for subscription packages
        self.TTL_USER_SUBSCRIPTIONS = 900  # 15 minutes for user subscriptions
        self.TTL_ASSIGNED_TRAININGS = 600  # 10 minutes for assigned trainings
        
    async def connect(self):
        """Initialize Redis connection pool"""
        if not self.enabled:
            logger.info("Redis caching disabled in configuration")
            return
            
        try:
            self.redis_client = redis.Redis(
                host=settings.REDIS_HOST,
                port=settings.REDIS_PORT,
                db=settings.REDIS_DB,
                password=settings.REDIS_PASSWORD if settings.REDIS_PASSWORD else None,
                encoding="utf-8",
                decode_responses=True,
                socket_keepalive=True,
                socket_connect_timeout=2,  # Fast fail — don't block requests for 10s on Redis outage
                socket_timeout=2,          # Also limit per-command timeout
                retry_on_timeout=True,
                max_connections=50,
                health_check_interval=30
            )
            
            # Test connection
            await self.redis_client.ping()
            logger.info(f"✅ Redis connected successfully: {settings.REDIS_HOST}:{settings.REDIS_PORT}")
            
        except Exception as e:
            logger.warning(f"⚠️ Redis connection failed: {str(e)} - Continuing without cache")
            self.enabled = False
            self.redis_client = None
    
    async def disconnect(self):
        """Close Redis connection pool"""
        if self.redis_client:
            await self.redis_client.close()
            logger.info("Redis connection closed")
    
    # ========== Circuit Breaker Logic ==========
    
    def _is_circuit_open(self) -> bool:
        """
        Check if the circuit breaker is open (Redis calls should be skipped).
        
        States:
          CLOSED  – Redis is healthy, all calls go through.
          OPEN    – Too many consecutive failures, skip Redis entirely.
          HALF-OPEN – Recovery timeout elapsed, allow exactly ONE probe call.
        """
        if self._failure_count < self._failure_threshold:
            return False  # Circuit CLOSED
        
        # Circuit is tripped — check if recovery timeout has elapsed
        if self._circuit_opened_at is None:
            return True
        
        elapsed = time.monotonic() - self._circuit_opened_at
        if elapsed >= self._recovery_timeout:
            # HALF-OPEN: allow only ONE probe call through
            if self._half_open_probe_in_progress:
                # Another request is already probing — skip Redis for this request
                return True
            self._half_open_probe_in_progress = True
            logger.info("Circuit breaker HALF-OPEN: allowing probe call to Redis")
            return False
        
        return True  # Circuit still OPEN
    
    def _record_success(self):
        """Reset circuit breaker on a successful Redis call."""
        if self._failure_count > 0:
            logger.info("Circuit breaker CLOSED: Redis recovered")
        self._failure_count = 0
        self._circuit_opened_at = None
        self._half_open_probe_in_progress = False
    
    def _record_failure(self, error: Exception, context: str = ""):
        """Record a failure and potentially trip the circuit breaker."""
        self._failure_count += 1
        self._half_open_probe_in_progress = False  # Reset probe guard
        
        if self._failure_count >= self._failure_threshold:
            if self._circuit_opened_at is None:
                # First time tripping the circuit
                self._circuit_opened_at = time.monotonic()
                logger.error(
                    f"Circuit breaker OPEN: {self._failure_count} consecutive Redis failures. "
                    f"Skipping Redis for {self._recovery_timeout}s. Last error ({context}): {error}"
                )
            else:
                # Re-tripping after a failed HALF-OPEN probe — reset the timer
                self._circuit_opened_at = time.monotonic()
                logger.warning(
                    f"Circuit breaker OPEN (probe failed): Redis still down. "
                    f"Skipping Redis for another {self._recovery_timeout}s. ({context}): {error}"
                )
        else:
            logger.warning(f"Redis failure {self._failure_count}/{self._failure_threshold} ({context}): {error}")
    
    def _get_ttl_with_jitter(self, base_ttl: int) -> int:
        """
        Add +/- 10% random jitter to TTL to prevent thundering herd.
        
        Without jitter, a server restart causes all keys to be set at the
        same time and expire simultaneously, slamming the database.
        """
        jitter = int(base_ttl * 0.1)
        return base_ttl + random.randint(-jitter, jitter)
    
    def _serialize(self, value: Any) -> str:
        """Serialize Python object to JSON string"""
        try:
            return json.dumps(value, default=str, ensure_ascii=False)
        except (TypeError, ValueError) as e:
            logger.error(f"Failed to serialize value: {e}")
            raise
    
    def _deserialize(self, value: Optional[str]) -> Any:
        """Deserialize JSON string to Python object"""
        if value is None:
            return None
        try:
            return json.loads(value)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to deserialize value: {e}")
            return None
    
    async def get(self, key: str) -> Optional[Any]:
        """
        Retrieve value from cache.
        Returns None if key doesn't exist, cache is disabled, or circuit is open.
        """
        if not self.enabled or not self.redis_client or self._is_circuit_open():
            return None
        
        try:
            value = await self.redis_client.get(key)
            self._record_success()
            if value:
                logger.debug(f"Cache HIT: {key}")
                return self._deserialize(value)
            logger.debug(f"Cache MISS: {key}")
            return None
        except Exception as e:
            self._record_failure(e, context=f"GET {key}")
            return None
    
    async def set(
        self, 
        key: str, 
        value: Any, 
        ttl: Optional[int] = None
    ) -> bool:
        """
        Store value in cache with optional TTL
        
        Args:
            key: Cache key
            value: Value to cache (will be JSON serialized)
            ttl: Time-to-live in seconds (None = no expiration)
        
        Returns:
            True if successful, False otherwise
        """
        if not self.enabled or not self.redis_client or self._is_circuit_open():
            return False
        
        try:
            serialized_value = self._serialize(value)
            
            if ttl:
                final_ttl = self._get_ttl_with_jitter(ttl)
                await self.redis_client.setex(key, final_ttl, serialized_value)
            else:
                final_ttl = None
                await self.redis_client.set(key, serialized_value)
            
            self._record_success()
            logger.debug(f"Cache SET: {key} (base TTL: {ttl}s, actual: {final_ttl}s)")
            return True
        except Exception as e:
            self._record_failure(e, context=f"SET {key}")
            return False
    
    async def delete(self, key: str) -> bool:
        """Delete single key from cache"""
        if not self.enabled or not self.redis_client or self._is_circuit_open():
            return False
        
        try:
            deleted = await self.redis_client.delete(key)
            self._record_success()
            logger.debug(f"Cache DELETE: {key} (deleted: {deleted})")
            return deleted > 0
        except Exception as e:
            self._record_failure(e, context=f"DELETE {key}")
            return False
    
    async def delete_pattern(self, pattern: str) -> int:
        """
        Delete all keys matching pattern
        Example: delete_pattern("products:*") deletes all product cache
        
        Returns:
            Number of keys deleted
        """
        if not self.enabled or not self.redis_client or self._is_circuit_open():
            return 0
        
        try:
            keys = []
            async for key in self.redis_client.scan_iter(match=pattern, count=100):
                keys.append(key)
            
            if keys:
                deleted = await self.redis_client.delete(*keys)
                self._record_success()
                logger.info(f"Cache DELETE PATTERN: {pattern} (deleted {deleted} keys)")
                return deleted
            self._record_success()
            return 0
        except Exception as e:
            self._record_failure(e, context=f"DELETE PATTERN {pattern}")
            return 0
    
    async def exists(self, key: str) -> bool:
        """Check if key exists in cache"""
        if not self.enabled or not self.redis_client or self._is_circuit_open():
            return False
        
        try:
            result = await self.redis_client.exists(key) > 0
            self._record_success()
            return result
        except Exception as e:
            self._record_failure(e, context=f"EXISTS {key}")
            return False
    
    async def clear_all(self) -> bool:
        """Clear entire cache database (use with caution!)"""
        if not self.enabled or not self.redis_client or self._is_circuit_open():
            return False
        
        try:
            await self.redis_client.flushdb()
            self._record_success()
            logger.warning("⚠️ Cache CLEARED: All keys deleted")
            return True
        except Exception as e:
            self._record_failure(e, context="FLUSHDB")
            return False
    
    # ========== Cache Key Builders ==========
    
    def key_product_categories(self) -> str:
        """Cache key for all product categories"""
        return "products:categories:all"
    
    def key_age_groups(self) -> str:
        """Cache key for all age groups"""
        return "products:age_groups:all"
    
    def key_skills(self) -> str:
        """Cache key for all skills"""
        return "products:skills:all"
    
    def key_product_catalog(self, filters_hash: str) -> str:
        """Cache key for filtered product catalog"""
        return f"products:catalog:{filters_hash}"
    
    def key_product_detail(self, product_id: str) -> str:
        """Cache key for single product detail"""
        return f"products:detail:{product_id}"
    
    def key_learning_content_all(self) -> str:
        """Cache key for all learning content"""
        return "learning:content:all"
    
    def key_learning_content_detail(self, content_id: int) -> str:
        """Cache key for single learning content"""
        return f"learning:content:{content_id}"
    
    def key_blogs_list(self, filters_hash: str) -> str:
        """Cache key for blogs list with filters"""
        return f"blogs:list:{filters_hash}"
    
    def key_blog_detail(self, slug: str) -> str:
        """Cache key for individual blog by slug"""
        return f"blogs:detail:{slug}"
    
    def key_vlogs_list(self, filters_hash: str) -> str:
        """Cache key for vlogs list with filters"""
        return f"vlogs:list:{filters_hash}"
    
    def key_vlog_detail(self, vlog_id: int) -> str:
        """Cache key for individual vlog"""
        return f"vlogs:detail:{vlog_id}"
    
    def key_about_us(self, language: str = "en") -> str:
        """Cache key for about us page by language"""
        return f"about_us:page:{language}"
    
    def key_learning_content_list(self, role: str) -> str:
        """Cache key for learning content list by role"""
        return f"learning_content:list:{role}"
    
    def key_learning_content_detail(self, content_id: int) -> str:
        """Cache key for individual learning content"""
        return f"learning_content:detail:{content_id}"
    
    def key_learning_goals_list(self, role: str) -> str:
        """Cache key for learning goals list by role"""
        return f"learning_goals:list:{role}"
    
    def key_learning_goal_detail(self, goal_id: int) -> str:
        """Cache key for individual learning goal"""
        return f"learning_goals:detail:{goal_id}"
    
    def key_available_coaches(self) -> str:
        """Cache key for available coaches list"""
        return "coaches:available:all"
    
    def key_coach_profile(self, coach_id: int) -> str:
        """Cache key for individual coach profile"""
        return f"coaches:profile:{coach_id}"
    
    def key_featured_coach(self, coach_id: int) -> str:
        """Cache key for featured coach data"""
        return f"coaches:featured:{coach_id}"
    
    def key_user_profile_me(self, user_id: int) -> str:
        """Cache key for current user profile (user-specific)"""
        return f"user:profile:me:{user_id}"
    
    # ========== Cache Invalidation Helpers ==========
    
    async def invalidate_product_metadata(self):
        """Invalidate all product metadata caches (categories, age groups, skills)"""
        await self.delete(self.key_product_categories())
        await self.delete(self.key_age_groups())
        await self.delete(self.key_skills())
        logger.info("Invalidated product metadata cache")
    
    async def invalidate_product_catalogs(self):
        """Invalidate all product catalog caches (after product update)"""
        await self.delete_pattern("products:catalog:*")
        logger.info("Invalidated product catalog cache")
    
    async def invalidate_product(self, product_id: str):
        """Invalidate specific product detail and all catalogs"""
        await self.delete(self.key_product_detail(product_id))
        await self.invalidate_product_catalogs()
        logger.info(f"Invalidated product cache: {product_id}")
    
    async def invalidate_learning_content(self, content_id: Optional[int] = None):
        """Invalidate learning content cache (all or specific)"""
        if content_id:
            await self.delete(self.key_learning_content_detail(content_id))
        else:
            await self.delete(self.key_learning_content_all())
        logger.info(f"Invalidated learning content cache: {content_id or 'all'}")
    
    async def invalidate_blogs(self):
        """Invalidate all blog list caches"""
        await self.delete_pattern("blogs:list:*")
        logger.info("Invalidated blog list cache")
    
    async def invalidate_blog(self, slug: str):
        """Invalidate specific blog detail and all lists"""
        await self.delete(self.key_blog_detail(slug))
        await self.invalidate_blogs()
        logger.info(f"Invalidated blog cache: {slug}")
    
    async def invalidate_vlogs(self):
        """Invalidate all vlog list caches"""
        await self.delete_pattern("vlogs:list:*")
        logger.info("Invalidated vlog list cache")
    
    async def invalidate_vlog(self, vlog_id: int):
        """Invalidate specific vlog detail and all lists"""
        await self.delete(self.key_vlog_detail(vlog_id))
        await self.invalidate_vlogs()
        logger.info(f"Invalidated vlog cache: {vlog_id}")
    
    async def invalidate_about_us(self):
        """Invalidate all about us page caches (all languages)"""
        await self.delete_pattern("about_us:page:*")
        logger.info("Invalidated about us cache")
    
    async def invalidate_learning_content_lists(self):
        """Invalidate all learning content list caches"""
        await self.delete_pattern("learning_content:list:*")
        logger.info("Invalidated learning content list cache")
    
    async def invalidate_learning_content(self, content_id: int):
        """Invalidate specific learning content detail and all lists"""
        await self.delete(self.key_learning_content_detail(content_id))
        await self.invalidate_learning_content_lists()
        logger.info(f"Invalidated learning content cache: {content_id}")
    
    async def invalidate_learning_goals_lists(self):
        """Invalidate all learning goals list caches"""
        await self.delete_pattern("learning_goals:list:*")
        logger.info("Invalidated learning goals list cache")
    
    async def invalidate_learning_goal(self, goal_id: int):
        """Invalidate specific learning goal detail and all lists"""
        await self.delete(self.key_learning_goal_detail(goal_id))
        await self.invalidate_learning_goals_lists()
        logger.info(f"Invalidated learning goal cache: {goal_id}")
    
    async def invalidate_coach_profiles(self):
        """Invalidate all coach profile caches"""
        await self.delete(self.key_available_coaches())
        await self.delete_pattern("coaches:profile:*")
        await self.delete_pattern("coaches:featured:*")
        logger.info("Invalidated coach profiles cache")
    
    async def invalidate_coach_profile(self, coach_id: int):
        """Invalidate specific coach profile and lists"""
        await self.delete(self.key_coach_profile(coach_id))
        await self.delete(self.key_featured_coach(coach_id))
        await self.invalidate_coach_profiles()
        logger.info(f"Invalidated coach profile cache: {coach_id}")
    
    async def invalidate_user_profile(self, user_id: int):
        """Invalidate specific user profile cache"""
        await self.delete(self.key_user_profile_me(user_id))
        logger.info(f"Invalidated user profile cache: {user_id}")


# Global cache service instance
cache_service = CacheService()


def cache_decorator(
    key_prefix: str,
    ttl: int = 300,
    key_builder=None
):
    """
    Decorator for caching function results
    
    Args:
        key_prefix: Prefix for cache key (e.g., "products:categories")
        ttl: Time-to-live in seconds
        key_builder: Optional function to build cache key from function args
    
    Example:
        @cache_decorator("products:categories", ttl=3600)
        async def get_all_categories(db: AsyncSession):
            # Function result will be cached for 1 hour
            return await db.execute(...)
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Build cache key
            if key_builder:
                cache_key = key_builder(*args, **kwargs)
            else:
                # Auto-generate key from prefix + arguments to avoid
                # the "static key" bug where different inputs share one cache entry.
                # Filter out non-hashable args like db sessions by type.
                safe_args = [str(a) for a in args if isinstance(a, (str, int, float, bool))]
                safe_kwargs = [f"{k}={v}" for k, v in sorted(kwargs.items()) if isinstance(v, (str, int, float, bool))]
                suffix = ":".join(safe_args + safe_kwargs)
                cache_key = f"{key_prefix}:{suffix}" if suffix else key_prefix
            
            # Try to get from cache (fast path)
            cached_value = await cache_service.get(cache_key)
            if cached_value is not None:
                logger.info(f"Returning cached result for: {cache_key}")
                return cached_value
            
            # Cache miss — use request coalescing to prevent stampede
            async with cache_service._locks_lock:
                if cache_key in cache_service._pending_requests:
                    # Another request is already fetching this — wait for it
                    lock = cache_service._pending_requests[cache_key]
                    logger.debug(f"Request coalescing: waiting for pending request ({cache_key})")
                else:
                    # We're the first — create a lock for others to wait on
                    lock = asyncio.Lock()
                    cache_service._pending_requests[cache_key] = lock
                    await lock.acquire()  # Acquire immediately (we're the first)
            
            # If we're waiting for another request, wait for the lock then check cache
            if lock.locked() and cache_key in cache_service._pending_requests:
                async with lock:
                    pass  # Just wait
                # The first request should have populated cache — try again
                cached_value = await cache_service.get(cache_key)
                if cached_value is not None:
                    logger.debug(f"Request coalescing: cache populated by first request ({cache_key})")
                    return cached_value
            
            # We're the first request — execute function
            try:
                result = await func(*args, **kwargs)
                
                # Store in cache
                if result is not None:
                    await cache_service.set(cache_key, result, ttl)
                    logger.info(f"Cached result for: {cache_key}")
                
                return result
            finally:
                # Release and remove lock
                async with cache_service._locks_lock:
                    if cache_key in cache_service._pending_requests:
                        cache_service._pending_requests[cache_key].release()
                        del cache_service._pending_requests[cache_key]
        
        return wrapper
    return decorator
