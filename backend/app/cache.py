# Application cache layer using cachetools
from cachetools import TTLCache
import threading

class AppCache:
    """Thread-safe cache with TTL support"""
    
    def __init__(self):
        self._lock = threading.Lock()
        self._cache = TTLCache(maxsize=1000, ttl=300)  # 5 min
        self._static_cache = TTLCache(maxsize=500, ttl=3600)  # 1 hour
    
    def get(self, key):
        """Get value from dynamic cache"""
        with self._lock:
            return self._cache.get(key)
    
    def set(self, key, value):
        """Set value in dynamic cache"""
        with self._lock:
            self._cache[key] = value
    
    def delete(self, key):
        """Delete key from dynamic cache"""
        with self._lock:
            self._cache.pop(key, None)
    
    def get_static(self, key):
        """Get value from static cache (longer TTL)"""
        with self._lock:
            return self._static_cache.get(key)
    
    def set_static(self, key, value):
        """Set value in static cache (longer TTL)"""
        with self._lock:
            self._static_cache[key] = value
    
    def invalidate_pattern(self, pattern):
        """Invalidate all keys matching pattern"""
        with self._lock:
            keys_to_delete = [k for k in self._cache if pattern in k]
            for k in keys_to_delete:
                del self._cache[k]
    
    def clear(self):
        """Clear all caches"""
        with self._lock:
            self._cache.clear()
            self._static_cache.clear()

# Global cache instance
cache = AppCache()
