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

## Development Commands

Since this project hasn't been implemented yet, typical commands would be:

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

## Future Phase 2 Features

The codebase is planned to support end-to-end AES encryption:
- Frontend: Web Crypto API with AES-GCM
- Backend: Python cryptography library
- AES key management via environment variables and LocalStorage

## Environment Variables

Key environment variables will include:
- `USERNAME` - Single user login
- `PASSWORD_HASH` - SHA256 hash of user password
- `JWT_SECRET_KEY` - JWT signing secret
- `GOOGLE_API_KEY` - Gemini API key
- `AES_KEY_HASH` - For Phase 2 encryption (optional)