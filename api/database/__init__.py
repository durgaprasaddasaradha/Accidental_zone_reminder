"""Database module for Supabase integration."""
from api.database.supabase import get_supabase_client, is_supabase_configured

__all__ = ["get_supabase_client", "is_supabase_configured"]
