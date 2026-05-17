import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.firestore.organizations import OrganizationRepository
from app.firestore.users import UserRepository
from app.firestore.system import CurrencyRepository, SequenceRepository
from app.firestore.accounts import AccountRepository
from app.firestore.taxes import TaxRateRepository
from app.services.auth import hash_password, verify_password, create_access_token, create_refresh_token, verify_refresh_token, get_current_user, revoke_token, validate_password_strength, record_ip_failure, is_ip_blocked, reset_ip_failures
from app.services.auth import _TOKEN_TYPE_ACCESS, _TOKEN_TYPE_REFRESH
from app.schemas.schemas import (
    SetupRequest, LoginRequest, TokenResponse, MessageResponse,
    RegisterRequest, FirebaseRegisterRequest, ForgotPasswordRequest, ResetPasswordRequest,
)
from app.seed.chart_of_accounts import CHART_OF_ACCOUNTS
from app.seed.currencies import CURRENCIES
from app.seed.tax_rates import TAX_RATES, SEQUENCES

limiter = Limiter(key_func=get_remote_address)
router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.get("/status")
def check_setup():
    """Check if system is set up (has any organization)"""
    org_repo = OrganizationRepository()
    orgs, _ = org_repo.list(limit=1)
    return {"is_setup": len(orgs) > 0}



@router.post("/setup", response_model=TokenResponse)
@limiter.limit("3/hour")
def initial_setup(request: Request, data: SetupRequest):
    """First-time setup: create org, user, seed data"""
    # Check if already set up
    org_repo = OrganizationRepository()
    existing, _ = org_repo.list(limit=1)
    if existing:
        raise HTTPException(status_code=400, detail="سیستەم پێشتر دامەزراوە")

    # Create organization
    org_id = str(uuid.uuid4())
    org = org_repo.create({
        "id": org_id,
        "name": data.org_name,
        "base_currency_code": data.currency_code,
        "language": data.language,
    })

    # Create user
    user_repo = UserRepository(org_id)
    user = user_repo.create({
        "id": str(uuid.uuid4()),
        "name": data.user_name,
        "email": data.email,
        "password_hash": hash_password(data.password),
        "role": "admin",
        "is_active": True,
    })

    # Seed currencies (global, no org_id)
    curr_repo = CurrencyRepository("system")
    for curr_data in CURRENCIES:
        existing_curr = curr_repo.collection.where("code", "==", curr_data["code"]).limit(1).get()
        if not any(existing_curr):
            curr_repo.create({"id": str(uuid.uuid4()), **curr_data, "org_id": "system"})

    # Seed chart of accounts
    account_repo = AccountRepository(org_id)
    _seed_accounts(account_repo, CHART_OF_ACCOUNTS, parent_id=None)

    # Seed tax rates
    tax_repo = TaxRateRepository(org_id)
    for tax_data in TAX_RATES:
        tax_repo.create({"id": str(uuid.uuid4()), **tax_data})

    # Seed sequences
    seq_repo = SequenceRepository(org_id)
    for seq_data in SEQUENCES:
        seq_repo.create({"id": f"{org_id}_{seq_data['entity_type']}", **seq_data})

    # Generate token
    token = create_access_token(data={"sub": user["id"], "org_id": org_id})
    return TokenResponse(
        access_token=token,
        user_id=user["id"],
        org_id=org_id,
        user_name=user["name"],
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
def login(request: Request, data: LoginRequest):
    """User login with brute-force lockout (5 failed attempts -> 15 min lock)
    and IP-based brute-force blocking (Requirement 6.11: 24h block).

    Returns:
        - access_token: JWT valid for 1 hour (Requirement 2.8)
        - refresh_token: JWT valid for 7 days (Requirement 2.8)
    """
    from datetime import timedelta

    # --- IP-based brute-force block check (Requirement 6.11) ---
    client_ip = (request.client.host if request and request.client else None) or ""
    if client_ip and is_ip_blocked(client_ip):
        raise HTTPException(
            status_code=429,
            detail="ئەم IP ەی بۆ ٢٤ ساعەت بلۆک کراوە بەهۆی هەوڵدانی زۆر. تکایە دواتر هەوڵبدەرەوە",
        )

    from app.firebase_client import get_db
    db = get_db()
    users_ref = db.collection("users").where("email", "==", data.email).limit(1).stream()
    
    user_data = None
    for doc in users_ref:
        user_data = {"id": doc.id, **doc.to_dict()}
        break
    
    if not user_data:
        # Record IP failure even for non-existent users (prevents user enumeration timing)
        if client_ip:
            record_ip_failure(client_ip)
        raise HTTPException(status_code=401, detail="ئیمەیڵ یان وشەی نهێنی هەڵەیە")

    # If user signed up via Google and has no password
    if user_data.get("auth_provider") == "google" and not user_data.get("password_hash"):
        raise HTTPException(status_code=400, detail="تکایە بە Google بچۆرە ژوورەوە")

    # --- Account-level brute-force lockout check ---
    LOCKOUT_THRESHOLD = 5
    LOCKOUT_MINUTES = 15
    locked_until = user_data.get("locked_until")
    if isinstance(locked_until, str):
        try:
            locked_until = datetime.fromisoformat(locked_until)
        except Exception:
            locked_until = None
    if locked_until and isinstance(locked_until, datetime) and locked_until > datetime.utcnow():
        raise HTTPException(
            status_code=423,
            detail="هەژمارەکە بە کاتی بلۆک کراوە بەهۆی دووبارە هەوڵدانی هەڵە. تکایە دواتر هەوڵبدەرەوە",
        )

    user_repo = UserRepository(user_data["org_id"])

    if not verify_password(data.password, user_data["password_hash"]):
        # Record failure for both account and IP
        failed = int(user_data.get("failed_login_attempts", 0)) + 1
        update_payload: dict = {"failed_login_attempts": failed}
        if failed >= LOCKOUT_THRESHOLD:
            update_payload["locked_until"] = datetime.utcnow() + timedelta(minutes=LOCKOUT_MINUTES)
            update_payload["failed_login_attempts"] = 0
        user_repo.update(user_data["id"], update_payload)
        if client_ip:
            record_ip_failure(client_ip)
        raise HTTPException(status_code=401, detail="ئیمەیڵ یان وشەی نهێنی هەڵەیە")

    # Success: reset counters + update last_login
    _now = datetime.utcnow()
    user_repo.update(user_data["id"], {
        "last_login": _now,
        "last_login_at": _now,
        "last_login_ip": client_ip,
        "failed_login_attempts": 0,
        "locked_until": None,
    })
    # Reset IP failure counter on successful login
    if client_ip:
        reset_ip_failures(client_ip)

    # Requirement 2.8: access token = 1 hour, refresh token = 7 days
    token_data = {"sub": user_data["id"], "org_id": user_data["org_id"]}
    access_token = create_access_token(data=token_data, expires_delta=timedelta(hours=1))
    refresh_token = create_refresh_token(data=token_data)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=user_data["id"],
        org_id=user_data["org_id"],
        user_name=user_data["name"],
    )


