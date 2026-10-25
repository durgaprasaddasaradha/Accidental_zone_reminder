"""Server-side Supabase database client configuration.

CRITICAL SECURITY RULE:
The service role key gives administrative bypass to Row Level Security (RLS).
This module MUST ONLY be imported and executed in backend/server environments.
NEVER import or bundle this into frontend client code.
"""

import os
from typing import Optional
from dotenv import load_dotenv

# Load environment variables from .env file if available
load_dotenv()

_supabase_client = None


def get_supabase_client():
    """Returns the initialized Supabase client singleton using service role credentials.
    
    Returns None if SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not configured.
    """
    global _supabase_client
    if _supabase_client is not None:
        return _supabase_client

    supabase_url = os.getenv("SUPABASE_URL")
    supabase_service_role_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not supabase_url or not supabase_service_role_key:
        return None

    try:
        from supabase import create_client, Client
        _supabase_client = create_client(supabase_url, supabase_service_role_key)
        return _supabase_client
    except Exception as exc:
        raise RuntimeError(f"Failed to initialize Supabase client: {exc}") from exc


def is_supabase_configured() -> bool:
    """Checks whether valid Supabase environment credentials are provided."""
    url = os.getenv("SUPABASE_URL", "").strip()
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    # Filter out empty or placeholder values
    if not url or not key:
        return False
    if "your-project-id" in url or "your-supabase-service-role-key" in key:
        return False
    return True
