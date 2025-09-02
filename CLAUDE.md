# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **production-deployed** secure AI chat web application with complete end-to-end encryption:

**🌟 Live Application:** Deployed on Google App Engine

- **Frontend**: React + TailwindCSS with Server-Sent Events (SSE) for streaming
- **Backend**: FastAPI (Python 3.13) deployed on Google App Engine
- **AI Integration**: Google Gemini (google-genai) with 42+ available models
- **Database**: Firestore Native with AES-256-GCM encryption
- **Authentication**: JWT with single-user mode (Username: `antonio`)
- **Encryption**: Complete end-to-end AES-256-GCM encryption for all data
- **Deployment**: ✅ Production-ready on Google App Engine Standard

## Key Architecture Decisions

### Authentication Flow
- Single predefined user with credentials from environment variables
- JWT tokens (access + refresh) stored in LocalStorage
- Username/password validated against environment variables with SHA256 hashing

### Chat Implementation
- Real-time streaming via Server-Sent Events (SSE)
- Markdown rendering for AI responses with syntax highlighting
- Dynamic Gemini model selection with 42+ available models
- Google Search grounding with web results and citations
- Automatic URL context detection for web page grounding
- Conversation history stored in Firestore without auto-expiration
- Bulk operations for non-starred conversations

### Data Model
Conversations in Firestore follow this structure:
```json
{
  "conversation_id": "uuid",
  "messages": [
    { 
      "role": "user|ai", 
      "content": "text", 
      "created_at": "timestamp",
      "references": [{"id": 1, "title": "Source", "url": "https://...", "domain": "example.com"}],
      "search_queries": ["query1", "query2"],
      "grounding_supports": [{"start_index": 0, "end_index": 10, "text": "grounded text", "reference_indices": [1]}],
      "url_context_urls": ["https://..."],
      "grounded": true
    }
  ],
  "created_at": "timestamp",
  "last_updated": "timestamp", 
  "starred": false
}
```

### API Endpoints Structure
- `/auth/*` - Authentication (login, refresh, logout)
- `/api/models/` - Get available Gemini models
- `/chat` - New conversations with streaming and model selection
- `/chat/{conversation_id}` - Continue existing conversations
- `/conversations` - CRUD operations and bulk delete

## Development Phases

This project follows a 4-phase development approach:

### Phase 1: Design and Documentation ✅
- Complete design documents (DESIGN.md, API.md, PLAN.md)
- Project structure and architecture planning
- Git repository setup with proper documentation

### Phase 2: Core Logic, API and Basic Chat (No Auth) ✅
- FastAPI backend with Gemini API integration
- React frontend with streaming chat interface
- Basic Firestore conversation storage
- No authentication required for this phase

### Phase 3: Authentication, Conversation Management, and AI Grounding ✅
- JWT-based single-user authentication system
- Complete conversation CRUD operations
- Conversation history, starring, and bulk delete
- Protected API endpoints with middleware
- Security headers and rate limiting
- React authentication context and protected routes
- Google Search grounding with web results and citations
- Automatic URL context detection and web page grounding
- Enhanced UI with search toggle and reference display
- Dynamic Gemini model selection with intelligent caching

### Phase 4: End-to-End Encryption ✅
- AES-256-GCM encryption for all sensitive endpoints
- Encrypted request/response for chat and conversation endpoints
- Complete SSE streaming encryption (all chunks + metadata)
- Frontend encryption service with client-side decryption
- SHA256 key derivation matching backend implementation
- No fallback to unencrypted traffic for protected endpoints
- Content-Length header fixes for encrypted responses


## Development Commands

