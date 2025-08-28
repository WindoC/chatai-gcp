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

### POST /api/chat/
Start a new conversation with streaming response.

**Headers:** 
- `Authorization: Bearer <access_token>`
- `Accept: text/event-stream` (for SSE)

**Request Body:**
```json
{
  "message": "string",
  "enable_search": false,  // Enable Google Search grounding
  "model": "gemini-2.5-flash",  // Selected Gemini model (optional, defaults to gemini-2.5-flash)
}
```

**Response (200 - Server-Sent Events):**
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive

data: {"type": "conversation_start"}

data: {"type": "chunk", "content": "Hello"}

data: {"type": "chunk", "content": " there!"}

data: {"type": "done", "conversation_id": "uuid", "references": [...], "grounded": true}
```

**Error Responses:**
- `400`: Missing or invalid message
- `401`: Unauthorized

---

### POST /api/chat/{conversation_id}
Continue an existing conversation with streaming response.

**Headers:** 
- `Authorization: Bearer <access_token>`
- `Accept: text/event-stream`

**Request Body:**
```json
{
  "message": "string",
  "enable_search": false,  // Enable Google Search grounding
  "model": "gemini-2.5-flash",  // Selected Gemini model (optional)
}
```

**Response:** Same SSE format as `/chat`

**Error Responses:**
- `404`: Conversation not found
- `400`: Invalid message format

## 3. Models Endpoint

### GET /api/models/
Get list of available Gemini models that support generateContent.

**Headers:** `Authorization: Bearer <access_token>`

**Response (200):**
```json
[
  {
    "id": "models/gemini-2.5-flash",
    "name": "Gemini 2.5 Flash",
    "description": "Google Gemini 2.5 Flash model"
  },
  {
    "id": "models/gemini-2.5-pro", 
    "name": "Gemini 2.5 Pro",
    "description": "Google Gemini 2.5 Pro model"
  },
  {
    "id": "models/gemini-2.0-flash-exp",
    "name": "Gemini 2.0 Flash Exp", 
    "description": "Google Gemini 2.0 Flash Exp model"
  }
]
```

**Response Details:**
- Returns 42+ available models that support `generateContent`
- Models are sorted alphabetically by name
- Includes experimental, preview, and stable models
- Falls back to default models if Google AI API is unavailable

**Error Responses:**
- `401`: Unauthorized
- `500`: Failed to fetch models from Google AI API

---

## 4. Conversation Management

### GET /api/conversations/
List all conversations for the user.

**Headers:** `Authorization: Bearer <access_token>`

**Query Parameters:**
- `limit` (optional): Number of conversations to return (default: 50)
- `offset` (optional): Offset for pagination (default: 0)
- `starred` (optional): Filter by starred status (true/false)

**Response (200):**
```json
{
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
```

---

### GET /api/conversations/{conversation_id}
Get full conversation with all messages.

**Headers:** `Authorization: Bearer <access_token>`

**Response (200):**
```json
{
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
      "created_at": "2024-01-15T10:30:05Z",
      "references": [...],
      "grounded": true
    }
  ]
}
```

**Error Responses:**
- `404`: Conversation not found

---

### POST /api/conversations/{conversation_id}/star
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

### PATCH /api/conversations/{conversation_id}/title
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

### DELETE /api/conversations/{conversation_id}
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

### DELETE /api/conversations/nonstarred
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

## 5. Utility Endpoints

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

### GET /auth/me
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