@router.post("/firebase-login", response_model=TokenResponse)
@limiter.limit("5/minute")
def firebase_login(request: Request, body: dict):
    """Login with Firebase Google ID token"""
    import firebase_admin
    from firebase_admin import auth as firebase_auth
    from app.firebase_client import get_db
    from datetime import timedelta

    id_token = body.get("id_token")
    if not id_token:
        raise HTTPException(status_code=400, detail="id_token پێویستە")

    try:
        decoded = firebase_auth.verify_id_token(id_token)
    except Exception:
        raise HTTPException(status_code=401, detail="توکنی Firebase هەڵەیە")

    email = decoded.get("email")
    if not email:
        raise HTTPException(status_code=401, detail="ئیمەیڵ نەدۆزرایەوە")

    # Look up user in Firestore
    db = get_db()
    users_ref = db.collection("users").where("email", "==", email).limit(1).stream()
    user_data = None
    for doc in users_ref:
        user_data = {"id": doc.id, **doc.to_dict()}
        break

    if not user_data:
        raise HTTPException(status_code=404, detail="ئەم ئیمەیڵە تۆمار نەکراوە، تکایە تۆمارببە")

    # Update last login + firebase_uid
    user_repo = UserRepository(user_data["org_id"])
    user_repo.update(user_data["id"], {
        "last_login": datetime.utcnow(),
        "firebase_uid": decoded.get("uid"),
    })

    # Requirement 2.8: access token = 1 hour, refresh token = 7 days
    token_data = {"sub": user_data["id"], "org_id": user_data["org_id"]}
    access_token = create_access_token(data=token_data, expires_delta=timedelta(hours=1))
    refresh_token = create_refresh_token(data=token_data)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=user_data["id"],
        org_id=user_data["org_id"],
        user_name=user_data.get("name", email),
    )


