from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import StreamingResponse
import json
import logging
import asyncio
from typing import AsyncGenerator, Optional, List, Dict, Any
from models import ChatRequest, Message, MessageRole, EncryptedPayload
from services import gemini_service, firestore_service
from services.encryption_service import encryption_service
from middleware.auth_middleware import get_current_user
from services.auth_service import TokenData
from config import settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])


def decrypt_chat_request(chat_request: ChatRequest) -> Dict[str, Any]:
    """
    Decrypt encrypted chat request payload using server's AES key
    
    Args:
        chat_request: Chat request with encrypted payload
        
    Returns:
        Dict[str, Any]: Decrypted request data
        
    Raises:
        HTTPException: If encryption is missing or decryption fails
    """
    # Encryption is now required
    if not chat_request.encrypted_payload:
        raise HTTPException(
            status_code=400,
            detail="Encrypted payload required"
        )
    
    try:
        # Use server's AES key hash from environment
        if not settings.aes_key_hash:
            raise HTTPException(
                status_code=500,
                detail="Server encryption not configured"
            )
        
        # Derive key and decrypt using server's key
        aes_key = encryption_service.derive_key_from_hash(settings.aes_key_hash)
        decrypted_data = encryption_service.decrypt_payload(
            chat_request.encrypted_payload.encrypted_data, 
            aes_key
        )
        return decrypted_data
        
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail="Decryption failed - invalid key or corrupted data"
        )


async def create_sse_stream(message: str, conversation_id: str = None, enable_search: bool = False, model: str = "gemini-2.5-flash") -> AsyncGenerator[str, None]:
    """
    Create Server-Sent Events stream for chat response
    
    Args:
        message: User message
        conversation_id: Optional existing conversation ID
        enable_search: Enable Google Search grounding
        model: Gemini model to use
        
    Yields:
        str: SSE formatted data
    """
    try:
        # Get conversation history if continuing existing chat
        conversation_history = []
        if conversation_id:
            conversation = await firestore_service.get_conversation(conversation_id)
            if conversation:
                # Convert messages to format expected by Gemini
                conversation_history = [
                    {"role": msg.role.value, "content": msg.content}
                    for msg in conversation.messages
                ]
        
        # Send conversation ID event if this is a new chat
        if not conversation_id:
            yield f"data: {json.dumps({'type': 'conversation_start'})}\n\n"
        
        # Always use grounding method to support URL auto-detection and search
        # URL context is auto-detected from message content in gemini_service
        complete_response, references, search_queries, grounding_supports, url_context_urls, grounded = await gemini_service.generate_response_with_grounding(
            message, conversation_history, enable_search, None, model
        )
        
        # Stream the complete response in chunks for consistency
        chunk_size = 50  # Characters per chunk
        for i in range(0, len(complete_response), chunk_size):
            chunk = complete_response[i:i + chunk_size]
            yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"
            # Small delay to simulate streaming
            await asyncio.sleep(0.05)
        
        # Save conversation to Firestore
        if conversation_id:
            # Add to existing conversation
            user_message = Message(role=MessageRole.USER, content=message)
            ai_message = Message(
                role=MessageRole.AI, 
                content=complete_response,
                references=references,
                search_queries=search_queries,
                grounding_supports=grounding_supports,
                url_context_urls=url_context_urls,
                grounded=grounded
            )
            await firestore_service.add_message_to_conversation_with_grounding(
                conversation_id, user_message, ai_message
            )
            final_conversation_id = conversation_id
        else:
            # Create new conversation
            user_message = Message(role=MessageRole.USER, content=message)
            ai_message = Message(
                role=MessageRole.AI, 
                content=complete_response,
                references=references,
                search_queries=search_queries,
                grounding_supports=grounding_supports,
                url_context_urls=url_context_urls,
                grounded=grounded
            )
            title = await gemini_service.generate_title(message)
            final_conversation_id = await firestore_service.create_conversation_with_grounding(
                user_message, ai_message, title
            )
        
        # Send final event with conversation ID and grounding metadata
        final_data = {
            'type': 'done', 
            'conversation_id': final_conversation_id
        }
        if grounded:
            final_data.update({
                'references': [ref.dict() for ref in references],
                'search_queries': search_queries,
                'grounding_supports': [support.dict() for support in grounding_supports],
                'url_context_urls': url_context_urls,
                'grounded': grounded
            })
        yield f"data: {json.dumps(final_data)}\n\n"
        
    except Exception as e:
        logger.error(f"Error in SSE stream: {e}")
        error_msg = "An error occurred while generating the response. Please try again."
        yield f"data: {json.dumps({'type': 'error', 'error': error_msg})}\n\n"


@router.post("/")
async def start_chat(
    chat_request: ChatRequest, 
    request: Request,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Start a new chat conversation with streaming response
    
    Args:
        chat_request: Chat request containing the user message
        request: FastAPI request object
        current_user: Current authenticated user
        
    Returns:
        StreamingResponse: Server-Sent Events stream
    """
    try:
        # Decrypt the request payload
        decrypted_data = decrypt_chat_request(chat_request)
        message = decrypted_data.get("message", "")
        enable_search = decrypted_data.get("enable_search", False)
        model = decrypted_data.get("model", "gemini-2.5-flash")
        
        logger.info(f"Starting new chat with message: {message[:100]}...")
        
        return StreamingResponse(
            create_sse_stream(message, enable_search=enable_search, model=model),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "*",
            }
        )
        
    except Exception as e:
        logger.error(f"Error starting chat: {e}")
        raise HTTPException(status_code=500, detail="Failed to start chat")


@router.post("/{conversation_id}")
async def continue_chat(
    conversation_id: str, 
    chat_request: ChatRequest, 
    request: Request,
    current_user: TokenData = Depends(get_current_user)
):
    """
    Continue an existing chat conversation with streaming response
    
    Args:
        conversation_id: ID of the existing conversation
        chat_request: Chat request containing the user message
        request: FastAPI request object
        current_user: Current authenticated user
        
    Returns:
        StreamingResponse: Server-Sent Events stream
    """
    try:
        # Decrypt the request payload
        decrypted_data = decrypt_chat_request(chat_request)
        message = decrypted_data.get("message", "")
        enable_search = decrypted_data.get("enable_search", False)
        model = decrypted_data.get("model", "gemini-2.5-flash")
        
        logger.info(f"Continuing chat {conversation_id} with message: {message[:100]}...")
        
        # Verify conversation exists
        conversation = await firestore_service.get_conversation(conversation_id)
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        return StreamingResponse(
            create_sse_stream(message, conversation_id, enable_search, model),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "*",
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error continuing chat: {e}")
        raise HTTPException(status_code=500, detail="Failed to continue chat")