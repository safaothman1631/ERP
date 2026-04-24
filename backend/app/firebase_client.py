# Firebase client initialization
import os
import logging

logger = logging.getLogger(__name__)

_app = None
_db = None
_bucket = None
_firebase_available = False

def init_firebase():
    """Initialize Firebase app with credentials. Gracefully skips if no credentials found."""
    global _app, _db, _bucket, _firebase_available
    
    try:
        import firebase_admin
        from firebase_admin import credentials, firestore, storage
        
        cred_path = os.environ.get("FIREBASE_CREDENTIALS_PATH", 
            os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "serviceAccountKey.json"))
        
        if os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            bucket_name = os.environ.get("FIREBASE_STORAGE_BUCKET", "")
            _app = firebase_admin.initialize_app(cred, {
                "storageBucket": bucket_name
            } if bucket_name else None)
            _db = firestore.client()
            if bucket_name:
                _bucket = storage.bucket()
            _firebase_available = True
            logger.info("Firebase initialized successfully")
        else:
            logger.warning(f"Firebase credentials not found at {cred_path}. Running in local mode.")
            _firebase_available = False
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