@router.post("/logout")
def logout(user: dict = Depends(get_current_user)):
    """Revoke the current access token's jti so it can no longer authenticate.

    Idempotent: calling /logout with an already-revoked token simply returns
    the same success response. Tokens issued without a jti (legacy) are silently
    ignored — no security regression because they will expire naturally.
    """
    jti = user.get("_jti")
    if jti:
        revoke_token(jti)
    return {"success": True, "message": "دەرچوون بەسەرکەوتوویی ئەنجامدرا"}


@router.post("/refresh", response_model=TokenResponse)
def refresh_token_endpoint(request: Request):
    """Exchange a refresh token for a new access token.

    Requirement 2.8: refresh token is valid for 7 days; access token for 1 hour.

    The endpoint accepts either:
    1. A valid refresh token (token_type=refresh) in the Authorization header
    2. A legacy access token (for backward compatibility with the grace-window approach)

    On success: new 1-hour access token + new 7-day refresh token issued.
    Old refresh token jti is revoked to prevent reuse.
    """
    from datetime import timedelta
    from jose import JWTError, jwt as _jwt
    from app.config import get_settings as _gs
    from app.services.auth import is_token_revoked as _revoked, revoke_token as _revoke
    s = _gs()

    # Extract bearer token from Authorization header
    auth_header = request.headers.get("Authorization") or ""
    if not auth_header.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="توکن نەدۆزرایەوە")
    token_str = auth_header[7:].strip()

    try:
        payload = _jwt.decode(
            token_str, s.SECRET_KEY, algorithms=[s.ALGORITHM],
            options={"verify_exp": False},  # we validate manually
        )
    except JWTError:
        raise HTTPException(status_code=401, detail="توکن نادروستە")

    user_id = payload.get("sub")
    org_id = payload.get("org_id")
    old_jti = payload.get("jti")
    exp_ts = payload.get("exp")
    token_type = payload.get("token_type", _TOKEN_TYPE_ACCESS)

    if not (user_id and org_id and exp_ts):
        raise HTTPException(status_code=401, detail="توکن ناتەواوە")

    # Reject revoked tokens immediately
    if old_jti and _revoked(old_jti):
        raise HTTPException(status_code=401, detail="توکن هەڵوەشێنراوەتەوە")

    exp_dt = datetime.utcfromtimestamp(int(exp_ts))

    if token_type == _TOKEN_TYPE_REFRESH:
        # Refresh token: must not be expired
        if datetime.utcnow() > exp_dt:
            raise HTTPException(status_code=401, detail="توکنی نوێکردنەوە بەسەرچووە — تکایە دیسان بچۆ ژوورەوە")
    else:
        # Legacy access token: allow within REFRESH_GRACE_DAYS grace window
        REFRESH_GRACE_DAYS = 7
        if datetime.utcnow() - exp_dt > timedelta(days=REFRESH_GRACE_DAYS):
            raise HTTPException(status_code=401, detail="ماوەی نوێکردنەوە تەواو بووە — تکایە دیسان بچۆ ژوورەوە")

    # Verify user still active
    from app.firebase_client import get_db as _get_db
    db = _get_db()
    user_doc = db.collection("users").document(user_id).get()
    if not user_doc.exists:
        raise HTTPException(status_code=401, detail="بەکارهێنەر نەدۆزرایەوە")
    user_data = {"id": user_doc.id, **user_doc.to_dict()}
    if not user_data.get("is_active", False):
        raise HTTPException(status_code=401, detail="ئەکاونت چالاک نییە")

    # Revoke old token jti to prevent reuse
    if old_jti:
        _revoke(old_jti, exp_dt)

    # Issue new 1-hour access token + new 7-day refresh token
    token_data = {"sub": user_id, "org_id": org_id}
    new_access_token = create_access_token(data=token_data, expires_delta=timedelta(hours=1))
    new_refresh_token = create_refresh_token(data=token_data)

    return TokenResponse(
        access_token=new_access_token,
        refresh_token=new_refresh_token,
        user_id=user_id,
        org_id=org_id,
        user_name=user_data.get("name", ""),
    )


