from google import genai
import asyncio
import logging
from typing import AsyncGenerator, Optional, Dict, List, Tuple
from config import settings
from models import Reference, GroundingSupport

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
    
    async def generate_response_stream(self, message: str, conversation_history: Optional[list] = None, enable_search: bool = False) -> AsyncGenerator[str, None]:
        """
        Generate streaming response from Gemini API
        
        Args:
            message: User message
            conversation_history: Previous messages for context
            enable_search: Enable Google Search grounding
            
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
            
            # Configure generation with search grounding if enabled
            config = {}
            if enable_search:
                config["tools"] = [{"google_search": {}}]
            
            # Generate streaming response using async client
            async for chunk in await self.client.aio.models.generate_content_stream(
                model='gemini-2.5-flash',
                contents=contents,
                config=config
            ):
                if chunk.text:
                    yield chunk.text
                    
        except Exception as e:
            logger.error(f"Error generating Gemini response: {e}")
            yield f"Error: Unable to generate response. Please try again."
    
    async def generate_response_with_grounding(self, message: str, conversation_history: Optional[list] = None, enable_search: bool = False) -> Tuple[str, List[Reference], List[str], List[GroundingSupport], bool]:
        """
        Generate complete response with grounding metadata from Gemini API
        
        Args:
            message: User message
            conversation_history: Previous messages for context
            enable_search: Enable Google Search grounding
            
        Returns:
            Tuple[str, List[Reference], List[str], List[GroundingSupport], bool]: Response text, references, search queries, grounding supports, grounded flag
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
            
            # Configure generation with search grounding if enabled
            config = {}
            if enable_search:
                config["tools"] = [{"google_search": {}}]
            
            # Generate complete response using async client
            response = await self.client.aio.models.generate_content(
                model='gemini-2.5-flash',
                contents=contents,
                config=config
            )
            
            # Extract response text
            response_text = response.text if response.text else ""
            
            # Extract grounding metadata
            references = []
            search_queries = []
            grounding_supports = []
            grounded = False
            
            if enable_search and hasattr(response, 'candidates') and response.candidates:
                candidate = response.candidates[0]
                if hasattr(candidate, 'grounding_metadata') and candidate.grounding_metadata:
                    grounded = True
                    grounding_metadata = candidate.grounding_metadata
                    
                    # Extract search queries (webSearchQueries in actual API)
                    if hasattr(grounding_metadata, 'web_search_queries'):
                        search_queries = grounding_metadata.web_search_queries or []
                    elif hasattr(grounding_metadata, 'webSearchQueries'):
                        search_queries = grounding_metadata.webSearchQueries or []
                    
                    # Extract grounding chunks and create references
                    grounding_chunks = []
                    if hasattr(grounding_metadata, 'grounding_chunks'):
                        grounding_chunks = grounding_metadata.grounding_chunks or []
                    elif hasattr(grounding_metadata, 'groundingChunks'):
                        grounding_chunks = grounding_metadata.groundingChunks or []
                    
                    for i, chunk in enumerate(grounding_chunks):
                        web_data = None
                        if hasattr(chunk, 'web') and chunk.web:
                            web_data = chunk.web
                        elif isinstance(chunk, dict) and 'web' in chunk:
                            web_data = chunk['web']
                        
                        if web_data:
                            # Handle both attribute access and dictionary access
                            uri = getattr(web_data, 'uri', None) or (web_data.get('uri') if isinstance(web_data, dict) else '')
                            title = getattr(web_data, 'title', None) or (web_data.get('title') if isinstance(web_data, dict) else '')
                            
                            if uri:
                                # Extract domain from URI
                                try:
                                    from urllib.parse import urlparse
                                    parsed_url = urlparse(uri)
                                    domain = parsed_url.netloc or 'Unknown'
                                except:
                                    domain = uri.split('/')[2] if '/' in uri else 'Unknown'
                                
                                reference = Reference(
                                    id=i + 1,
                                    title=title or domain or 'Reference',
                                    url=uri,
                                    domain=domain,
                                    snippet=None  # Snippet not provided in groundingChunks
                                )
                                references.append(reference)
                    
                    # Extract grounding supports
                    supports_data = []
                    if hasattr(grounding_metadata, 'grounding_supports'):
                        supports_data = grounding_metadata.grounding_supports or []
                    elif hasattr(grounding_metadata, 'groundingSupports'):
                        supports_data = grounding_metadata.groundingSupports or []
                    
                    for support in supports_data:
                        segment = None
                        indices = []
                        
                        if hasattr(support, 'segment') and support.segment:
                            segment = support.segment
                            indices = getattr(support, 'grounding_chunk_indices', []) or getattr(support, 'groundingChunkIndices', [])
                        elif isinstance(support, dict):
                            segment = support.get('segment')
                            indices = support.get('groundingChunkIndices', [])
                        
                        if segment:
                            start_idx = getattr(segment, 'start_index', None) or getattr(segment, 'startIndex', None) or (segment.get('startIndex') if isinstance(segment, dict) else 0)
                            end_idx = getattr(segment, 'end_index', None) or getattr(segment, 'endIndex', None) or (segment.get('endIndex') if isinstance(segment, dict) else 0)
                            text = getattr(segment, 'text', None) or (segment.get('text') if isinstance(segment, dict) else '')
                            
                            grounding_support = GroundingSupport(
                                start_index=start_idx or 0,
                                end_index=end_idx or 0,
                                text=text or '',
                                reference_indices=[i + 1 for i in indices] if indices else []
                            )
                            grounding_supports.append(grounding_support)
            
            # Process inline citations in the response text
            if grounded and grounding_supports and references:
                response_text = self._insert_inline_citations(response_text, grounding_supports)
            
            return response_text, references, search_queries, grounding_supports, grounded
            
        except Exception as e:
            logger.error(f"Error generating Gemini response with grounding: {e}")
            return "Error: Unable to generate response. Please try again.", [], [], [], False
    
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
    
    def _insert_inline_citations(self, text: str, grounding_supports: List[GroundingSupport]) -> str:
        """
        Insert inline citations into the response text based on grounding supports
        
        Args:
            text: Original response text
            grounding_supports: List of grounding supports with reference indices
            
        Returns:
            str: Text with inline citations inserted
        """
        try:
            # Sort supports by start index in reverse order to maintain indices when inserting
            sorted_supports = sorted(grounding_supports, key=lambda x: x.start_index, reverse=True)
            
            result_text = text
            
            for support in sorted_supports:
                if support.reference_indices:
                    # Create citation string like [1][2] for multiple references
                    citations = ''.join([f'[{idx}]' for idx in support.reference_indices])
                    
                    # Insert citation at the end of the grounded segment
                    end_pos = support.end_index
                    if end_pos <= len(result_text):
                        # Insert citation after the grounded text
                        result_text = result_text[:end_pos] + citations + result_text[end_pos:]
            
            return result_text
            
        except Exception as e:
            logger.error(f"Error inserting inline citations: {e}")
            return text  # Return original text on error


# Global service instance
gemini_service = GeminiService()