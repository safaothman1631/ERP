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
        init_options = {"storageBucket": bucket_name} if bucket_name else None

        cred = None
        mode = None
        # Explicit Firebase project ID — prevents 'aud claim mismatch' on
        # Cloud Run when ADC project differs from Firebase project.
        firebase_project_id = os.environ.get("FIREBASE_PROJECT_ID", "zoho-83cda")
        init_options = init_options or {}
        init_options["projectId"] = firebase_project_id

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
        if bucket_name:
            _bucket = storage.bucket()
        _firebase_available = True
        logger.info(f"Firebase initialized via {mode}")
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
    """Get Firebase Storage bucket"""
    global _bucket
    if _bucket is None and _firebase_available:
        init_firebase()
    if _bucket is None:
        raise RuntimeError("Firebase Storage is not configured. Set FIREBASE_STORAGE_BUCKET env var.")
    return _bucket


# Alias used by scheduler.py and other modules
get_firestore_client = get_db
