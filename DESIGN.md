# Design Document - ChatAI-GCP

## 1. System Architecture

### 1.1 High-Level Architecture

```
┌─────────────────┐    HTTPS/WSS     ┌──────────────────┐
│   React Client  │ ←────────────── │  FastAPI Backend │
│   + TailwindCSS │                  │  (Python 3.13)  │
└─────────────────┘                  └──────────────────┘
         │                                     │
         │ LocalStorage                       │ 
         │ (JWT, AES Key)                     │
         │                                     ▼
         │                           ┌─────────────────┐
         │                           │   Firestore     │
         │                           │   (Native)      │
         │                           └─────────────────┘
         │                                     │
         └─────────────────────────────────────┼─────────────────┐
                                              │                 │
                                              ▼                 ▼
                                    ┌─────────────────┐ ┌──────────────┐
                                    │  Google Gemini  │ │ Google App   │
                                    │      API        │ │   Engine     │
                                    └─────────────────┘ └──────────────┘
```

### 1.2 Component Breakdown

#### Frontend Components
- **Chat Interface**: Message display, input handling, streaming
- **Conversation Sidebar**: History, starring, bulk operations
- **Authentication**: Login form, JWT management
- **Settings Panel**: AES key management
- **Markdown Renderer**: Code highlighting, table support

#### Backend Services
- **Authentication Service**: JWT handling, single-user validation
- **Chat Service**: Gemini API integration, SSE streaming
- **Conversation Service**: Firestore CRUD operations
- **Encryption Service**: AES-GCM encryption/decryption

## 2. Data Flow

### 2.1 Authentication Flow
```
1. User Login → Validate against env vars → Generate JWT tokens
2. Store tokens in LocalStorage (access_token, refresh_token)
3. Include access_token in Authorization header for all API calls
4. Auto-refresh using refresh_token when access_token expires
```

### 2.2 Chat Flow (Fully Encrypted)
```
1. User sends message → Frontend encrypts → POST /chat with encrypted payload
2. Backend validates JWT → Decrypts message → Call Gemini API
3. Stream encrypted chunks via SSE → Frontend decrypts in real-time → Render markdown
4. Save conversation to Firestore → Update UI with conversation ID
```

### 2.3 Conversation Management Flow
```
1. Load conversations → GET /conversations → Display in sidebar
2. Select conversation → GET /conversations/{id} → Load chat history
3. Continue chat → POST /chat/{id} → Append new messages
4. Star/unstar → POST /conversations/{id}/star → Update UI
5. Delete → DELETE /conversations/{id} → Remove from sidebar
6. Bulk delete → DELETE /conversations/nonstarred → Refresh sidebar
```

## 3. Database Schema

### 3.1 Firestore Collections

#### Conversations Collection
```typescript
interface Conversation {
  conversation_id: string;        // UUID
  messages: Message[];
  created_at: Timestamp;
  last_updated: Timestamp;
  starred: boolean;
  title?: string;                 // Auto-generated from first message
}

interface Message {
  role: 'user' | 'ai';
  content: string;               // Encrypted in Phase 4
  created_at: Timestamp;
  message_id?: string;           // For message-level operations
}
```

### 3.2 Indexing Strategy
- Primary: `last_updated DESC` for conversation listing
- Secondary: `starred = true, last_updated DESC` for starred conversations
- Composite: `starred = false` for bulk delete operations

## 4. Security Design

### 4.1 Authentication Security
- Single-user credentials stored as environment variables
- Password hashed with SHA256 before comparison
- JWT tokens with short expiration (access: 30min, refresh: 7 days)
- No persistent sessions on server side

### 4.2 Transport Security
- HTTPS enforced for all communications
- CORS restricted to specific origins
- CSP headers for XSS protection
- Rate limiting on authentication endpoints