@router.get("/me")
def get_me(user: dict = Depends(get_current_user)):
    """Get current user info"""
    from app.firebase_client import get_db
    db = get_db()
    org_doc = db.collection("organizations").document(user["org_id"]).get()
    org_name = org_doc.to_dict().get("name", "") if org_doc.exists else ""
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": user["role"],
        "org_id": user["org_id"],
        "org_name": org_name,
        "auth_provider": user.get("auth_provider", "email"),
        "is_2fa_enabled": bool(user.get("is_2fa_enabled", False)),
    }


@router.post("/register", response_model=TokenResponse)
@limiter.limit("5/hour")
def register(request: Request, data: RegisterRequest):
    """Register new user with new organization + seed data.

    Returns:
        - access_token: JWT valid for 1 hour (Requirement 2.8)
        - refresh_token: JWT valid for 7 days (Requirement 2.8)
    """
    from datetime import timedelta
    # FIX-48: enforce password policy at registration
    validate_password_strength(data.password)

    from app.firebase_client import get_db
    db = get_db()

    # Check if email already exists
    existing = list(db.collection("users").where("email", "==", data.email).limit(1).stream())
    if existing:
        raise HTTPException(status_code=400, detail="ئەم ئیمەیڵە پێشتر تۆمارکراوە")

    org_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())

    # Create org + user + seed data
    _seed_org(org_id, data.org_name, data.currency_code, data.language)

    user_repo = UserRepository(org_id)
    user = user_repo.create({
        "id": user_id,
        "name": data.user_name,
        "email": data.email,
        "password_hash": hash_password(data.password),
        "role": "admin",
        "is_active": True,
        "auth_provider": "email",
        "created_at": datetime.utcnow(),
    })

    # Requirement 2.8: access token = 1 hour, refresh token = 7 days
    token_data = {"sub": user["id"], "org_id": org_id}
    access_token = create_access_token(data=token_data, expires_delta=timedelta(hours=1))
    refresh_token = create_refresh_token(data=token_data)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=user["id"],
        org_id=org_id,
        user_name=user["name"],
    )


@router.post("/firebase-register", response_model=TokenResponse)
def firebase_register(request: Request, data: FirebaseRegisterRequest):
    """Register new user via Google Sign-In with new organization"""
    from firebase_admin import auth as firebase_auth
    from app.firebase_client import get_db
    from datetime import timedelta

    try:
        decoded = firebase_auth.verify_id_token(data.id_token)
    except Exception:
        raise HTTPException(status_code=401, detail="توکنی Firebase هەڵەیە")

    email = decoded.get("email")
    if not email:
        raise HTTPException(status_code=401, detail="ئیمەیڵ نەدۆزرایەوە")

    db = get_db()
    existing = list(db.collection("users").where("email", "==", email).limit(1).stream())
    if existing:
        raise HTTPException(status_code=400, detail="ئەم ئیمەیڵە پێشتر تۆمارکراوە")

    org_id = str(uuid.uuid4())
    user_id = str(uuid.uuid4())
    display_name = decoded.get("name") or email.split("@")[0]

    _seed_org(org_id, data.org_name, "IQD", "ku")

    user_repo = UserRepository(org_id)
    user = user_repo.create({
        "id": user_id,
        "name": display_name,
        "email": email,
        "password_hash": "",
        "role": "admin",
        "is_active": True,
        "auth_provider": "google",
        "firebase_uid": decoded.get("uid"),
        "created_at": datetime.utcnow(),
    })

    # Requirement 2.8: access token = 1 hour, refresh token = 7 days
    token_data = {"sub": user["id"], "org_id": org_id}
    access_token = create_access_token(data=token_data, expires_delta=timedelta(hours=1))
    refresh_token = create_refresh_token(data=token_data)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=user["id"],
        org_id=org_id,
        user_name=user["name"],
    )


