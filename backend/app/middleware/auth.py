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
    """Validate Supabase access token and return user with profile data.

    org_id and role are read exclusively from the profiles table —
    never from user_metadata (which is user-editable).
    """
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
        profile = profile_response.data
        if not profile or not profile.get("org_id"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User profile not found or missing organization. Contact your admin.",
            )

        return {
            "sub": user.id,
            "email": user.email,
            "org_id": profile["org_id"],
            "role": profile["role"],
            "full_name": profile.get("full_name", ""),
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
        user_role = current_user["role"]
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user_role}' not authorized. Required: {allowed_roles}",
            )
        return current_user

    return check_role
