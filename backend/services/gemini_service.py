from google import genai
import asyncio
import logging
from typing import AsyncGenerator, Optional
from config import settings

logger = logging.getLogger(__name__)


class GeminiService:
    """Service for interacting with Google Gemini API"""
    
    def __init__(self):
        self.client = None
        self._initialize_client()
    
    def _initialize_client(self):
        """Initialize the Gemini client"""
        try:
            self.client = genai.Client(api_key=settings.google_api_key)
            logger.info("Gemini client initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Gemini client: {e}")
            raise
    
    async def generate_response_stream(self, message: str, conversation_history: Optional[list] = None) -> AsyncGenerator[str, None]:
        """
        Generate streaming response from Gemini API
        
        Args:
            message: User message
            conversation_history: Previous messages for context
            
        Yields:
            str: Chunks of the AI response
        """
        try:
            # Build the full conversation context including history and current message
            contents = []
            
            # Add conversation history
            if conversation_history:
                for msg in conversation_history[-10:]:  # Limit context to last 10 messages
                    contents.append(msg["content"])
            
            # Add current message
            contents.append(message)
            
            # Generate streaming response using async client
            async for chunk in await self.client.aio.models.generate_content_stream(
                model='gemini-2.5-flash',
                contents=contents
            ):
                if chunk.text:
                    yield chunk.text
                    
        except Exception as e:
            logger.error(f"Error generating Gemini response: {e}")
            yield f"Error: Unable to generate response. Please try again."
    
    async def generate_response(self, message: str, conversation_history: Optional[list] = None) -> str:
        """
        Generate complete response from Gemini API (non-streaming)
        
        Args:
            message: User message
            conversation_history: Previous messages for context
            
        Returns:
            str: Complete AI response
        """
        try:
            # Collect all chunks from streaming response
            response_chunks = []
            async for chunk in self.generate_response_stream(message, conversation_history):
                response_chunks.append(chunk)
            
            return "".join(response_chunks)
            
        except Exception as e:
            logger.error(f"Error generating Gemini response: {e}")
            return "Error: Unable to generate response. Please try again."
    
    async def generate_title(self, first_message: str) -> str:
        """
        Generate a title for a conversation based on the first message
        
        Args:
            first_message: The first user message in the conversation
            
        Returns:
            str: Generated title (max 50 characters)
        """
        try:
            prompt = f"Generate a short, descriptive title (max 50 characters) for a conversation that starts with: '{first_message[:200]}'"
            
            # Use the async client to generate title
            response = await self.client.aio.models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt
            )
            
            # Clean up the response
            title = response.text.strip().strip('"').strip("'")
            return title[:50] if len(title) > 50 else title
            
        except Exception as e:
            logger.error(f"Error generating conversation title: {e}")
            # Fallback to first few words of the message
            words = first_message.split()[:5]
            return " ".join(words) + ("..." if len(words) >= 5 else "")


# Global service instance
gemini_service = GeminiService()