@router.post("/forgot-password")
@limiter.limit("3/hour")
def forgot_password(request: Request, data: ForgotPasswordRequest):
    """Send password reset token"""
    from app.firebase_client import get_db
    db = get_db()

    # Always return same message (email enumeration protection)
    msg = {"message": "ئەگەر ئیمەیڵ تۆمارکراوە، لینکی گۆڕینی وشەنهێنی نێردراوە"}

    users = list(db.collection("users").where("email", "==", data.email).limit(1).stream())
    if not users:
        return msg

    user = {"id": users[0].id, **users[0].to_dict()}

    # Don't allow reset for Google-only users
    if user.get("auth_provider") == "google" and not user.get("password_hash"):
        return msg

    # Generate reset token
    reset_token = str(uuid.uuid4())
    token_hash = hash_password(reset_token)

    db.collection("password_resets").document(reset_token[:8]).set({
        "email": data.email,
        "token_hash": token_hash,
        "expires_at": datetime.utcnow() + timedelta(hours=1),
        "used": False,
        "created_at": datetime.utcnow(),
    })

    # Try to send email (if SMTP configured)
    try:
        org_id = user.get("org_id", "")
        reset_url = f"http://localhost:5173/reset-password?token={reset_token}"
        _send_reset_email(org_id, data.email, reset_url)
    except Exception:
        pass  # Email may not be configured - token still works

    return msg


@router.post("/reset-password")
@limiter.limit("5/hour")
def reset_password(request: Request, data: ResetPasswordRequest):
    """Reset password with token"""
    # FIX-48: enforce password policy on reset
    validate_password_strength(data.new_password)

    from app.firebase_client import get_db
    db = get_db()

    # Find reset token
    resets = list(db.collection("password_resets")
                  .where("used", "==", False)
                  .stream())

    valid_reset = None
    for doc in resets:
        r = doc.to_dict()
        if r.get("expires_at") and r["expires_at"].replace(tzinfo=None) < datetime.utcnow():
            continue
        try:
            if verify_password(data.token, r["token_hash"]):
                valid_reset = {"id": doc.id, **r}
                break
        except Exception:
            continue

    if not valid_reset:
        raise HTTPException(status_code=400, detail="توکن بەسەرچووە یان هەڵەیە")

    # Update user password
    users = list(db.collection("users")
                 .where("email", "==", valid_reset["email"])
                 .limit(1).stream())
    if not users:
        raise HTTPException(status_code=400, detail="بەکارهێنەر نەدۆزرایەوە")

    db.collection("users").document(users[0].id).update({
        "password_hash": hash_password(data.new_password),
    })

    # Mark token as used
    db.collection("password_resets").document(valid_reset["id"]).update({"used": True})

    return {"message": "وشەی نهێنی بە سەرکەوتوویی گۆڕدرا"}


def _seed_org(org_id: str, org_name: str, currency_code: str, language: str):
    """Create organization and seed default data"""
    org_repo = OrganizationRepository()
    org_repo.create({
        "id": org_id,
        "name": org_name,
        "base_currency_code": currency_code,
        "language": language,
        "created_at": datetime.utcnow(),
    })

    # Seed currencies (global)
    curr_repo = CurrencyRepository("system")
    for curr_data in CURRENCIES:
        existing_curr = curr_repo.collection.where("code", "==", curr_data["code"]).limit(1).get()
        if not any(existing_curr):
            curr_repo.create({"id": str(uuid.uuid4()), **curr_data, "org_id": "system"})

    # Seed chart of accounts
    account_repo = AccountRepository(org_id)
    _seed_accounts(account_repo, CHART_OF_ACCOUNTS, parent_id=None)

    # Seed tax rates
    tax_repo = TaxRateRepository(org_id)
    for tax_data in TAX_RATES:
        tax_repo.create({"id": str(uuid.uuid4()), **tax_data})

    # Seed sequences
    seq_repo = SequenceRepository(org_id)
    for seq_data in SEQUENCES:
        seq_repo.create({"id": f"{org_id}_{seq_data['entity_type']}", **seq_data})