**Frontend (React)**:
- `npm install` - Install dependencies
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run test` - Run tests
- `npm run lint` - Lint code

**Backend (FastAPI)**:
- `pip install -r requirements.txt` - Install dependencies
- `uvicorn main:app --reload` - Start development server
- `pytest` - Run tests
- `python -m pytest --cov` - Run tests with coverage

**Deployment**:
- `gcloud app deploy` - Deploy to Google App Engine

## Phase-Specific Implementation Notes

### Phase 2 Focus Areas
- Server-Sent Events (SSE) for streaming AI responses
- Firestore schema implementation with proper indexing
- React components with TailwindCSS ChatGPT-inspired UI
- Markdown rendering with syntax highlighting

### Phase 3 Security and AI Features Implementation ✅
- Environment-based credentials (USERNAME, PASSWORD_HASH)
- JWT access (30min) and refresh tokens (7 days)
- Rate limiting on authentication endpoints (10/min auth, 30/min chat)
- CORS and security headers configuration (CSP, HSTS, XSS protection)
- Protected API endpoints with JWT middleware
- React authentication context with automatic token refresh
- Login/logout functionality with secure token storage
- Google Search grounding with Gemini 2.5 Flash integration
- Automatic URL detection and web page context grounding
- Citation processing with inline reference insertion
- Enhanced message display with grounding indicators and references


## Environment Variables

### Phase 3 Required Variables
- `GOOGLE_API_KEY` - Gemini API key
- `GOOGLE_CLOUD_PROJECT` - GCP project ID
- `JWT_SECRET_KEY` - JWT signing secret (generate with `secrets.token_hex(32)`)
- `JWT_ACCESS_EXPIRE_MINUTES` - Access token expiration (default: 30)
- `JWT_REFRESH_EXPIRE_DAYS` - Refresh token expiration (default: 7)
- `USERNAME` - Single user login (e.g., "admin")
- `PASSWORD_HASH` - SHA256 hash of user password
- `AUTH_RATE_LIMIT` - Authentication rate limit per minute (default: 10)
- `CHAT_RATE_LIMIT` - Chat API rate limit per minute (default: 30)
- `AES_KEY_HASH` - Server secret for AES key derivation (never transmitted)

## Security Notes
- Default password hash corresponds to "secret123"
- Generate secure JWT secrets: `python -c "import secrets; print(secrets.token_hex(32))"`
- Generate password hashes: `python -c "import hashlib; print(hashlib.sha256('password'.encode()).hexdigest())"`
- Generate AES server secrets: `python -c "import secrets; print(secrets.token_hex(32))"`

## 🚀 Production Deployment Status - ALL PHASES COMPLETE ✅

**Live Application:** Deployed on Google App Engine  
**Deployment Date:** January 2025  
**Status:** Fully operational with end-to-end encryption

### Dynamic Model Selection Features
- **Real-time Model Discovery**: Queries Google AI API for all available models
- **Intelligent Caching**: Models cached in memory to avoid repeated API calls
- **42+ Available Models**: Supports all Gemini models that support generateContent
- **Persistent Selection**: Selected model stored in localStorage across sessions
- **Fallback Models**: Graceful degradation when API is unavailable
- **UI Integration**: Clean dropdown in header with loading/error states

### AI Grounding Features
- **Google Search Integration**: Real-time web search with Gemini 2.5 Flash
- **Automatic URL Detection**: Uses regex pattern to detect URLs in messages
- **Citation Processing**: Backend processes inline citations for grounded responses
- **Reference Management**: Structured reference data with clickable links
- **UI Enhancements**: Search toggle button and grounding indicators

### Grounding Implementation Details
- **Backend URL Detection**: `r'https?://[^\s<>"{}|\\^`\[\]]+[^\s<>"{}|\\^`\[\].,;:!?)]'`
- **Tool Configuration**: Automatically adds `google_search` and `url_context` tools
- **Citation Insertion**: Server-side processing of grounding supports with reference indices
- **Data Models**: Extended with `Reference`, `GroundingSupport` models for metadata
- **SSE Integration**: Real-time streaming includes grounding metadata in final event

### End-to-End Encryption Implementation Details
- **Algorithm**: AES-256-GCM with SHA256 key derivation
- **Key Source**: Pure server-side secret from `AES_KEY_HASH` environment variable
- **Key Security**: No JWT tokens or client data involved in encryption
- **Payload Structure**: `{"encrypted_data": "base64(nonce + ciphertext)"}`
- **Protected Endpoints**: Chat and conversation APIs (requests and responses)
- **SSE Handling**: All streaming chunks and final metadata fully encrypted
- **Frontend Integration**: Client-side AES-GCM encryption/decryption service
- **Key Derivation**: SHA256 hash of server secret for symmetric encryption
- **Error Handling**: Comprehensive encryption-specific error codes
- **Security**: No fallback to unencrypted channels, complete E2E encryption

### Backend Architecture
```
backend/
├── main.py                           # FastAPI app with security middleware
├── config.py                         # Environment variables configuration
├── models.py                         # Pydantic models for API requests/responses
├── services/
│   ├── auth_service.py               # JWT token management and user auth
│   ├── firestore_service.py          # Database operations
│   ├── gemini_service.py             # AI chat integration
│   └── encryption_service.py         # AES-GCM encryption operations
├── middleware/
│   ├── auth_middleware.py            # JWT authentication dependency
│   ├── security_middleware.py        # Rate limiting and security headers
│   └── encryption_middleware.py      # AES-GCM encryption for protected endpoints
├── routers/
│   ├── auth.py                       # Authentication endpoints (/auth/*)
│   ├── chat.py                       # Chat endpoints with auth protection
│   ├── conversations.py              # Conversation CRUD with auth protection
│   └── models.py                     # Model discovery endpoint (/api/models/)
└── requirements.txt                  # Updated with JWT dependencies
```

### Frontend Architecture
```
frontend/src/
├── App.tsx                           # Main app with AuthProvider and ProtectedRoute
├── contexts/
│   ├── AuthContext.tsx               # Global authentication state management
│   └── ThemeContext.tsx              # Dark/light theme switching
├── components/
│   ├── Login.tsx                     # Authentication form component
│   ├── ProtectedRoute.tsx            # Route protection wrapper
│   ├── ModelSelector.tsx             # Dynamic model selection dropdown
│   ├── ChatInput.tsx                 # Message input with search toggle
│   ├── ChatMessage.tsx               # Message display with grounding indicators
│   ├── References.tsx                # Citation and reference display
│   ├── ConversationSidebar.tsx       # Conversation management UI
│   ├── EditableTitle.tsx             # In-place conversation title editing
│   └── ThemeToggle.tsx               # Theme switching component
├── services/
│   ├── api.ts                        # API client with JWT token management
│   └── modelsCache.ts                # Intelligent model caching service
└── types/
    └── index.ts                      # TypeScript interfaces
