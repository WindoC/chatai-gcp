"""
Encryption management endpoints for Phase 4 end-to-end encryption.
Provides key validation and encryption status endpoints.
"""

from fastapi import APIRouter, HTTPException, Depends
import logging
from models import EncryptionValidationRequest, EncryptionValidationResponse, APIResponse
from services.encryption_service import encryption_service, EncryptionError
from middleware.auth_middleware import get_current_user
from services.auth_service import TokenData

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/encryption", tags=["encryption"])


@router.post("/validate", response_model=APIResponse)
async def validate_key(
    validation_request: EncryptionValidationRequest,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Validate AES key hash against server configuration
    
    Args:
        validation_request: Request containing the key hash to validate
        current_user: Current authenticated user
        
    Returns:
        APIResponse: Validation result
    """
    try:
        logger.info("Validating encryption key hash")
        
        if not encryption_service.encryption_enabled:
            return APIResponse(
                success=True,
                data={"valid": True, "encryption_enabled": False},
                message="Encryption is not enabled"
            )
        
        # Validate the key hash
        is_valid = encryption_service.validate_key_hash(validation_request.key_hash)
        
        return APIResponse(
            success=True,
            data={
                "valid": is_valid,
                "encryption_enabled": True
            },
            message="Key hash validated successfully" if is_valid else "Invalid key hash"
        )
        
    except Exception as e:
        logger.error(f"Error validating key hash: {e}")
        raise HTTPException(status_code=500, detail="Failed to validate key hash")


@router.get("/status", response_model=APIResponse)
async def get_encryption_status(current_user: TokenData = Depends(get_current_user)):
    """
    Get encryption status and configuration
    
    Args:
        current_user: Current authenticated user
        
    Returns:
        APIResponse: Encryption status information
    """
    try:
        logger.info("Getting encryption status")
        
        return APIResponse(
            success=True,
            data={
                "encryption_enabled": encryption_service.encryption_enabled,
                "key_hash_configured": bool(encryption_service.expected_key_hash)
            },
            message="Encryption status retrieved successfully"
        )
        
    except Exception as e:
        logger.error(f"Error getting encryption status: {e}")
        raise HTTPException(status_code=500, detail="Failed to get encryption status")