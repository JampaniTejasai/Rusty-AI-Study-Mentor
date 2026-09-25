import os
import structlog
from app.core.config import get_settings

log = structlog.get_logger(__name__)

_app = None
_init_attempted = False


def init_firebase():
    global _app, _init_attempted
    if _init_attempted:
        return _app

    _init_attempted = True
    settings = get_settings()

    if settings.firebase_auth_emulator_host:
        os.environ["FIREBASE_AUTH_EMULATOR_HOST"] = settings.firebase_auth_emulator_host
    if settings.firestore_emulator_host:
        os.environ["FIRESTORE_EMULATOR_HOST"] = settings.firestore_emulator_host

    try:
        import firebase_admin
        from firebase_admin import credentials
        cred = credentials.ApplicationDefault()
        _app = firebase_admin.initialize_app(cred, {"projectId": settings.firebase_project_id})
        log.info("firebase_initialized", project=settings.firebase_project_id)
    except Exception as exc:
        if settings.app_env == "development":
            log.warning("firebase_init_skipped", reason=str(exc))
            _app = None
        else:
            raise

    return _app


def get_auth_client():
    if not _init_attempted:
        init_firebase()
    if _app is None:
        raise RuntimeError("Firebase not initialized")
    from firebase_admin import auth
    return auth


def get_firestore_client():
    if not _init_attempted:
        init_firebase()
    if _app is None:
        raise RuntimeError("Firebase not initialized")
    from firebase_admin import firestore
    return firestore.client()
