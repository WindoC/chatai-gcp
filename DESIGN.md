# Design Document - ChatAI-GCP

## 1. System Architecture

### 1.1 High-Level Architecture (Phase 4: With End-to-End Encryption)

```
┌─────────────────────────┐    HTTPS/TLS    ┌──────────────────────────┐
│   React Client          │ ←──────────────→ │  FastAPI Backend         │
│   + TailwindCSS         │  🔐 AES-256-GCM  │  (Python 3.13)          │
│   + Web Crypto API      │                  │  + Cryptography         │
└─────────────────────────┘                  └──────────────────────────┘
         │                                              │
         │ LocalStorage                                │ 
         │ (JWT, AES Key Hash)                        │
         │ 🔐 Zero-Knowledge                           ▼
         │                                   ┌─────────────────────┐
         │                                   │   Firestore         │
         │                                   │   (Native)          │
         │                                   │   🔐 Encrypted      │
         │                                   │   Conversation      │
         │                                   │   Storage           │
         │                                   └─────────────────────┘
         │                                              │
         └──────────────────────────────────────────────┼─────────────────┐
                                                       │                 │
                                                       ▼                 ▼
                                             ┌─────────────────┐ ┌──────────────┐
                                             │  Google Gemini  │ │ Google App   │
                                             │      API        │ │   Engine     │
                                             │  (Processes     │ │              │
                                             │   Plaintext)    │ │              │
                                             └─────────────────┘ └──────────────┘
```

**🔐 Encryption Flow:**
- **Client**: Encrypts messages with AES-256-GCM before transmission
- **Transport**: Double encryption (TLS + AES) for maximum security  
- **Server**: Temporarily decrypts for AI processing, encrypts responses
- **Storage**: All conversation history stored encrypted in Firestore
- **Zero-Knowledge**: Server validates key hashes but never stores plaintext

### 1.2 Component Breakdown

#### Frontend Components
- **Chat Interface**: Message display, input handling, streaming
- **Conversation Sidebar**: History, starring, bulk operations
- **Authentication**: Login form, JWT management
- **Encryption Settings**: AES key setup and management modal
- **Encryption Status**: Visual encryption state indicator
- **Markdown Renderer**: Code highlighting, table support

#### Backend Services
- **Authentication Service**: JWT handling, single-user validation
- **Chat Service**: Gemini API integration, SSE streaming
- **Conversation Service**: Firestore CRUD operations
- **Encryption Service**: AES-GCM encryption/decryption with zero-knowledge validation

## 2. Data Flow

### 2.1 Authentication Flow
```
1. User Login → Validate against env vars → Generate JWT tokens
2. Store tokens in LocalStorage (access_token, refresh_token)
3. Include access_token in Authorization header for all API calls
4. Auto-refresh using refresh_token when access_token expires
```

### 2.2 Chat Flow (With End-to-End Encryption)
```
1. User sends message → Frontend encrypts with AES-256-GCM → POST /chat
2. Backend validates JWT + Key Hash → Decrypts message → Call Gemini API  
3. Stream response via SSE → Backend encrypts chunks → Frontend decrypts → Render markdown
4. Save encrypted conversation to Firestore → Update UI with conversation ID
```

**🔐 Encryption Details:**
- **Step 1**: Web Crypto API encrypts message with random IV
- **Step 2**: Server validates SHA256 key hash, decrypts for AI processing  
- **Step 3**: Each streaming chunk encrypted individually for real-time decryption
- **Step 4**: Conversation stored encrypted, only accessible with correct key

### 2.3 Conversation Management Flow (With Encryption)
```
1. Load conversations → GET /conversations → Display in sidebar
2. Select conversation → GET /conversations/{id} + X-Key-Hash → Decrypt & load history  
3. Continue chat → POST /chat/{id} → Encrypt & append new messages
4. Star/unstar → POST /conversations/{id}/star → Update UI
5. Delete → DELETE /conversations/{id} → Remove from sidebar
6. Bulk delete → DELETE /conversations/nonstarred → Refresh sidebar
```

**🔐 Encryption Details:**
- **Step 2**: X-Key-Hash header enables server-side decryption of conversation history
- **Step 3**: New messages encrypted before appending to existing conversation
- **All Operations**: Maintain encryption consistency across conversation lifecycle

## 3. Database Schema

### 3.1 Firestore Collections

#### Conversations Collection (Phase 4: With Encryption)
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
  content: string | EncryptedContent;  // Encrypted with AES-256-GCM
  created_at: Timestamp;
  message_id?: string;           // For message-level operations
}

interface EncryptedContent {
  content: string;               // Base64 encoded: IV + ciphertext + auth tag  
  encrypted: boolean;            // Always true for encrypted messages
  key_hash: string;             // SHA256 hash for key validation
}
```

**🔐 Storage Security:**
- **Zero-Knowledge**: Server never stores plaintext messages
- **AES-256-GCM**: Authenticated encryption prevents tampering
- **Random IVs**: Each message uses unique initialization vector
- **Key Isolation**: Only key hashes stored for validation

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

### 4.3 End-to-End Encryption (Phase 4: IMPLEMENTED ✅)
```
Frontend (Web Crypto API):
- AES-256-GCM encryption with cryptographically secure random IVs
- PBKDF2 key derivation (100,000 iterations) from user passphrase  
- Base64 encoding: IV (12 bytes) + ciphertext + authentication tag
- Local key storage with automatic cleanup on logout

Backend (Python cryptography):  
- SHA256 key hash validation (server never sees actual keys)
- Temporary decryption for AI processing only
- Real-time encryption of streaming responses  
- Zero-knowledge architecture with secure error handling
```

**🔐 Cryptographic Specifications:**
- **Algorithm**: AES-256-GCM (AEAD - Authenticated Encryption with Associated Data)
- **Key Size**: 256 bits (32 bytes)
- **IV Size**: 96 bits (12 bytes) - optimal for GCM mode
- **Key Derivation**: PBKDF2-SHA256 with 100,000 iterations
- **Authentication**: 128-bit authentication tag prevents tampering
- **Encoding**: Base64 for safe transport over HTTP/JSON

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

### 5.3 Streaming Implementation
```python
async def stream_chat_response():
    async for chunk in gemini_client.generate_content_stream():
        yield f"data: {json.dumps({'content': chunk.text})}\n\n"
    yield f"data: {json.dumps({'done': True})}\n\n"
```

## 6. Error Handling

### 6.1 Frontend Error States
- Network connectivity issues
- Authentication failures
- Encryption/decryption errors (Phase 4)
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

# Phase 4: End-to-End Encryption (IMPLEMENTED ✅)
AES_KEY_HASH=sha256_of_user_passphrase
ENCRYPTION_ENABLED=true
```

### 8.3 Build and Deployment
- Frontend built with Vite/Create React App
- Backend packaged with pip requirements
- Static files served from App Engine
- Health checks at `/health` endpoint