# Firebase client initialization
import os
import logging

logger = logging.getLogger(__name__)

_app = None
_db = None
_bucket = None
_firebase_available = False

def init_firebase():
    """Initialize Firebase app with credentials.

    Resolution order (production-safe):
      1. Explicit FIREBASE_CREDENTIALS_PATH file (local dev).
      2. GOOGLE_APPLICATION_CREDENTIALS file (standard GCP env var).
      3. Application Default Credentials — used automatically on Cloud Run,
         GKE, Cloud Functions, etc. (no JSON file needed).
    Falls back to local mode only when nothing works.
    """
    global _app, _db, _bucket, _firebase_available

    try:
        import firebase_admin
        from firebase_admin import credentials, firestore, storage

        cred_path = os.environ.get("FIREBASE_CREDENTIALS_PATH",
            os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "serviceAccountKey.json"))
        gac_path = os.environ.get("GOOGLE_APPLICATION_CREDENTIALS")
        bucket_name = os.environ.get("FIREBASE_STORAGE_BUCKET", "")
        firebase_project_id = os.environ.get("FIREBASE_PROJECT_ID", "zoho-83cda")
        if not bucket_name:
            bucket_name = f"{firebase_project_id}.appspot.com"
        init_options = {"storageBucket": bucket_name, "projectId": firebase_project_id}

        cred = None
        mode = None

        if os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            mode = f"service-account file ({cred_path})"
        elif gac_path and os.path.exists(gac_path):
            cred = credentials.Certificate(gac_path)
            mode = f"GOOGLE_APPLICATION_CREDENTIALS ({gac_path})"
        else:
            # Cloud Run / GKE / Cloud Functions: ADC is auto-provided.
            try:
                cred = credentials.ApplicationDefault()
                mode = "Application Default Credentials"
            except Exception as adc_err:
                logger.warning(f"No Firebase credentials found (file or ADC): {adc_err}. Running in local mode.")
                _firebase_available = False
                return

        _app = firebase_admin.initialize_app(cred, init_options)
        _db = firestore.client()
        try:
            _bucket = storage.bucket()
        except Exception as bucket_err:
            logger.warning(f"Firebase Storage bucket unavailable ({bucket_name}): {bucket_err}")
            _bucket = None
        _firebase_available = True
        logger.info(f"Firebase initialized via {mode}")
    except ValueError as dup_err:
        if "already exists" not in str(dup_err):
            raise
        import firebase_admin
        from firebase_admin import firestore, storage
        _app = firebase_admin.get_app()
        _db = firestore.client()
        bucket_name = os.environ.get("FIREBASE_STORAGE_BUCKET") or f"{os.environ.get('FIREBASE_PROJECT_ID', 'zoho-83cda')}.appspot.com"
        try:
            _bucket = storage.bucket(bucket_name) if bucket_name else None
        except Exception:
            _bucket = None
        _firebase_available = True
        logger.info("Firebase reusing existing app instance")
    except Exception as e:
        logger.warning(f"Firebase initialization failed: {e}. Running in local mode.")
        _firebase_available = False

def is_firebase_available():
    return _firebase_available

def get_db():
    """Get Firestore database client"""
    global _db
    if _db is None and _firebase_available:
        init_firebase()
    if _db is None:
        raise RuntimeError("Firebase is not configured. Please add serviceAccountKey.json")
    return _db

def get_bucket():
    """Get Firebase Storage bucket (optional — returns None when not configured)."""
    global _bucket
    if _bucket is None and _firebase_available:
        init_firebase()
    if _bucket is None:
        return None
    return _bucket


def is_storage_available() -> bool:
    """True when a Firebase Storage bucket is reachable."""
    return get_bucket() is not None


# Alias used by scheduler.py and other modules
get_firestore_client = get_db
