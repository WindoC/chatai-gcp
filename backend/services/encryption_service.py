import base64
import hashlib
import os
from typing import Dict, Any, Optional, Tuple
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import json
import logging
from datetime import datetime
from google.cloud.firestore_v1._helpers import DatetimeWithNanoseconds
from config import settings

logger = logging.getLogger(__name__)


class FirestoreJSONEncoder(json.JSONEncoder):
    """Custom JSON encoder to handle Firestore datetime objects"""
    
    def default(self, obj):
        if isinstance(obj, DatetimeWithNanoseconds):
            # Convert to ISO format string
            return obj.isoformat()
        return super().default(obj)


class EncryptionService:
    """Service for AES-GCM encryption/decryption operations"""
    
    def __init__(self):
        self.required_aes_hash = os.getenv("AES_KEY_HASH")
        if not self.required_aes_hash:
            logger.warning("AES_KEY_HASH not set in environment")
    
    def validate_aes_key_hash(self, provided_hash: str) -> bool:
        """
        Validate provided AES key hash against environment variable
        
        Args:
            provided_hash: SHA256 hash of AES key provided by client
            
        Returns:
            bool: True if hash matches, False otherwise
        """
        if not self.required_aes_hash:
            return False
        return provided_hash == self.required_aes_hash
    
    def decrypt_payload(self, encrypted_payload: str, aes_key_bytes: bytes) -> Dict[str, Any]:
        """
        Decrypt AES-GCM encrypted payload
        
        Args:
            encrypted_payload: Base64 encoded encrypted data with IV
            aes_key_bytes: AES key as bytes
            
        Returns:
            Dict[str, Any]: Decrypted payload as dictionary
            
        Raises:
            ValueError: If decryption fails
        """
        try:
            # Decode base64 payload
            encrypted_data = base64.b64decode(encrypted_payload)
            
            # Extract IV (first 12 bytes) and ciphertext
            iv = encrypted_data[:12]
            ciphertext = encrypted_data[12:]
            
            # Decrypt using AES-GCM
            aesgcm = AESGCM(aes_key_bytes)
            decrypted_bytes = aesgcm.decrypt(iv, ciphertext, None)
            
            # Parse JSON
            decrypted_text = decrypted_bytes.decode('utf-8')
            return json.loads(decrypted_text)
            
        except Exception as e:
            logger.error(f"Decryption failed: {e}")
            raise ValueError("Decryption failed")
    
    def encrypt_response(self, response_data: Dict[str, Any], aes_key_bytes: bytes) -> str:
        """
        Encrypt response data using AES-GCM
        
        Args:
            response_data: Data to encrypt
            aes_key_bytes: AES key as bytes
            
        Returns:
            str: Base64 encoded encrypted data with IV
        """
        try:
            # Convert to JSON bytes using custom encoder for Firestore objects
            json_bytes = json.dumps(response_data, cls=FirestoreJSONEncoder).encode('utf-8')
            
            # Generate random IV
            iv = os.urandom(12)  # 96 bits for GCM
            
            # Encrypt using AES-GCM
            aesgcm = AESGCM(aes_key_bytes)
            ciphertext = aesgcm.encrypt(iv, json_bytes, None)
            
            # Combine IV + ciphertext and encode as base64
            encrypted_data = iv + ciphertext
            return base64.b64encode(encrypted_data).decode('utf-8')
            
        except Exception as e:
            logger.error(f"Encryption failed: {e}")
            raise ValueError("Encryption failed")
    
    def derive_key_from_hash(self, key_hash: str) -> bytes:
        """
        Derive AES key bytes from SHA256 hash
        
        Args:
            key_hash: SHA256 hash of the original key
            
        Returns:
            bytes: 32-byte AES key
        """
        try:
            # Use the hash as the key (already 32 bytes when hex decoded)
            return bytes.fromhex(key_hash)
        except ValueError as e:
            logger.error(f"Invalid AES key hash format: {key_hash[:20]}... (length: {len(key_hash)})")
            raise ValueError(f"Invalid AES key hash format: {e}")


# Global encryption service instance
encryption_service = EncryptionService()