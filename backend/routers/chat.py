from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import StreamingResponse
import json
import logging
from typing import AsyncGenerator, Union
from models import ChatRequest, Message, MessageRole, EncryptedContent
from services import gemini_service, firestore_service
from services.encryption_service import encryption_service, EncryptionError, DecryptionError
from middleware.auth_middleware import get_current_user
from services.auth_service import TokenData

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])


async def create_sse_stream(
    message: str, 
    conversation_id: str = None,
    key_hash: str = None
) -> AsyncGenerator[str, None]:
    """
    Create Server-Sent Events stream for chat response
    
    Args:
        message: Decrypted user message
        conversation_id: Optional existing conversation ID
        key_hash: Optional AES key hash for encrypting responses
        
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
        
        # Stream AI response
        response_chunks = []
        async for chunk in gemini_service.generate_response_stream(message, conversation_history):
            response_chunks.append(chunk)
            
            # Encrypt chunk if encryption is enabled and key_hash provided
            chunk_data = {'type': 'chunk', 'content': chunk}
            if encryption_service.encryption_enabled and key_hash:
                try:
                    encrypted_chunk = encryption_service.encrypt_payload(chunk, key_hash)
                    chunk_data = {
                        'type': 'chunk',
                        'content': encrypted_chunk,
                        'encrypted': True,
                        'key_hash': key_hash
                    }
                except EncryptionError as e:
                    logger.error(f"Failed to encrypt chunk: {e}")
                    chunk_data['error'] = "Encryption failed"
            
            yield f"data: {json.dumps(chunk_data)}\n\n"
        
        # Combine all chunks for complete response
        complete_response = "".join(response_chunks)
        
        # Save conversation to Firestore
        if conversation_id:
            # Add to existing conversation
            user_message = Message(role=MessageRole.USER, content=message)
            await firestore_service.add_message_to_conversation(
                conversation_id, user_message, complete_response
            )
            final_conversation_id = conversation_id
        else:
            # Create new conversation
            user_message = Message(role=MessageRole.USER, content=message)
            title = await gemini_service.generate_title(message)
            final_conversation_id = await firestore_service.create_conversation(
                user_message, complete_response, title
            )
        
        # Send final event with conversation ID
        yield f"data: {json.dumps({'type': 'done', 'conversation_id': final_conversation_id})}\n\n"
        
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
        # Handle message decryption if needed
        decrypted_message = chat_request.message
        key_hash = chat_request.key_hash
        
        # If message is encrypted or encryption is enabled
        if chat_request.encrypted or encryption_service.encryption_enabled:
            if isinstance(chat_request.message, EncryptedContent):
                # Message is an EncryptedContent object
                key_hash = chat_request.message.key_hash
                decrypted_message = encryption_service.decrypt_payload(
                    chat_request.message.content, key_hash
                )
            elif isinstance(chat_request.message, str) and chat_request.encrypted:
                # Message is encrypted string
                if not key_hash:
                    raise HTTPException(status_code=400, detail="Key hash required for encrypted messages")
                decrypted_message = encryption_service.decrypt_payload(chat_request.message, key_hash)
            elif encryption_service.encryption_enabled and not chat_request.encrypted:
                # Encryption is enabled but message is not encrypted
                raise HTTPException(status_code=501, detail="Encryption is required but message is not encrypted")
        
        logger.info(f"Starting new chat with decrypted message: {str(decrypted_message)[:100]}...")
        
        return StreamingResponse(
            create_sse_stream(decrypted_message, key_hash=key_hash),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "*",
            }
        )
        
    except (EncryptionError, DecryptionError) as e:
        logger.error(f"Encryption error in chat: {e}")
        raise HTTPException(status_code=400, detail=str(e))
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
        # Handle message decryption if needed
        decrypted_message = chat_request.message
        key_hash = chat_request.key_hash
        
        # If message is encrypted or encryption is enabled
        if chat_request.encrypted or encryption_service.encryption_enabled:
            if isinstance(chat_request.message, EncryptedContent):
                # Message is an EncryptedContent object
                key_hash = chat_request.message.key_hash
                decrypted_message = encryption_service.decrypt_payload(
                    chat_request.message.content, key_hash
                )
            elif isinstance(chat_request.message, str) and chat_request.encrypted:
                # Message is encrypted string
                if not key_hash:
                    raise HTTPException(status_code=400, detail="Key hash required for encrypted messages")
                decrypted_message = encryption_service.decrypt_payload(chat_request.message, key_hash)
            elif encryption_service.encryption_enabled and not chat_request.encrypted:
                # Encryption is enabled but message is not encrypted
                raise HTTPException(status_code=501, detail="Encryption is required but message is not encrypted")
        
        logger.info(f"Continuing chat {conversation_id} with decrypted message: {str(decrypted_message)[:100]}...")
        
        # Verify conversation exists
        conversation = await firestore_service.get_conversation(conversation_id)
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        return StreamingResponse(
            create_sse_stream(decrypted_message, conversation_id, key_hash=key_hash),
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
    except (EncryptionError, DecryptionError) as e:
        logger.error(f"Encryption error in chat: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error continuing chat: {e}")
        raise HTTPException(status_code=500, detail="Failed to continue chat")