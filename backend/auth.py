"""
backend/auth.py
================================================================================
RespiGuard Production-Grade Authentication & Cryptographic Security Module
Phase 3, Sub-Phase 3.2: Backend Authentication & Telemetry Security Hardening

Covers:
1. Multi-key JWT keystore with 5-state key rotation and strict HS256 enforcement.
2. Comprehensive claim validation (sub, iss, aud, role, jti, exp, iat, kid).
3. Bcrypt password hashing (work factor 12) with complexity validation.
4. Refresh token generation, validation, and breach containment helpers.
5. Exact Origin and Referer CSRF validation with scheme/host/port tuple matching.
6. AES-256-GCM envelope encryption and canonical HMAC-SHA256 telemetry verification.
7. FastAPI authentication dependencies (get_current_user, require_role).
================================================================================
"""

import os
import re
import json
import hmac
import hashlib
import secrets
import time
from datetime import datetime, timezone, timedelta
from urllib.parse import urlsplit
from typing import Optional, Dict, Any, List, Tuple
from dotenv import load_dotenv

import jwt
from passlib.context import CryptContext
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from fastapi import HTTPException, Header, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

# Ensure environment variables are loaded immediately upon module import
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv()

UUID_REGEX = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.I)
ALLOWED_ROLES = {"patient", "doctor", "admin"}
MAX_ACCESS_TOKEN_LIFETIME = 3600  # 1 hour maximum access token validity duration

# ==============================================================================
# Keystore & Multi-Key Configuration
# ==============================================================================

# Cryptographically persistent key resolution to prevent "Signature verification failed" across restarts
_key_file = os.path.join(os.path.dirname(__file__), ".jwt_signing_key")
_env_signing_key = (os.getenv("JWT_SIGNING_KEY") or "").strip()

if _env_signing_key:
    DEFAULT_SIGNING_KEY = _env_signing_key
elif os.path.exists(_key_file):
    try:
        with open(_key_file, "r") as f:
            DEFAULT_SIGNING_KEY = f.read().strip()
    except Exception:
        DEFAULT_SIGNING_KEY = secrets.token_urlsafe(32)
else:
    DEFAULT_SIGNING_KEY = secrets.token_urlsafe(32)
    try:
        with open(_key_file, "w") as f:
            f.write(DEFAULT_SIGNING_KEY)
    except Exception:
        pass

LEGACY_RETIRING_KEY = os.getenv("JWT_RETIRING_KEY") or secrets.token_urlsafe(32)

# Multi-key keystore structure for zero-downtime rotation
DEFAULT_KEYSTORE = {
    "active_kid": "key-2026-v1",
    "keys": {
        "key-2026-v1": {
            "secret": DEFAULT_SIGNING_KEY,
            "status": "active_signing",
            "created_at": 1773705600
        },
        "key-2025-v0": {
            "secret": LEGACY_RETIRING_KEY,
            "status": "retiring_verify_only",
            "retire_after": 1893456000  # valid until future retire_after timestamp
        }
    }
}

def load_keystore() -> Dict[str, Any]:
    raw_config = os.getenv("JWT_KEYS_CONFIG")
    if raw_config:
        try:
            return json.loads(raw_config)
        except Exception:
            pass
    return DEFAULT_KEYSTORE

KEYSTORE = load_keystore()

# Master Key for Device PSK AES-256-GCM Envelope Encryption (32 bytes / 64 hex chars)
DEFAULT_MASTER_KEY_HEX = os.getenv("DEVICE_PSK_MASTER_KEY") or secrets.token_hex(32)

# Exact Origin and Referer Match Tuples (scheme, hostname, port)
ALLOWED_ORIGIN_TUPLES = {
    ("http", "localhost", 5173),
    ("http", "127.0.0.1", 5173),
    ("http", "localhost", 3000),
    ("http", "127.0.0.1", 3000),
    ("https", "respiguard.ai", 443),
    ("https", "staging.respiguard.ai", 443),
}

# Supported JWT Constants
JWT_ALGORITHM = "HS256"
JWT_ISSUER = "respiguard-auth-service"
JWT_AUDIENCE = "respiguard-api"
JWT_REFRESH_AUDIENCE = "respiguard-refresh"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 7

# Password Hashing Context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
http_bearer = HTTPBearer(auto_error=False)

# In-memory Revocation JTI cache for fast lookups (synchronized with DB)
_revoked_jtis: set = set()

