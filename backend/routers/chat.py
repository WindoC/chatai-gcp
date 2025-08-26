from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import StreamingResponse
import json
import logging
from typing import AsyncGenerator
from models import ChatRequest, Message, MessageRole
from services import gemini_service, firestore_service
from middleware.auth_middleware import get_current_user
from services.auth_service import TokenData

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["chat"])


async def create_sse_stream(message: str, conversation_id: str = None) -> AsyncGenerator[str, None]:
    """
    Create Server-Sent Events stream for chat response
    
    Args:
        message: User message
        conversation_id: Optional existing conversation ID
        
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
            yield f"data: {json.dumps({'type': 'chunk', 'content': chunk})}\n\n"
        
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
        logger.info(f"Starting new chat with message: {chat_request.message[:100]}...")
        
        return StreamingResponse(
            create_sse_stream(chat_request.message),
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
        logger.info(f"Continuing chat {conversation_id} with message: {chat_request.message[:100]}...")
        
        # Verify conversation exists
        conversation = await firestore_service.get_conversation(conversation_id)
        if not conversation:
            raise HTTPException(status_code=404, detail="Conversation not found")
        
        return StreamingResponse(
            create_sse_stream(chat_request.message, conversation_id),
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