```

### Key Features Implemented
- **🔐 JWT Authentication**: Access (30min) and refresh tokens (7 days)
- **🛡️ Security Middleware**: Rate limiting, CORS, CSP headers, XSS protection
- **🌐 Protected Routes**: All chat and conversation endpoints require authentication
- **⚡ Auto Token Refresh**: Background token renewal every 25 minutes
- **📱 Responsive Login UI**: Beautiful authentication form with error handling
- **🔄 State Management**: React Context for global authentication state
- **🚪 Clean Logout**: Token cleanup and UI reset on logout
- **🤖 Dynamic Model Selection**: 42+ Gemini models with intelligent caching
- **🔍 Google Search Grounding**: Web search integration with result citations
- **🌐 URL Context Detection**: Automatic URL detection and web page grounding
- **📋 Enhanced Copy**: Full conversation copy including references and metadata
- **🎯 Inline Citations**: Automatic citation insertion in AI responses
- **📚 Reference Display**: Clickable source references with proper attribution
- **🔒 End-to-End Encryption**: AES-256-GCM encryption for chat and conversation endpoints

### Default Credentials (Development)
- **Username**: `admin`
- **Password**: `secret123`
- **Password Hash**: `ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f`

### Testing Coverage
- Unit tests for authentication service and JWT handling
- Integration tests for all auth endpoints and protected routes
- E2E tests for complete login/logout user flow
- Load tests with authenticated user sessions

### Deployment Ready ✅
- Updated app.yaml with authentication environment variables
- Security headers and rate limiting configured
- Production-ready JWT token management
- Comprehensive error handling and logging
- **DEPLOYED TO PRODUCTION:** Live on Google App Engine

---

## 🎉 PROJECT COMPLETION SUMMARY

This ChatAI-GCP project has been **successfully completed** and deployed to production:

### ✅ **All 4 Phases Complete:**
1. **Phase 1:** Design and Documentation ✅
2. **Phase 2:** Core Chat Functionality ✅ 
3. **Phase 3:** Authentication & Security ✅
4. **Phase 4:** End-to-End Encryption ✅

### 🚀 **Production Deployment:**
- **Live URL:** Deployed on Google App Engine
- **Google App Engine:** Auto-scaling, SSL, monitoring
- **Security:** Military-grade AES-256-GCM encryption
- **Performance:** Real-time streaming with SSE

### 🛠️ **For Future Development:**
- All code is production-ready and fully documented
- Follow the existing architecture patterns
- Maintain the current security standards
- Use DEPLOYMENT.md for any redeployment needs

**This is a complete, secure, production-grade AI chat application.** 🎉

