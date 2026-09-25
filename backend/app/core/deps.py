"""
FastAPI dependencies — auth, DB session, RBAC.
Every protected route uses Depends() from here.
"""
from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.firebase import get_auth_client, get_firestore_client
from app.core.config import get_settings

_bearer = HTTPBearer(auto_error=True)

VALID_ROLES = {"student", "teacher", "coordinator", "admin"}


class AuthenticatedUser:
    def __init__(
        self,
        student_id: str,
        role: str,
        centre_id: str,
        class_num: int | None,
    ):
        self.student_id = student_id
        self.role = role
        self.centre_id = centre_id
        self.class_num = class_num


async def _verify_token(credentials: HTTPAuthorizationCredentials) -> dict:
    """Validate Firebase ID token. Raises 401 on any failure."""
    settings = get_settings()
    auth_client = get_auth_client()
    token = credentials.credentials

    try:
        decoded = auth_client.verify_id_token(token, check_revoked=True)
    except auth_client.RevokedIdTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token revoked")
    except auth_client.ExpiredIdTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    return decoded


_DEV_USERS = {
    "dev-student-token": AuthenticatedUser(
        student_id="KHEL-2026-001", role="student", centre_id="KHEL-PATNA-01", class_num=8,
    ),
    "dev-teacher-token": AuthenticatedUser(
        student_id="KHEL-2026-T01", role="teacher", centre_id="KHEL-PATNA-01", class_num=None,
    ),
    "dev-admin-token": AuthenticatedUser(
        student_id="KHEL-2026-ADM1", role="admin", centre_id="KHEL-PATNA-01", class_num=None,
    ),
}


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
) -> AuthenticatedUser:
    settings = get_settings()

    if settings.app_env == "development":
        dev_user = _DEV_USERS.get(credentials.credentials)
        if dev_user:
            return dev_user

    decoded = await _verify_token(credentials)
    uid = decoded.get("uid")
    if not uid:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token claims")

    fs = get_firestore_client()
    doc = fs.collection("users").document(uid).get()
    if not doc.exists:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    data = doc.to_dict()
    if not data.get("is_active", False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account inactive")

    return AuthenticatedUser(
        student_id=uid,
        role=data.get("role", "student"),
        centre_id=data.get("centre_id", ""),
        class_num=data.get("class_num"),
    )


def require_role(*roles: str):
    """Returns a FastAPI dependency that enforces the given role(s)."""
    async def _dep(user: Annotated[AuthenticatedUser, Depends(get_current_user)]) -> AuthenticatedUser:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Role '{user.role}' is not permitted here",
            )
        return user
    return _dep


# Convenience aliases
StudentDep = Annotated[AuthenticatedUser, Depends(require_role("student", "teacher", "coordinator", "admin"))]
TeacherDep = Annotated[AuthenticatedUser, Depends(require_role("teacher", "coordinator", "admin"))]
CoordinatorDep = Annotated[AuthenticatedUser, Depends(require_role("coordinator", "admin"))]
AdminDep = Annotated[AuthenticatedUser, Depends(require_role("admin"))]
DBDep = Annotated[AsyncSession, Depends(get_db)]
