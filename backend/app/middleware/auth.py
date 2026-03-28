from fastapi import Depends, HTTPException, Request, status
from jose import JWTError, jwt
from app.core.config import get_settings

settings = get_settings()

# Supabase JWT secret is the anon key for verification
SUPABASE_JWT_SECRET = settings.supabase_anon_key


def get_token(request: Request) -> str:
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid authorization header",
        )
    return auth_header.split(" ")[1]


def get_current_user(token: str = Depends(get_token)) -> dict:
    """Decode Supabase JWT and return user payload."""
    try:
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated",
        )
        return payload
    except JWTError:
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
