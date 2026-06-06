# Firebase client initialization
import os
import logging
import threading

logger = logging.getLogger(__name__)

# Serializes channel resets so concurrent wedge-detections don't race on delete_app.
_reset_lock = threading.Lock()

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


def reset_firestore_client():
    """Recreate the Firestore client with a FRESH gRPC channel.

    Recovery path for a wedged channel: the long-lived sync Firestore gRPC
    channel can intermittently corrupt on Cloud Run (KeyError in grpc
    ``channel_spin``), after which every query on it hangs until timeout.
    Tearing down the firebase_admin app and re-initialising yields a brand-new
    channel. Repositories and handlers fetch the client via ``get_db()`` per
    request, so the next request transparently picks up the fresh client.
    """
    global _app, _db
    with _reset_lock:
        try:
            import firebase_admin
            try:
                firebase_admin.delete_app(firebase_admin.get_app())
            except Exception:
                pass
            _app = None
            _db = None
            init_firebase()
            logger.info("Firestore client reset — fresh gRPC channel")
        except Exception as e:  # noqa: BLE001
            logger.error(f"Firestore client reset failed: {e}")
    return _db


def safe_query(query, timeout: float = 15.0):
    """Run a Firestore query under a THREADING timeout (NOT a gRPC deadline).

    When the sync gRPC channel corrupts (``channel_spin``), gRPC deadlines stop
    firing — so ``query.stream(timeout=N)`` hangs the full 300s request timeout
    instead of timing out, and even the keepalive ping hangs. Running the query
    in a worker thread + ``join(timeout)`` gives a reliable timeout regardless of
    gRPC state. On timeout the channel is wedged: reset it (closing the channel
    also unblocks the stuck worker thread, so it does not leak) and raise, so the
    caller fails fast in ``timeout`` seconds and any retry lands on a fresh channel.

    Returns the materialised list of document snapshots.
    """
    box = {}

    def _run():
        try:
            box["r"] = list(query.stream())
        except Exception as e:  # noqa: BLE001
            box["e"] = e

    th = threading.Thread(target=_run, name="firestore-query", daemon=True)
    th.start()
    th.join(timeout)
    if th.is_alive():
        logger.warning("Firestore query wedged (>%ss) — resetting channel", timeout)
        reset_firestore_client()
        raise TimeoutError(f"Firestore query exceeded {timeout}s (channel wedged; reset)")
    if "e" in box:
        raise box["e"]
    return box.get("r", [])


def start_firestore_keepalive(interval_sec: int = 10, ping_timeout_sec: int = 8):
    """Background watchdog that keeps the Firestore gRPC channel healthy.

    Every ``interval_sec`` it issues a tiny, short-deadline read. This both
    (a) keeps the channel warm so its background poller never idles into the
    ``channel_spin`` corruption, and (b) detects an already-wedged channel
    (the ping times out) and recreates it via ``reset_firestore_client()``.

    Daemon thread; idempotent (starts once). Relies on CPU staying allocated
    between requests (Cloud Run ``--no-cpu-throttling``) so the thread runs.
    """
    import threading
    import time

    if getattr(start_firestore_keepalive, "_started", False):
        return
    start_firestore_keepalive._started = True

    def _loop():
        while True:
            try:
                time.sleep(interval_sec)
                if not _firebase_available:
                    continue
                db = get_db()
                if db is None:
                    continue
                # Ping via safe_query — a THREADING timeout, because the gRPC
                # deadline (.stream(timeout=)) is itself broken once the channel
                # corrupts (so the old ping would hang forever and never reset).
                # safe_query resets the channel itself if the ping wedges.
                safe_query(db.collection("_keepalive").limit(1), timeout=ping_timeout_sec)
            except Exception as e:  # noqa: BLE001
                logger.warning(
                    "Firestore keepalive failed (%s: %s) — recreating channel",
                    type(e).__name__, e,
                )
                try:
                    reset_firestore_client()
                except Exception:
                    pass

    threading.Thread(target=_loop, name="firestore-keepalive", daemon=True).start()
    logger.info("Firestore keepalive watchdog started (interval=%ss)", interval_sec)
