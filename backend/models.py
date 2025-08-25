from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from enum import Enum


class MessageRole(str, Enum):
    """Message role enumeration"""
    USER = "user"
    AI = "ai"


class Message(BaseModel):
    """Chat message model"""
    message_id: Optional[str] = None
    role: MessageRole
    content: str
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ChatRequest(BaseModel):
    """Chat request model"""
    message: str = Field(..., min_length=1, max_length=4000)
    encrypted: bool = False  # Phase 4 feature


class ChatResponse(BaseModel):
    """Chat response model"""
    success: bool = True
    conversation_id: Optional[str] = None
    message: Optional[str] = None
    error: Optional[str] = None


class Conversation(BaseModel):
    """Conversation model"""
    conversation_id: str
    title: Optional[str] = None
    messages: List[Message] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_updated: datetime = Field(default_factory=datetime.utcnow)
    starred: bool = False


class ConversationSummary(BaseModel):
    """Conversation summary for listing"""
    conversation_id: str
    title: Optional[str] = None
    created_at: datetime
    last_updated: datetime
    starred: bool = False
    message_count: int = 0
    preview: Optional[str] = None


class ConversationList(BaseModel):
    """Conversation list response"""
    conversations: List[ConversationSummary]
    total: int
    has_more: bool = False


class HealthCheck(BaseModel):
    """Health check response"""
    status: str = "healthy"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    version: str = "1.0.0"


class APIResponse(BaseModel):
    """Generic API response wrapper"""
    success: bool = True
    data: Optional[dict] = None
    message: Optional[str] = None
    error: Optional[dict] = None