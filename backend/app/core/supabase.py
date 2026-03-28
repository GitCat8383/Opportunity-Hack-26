from supabase import create_client, Client
from app.core.config import get_settings

settings = get_settings()


def get_supabase_client() -> Client:
    return create_client(settings.supabase_url, settings.supabase_anon_key)


def get_supabase_admin() -> Client:
    """Service-role client for admin operations (bypasses RLS)."""
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
