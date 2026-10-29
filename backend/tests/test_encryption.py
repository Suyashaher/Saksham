"""Tests for AES-256-GCM document encryption service."""

from __future__ import annotations

import base64
import os
import pytest

from app.services.encryption_service import EncryptionService


def test_encryption_roundtrip():
    """Data encrypted can be decrypted back to identical original bytes."""
    key = base64.b64encode(os.urandom(32)).decode()
    service = EncryptionService(key)

    original = b"AICTE FDR Security Deposit Verification Document - Top Secret"
    ciphertext = service.encrypt(original)

    assert ciphertext != original
    assert len(ciphertext) > len(original)

    decrypted = service.decrypt(ciphertext)
    assert decrypted == original


def test_unique_nonce_per_encryption():
    """Encrypting the same plaintext twice yields different ciphertexts (random nonce)."""
    key = base64.b64encode(os.urandom(32)).decode()
    service = EncryptionService(key)

    data = b"Repeat payload"
    c1 = service.encrypt(data)
    c2 = service.encrypt(data)

    assert c1 != c2
    assert service.decrypt(c1) == data
    assert service.decrypt(c2) == data


def test_encryption_invalid_key_length():
    """Keys not exactly 32 bytes must be rejected."""
    # 16-byte key
    short_key = base64.b64encode(os.urandom(16)).decode()
    with pytest.raises(ValueError) as exc:
        EncryptionService(short_key)
    assert "must decode to 32 bytes" in str(exc.value)

    # invalid base64
    with pytest.raises(ValueError) as exc:
        EncryptionService("not valid base64!!!")
    assert "not valid base64" in str(exc.value)


def test_tampered_ciphertext_fails():
    """Tampering with ciphertext or authentication tag must raise ValueError."""
    key = base64.b64encode(os.urandom(32)).decode()
    service = EncryptionService(key)

    original = b"Important tamper-evident payload"
    ciphertext = bytearray(service.encrypt(original))

    # Tamper with the last byte
    ciphertext[-1] ^= 0x55

    with pytest.raises(ValueError) as exc:
        service.decrypt(bytes(ciphertext))
    assert "Decryption failed" in str(exc.value)


def test_too_short_ciphertext():
    """Ciphertext shorter than nonce must raise ValueError."""
    key = base64.b64encode(os.urandom(32)).decode()
    service = EncryptionService(key)

    with pytest.raises(ValueError) as exc:
        service.decrypt(b"short")
    assert "too short" in str(exc.value)