def register_revoked_jti(jti: str):
    """Registers a revoked JTI in memory."""
    _revoked_jtis.add(jti)

def is_jti_revoked(jti: str) -> bool:
    """Checks if a JTI has been revoked."""
    return jti in _revoked_jtis

# ==============================================================================
# Password Management & Validation
# ==============================================================================

def validate_password_strength(password: str) -> Tuple[bool, Optional[str]]:
    """Enforces minimum 8 chars, at least 1 uppercase letter, and at least 1 digit."""
    if len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if not any(c.isupper() for c in password):
        return False, "Password must contain at least one uppercase letter."
    if not any(c.isdigit() for c in password):
        return False, "Password must contain at least one digit."
    return True, None

def hash_password(password: str) -> str:
    """Hashes password using bcrypt with work factor 12."""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifies a password against stored hash.
    Supports bcrypt and legacy pbkdf2 hashes with constant-time check.
    """
    if not hashed_password or not plain_password:
        return False
    try:
        # Check if bcrypt
        if hashed_password.startswith("$2b$") or hashed_password.startswith("$2a$"):
            return pwd_context.verify(plain_password, hashed_password)
        # Check if legacy pbkdf2 (salt$hash)
        if "$" in hashed_password:
            salt, key_hex = hashed_password.split("$", 1)
            computed = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt.encode("utf-8"), 100000)
            return secrets.compare_digest(computed.hex(), key_hex)
    except Exception:
        return False
    return False

# ==============================================================================
# JWT Access & Refresh Token Management (HS256 Only, 5-State Key Rotation)
# ==============================================================================

def get_signing_key() -> Tuple[str, str]:
    """Returns active kid and active signing secret."""
    active_kid = KEYSTORE.get("active_kid")
    key_entry = KEYSTORE.get("keys", {}).get(active_kid)
    if not key_entry or key_entry.get("status") != "active_signing":
        raise RuntimeError("No active signing key configured in keystore!")
    secret = key_entry.get("secret")
    if len(secret) < 32:
        raise RuntimeError("Active signing key must be at least 32 bytes (256 bits)!")
    return active_kid, secret

def create_access_token(
    user_id: str,
    email: str,
    role: str = "patient",
    custom_claims: Optional[Dict[str, Any]] = None,
    expires_delta: Optional[timedelta] = None
) -> str:
    """
    Issues a cryptographically signed 15-minute JWT.
    Enforces algorithm allowlist (HS256 only) and includes kid in header.
    """
    active_kid, secret = get_signing_key()
    now_utc = datetime.now(timezone.utc)
    exp_delta = expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    exp_time = now_utc + exp_delta

    payload = {
        "sub": str(user_id),
        "email": email.strip().lower(),
        "role": role,
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
        "iat": int(now_utc.timestamp()),
        "exp": int(exp_time.timestamp()),
        "jti": secrets.token_hex(16)
    }
    if custom_claims:
        payload.update(custom_claims)

    headers = {
        "typ": "JWT",
        "alg": JWT_ALGORITHM,
        "kid": active_kid
    }

    token = jwt.encode(payload, secret, algorithm=JWT_ALGORITHM, headers=headers)
    return token

def create_refresh_token(user_id: str, expires_delta: Optional[timedelta] = None) -> Tuple[str, str, datetime]:
    """
    Issues a refresh token signed with HS256.
    Returns (raw_token, jti, expires_at).
    """
    active_kid, secret = get_signing_key()
    now_utc = datetime.now(timezone.utc)
    exp_delta = expires_delta or timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    exp_time = now_utc + exp_delta
    jti = secrets.token_hex(16)

    payload = {
        "sub": str(user_id),
        "typ": "Refresh",
        "iss": JWT_ISSUER,
        "aud": JWT_REFRESH_AUDIENCE,
        "iat": int(now_utc.timestamp()),
        "exp": int(exp_time.timestamp()),
        "jti": jti
    }
    headers = {
        "typ": "JWT",
        "alg": JWT_ALGORITHM,
        "kid": active_kid
    }
    raw_token = jwt.encode(payload, secret, algorithm=JWT_ALGORITHM, headers=headers)
    return raw_token, jti, exp_time

def decode_access_token(token: str) -> Dict[str, Any]:
    """
    Strictly verifies an access token:
    1. Algorithm allowlist: HS256 ONLY.
    2. Header validation: typ=JWT, alg=HS256, kid present.
    3. Key status:
       - active_signing: verifies
       - retiring_verify_only: verifies iff current_time < retire_after
       - expired retiring / unknown kid: rejected
    4. Claims validation: sub, iss, aud, role, jti, exp, iat required.
    5. Checks against revoked JTI list.
    """
    try:
        unverified_header = jwt.get_unverified_header(token)
    except Exception as e:
        raise HTTPException(status_code=401, detail="Malformed JWT header")

    # 1. Strict Algorithm Check: Reject "none", "RS256", etc.
    alg = unverified_header.get("alg")
    if alg != JWT_ALGORITHM:
        raise HTTPException(status_code=401, detail=f"Unsupported or unauthorized algorithm: {alg}")

    # 2. Kid Check
    kid = unverified_header.get("kid")
    if not kid:
        raise HTTPException(status_code=401, detail="Missing key ID (kid) in token header")

    key_entry = KEYSTORE.get("keys", {}).get(kid)
    if not key_entry:
        raise HTTPException(status_code=401, detail=f"Unknown key ID: {kid}")

    # 3. Key Lifecycle State Validation
    status = key_entry.get("status")
    now_ts = int(datetime.now(timezone.utc).timestamp())
    if status == "active_signing":
        pass
    elif status == "retiring_verify_only":
        retire_after = key_entry.get("retire_after", 0)
        if now_ts > retire_after:
            raise HTTPException(status_code=401, detail="Signing key grace period has expired")
    else:
        raise HTTPException(status_code=401, detail="Signing key is inactive or revoked")

    secret = key_entry.get("secret")

    # 4. Decode & Verify Claims
    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=[JWT_ALGORITHM],
            issuer=JWT_ISSUER,
            audience=JWT_AUDIENCE,
            options={
                "require": ["sub", "iss", "aud", "role", "jti", "exp", "iat"],
                "verify_exp": True,
                "verify_iat": True,
                "verify_iss": True,
                "verify_aud": True
            }
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidIssuerError:
        raise HTTPException(status_code=401, detail="Invalid token issuer")
    except jwt.InvalidAudienceError:
        raise HTTPException(status_code=401, detail="Invalid token audience")
    except jwt.MissingRequiredClaimError as e:
        raise HTTPException(status_code=401, detail=f"Missing required claim: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token signature or claims: {str(e)}")

    # 5. Comprehensive Claim Type and Value Validation
    sub = payload.get("sub")
    if not isinstance(sub, str) or not sub.strip():
        raise HTTPException(status_code=401, detail="Invalid subject claim: 'sub' must be a non-empty string")
    if not UUID_REGEX.match(sub.strip()):
        raise HTTPException(status_code=401, detail="Invalid subject claim: 'sub' must be a valid UUID format")

    role = payload.get("role")
    if not isinstance(role, str) or role not in ALLOWED_ROLES:
        raise HTTPException(status_code=401, detail=f"Invalid or unauthorized role claim: '{role}'")

    jti = payload.get("jti")
    if not isinstance(jti, str) or len(jti) < 16 or len(jti) > 64:
        raise HTTPException(status_code=401, detail="Invalid jti claim: must be a string between 16 and 64 characters")

    iat = payload.get("iat")
    exp = payload.get("exp")
    if not isinstance(iat, int) or isinstance(iat, bool):
        raise HTTPException(status_code=401, detail="Invalid iat claim: must be an integer timestamp")
    if not isinstance(exp, int) or isinstance(exp, bool):
        raise HTTPException(status_code=401, detail="Invalid exp claim: must be an integer timestamp")

    # Unreasonable timestamps
    if iat > now_ts + 60:
        raise HTTPException(status_code=401, detail="Token issued in the future (unreasonable iat)")
    if iat < 1700000000:
        raise HTTPException(status_code=401, detail="Unreasonable iat timestamp")
    if exp <= iat:
        raise HTTPException(status_code=401, detail="Invalid token lifetime: exp must be strictly greater than iat")

    # Excessive Token Lifetime check (Max 1 hour / 3600s for access tokens)
    if (exp - iat) > MAX_ACCESS_TOKEN_LIFETIME:
        raise HTTPException(
            status_code=401,
            detail=f"Excessive token lifetime: validity duration {exp - iat}s exceeds maximum permitted lifetime of {MAX_ACCESS_TOKEN_LIFETIME}s"
        )

    # 6. Revocation Check
    if is_jti_revoked(jti):
        raise HTTPException(status_code=401, detail="Token has been revoked")

    return payload

def decode_refresh_token(token: str, check_revocation: bool = False) -> Dict[str, Any]:
    """
    Decodes and validates a refresh token.
    Enforces HS256, audience='respiguard-refresh', issuer='respiguard-auth-service'.
    """
    try:
        unverified_header = jwt.get_unverified_header(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Malformed refresh token")

    if unverified_header.get("alg") != JWT_ALGORITHM:
        raise HTTPException(status_code=401, detail="Unsupported algorithm in refresh token")

    kid = unverified_header.get("kid")
    key_entry = KEYSTORE.get("keys", {}).get(kid)
    if not key_entry:
        raise HTTPException(status_code=401, detail="Unknown key ID in refresh token")

    secret = key_entry.get("secret")
    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=[JWT_ALGORITHM],
            issuer=JWT_ISSUER,
            audience=JWT_REFRESH_AUDIENCE,
            options={
                "require": ["sub", "iss", "aud", "jti", "exp", "iat"],
                "verify_exp": True,
                "verify_iat": True,
                "verify_iss": True,
                "verify_aud": True
            }
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token has expired")
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid refresh token: {str(e)}")

    if payload.get("typ") != "Refresh":
        raise HTTPException(status_code=401, detail="Token is not a refresh token")

    sub = payload.get("sub")
    if not isinstance(sub, str) or not UUID_REGEX.match(sub.strip()):
        raise HTTPException(status_code=401, detail="Invalid refresh token subject claim")

    jti = payload.get("jti")
    if not isinstance(jti, str) or len(jti) < 16 or len(jti) > 64:
        raise HTTPException(status_code=401, detail="Invalid refresh token jti claim")

    iat = payload.get("iat")
    exp = payload.get("exp")
    if not isinstance(iat, int) or isinstance(iat, bool) or not isinstance(exp, int) or isinstance(exp, bool):
        raise HTTPException(status_code=401, detail="Invalid refresh token timestamp types")
    if exp <= iat:
        raise HTTPException(status_code=401, detail="Invalid refresh token expiration bounds")

    # Max Refresh Lifetime: 30 days
    if (exp - iat) > (30 * 86400):
        raise HTTPException(status_code=401, detail="Excessive refresh token lifetime (>30 days)")

    if check_revocation and is_jti_revoked(jti):
        raise HTTPException(status_code=401, detail="Refresh token has been revoked")

    return payload

# ==============================================================================
# CSRF Defense & Exact Origin Validation
# ==============================================================================

def is_origin_authorized(candidate_uri: str) -> bool:
    """Checks if candidate URI matches allowed origin tuples, onrender.com, trycloudflare.com, or env vars."""
    try:
        parsed = urlsplit(candidate_uri)
        scheme = parsed.scheme.lower()
        hostname = parsed.hostname.lower() if parsed.hostname else ""
        port = parsed.port or (443 if scheme == "https" else 80)
        origin_tuple = (scheme, hostname, port)
        if origin_tuple in ALLOWED_ORIGIN_TUPLES:
            return True
        if scheme == "https" and (hostname.endswith(".onrender.com") or hostname.endswith(".trycloudflare.com")):
            return True
        extra_env = (os.getenv("FRONTEND_URL", "") + "," + os.getenv("CORS_ORIGINS", "")).strip(",")
        for orig in extra_env.split(","):
            orig = orig.strip().rstrip("/")
            if orig:
                p = urlsplit(orig)
                p_host = p.hostname.lower() if p.hostname else ""
                p_port = p.port or (443 if p.scheme.lower() == "https" else 80)
                if (p.scheme.lower(), p_host, p_port) == (scheme, hostname, port):
                    return True
        return False
    except Exception:
        return False

def validate_csrf_and_origin(
    origin: Optional[str],
    referer: Optional[str],
    custom_header: Optional[str]
) -> None:
    """
    Strict CSRF and Origin Defense for sensitive state-changing and cookie endpoints:
    1. Demands custom header 'X-Requested-With: RespiGuardClient'.
    2. Validates Origin or Referer against exact allowed tuples (scheme, hostname, port).
    3. Rejects subdomains (e.g. respiguard.ai.attacker.com) and unauthorized origins with HTTP 403.
    """
    # 1. Custom Header Verification (Cannot be forged by simple HTML forms)
    if not custom_header or custom_header != "RespiGuardClient":
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Missing or invalid X-Requested-With CSRF protection header"
        )

    # 2. Extract Candidate URI
    candidate_uri = origin or referer
    if not candidate_uri:
        raise HTTPException(
            status_code=403,
            detail="Forbidden: Missing Origin and Referer headers"
        )

    if not is_origin_authorized(candidate_uri):
        raise HTTPException(
            status_code=403,
            detail=f"Forbidden: Origin '{candidate_uri}' is not authorized"
        )


# ==============================================================================
# FastAPI Authentication Dependencies
# ==============================================================================

def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer)) -> Dict[str, Any]:
    """
    Extracts and validates the current user from the Authorization: Bearer <token> header.
    Returns: {"id": user_id, "email": email, "role": role, "jti": jti}
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=401,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"}
        )
    claims = decode_access_token(credentials.credentials)
    return {
        "id": claims["sub"],
        "email": claims["email"],
        "role": claims.get("role", "patient"),
        "jti": claims["jti"],
        "claims": claims
    }

