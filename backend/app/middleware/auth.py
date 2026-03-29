from fastapi import Depends, HTTPException, Request, status

from app.core.config import get_settings
from app.core.supabase import get_supabase_admin, get_supabase_client

settings = get_settings()


def get_token(request: Request) -> str:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header",
        )
    return auth_header.split(" ")[1]


def get_current_user(token: str = Depends(get_token)) -> dict:
    """Validate Supabase access token and enrich it with profile role/org data."""
    try:
        auth_response = get_supabase_client().auth.get_user(token)
        user = auth_response.user
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )

        profile_response = (
            get_supabase_admin()
            .table("profiles")
            .select("org_id, role, full_name, email")
            .eq("id", user.id)
            .maybe_single()
            .execute()
        )
        profile = profile_response.data or {}
        user_metadata = dict(user.user_metadata or {})
        if profile:
            user_metadata["org_id"] = profile.get("org_id", user_metadata.get("org_id"))
            user_metadata["role"] = profile.get("role", user_metadata.get("role"))
            user_metadata["full_name"] = profile.get(
                "full_name",
                user_metadata.get("full_name"),
            )

        return {
            "sub": user.id,
            "email": user.email,
            "user_metadata": user_metadata,
            "app_metadata": user.app_metadata or {},
            "profile": profile,
        }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )


def require_role(allowed_roles: list[str]):
    """Dependency factory that checks user role against allowed roles."""

    def check_role(current_user: dict = Depends(get_current_user)) -> dict:
        user_role = current_user.get("user_metadata", {}).get("role", "volunteer")
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user_role}' not authorized. Required: {allowed_roles}",
            )
        return current_user

    return check_role
