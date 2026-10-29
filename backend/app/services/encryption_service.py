"""AES-256-GCM document encryption service."""

from __future__ import annotations

import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

_NONCE_SIZE = 12  # 96-bit nonce recommended for AES-GCM


class EncryptionService:
    """Encrypt / decrypt arbitrary byte streams with AES-256-GCM."""

    def __init__(self, key_b64: str) -> None:
        try:
            key = base64.b64decode(key_b64)
        except Exception as exc:
            raise ValueError("DOCUMENT_ENCRYPTION_KEY is not valid base64") from exc

        if len(key) != 32:
            raise ValueError(
                f"DOCUMENT_ENCRYPTION_KEY must decode to 32 bytes, got {len(key)}"
            )

        self._aesgcm = AESGCM(key)

    def encrypt(self, plaintext: bytes) -> bytes:
        """Encrypt *plaintext* and return ``nonce || ciphertext``."""
        nonce = os.urandom(_NONCE_SIZE)
        ciphertext = self._aesgcm.encrypt(nonce, plaintext, None)
        return nonce + ciphertext

    def decrypt(self, ciphertext: bytes) -> bytes:
        """Decrypt ``nonce || ciphertext`` previously produced by :meth:`encrypt`.

        Raises ValueError on authentication failure or malformed input.
        """
        if len(ciphertext) <= _NONCE_SIZE:
            raise ValueError("Ciphertext too short to contain a nonce")
        nonce = ciphertext[:_NONCE_SIZE]
        data = ciphertext[_NONCE_SIZE:]
        try:
            return self._aesgcm.decrypt(nonce, data, None)
        except Exception as exc:
            raise ValueError("Decryption failed — data may be corrupted or the key is incorrect") from exc
