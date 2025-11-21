"""
Supabase Client Configuration
Async database operations wrapper
"""
from supabase import create_client, Client
from config.settings import settings
from typing import Optional, Dict, List, Any
import time
import logging
from .local_cache import local_cache

class SupabaseUnavailable(Exception):
    """Raised when Supabase cannot be initialized or queried."""
    pass

logger = logging.getLogger(__name__)


class SupabaseClient:
    """Async wrapper for Supabase operations"""
    
    def __init__(self):
        self.url = settings.SUPABASE_URL
        self.key = settings.SUPABASE_KEY
        self._client: Optional[Client] = None
        self._last_error_time: Optional[float] = None
        
    def reset_client(self):
        """Reset client to force reconnection"""
        self._client = None
        logger.info("Supabase client reset - will reconnect on next request")
        
    @property
    def client(self) -> Client:
        """Lazy initialization of Supabase client with retry on each access"""
        # Always try to reconnect if client not initialized
        if self._client is None:
            if not self.url or not self.key:
                logger.warning("Supabase credentials missing – entering cache-only mode.")
                raise SupabaseUnavailable("Supabase credentials missing")
            try:
                # Create client without proxy parameter to avoid version compatibility issues
                self._client = create_client(
                    supabase_url=self.url,
                    supabase_key=self.key
                )
                logger.info("✅ Supabase client initialized successfully")
            except Exception as e:
                logger.warning(f"❌ Supabase initialization failed: {e}. Using local cache.")
                raise SupabaseUnavailable(f"Supabase init failed: {e}")
        return self._client
    
    async def select(self, table: str, filters: Optional[Dict] = None, limit: Optional[int] = None, columns: Optional[str] = None) -> List[Dict]:
        """
        Select records from table
        
        Args:
            table: Table name
            filters: Dict of column: value filters
            limit: Maximum number of records
            
        Returns:
            List of records
        """
        start = time.time()
        try:
            select_cols = columns if columns else "*"
            query = self.client.table(table).select(select_cols)
            
            if filters:
                for key, value in filters.items():
                    query = query.eq(key, value)
            
            if limit:
                query = query.limit(limit)
                
            response = query.execute()
            took_ms = int((time.time() - start) * 1000)
            if not response.data:
                logger.warning(f"Supabase select returned empty set table={table} cols={select_cols} filters={filters} limit={limit} ({took_ms}ms)")
                return []
            logger.info(f"Supabase select ok table={table} count={len(response.data)} cols={select_cols} ({took_ms}ms)")
            return response.data
            
        except SupabaseUnavailable:
            # Fallback to local cache
            return local_cache.get_all(table, limit=limit or 100)
        except Exception as e:
            took_ms = int((time.time() - start) * 1000)
            logger.error(f"Supabase select error table={table} cols={columns or '*'} filters={filters} limit={limit} ({took_ms}ms): {e}. Falling back to cache")
            return local_cache.get_all(table, limit=limit or 100)
    
    async def select_by_id(self, table: str, record_id: str) -> Optional[Dict]:
        """Get single record by ID"""
        try:
            response = self.client.table(table).select("*").eq("id", record_id).execute()
            return response.data[0] if response.data else None
        except SupabaseUnavailable:
            return local_cache.get_by_id(table, record_id)
        except Exception as e:
            logger.error(f"Supabase select_by_id error: {e}. Falling back to cache")
            return local_cache.get_by_id(table, record_id)
    
    async def insert(self, table: str, data: Dict) -> Optional[Dict]:
        """
        Insert record into table
        
        Args:
            table: Table name
            data: Record data
            
        Returns:
            Inserted record
        """
        try:
            response = self.client.table(table).insert(data).execute()
            inserted = response.data[0] if response.data else None
            if inserted:
                # write-through to cache
                local_cache.upsert(table, inserted)
            return inserted
        except SupabaseUnavailable:
            local_cache.upsert(table, data)
            return data
        except Exception as e:
            logger.error(f"Supabase insert error: {e}. Using cache only")
            local_cache.upsert(table, data)
            return data
    
    async def update(self, table: str, record_id: str, data: Dict) -> Optional[Dict]:
        """
        Update record by ID
        
        Args:
            table: Table name
            record_id: Record ID
            data: Updated data
            
        Returns:
            Updated record
        """
        try:
            response = self.client.table(table).update(data).eq("id", record_id).execute()
            updated = response.data[0] if response.data else None
            if updated:
                local_cache.upsert(table, updated)
            return updated
        except SupabaseUnavailable:
            # update cache directly
            local_cache.upsert(table, {"id": record_id, **data})
            return {"id": record_id, **data}
        except Exception as e:
            logger.error(f"Supabase update error: {e}. Updating cache only")
            local_cache.upsert(table, {"id": record_id, **data})
            return {"id": record_id, **data}
    
    async def delete(self, table: str, record_id: str) -> bool:
        """
        Delete record by ID
        
        Args:
            table: Table name
            record_id: Record ID
            
        Returns:
            Success status
        """
        try:
            self.client.table(table).delete().eq("id", record_id).execute()
            local_cache.delete(table, record_id)
            return True
        except SupabaseUnavailable:
            return local_cache.delete(table, record_id)
        except Exception as e:
            logger.error(f"Supabase delete error: {e}. Deleting in cache only")
            return local_cache.delete(table, record_id)


# Global client instance
supabase_client = SupabaseClient()
