# Product Requirements Document (PRD)

## 1. Overview

This project is a **secure AI chat web application** that allows a **single predefined user** to interact with Google Gemini (`google-genai`) via a web frontend.

The platform includes:

* **Streaming chat (SSE)**
* **Markdown rendering**
* **Single-user authentication via JWT**
* **Conversation history with manual management** (no auto-expiration)
* **Bulk delete of non-starred conversations**
* **UI inspired by OpenAI ChatGPT**
* **Optional end-to-end AES encryption (Phase 2)**

Deployment is on **Google App Engine Standard (Python 3.13)** with **Firestore Native** as the database.

---

## 2. Goals

* Deliver a **fast, simple, secure AI chat interface**.
* Support **single-user mode** with credentials from environment variables.
* Provide **streaming AI responses** with markdown rendering.
* Allow user to **manually manage conversation history** (delete one or bulk delete non-starred).
* Phase 2: Add **AES end-to-end encryption** for sensitive conversations.

---

## 3. Features & Requirements

### 3.1 Functional Requirements

#### Chat Interface

* Real-time **streaming responses** using **Server-Sent Events (SSE)**.
* **Markdown rendering** for AI output (code blocks, tables, formatting).
* **Gemini AI only**, with configuration from environment variables.

#### Conversation History

* Stored in **Firestore Native**.
* **No auto-expiration** of conversations.
* User can:

  * View the list of saved conversations.
  * Open a previous conversation.
  * Continue chatting in the existing conversation (messages appended).
  * Delete a conversation manually.
  * Bulk delete: **“Delete all non-starred conversations.”**

#### Authentication (Phase 1)

* **Single-user mode**:

  * Username and SHA256-hashed password stored in **environment variables**.
  * Login issues JWT (`access_token`, `refresh_token`) stored in LocalStorage.
* No multi-user or role management.

#### End-to-End AES Encryption (Phase 2)

* **Frontend (Web Crypto API):**

  * User enters AES key on first use.
  * SHA256 hash stored in LocalStorage.
  * Auto re-prompt if decryption fails.
  * AES-GCM encryption with random IV.
  * Payloads base64 encoded.
* **Backend (Python cryptography):**

  * AES key SHA256 hash validated against environment variable.
  * AES-GCM decryption of incoming payloads.
  * Encrypted responses for protected endpoints.
  * Errors: HTTP 400 (missing encryption) / 501 (not implemented).

---

### 3.2 Non-Functional Requirements

* **Performance:** SSE must start streaming within <1s.
* **Scalability:** Supports autoscaling (0–1 instances).
* **Security:**

  * Single-user login with environment-protected credentials.
  * JWT-based session management.
  * AES end-to-end encryption (Phase 2).
  * HTTPS enforced, CORS restricted.
* **Data Privacy:** Conversations encrypted in transit (TLS, AES in Phase 2).
* **Availability:** ≥99.5% uptime.

---

## 4. Technical Specifications

### 4.1 Tech Stack

* **Frontend:** React + TailwindCSS, SSE, `react-markdown`, Web Crypto API (Phase 2)
* **Backend:** FastAPI (Python 3.13)
* **AI API:** Google Gemini (`google-genai`)
* **Database:** Firestore (Native mode)
* **Auth:** JWT (Access + Refresh tokens, stored in LocalStorage)
* **Encryption:** AES-GCM (Phase 2)

---

### 4.2 Authentication Flow (Single-User, JWT)

#### Flow

1. **Login** → User enters username/password (checked against env vars).
2. **Tokens issued:**

   * `access_token` (\~15–30 min).
   * `refresh_token` (\~7–30 days).
     Both stored in LocalStorage.
3. **Access Token Usage** → Sent via `Authorization: Bearer <access_token>`.
4. **Refresh Token** → Used with `/auth/refresh` to renew access token.
5. **Logout** → Tokens cleared from LocalStorage.

---

### 4.3 Data Model (Firestore)

**Conversations Collection**

```json
{
  "conversation_id": "uuid",
  "messages": [
    { "role": "user", "content": "Hello", "created_at": "timestamp" },
    { "role": "ai", "content": "Hi!", "created_at": "timestamp" }
  ],
  "created_at": "timestamp",
  "last_updated": "timestamp",
  "starred": false
}
```

---

### 4.4 API Endpoints

#### Authentication

* `POST /auth/login` → Login, returns `{ access_token, refresh_token }`
* `POST /auth/refresh` → Renew access token
* `POST /auth/logout` → Revoke refresh token

#### Chat

* `POST /chat` → Start new conversation, stream response via SSE
* `POST /chat/{conversation_id}` → Continue an existing conversation, stream response via SSE

#### Conversations

* `GET /conversations` → List conversations
* `GET /conversations/{id}` → Get full conversation
* `POST /conversations/{id}/star` → Star a conversation
* `DELETE /conversations/{id}` → Delete a conversation
* `DELETE /conversations/nonstarred` → Bulk delete all non-starred conversations

---

## 5. UI/UX Design (Reference: ChatGPT UI)

The UI should follow a **familiar chat layout inspired by OpenAI’s ChatGPT**:

* **Left Sidebar:**

  * List of conversations (sorted by `last_updated`).
  * “New Chat” button at the top.
  * Starred conversations pinned at the top.
  * Option: “Delete all non-starred conversations.”

* **Top Bar:**

  * App title/logo (e.g., “AI Chat”).
  * Settings icon (for AES key input in Phase 2).
  * Logout button.

* **Main Chat Window:**

  * Scrollable list of messages (user vs AI).
  * AI messages rendered with **Markdown** (code highlighting, tables, formatting).
  * User input box at the bottom (multiline, with Enter=send, Shift+Enter=new line).
  * “Regenerate response” option for the last AI message.

* **Mobile View:**

  * Sidebar collapses into a hamburger menu.
  * Chat window remains primary focus.

---

## 6. Future Enhancements

* Multi-user authentication (OAuth2, email/password).
* MFA (multi-factor authentication).
* Export conversations (Markdown, PDF).
* Usage dashboard (token & cost tracking).
* Teams & shared conversations.

