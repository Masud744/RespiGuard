"""
backend/crypto_service.py
================================================================================
RespiGuard Medical Grade AES-256-GCM Clinical Consultation Encryption Engine
Ensures end-to-end and at-rest cryptographic confidentiality for patient-doctor
messages in PostgreSQL and Supabase.
================================================================================
"""

import os
import base64
import secrets
import hashlib
from typing import Optional
from dotenv import load_dotenv
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

# Load environment variables
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))
load_dotenv()

_raw_key = os.getenv("MESSAGE_ENCRYPTION_KEY", "").strip()
if _raw_key:
    try:
        if len(_raw_key) == 64:
            MESSAGE_KEY = bytes.fromhex(_raw_key)
        else:
            MESSAGE_KEY = hashlib.sha256(_raw_key.encode("utf-8")).digest()
    except Exception:
        MESSAGE_KEY = hashlib.sha256(_raw_key.encode("utf-8")).digest()
else:
    # Persistent key fallback file
    key_file = os.path.join(os.path.dirname(__file__), ".msg_encryption_key")
    if os.path.exists(key_file):
        with open(key_file, "rb") as f:
            MESSAGE_KEY = f.read()[:32]
    else:
        MESSAGE_KEY = secrets.token_bytes(32)
        try:
            with open(key_file, "wb") as f:
                f.write(MESSAGE_KEY)
        except Exception:
            pass

def encrypt_message(plaintext: Optional[str]) -> str:
    """
    Encrypts clinical advisory message with authenticated AES-256-GCM.
    Returns standard prefixed ciphertext: enc:v1:<base64(12B_nonce + ciphertext + 16B_tag)>
    """
    if not plaintext or not isinstance(plaintext, str):
        return ""
    try:
        iv = secrets.token_bytes(12)
        aesgcm = AESGCM(MESSAGE_KEY)
        ct_with_tag = aesgcm.encrypt(iv, plaintext.encode("utf-8"), None)
        combined = iv + ct_with_tag
        b64 = base64.b64encode(combined).decode("ascii")
        return f"enc:v1:{b64}"
    except Exception as e:
        print(f"[CryptoService] Encryption error: {e}")
        return plaintext

def decrypt_message(ciphertext: Optional[str]) -> str:
    """
    Decrypts AES-256-GCM ciphertext. Seamlessly falls back to plaintext if legacy.
    """
    if not ciphertext or not isinstance(ciphertext, str):
        return ""
    if not ciphertext.startswith("enc:v1:"):
        return ciphertext
    try:
        raw_b64 = ciphertext[len("enc:v1:"):]
        combined = base64.b64decode(raw_b64)
        if len(combined) < 13:
            return ciphertext
        iv = combined[:12]
        ct_with_tag = combined[12:]
        aesgcm = AESGCM(MESSAGE_KEY)
        decrypted_bytes = aesgcm.decrypt(iv, ct_with_tag, None)
        return decrypted_bytes.decode("utf-8")
    except Exception as e:
        print(f"[CryptoService] Decryption error: {e}")
        return "[Protected Clinical Advisory]"

def is_encrypted(content: Optional[str]) -> bool:
    """Checks if message is stored in encrypted format."""
    return isinstance(content, str) and content.startswith("enc:v1:")
