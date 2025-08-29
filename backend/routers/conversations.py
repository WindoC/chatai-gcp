from fastapi import APIRouter, HTTPException, Query, Depends
from typing import Optional
import logging
from models import ConversationList, Conversation, APIResponse, StarRequest, RenameRequest, EncryptedPayload
from services import firestore_service
from services.encryption_service import encryption_service
from middleware.auth_middleware import get_current_user
from services.auth_service import TokenData
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


def decrypt_request_payload(encrypted_payload: EncryptedPayload) -> dict:
    """
    Decrypt encrypted request payload
    
    Args:
        encrypted_payload: Encrypted payload with key hash
        
    Returns:
        dict: Decrypted request data
        
    Raises:
        HTTPException: If decryption fails or key is invalid
    """
    # Validate AES key hash
    if not encryption_service.validate_aes_key_hash(encrypted_payload.key_hash):
        raise HTTPException(status_code=401, detail="Invalid encryption key")
    
    try:
        # Derive key and decrypt
        aes_key = encryption_service.derive_key_from_hash(encrypted_payload.key_hash)
        return encryption_service.decrypt_payload(encrypted_payload.encrypted_data, aes_key)
    except ValueError:
        raise HTTPException(status_code=400, detail="Decryption failed")


def encrypt_response(response_data: dict) -> str:
    """
    Encrypt response data using server's AES key
    
    Args:
        response_data: Data to encrypt
        
    Returns:
        str: Base64 encoded encrypted response
    """
    if not settings.aes_key_hash:
        raise HTTPException(
            status_code=500,
            detail="Server encryption not configured"
        )
    
    aes_key = encryption_service.derive_key_from_hash(settings.aes_key_hash)
    return encryption_service.encrypt_response(response_data, aes_key)


@router.get("/", response_model=str)
async def list_conversations(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    starred: Optional[bool] = Query(None),
    current_user: TokenData = Depends(get_current_user)
):
    """
    List conversations with pagination (encrypted response)
    
    Args:
        limit: Number of conversations to return (1-100)
        offset: Number of conversations to skip
        starred: Filter by starred status (optional)
        
    Returns:
        str: Encrypted conversation list as base64 string
    """
    try:
        logger.info(f"Listing conversations: limit={limit}, offset={offset}, starred={starred}")
        
        conversations = await firestore_service.list_conversations(limit, offset)
        
        # Filter by starred status if specified
        if starred is not None:
            conversations = [conv for conv in conversations if conv.starred == starred]
        
        # Check if there are more conversations
        has_more = len(conversations) == limit
        
        conversation_list = ConversationList(
            conversations=conversations,
            total=len(conversations),
            has_more=has_more
        )
        
        # Encrypt the response using server's key
        response_dict = conversation_list.model_dump()
        try:
            return encrypt_response(response_dict)
        except ValueError as ve:
            logger.error(f"Encryption failed: {ve}")
            raise HTTPException(status_code=500, detail="Server encryption error")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing conversations: {e}")
        raise HTTPException(status_code=500, detail="Failed to list conversations")


@router.get("/{conversation_id}", response_model=str)
async def get_conversation(
    conversation_id: str,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Get a specific conversation with all messages (encrypted response)
    
    Args:
        conversation_id: The conversation ID
        
    Returns:
        str: Encrypted conversation data as base64 string
    """
    try:
        logger.info(f"Getting conversation: {conversation_id}")
        
        conversation = await firestore_service.get_conversation(conversation_id)
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        # Encrypt the response using server's key
        response_dict = conversation.model_dump()
        try:
            return encrypt_response(response_dict)
        except ValueError as ve:
            logger.error(f"Encryption failed: {ve}")
            raise HTTPException(status_code=500, detail="Server encryption error")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting conversation {conversation_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get conversation")


@router.post("/{conversation_id}/star", response_model=APIResponse)
async def star_conversation(conversation_id: str, star_request: StarRequest, current_user: TokenData = Depends(get_current_user)):
    """
    Star or unstar a conversation
    
    Args:
        conversation_id: The conversation ID
        star_request: StarRequest containing starred boolean
        
    Returns:
        APIResponse: Success response
    """
    try:
        starred = star_request.starred
        logger.info(f"{'Starring' if starred else 'Unstarring'} conversation: {conversation_id}")
        
        success = await firestore_service.star_conversation(conversation_id, starred)
        if not success:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        return APIResponse(
            success=True,
            data={"conversation_id": conversation_id, "starred": starred},
            message=f"Conversation {'starred' if starred else 'unstarred'} successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starring conversation {conversation_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update conversation")


@router.patch("/{conversation_id}/title", response_model=APIResponse)
async def rename_conversation(conversation_id: str, rename_request: RenameRequest, current_user: TokenData = Depends(get_current_user)):
    """
    Rename a conversation
    
    Args:
        conversation_id: The conversation ID
        rename_request: RenameRequest containing new title
        
    Returns:
        APIResponse: Success response
    """
    try:
        title = rename_request.title.strip()
        logger.info(f"Renaming conversation {conversation_id} to '{title}'")
        
        success = await firestore_service.rename_conversation(conversation_id, title)
        if not success:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        return APIResponse(
            success=True,
            data={"conversation_id": conversation_id, "title": title},
            message="Conversation renamed successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error renaming conversation {conversation_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to rename conversation")


@router.delete("/nonstarred", response_model=APIResponse)
async def bulk_delete_nonstarred(current_user: TokenData = Depends(get_current_user)):
    """
    Bulk delete all non-starred conversations
    
    Returns:
        APIResponse: Success response with count of deleted conversations
    """
    try:
        logger.info("Bulk deleting non-starred conversations")
        
        deleted_count = await firestore_service.bulk_delete_nonstarred()
        
        return APIResponse(
            success=True,
            data={"deleted_count": deleted_count},
            message=f"Deleted {deleted_count} non-starred conversations"
        )
        
    except Exception as e:
        logger.error(f"Error bulk deleting non-starred conversations: {e}")
        raise HTTPException(status_code=500, detail="Failed to bulk delete conversations")


@router.delete("/{conversation_id}", response_model=APIResponse)
async def delete_conversation(conversation_id: str, current_user: TokenData = Depends(get_current_user)):
    """
    Delete a specific conversation
    
    Args:
        conversation_id: The conversation ID
        
    Returns:
        APIResponse: Success response
    """
    try:
        logger.info(f"Deleting conversation: {conversation_id}")
        
        success = await firestore_service.delete_conversation(conversation_id)
        if not success:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        return APIResponse(
            success=True,
            message="Conversation deleted successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting conversation {conversation_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete conversation")