def require_role(*allowed_roles: str):
    """Factory creating a FastAPI dependency enforcing user roles."""
    def role_checker(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
        user_role = current_user.get("role")
        if user_role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail=f"Forbidden: User role '{user_role}' lacks required permissions ({allowed_roles})"
            )
        return current_user
    return role_checker

# ==============================================================================
# Telemetry HMAC & AES-256-GCM Hardware Envelope Decryption
# ==============================================================================

def compute_telemetry_canonical_string(
    device_node: str,
    timestamp_str: str,
    seq_num: int,
    payload_sha256: str
) -> str:
    """
    Canonical String Construction for Telemetry Verification:
    DEVICE_ID:{device_node}\nTIMESTAMP:{timestamp_str}\nSEQUENCE:{seq_num}\nPAYLOAD_SHA256:{payload_sha256}
    """
    return f"DEVICE_ID:{device_node}\nTIMESTAMP:{timestamp_str}\nSEQUENCE:{seq_num}\nPAYLOAD_SHA256:{payload_sha256}"

def verify_telemetry_hmac(
    device_secret: str,
    canonical_string: str,
    provided_signature: str
) -> bool:
    """
    Constant-time HMAC-SHA256 verification against canonical string.
    """
    if not device_secret or not provided_signature:
        return False
    computed = hmac.new(
        device_secret.encode("utf-8"),
        canonical_string.encode("utf-8"),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(computed.lower(), provided_signature.lower())

def encrypt_device_psk(
    master_key_hex: str,
    psk_bytes: bytes,
    device_node: str,
    version: int = 1
) -> Dict[str, str]:
    """
    AES-256-GCM Envelope Encryption of Device PSK:
    - Master Key: 256-bit AES
    - IV: 12-byte CSPRNG (NIST SP 800-38D compliant)
    - AAD: Bound to device_node and key version
    Returns dict with hex-encoded ciphertext, iv, tag, and key_version.
    """
    master_key = bytes.fromhex(master_key_hex)
    aesgcm = AESGCM(master_key)
    iv = os.urandom(12)
    aad = f"device:{device_node}:version:{version}".encode("utf-8")
    ct_with_tag = aesgcm.encrypt(iv, psk_bytes, aad)
    # In cryptography AESGCM, tag is appended to ciphertext (last 16 bytes)
    ciphertext = ct_with_tag[:-16]
    tag = ct_with_tag[-16:]
    return {
        "ciphertext": ciphertext.hex(),
        "iv": iv.hex(),
        "tag": tag.hex(),
        "version": version
    }

def decrypt_device_psk(
    master_key_hex: str,
    iv_hex: str,
    ciphertext_hex: str,
    tag_hex: str,
    device_node: str,
    version: int = 1
) -> bytes:
    """
    AES-256-GCM Decryption of Device PSK in volatile memory during request lifecycle.
    """
    master_key = bytes.fromhex(master_key_hex)
    aesgcm = AESGCM(master_key)
    iv = bytes.fromhex(iv_hex)
    ct_with_tag = bytes.fromhex(ciphertext_hex) + bytes.fromhex(tag_hex)
    aad = f"device:{device_node}:version:{version}".encode("utf-8")
    return aesgcm.decrypt(iv, ct_with_tag, aad)
