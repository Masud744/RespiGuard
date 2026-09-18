"""
tests/test_message_encryption.py
================================================================================
Test suite for RespiGuard AES-256-GCM message encryption at rest and retrieval.
================================================================================
"""

import pytest
from backend.crypto_service import encrypt_message, decrypt_message, is_encrypted
from backend.db_service import db_service

def test_aes256_gcm_encrypt_and_decrypt_roundtrip():
    plaintext = "Patient needs immediate clinical evaluation: PEF dropped to 280 L/min."
    ciphertext = encrypt_message(plaintext)
    
    assert ciphertext.startswith("enc:v1:")
    assert is_encrypted(ciphertext) is True
    assert plaintext not in ciphertext
    
    decrypted = decrypt_message(ciphertext)
    assert decrypted == plaintext

def test_backward_compatibility_with_plaintext():
    legacy_text = "Legacy message before encryption was implemented"
    assert is_encrypted(legacy_text) is False
    assert decrypt_message(legacy_text) == legacy_text

def test_db_service_encrypts_on_send_and_decrypts_on_read():
    pat_id = "046c2316-3dbe-4049-ad27-463ddf402a9a"
    doc_id = "a0b0ab33-5711-4dc2-92f9-a11444fc7d18"
    msg_content = "Secure test advisory: activate emergency asthma action plan."
    
    send_res = db_service.send_message_to_doctor({
        "user_id": pat_id,
        "doctor_id": doc_id,
        "sender_type": "patient",
        "subject": "Emergency Advisory",
        "message_body": msg_content
    })
    assert send_res["success"] is True
    assert send_res["message"]["message_body"] == msg_content
    assert send_res["message"]["is_encrypted"] is True
    
    # Retrieve messages via db_service
    msgs = db_service.get_messages(pat_id, doc_id)
    assert len(msgs) > 0
    found = [m for m in msgs if m["subject"] == "Emergency Advisory"]
    assert len(found) > 0
    assert found[-1]["message_body"] == msg_content
    assert found[-1]["is_encrypted"] is True