### 4.3 End-to-End Encryption (Phase 4) ✅
```
Frontend (Web Crypto API):
- AES-256-GCM encryption with 12-byte nonce
- SHA256 key derivation from server secret (matches backend)
- Nonce and encrypted data transmitted as base64
- Real-time decryption of SSE streaming chunks

Backend (Python cryptography):
- Pure server-side key management from AES_KEY_HASH
- SHA256 key derivation for symmetric encryption
- All chat content encrypted (streaming chunks + metadata)
- Middleware encryption for protected endpoints
- Content-Length header fixes for encrypted responses

Security Features:
- No client key material or JWT involvement
- Complete streaming encryption (all chunks)
- No fallback to unencrypted channels
- Server-side only encryption key management
```

## 5. Performance Considerations

### 5.1 Frontend Optimization
- Code splitting for authentication vs chat components
- Virtual scrolling for long conversation lists
- Debounced auto-save for drafts
- Efficient re-rendering with React.memo

### 5.2 Backend Optimization
- Connection pooling for Firestore
- Response compression (gzip)
- Efficient SSE implementation with async generators
- Caching of conversation metadata

### 5.3 Encrypted Streaming Implementation
```python
async def stream_chat_response(message: str, encryption_key: str):
    complete_response = await gemini_client.generate_content(message)
    
    # Stream encrypted chunks
    chunk_size = 50
    for i in range(0, len(complete_response), chunk_size):
        chunk = complete_response[i:i + chunk_size]
        encrypted_chunk = EncryptionService.encrypt_response({'content': chunk}, encryption_key)
        yield f"data: {json.dumps({'type': 'encrypted_chunk', 'encrypted_data': encrypted_chunk['encrypted_data']})}\n\n"
    
    # Send encrypted final metadata
    final_data = {'type': 'done', 'conversation_id': conv_id, 'references': refs}
    encrypted_final = EncryptionService.encrypt_response(final_data, encryption_key)
    yield f"data: {json.dumps({'type': 'encrypted_done', 'encrypted_data': encrypted_final['encrypted_data']})}\n\n"
```

## 6. Error Handling

### 6.1 Frontend Error States
- Network connectivity issues
- Authentication failures
- Encryption/decryption errors
- Streaming interruptions
- Markdown rendering errors

### 6.2 Backend Error Responses
- 400: Bad Request (malformed data, missing encryption)
- 401: Unauthorized (invalid/expired JWT)
- 403: Forbidden (insufficient permissions)
- 429: Rate Limited
- 500: Internal Server Error
- 501: Not Implemented (missing encryption in Phase 4)

### 6.3 Resilience Patterns
- Exponential backoff for API retries
- Circuit breaker for Gemini API failures
- Graceful degradation when encryption fails
- Auto-reconnection for SSE streams

## 7. UI/UX Design Principles

### 7.1 ChatGPT-Inspired Layout
- Left sidebar: Conversation history with search
- Main area: Chat messages with markdown rendering
- Bottom: Input area with send button and shortcuts
- Top bar: App branding, settings, logout

### 7.2 Responsive Design
- Mobile-first approach with collapsible sidebar
- Touch-friendly interaction targets
- Keyboard shortcuts for power users
- Accessibility compliance (WCAG 2.1)

### 7.3 Real-time Feedback
- Typing indicators during AI response
- Progress indicators for long operations
- Toast notifications for actions
- Loading states for all async operations

## 8. Deployment Architecture

### 8.1 Google App Engine Configuration
```yaml
runtime: python313
service: default
instance_class: F1
automatic_scaling:
  min_instances: 0
  max_instances: 1
  target_cpu_utilization: 0.6
```

### 8.2 Environment Variables
```bash
# Authentication
USERNAME=admin
PASSWORD_HASH=sha256_hash_here
JWT_SECRET_KEY=random_secret_key
JWT_ACCESS_EXPIRE_MINUTES=30
JWT_REFRESH_EXPIRE_DAYS=7

# Google Services
GOOGLE_API_KEY=gemini_api_key
GOOGLE_CLOUD_PROJECT=project_id
FIRESTORE_DATABASE=(default)

```

### 8.3 Build and Deployment
- Frontend built with Vite/Create React App
- Backend packaged with pip requirements
- Static files served from App Engine
- Health checks at `/health` endpoint