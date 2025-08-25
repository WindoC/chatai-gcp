# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a secure AI chat web application with the following architecture:

- **Frontend**: React + TailwindCSS with Server-Sent Events (SSE) for streaming
- **Backend**: FastAPI (Python 3.13) 
- **AI Integration**: Google Gemini (google-genai)
- **Database**: Firestore Native
- **Authentication**: JWT with single-user mode
- **Deployment**: Google App Engine Standard

## Key Architecture Decisions

### Authentication Flow
- Single predefined user with credentials from environment variables
- JWT tokens (access + refresh) stored in LocalStorage
- Username/password validated against environment variables with SHA256 hashing

### Chat Implementation
- Real-time streaming via Server-Sent Events (SSE)
- Markdown rendering for AI responses
- Conversation history stored in Firestore without auto-expiration
- Bulk operations for non-starred conversations

### Data Model
Conversations in Firestore follow this structure:
```json
{
  "conversation_id": "uuid",
  "messages": [
    { "role": "user|ai", "content": "text", "created_at": "timestamp" }
  ],
  "created_at": "timestamp",
  "last_updated": "timestamp", 
  "starred": false
}
```

### API Endpoints Structure
- `/auth/*` - Authentication (login, refresh, logout)
- `/chat` - New conversations with streaming
- `/chat/{conversation_id}` - Continue existing conversations
- `/conversations` - CRUD operations and bulk delete

## Development Phases

This project follows a 4-phase development approach:

### Phase 1: Design and Documentation ✅
- Complete design documents (DESIGN.md, API.md, PLAN.md)
- Project structure and architecture planning
- Git repository setup with proper documentation

### Phase 2: Core Logic, API and Basic Chat (No Auth)
- FastAPI backend with Gemini API integration
- React frontend with streaming chat interface
- Basic Firestore conversation storage
- No authentication required for this phase

### Phase 3: Authentication and Conversation Management
- JWT-based single-user authentication system
- Complete conversation CRUD operations
- Conversation history, starring, and bulk delete
- Protected API endpoints with middleware

### Phase 4: End-to-End AES Encryption
- Web Crypto API implementation on frontend
- Python cryptography on backend
- Zero-knowledge encryption where server never sees plaintext
- AES-256-GCM with random IV per message

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

### Phase 3 Security Implementation
- Environment-based credentials (USERNAME, PASSWORD_HASH)
- JWT access (30min) and refresh tokens (7 days)
- Rate limiting on authentication endpoints
- CORS and security headers configuration

### Phase 4 Encryption Details
- AES-256-GCM encryption with Web Crypto API
- PBKDF2 key derivation from user passphrase
- SHA256 key validation between frontend/backend
- Base64 transport encoding for encrypted payloads

## Environment Variables

Key environment variables will include:
- `USERNAME` - Single user login
- `PASSWORD_HASH` - SHA256 hash of user password
- `JWT_SECRET_KEY` - JWT signing secret
- `GOOGLE_API_KEY` - Gemini API key
- `AES_KEY_HASH` - For Phase 2 encryption (optional)