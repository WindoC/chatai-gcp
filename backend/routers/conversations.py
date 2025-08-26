from fastapi import APIRouter, HTTPException, Query
from typing import Optional
import logging
from models import ConversationList, Conversation, APIResponse
from services import firestore_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/conversations", tags=["conversations"])


@router.get("/", response_model=ConversationList)
async def list_conversations(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    starred: Optional[bool] = Query(None)
):
    """
    List conversations with pagination
    
    Args:
        limit: Number of conversations to return (1-100)
        offset: Number of conversations to skip
        starred: Filter by starred status (optional)
        
    Returns:
        ConversationList: List of conversation summaries
    """
    try:
        logger.info(f"Listing conversations: limit={limit}, offset={offset}, starred={starred}")
        
        conversations = await firestore_service.list_conversations(limit, offset)
        
        # Filter by starred status if specified
        if starred is not None:
            conversations = [conv for conv in conversations if conv.starred == starred]
        
        # Check if there are more conversations
        has_more = len(conversations) == limit
        
        return ConversationList(
            conversations=conversations,
            total=len(conversations),
            has_more=has_more
        )
        
    except Exception as e:
        logger.error(f"Error listing conversations: {e}")
        raise HTTPException(status_code=500, detail="Failed to list conversations")


@router.get("/{conversation_id}", response_model=Conversation)
async def get_conversation(conversation_id: str):
    """
    Get a specific conversation with all messages
    
    Args:
        conversation_id: The conversation ID
        
    Returns:
        Conversation: Complete conversation with messages
    """
    try:
        logger.info(f"Getting conversation: {conversation_id}")
        
        conversation = await firestore_service.get_conversation(conversation_id)
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        return conversation
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting conversation {conversation_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get conversation")


@router.post("/{conversation_id}/star", response_model=APIResponse)
async def star_conversation(conversation_id: str, starred: bool = True):
    """
    Star or unstar a conversation
    
    Args:
        conversation_id: The conversation ID
        starred: Whether to star (True) or unstar (False)
        
    Returns:
        APIResponse: Success response
    """
    try:
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


@router.delete("/{conversation_id}", response_model=APIResponse)
async def delete_conversation(conversation_id: str):
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


@router.delete("/nonstarred", response_model=APIResponse)
async def bulk_delete_nonstarred():
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