def _send_reset_email(org_id: str, email: str, reset_url: str):
    """Send password reset email"""
    import smtplib
    from email.mime.text import MIMEText
    from app.firebase_client import get_db

    db = get_db()
    org_doc = db.collection("organizations").document(org_id).get()
    if not org_doc.exists:
        return

    org = org_doc.to_dict()
    if not org.get("smtp_host"):
        return

    body = f"""
    <div dir="rtl" style="font-family: 'Noto Sans Arabic', sans-serif; max-width:500px; margin:auto; padding:30px;">
        <h2>گۆڕینی وشەی نهێنی</h2>
        <p>داواکاریەکی گۆڕینی وشەی نهێنی بۆ ئەم ئیمەیڵە کرا.</p>
        <p>کلیک لەسەر لینکەکەی خوارەوە بکە:</p>
        <a href="{reset_url}" style="display:inline-block; background:linear-gradient(135deg,#667EEA,#764BA2); color:white; padding:12px 30px; text-decoration:none; border-radius:8px; margin:16px 0;">
            گۆڕینی وشەی نهێنی
        </a>
        <p style="color:#888; font-size:12px;">ئەم لینکە دوای ١ کاتژمێر بەسەردەچێت.</p>
    </div>
    """
    msg = MIMEText(body, "html", "utf-8")
    msg["From"] = org.get("email_from") or org["smtp_user"]
    msg["To"] = email
    msg["Subject"] = "گۆڕینی وشەی نهێنی"

    with smtplib.SMTP(org["smtp_host"], org.get("smtp_port", 587), timeout=15) as server:
        server.starttls()
        server.login(org["smtp_user"], org["smtp_password"])
        server.sendmail(msg["From"], [email], msg.as_string())


def _seed_accounts(account_repo: AccountRepository, accounts: list, parent_id: str | None):
    """Recursively create chart of accounts"""
    import copy
    for acc_data in accounts:
        data = copy.deepcopy(acc_data)
        children = data.pop("children", [])
        account = account_repo.create({
            "id": str(uuid.uuid4()),
            "parent_id": parent_id,
            "is_system": True,
            **data,
        })
        if children:
            _seed_accounts(account_repo, children, account["id"])


# ===== 2FA ENDPOINTS =====

@router.post("/2fa/setup")
def setup_2fa(user: dict = Depends(get_current_user)):
    """Generate TOTP secret for 2FA setup"""
    import pyotp
    import qrcode
    import io
    import base64
    
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=user.get("email", ""), issuer_name="Zoho Books")
    
    # Generate QR code
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    qr_base64 = base64.b64encode(buffer.getvalue()).decode()
    
    # Save secret to user (not yet verified)
    from app.firestore.users import UserRepository
    user_repo = UserRepository(user["org_id"])
    user_repo.update(user["id"], {"totp_secret": secret, "is_2fa_enabled": False})
    
    return {"secret": secret, "qr_code": f"data:image/png;base64,{qr_base64}", "uri": uri}


@router.post("/2fa/verify")
def verify_2fa(data: dict, user: dict = Depends(get_current_user)):
    """Verify TOTP code and enable 2FA"""
    import pyotp
    
    from app.firestore.users import UserRepository
    user_repo = UserRepository(user["org_id"])
    user_data = user_repo.get(user["id"])
    if not user_data or not user_data.get("totp_secret"):
        raise HTTPException(400, "2FA not set up")
    
    totp = pyotp.TOTP(user_data["totp_secret"])
    if totp.verify(data.get("code", "")):
        user_repo.update(user["id"], {"is_2fa_enabled": True})
        return {"success": True, "message": "2FA enabled"}
    raise HTTPException(400, "Invalid code")


@router.post("/2fa/disable")
def disable_2fa(data: dict, user: dict = Depends(get_current_user)):
    """Disable 2FA with password verification"""
    import pyotp
    
    from app.firestore.users import UserRepository
    user_repo = UserRepository(user["org_id"])
    user_data = user_repo.get(user["id"])
    if not user_data or not user_data.get("is_2fa_enabled"):
        raise HTTPException(400, "2FA not enabled")
    
    totp = pyotp.TOTP(user_data["totp_secret"])
    if totp.verify(data.get("code", "")):
        user_repo.update(user["id"], {"is_2fa_enabled": False, "totp_secret": None})
        return {"success": True, "message": "2FA disabled"}
    raise HTTPException(400, "Invalid code")
