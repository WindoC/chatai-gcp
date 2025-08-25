# API Specification - ChatAI-GCP

## Base URL
```
Development: http://localhost:8000
Production: https://your-app.appspot.com
```

## Authentication
All protected endpoints require JWT token in Authorization header:
```
Authorization: Bearer <access_token>
```

## Common Response Format

### Success Response
```json
{
  "success": true,
  "data": {...},
  "message": "Optional success message"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": "Optional additional details"
  }
}
```

## 1. Authentication Endpoints

### POST /auth/login
Login with username and password.

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "access_token": "jwt_token_string",
    "refresh_token": "jwt_refresh_token_string",
    "token_type": "bearer",
    "expires_in": 1800
  }
}
```

**Error Responses:**
- `401`: Invalid credentials
- `429`: Too many login attempts

---

### POST /auth/refresh
Refresh access token using refresh token.

**Request Body:**
```json
{
  "refresh_token": "string"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "access_token": "new_jwt_token_string",
    "token_type": "bearer",
    "expires_in": 1800
  }
}
```

**Error Responses:**
- `401`: Invalid or expired refresh token

---

### POST /auth/logout
Revoke refresh token (logout).

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**
```json
{
  "refresh_token": "string"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

## 2. Chat Endpoints

### POST /chat
Start a new conversation with streaming response.

**Headers:** 
- `Authorization: Bearer <access_token>`
- `Accept: text/event-stream` (for SSE)

**Request Body:**
```json
{
  "message": "string",
  "encrypted": false  // Phase 4: true if message is encrypted
}
```

**Response (200 - Server-Sent Events):**
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

data: {"type": "conversation_id", "conversation_id": "uuid"}

data: {"type": "chunk", "content": "Hello"}

data: {"type": "chunk", "content": " there!"}

data: {"type": "done", "conversation_id": "uuid"}
```

**Error Responses:**
- `400`: Missing or invalid message
- `401`: Unauthorized
- `501`: Encryption required but not provided (Phase 4)

---

### POST /chat/{conversation_id}
Continue an existing conversation with streaming response.

**Headers:** 
- `Authorization: Bearer <access_token>`
- `Accept: text/event-stream`

**Request Body:**
```json
{
  "message": "string",
  "encrypted": false  // Phase 4
}
```

**Response:** Same SSE format as `/chat`

**Error Responses:**
- `404`: Conversation not found
- `400`: Invalid message format
- `501`: Encryption required but not provided (Phase 4)

## 3. Conversation Management

### GET /conversations
List all conversations for the user.

**Headers:** `Authorization: Bearer <access_token>`

**Query Parameters:**
- `limit` (optional): Number of conversations to return (default: 50)
- `offset` (optional): Offset for pagination (default: 0)
- `starred` (optional): Filter by starred status (true/false)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "conversations": [
      {
        "conversation_id": "uuid",
        "title": "Auto-generated title from first message",
        "created_at": "2024-01-15T10:30:00Z",
        "last_updated": "2024-01-15T11:45:00Z",
        "starred": false,
        "message_count": 6,
        "preview": "Last message preview..."
      }
    ],
    "total": 42,
    "has_more": true
  }
}
```

---

### GET /conversations/{conversation_id}
Get full conversation with all messages.

**Headers:** `Authorization: Bearer <access_token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "conversation_id": "uuid",
    "title": "Conversation title",
    "created_at": "2024-01-15T10:30:00Z",
    "last_updated": "2024-01-15T11:45:00Z",
    "starred": false,
    "messages": [
      {
        "message_id": "uuid",
        "role": "user",
        "content": "Hello, how are you?",
        "created_at": "2024-01-15T10:30:00Z"
      },
      {
        "message_id": "uuid",
        "role": "ai",
        "content": "I'm doing well, thank you!",
        "created_at": "2024-01-15T10:30:05Z"
      }
    ]
  }
}
```

**Error Responses:**
- `404`: Conversation not found

---

### POST /conversations/{conversation_id}/star
Toggle star status of a conversation.

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**
```json
{
  "starred": true
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "conversation_id": "uuid",
    "starred": true
  }
}
```

---

### PUT /conversations/{conversation_id}/title
Update conversation title.

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**
```json
{
  "title": "New conversation title"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "conversation_id": "uuid",
    "title": "New conversation title"
  }
}
```

---

### DELETE /conversations/{conversation_id}
Delete a specific conversation.

**Headers:** `Authorization: Bearer <access_token>`

**Response (200):**
```json
{
  "success": true,
  "message": "Conversation deleted successfully"
}
```

---

### DELETE /conversations/nonstarred
Bulk delete all non-starred conversations.

**Headers:** `Authorization: Bearer <access_token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "deleted_count": 15
  },
  "message": "Deleted 15 non-starred conversations"
}
```

## 4. Utility Endpoints

### GET /health
Health check endpoint (no authentication required).

**Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0"
}
```

---

### GET /me
Get current user information.

**Headers:** `Authorization: Bearer <access_token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "username": "admin",
    "login_time": "2024-01-15T10:00:00Z",
    "token_expires": "2024-01-15T10:30:00Z"
  }
}
```

## 5. Phase 4: Encryption Endpoints

### POST /encryption/validate
Validate AES key hash (Phase 4 only).

**Headers:** `Authorization: Bearer <access_token>`

**Request Body:**
```json
{
  "key_hash": "sha256_hash_of_aes_key"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "valid": true
  }
}
```

## Error Codes

### Authentication Errors
- `AUTH_INVALID_CREDENTIALS`: Invalid username or password
- `AUTH_TOKEN_EXPIRED`: JWT token has expired
- `AUTH_TOKEN_INVALID`: JWT token is malformed or invalid
- `AUTH_REFRESH_REQUIRED`: Access token expired, refresh required
- `AUTH_RATE_LIMITED`: Too many authentication attempts

### Chat Errors
- `CHAT_MESSAGE_EMPTY`: Message content is empty
- `CHAT_MESSAGE_TOO_LONG`: Message exceeds maximum length
- `CHAT_API_ERROR`: Error calling Gemini API
- `CHAT_STREAM_ERROR`: Error during streaming response
- `CHAT_ENCRYPTION_REQUIRED`: Encryption enabled but message not encrypted
- `CHAT_DECRYPTION_FAILED`: Failed to decrypt message

### Conversation Errors
- `CONV_NOT_FOUND`: Conversation does not exist
- `CONV_ACCESS_DENIED`: User does not have access to conversation
- `CONV_DELETE_FAILED`: Failed to delete conversation
- `CONV_UPDATE_FAILED`: Failed to update conversation

### General Errors
- `VALIDATION_ERROR`: Request validation failed
- `INTERNAL_ERROR`: Internal server error
- `RATE_LIMITED`: Request rate limit exceeded
- `SERVICE_UNAVAILABLE`: Service temporarily unavailable

## Rate Limits

- Authentication endpoints: 10 requests per minute
- Chat endpoints: 30 requests per minute
- Conversation management: 100 requests per minute
- Other endpoints: 200 requests per minute

Rate limit headers included in responses:
```
X-RateLimit-Limit: 30
X-RateLimit-Remaining: 29
X-RateLimit-Reset: 1642234800
```