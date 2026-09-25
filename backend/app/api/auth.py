import bcrypt
from fastapi import APIRouter, HTTPException, status, Request

from app.core.config import get_settings
from app.core.firebase import get_auth_client, get_firestore_client
from app.core.deps import TeacherDep
from app.core.limiter import limiter
from app.schemas.auth import LoginRequest, LoginResponse, PinResetRequest, PingResponse

router = APIRouter()

APP_VERSION = "1.0.0"

# Track failed login attempts in-memory (swap for Redis in production)
# Bounded to prevent memory exhaustion from enumeration attacks.
_MAX_TRACKED_IDS = 10_000
_failed_attempts: dict[str, list[float]] = {}
_LOCKOUT_THRESHOLD = 5
_LOCKOUT_WINDOW_S = 900  # 15 minutes


def _is_locked_out(student_id: str) -> bool:
    import time
    now = time.time()
    attempts = _failed_attempts.get(student_id, [])
    recent = [t for t in attempts if now - t < _LOCKOUT_WINDOW_S]
    _failed_attempts[student_id] = recent
    return len(recent) >= _LOCKOUT_THRESHOLD


def _record_failure(student_id: str) -> None:
    import time
    if len(_failed_attempts) >= _MAX_TRACKED_IDS and student_id not in _failed_attempts:
        oldest_key = next(iter(_failed_attempts))
        _failed_attempts.pop(oldest_key, None)
    _failed_attempts.setdefault(student_id, []).append(time.time())


def _clear_attempts(student_id: str) -> None:
    _failed_attempts.pop(student_id, None)


_DEV_CREDENTIALS = {
    ("KHEL-2026-001", "1234"): LoginResponse(
        firebase_token="dev-student-token", role="student", class_num=8, centre_id="KHEL-PATNA-01",
    ),
    ("KHEL-2026-T01", "9999"): LoginResponse(
        firebase_token="dev-teacher-token", role="teacher", class_num=None, centre_id="KHEL-PATNA-01",
    ),
    ("KHEL-2026-ADM1", "0000"): LoginResponse(
        firebase_token="dev-admin-token", role="admin", class_num=None, centre_id="KHEL-PATNA-01",
    ),
}


@router.post("/login", response_model=LoginResponse)
@limiter.limit("5/minute")
async def login(request: Request, body: LoginRequest) -> LoginResponse:
    settings = get_settings()
    if settings.app_env == "development":
        dev_resp = _DEV_CREDENTIALS.get((body.student_id, body.pin))
        if dev_resp:
            return dev_resp
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if _is_locked_out(body.student_id):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed attempts. Please wait 15 minutes.",
        )

    fs = get_firestore_client()
    doc = fs.collection("users").document(body.student_id).get()

    if not doc.exists:
        _record_failure(body.student_id)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    data = doc.to_dict()
    if not data.get("is_active", False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account inactive")

    stored_hash: str = data.get("pin_hash", "")
    if not bcrypt.checkpw(body.pin.encode(), stored_hash.encode()):
        _record_failure(body.student_id)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    _clear_attempts(body.student_id)

    auth_client = get_auth_client()
    firebase_token = auth_client.create_custom_token(body.student_id).decode()

    return LoginResponse(
        firebase_token=firebase_token,
        role=data.get("role", "student"),
        class_num=data.get("class_num"),
        centre_id=data.get("centre_id", ""),
    )


@router.post("/reset-pin")
@limiter.limit("3/minute")
async def reset_pin(request: Request, body: PinResetRequest, teacher: TeacherDep) -> dict:
    fs = get_firestore_client()
    doc = fs.collection("users").document(body.student_id).get()
    if not doc.exists:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")

    new_hash = bcrypt.hashpw(body.new_pin.encode(), bcrypt.gensalt(rounds=12)).decode()
    fs.collection("users").document(body.student_id).update({
        "pin_hash": new_hash,
        "force_pin_change": True,
    })
    return {"success": True}


@router.get("/ping", response_model=PingResponse)
async def ping() -> PingResponse:
    return PingResponse(version=APP_VERSION)
