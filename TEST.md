# Test Environment Setup Guide - ChatAI-GCP

This guide covers setting up and maintaining a complete local test environment for developing and testing the ChatAI-GCP application.

## Quick Start

For immediate local testing:
```bash
# Clone and setup
git clone <repository-url>
cd chatai-gcp

# Backend setup
cd backend
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your API keys
uvicorn main:app --reload

# Frontend setup (new terminal)
cd frontend
npm install
npm start
```

## Complete Development Environment Setup

### Prerequisites

**Required Software:**
- Python 3.13+ with pip
- Node.js 18+ with npm
- Git
- Google Cloud SDK (optional, for Firestore emulator)
- Docker (optional, for containerized development)

**Required Accounts:**
- Google Cloud Project (for Firestore and Gemini API)
- Google Gemini API key

### Environment Setup Methods

Choose one of these approaches:

## Method 1: Local Development with Real Services

### 1.1 Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment (recommended)
python -m venv .venv

# Activate virtual environment
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Install development dependencies
pip install pytest-cov black isort flake8 mypy

# Create environment file
cp .env.example .env
```

### 1.2 Configure Environment Variables

Edit `backend/.env`:
```env
# Required - Get from Google AI Studio
GOOGLE_API_KEY=your_gemini_api_key_here

# Required - Your GCP project ID
GOOGLE_CLOUD_PROJECT=your_project_id

# Development settings
DEBUG=true
FIRESTORE_DATABASE=(default)

# REQUIRED for Phase 3 - Authentication
JWT_SECRET_KEY=your_local_jwt_secret_for_testing_generate_with_secrets_token_hex_32
JWT_ACCESS_EXPIRE_MINUTES=30
JWT_REFRESH_EXPIRE_DAYS=7
USERNAME=admin
PASSWORD_HASH=ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f  # "secret123"

# Rate limiting
AUTH_RATE_LIMIT=10
CHAT_RATE_LIMIT=30

```

### 1.3 Setup Google Cloud Authentication

```bash
# Install and authenticate with gcloud (for Firestore access)
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Set up application default credentials
gcloud auth application-default login
```

### 1.4 Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Install additional development tools
npm install --save-dev @types/node @testing-library/jest-dom

# Create environment file (optional)
echo "REACT_APP_API_URL=http://localhost:8000" > .env.local
```

## Method 2: Local Development with Emulators

### 2.1 Install Firebase CLI
```bash
# Install Firebase CLI for emulators
npm install -g firebase-tools

# Login to Firebase
firebase login
```

### 2.2 Initialize Firebase Project
```bash
# In project root
firebase init

# Select:
# - Firestore (configure rules and indexes)
# - Emulators (Firestore emulator)

# Choose existing project or create new one
# Use default settings for most prompts
```

### 2.3 Configure Firestore Emulator

Create `firebase.json`:
```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "emulators": {
    "firestore": {
      "port": 8080
    },
    "ui": {
      "enabled": true,
      "port": 4000
    }
  }
}
```

### 2.4 Create Firestore Rules

Create `firestore.rules`:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow all for local development
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

### 2.5 Start Emulators

```bash
# Start Firestore emulator
firebase emulators:start --only firestore

# View emulator UI at http://localhost:4000
```

### 2.6 Configure Backend for Emulator

Update `backend/.env`:
```env
# ... other variables ...

# For Firestore emulator
FIRESTORE_EMULATOR_HOST=localhost:8080
GOOGLE_CLOUD_PROJECT=demo-project-id
```

## Method 3: Docker Development Environment

### 3.1 Create Docker Compose

Create `docker-compose.dev.yml`:
```yaml
version: '3.8'

services:
  backend:
    build: 
      context: ./backend
      dockerfile: Dockerfile.dev
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app
    environment:
      - DEBUG=true
      - GOOGLE_API_KEY=${GOOGLE_API_KEY}
      - GOOGLE_CLOUD_PROJECT=${GOOGLE_CLOUD_PROJECT}
    depends_on:
      - firestore-emulator

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    environment:
      - REACT_APP_API_URL=http://localhost:8000

  firestore-emulator:
    image: google/cloud-sdk:alpine
    ports:
      - "8080:8080"
      - "4000:4000"
    command: >
      sh -c "
        gcloud components install cloud-firestore-emulator --quiet &&
        gcloud beta emulators firestore start --host-port=0.0.0.0:8080
      "
```

### 3.2 Create Development Dockerfiles

`backend/Dockerfile.dev`:
```dockerfile
FROM python:3.13-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
```

`frontend/Dockerfile.dev`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

CMD ["npm", "start"]
```

### 3.3 Start Docker Environment

```bash
# Create .env file in project root with your API keys
echo "GOOGLE_API_KEY=your_key_here" > .env
echo "GOOGLE_CLOUD_PROJECT=your_project_id" >> .env

# Start all services
docker-compose -f docker-compose.dev.yml up
```

## Running Tests

### Backend Tests

```bash
cd backend

# Run all tests
pytest

# Run with coverage
pytest --cov=. --cov-report=html

# Run specific test file
pytest tests/test_main.py

# Run with verbose output
pytest -v

# Run and watch for changes
pytest-watch
```

### Frontend Tests

```bash
cd frontend

# Run all tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run tests in watch mode (default)
npm test -- --watch

# Run specific test file
npm test -- ChatMessage.test.tsx

# Run all tests once (CI mode)
npm test -- --watchAll=false
```

### Integration Tests

Create `backend/tests/test_integration.py`:
```python
import pytest
from fastapi.testclient import TestClient
from main import app

@pytest.fixture
def client():
    return TestClient(app)

@pytest.fixture
def auth_headers(client):
    """Get authentication headers for testing"""
    # Login to get JWT token
    response = client.post("/auth/login", json={
        "username": "admin", 
        "password": "secret123"
    })
    assert response.status_code == 200
    tokens = response.json()
    return {"Authorization": f"Bearer {tokens['access_token']}"}

def test_authentication_flow(client):
    """Test complete authentication flow"""
    # Test login
    response = client.post("/auth/login", json={
        "username": "admin", 
        "password": "secret123"
    })
    assert response.status_code == 200
    tokens = response.json()
    assert "access_token" in tokens
    assert "refresh_token" in tokens
    
    # Test accessing protected endpoint
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}
    response = client.get("/auth/me", headers=headers)
    assert response.status_code == 200
    
    # Test token refresh
    response = client.post("/auth/refresh", json={
        "refresh_token": tokens["refresh_token"]
    })
    assert response.status_code == 200

def test_protected_endpoints_require_auth(client):
    """Test that protected endpoints require authentication"""
    # Test chat endpoint without auth
    response = client.post("/api/chat/", json={"message": "Hello"})
    assert response.status_code == 401
    
    # Test conversations endpoint without auth
    response = client.get("/api/conversations/")
    assert response.status_code == 401

def test_full_chat_flow_with_auth(client, auth_headers):
    """Test complete chat flow with authentication"""
    # Start new chat with auth
    response = client.post("/api/chat/", 
                          json={"message": "Hello"}, 
                          headers=auth_headers)
    assert response.status_code == 200
    
    # Verify conversations list with auth
    response = client.get("/api/conversations/", headers=auth_headers)
    assert response.status_code == 200
    conversations = response.json()["conversations"]
    assert len(conversations) >= 1
```

### End-to-End Tests with Playwright (Optional)

```bash
cd frontend

# Install Playwright
npm install --save-dev @playwright/test

# Install browsers
npx playwright install

# Create test
mkdir e2e
```

Create `frontend/e2e/auth.spec.ts`:
```typescript
import { test, expect } from '@playwright/test';

test('authentication flow', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // Should show login page
  await expect(page.locator('text=Welcome to Chat-AI')).toBeVisible();
  await expect(page.locator('text=Sign in to start chatting')).toBeVisible();
  
  // Login
  await page.fill('input[name="username"]', 'admin');
  await page.fill('input[name="password"]', 'secret123');
  await page.click('button[type="submit"]');
  
  // Should redirect to chat after login
  await expect(page.locator('text=New Chat')).toBeVisible();
  
  // Test logout
  await page.click('button[title="Logout"]');
  await expect(page.locator('text=Sign in to start chatting')).toBeVisible();
});

test('basic chat functionality with auth', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // Login first
  await page.fill('input[name="username"]', 'admin');
  await page.fill('input[name="password"]', 'secret123');
  await page.click('button[type="submit"]');
  
  // Wait for chat interface
  await expect(page.locator('text=New Chat')).toBeVisible();
  
  // Send a message
  await page.fill('textarea[placeholder="Type your message..."]', 'Hello');
  await page.click('button[type="submit"]');
  
  // Wait for response
  await expect(page.locator('text=Hello')).toBeVisible();
});

test('protected routes redirect to login', async ({ page }) => {
  // Try to access chat directly without login
  await page.goto('http://localhost:3000');
  
  // Should show login instead of chat
  await expect(page.locator('text=Sign in to start chatting')).toBeVisible();
  await expect(page.locator('text=New Chat')).not.toBeVisible();
});
```

## Test Data Management

### 1. Create Test Data

Create `backend/tests/fixtures.py`:
```python
import pytest
from models import Message, Conversation, MessageRole
from datetime import datetime

@pytest.fixture
def sample_conversation():
    return Conversation(
        conversation_id="test-conv-id",
        title="Test Conversation",
        messages=[
            Message(
                role=MessageRole.USER,
                content="Hello",
                created_at=datetime.utcnow()
            ),
            Message(
                role=MessageRole.AI,
                content="Hi there!",
                created_at=datetime.utcnow()
            )
        ],
        created_at=datetime.utcnow(),
        last_updated=datetime.utcnow(),
        starred=False
    )
```

### 2. Database Cleanup

Create `backend/tests/conftest.py`:
```python
import pytest
import asyncio
from services.firestore_service import firestore_service

@pytest.fixture(autouse=True)
async def cleanup_database():
    """Clean up test data after each test"""
    yield
    # Clean up test conversations
    # Only in test environment
    if "test" in os.getenv("GOOGLE_CLOUD_PROJECT", ""):
        # Clean up logic here
        pass
```

## Development Workflow

### 1. Daily Development

```bash
# Start backend (terminal 1)
cd backend
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
uvicorn main:app --reload

# Start frontend (terminal 2)
cd frontend
npm start

# Run tests (terminal 3)
cd backend
pytest --watch
```

### 2. Code Quality Checks

```bash
# Backend code quality
cd backend
black .              # Format code
isort .              # Sort imports
flake8 .             # Lint code
mypy .               # Type checking

# Frontend code quality
cd frontend
npm run lint         # ESLint
npm run format       # Prettier
npm run type-check   # TypeScript checking
```

### 3. Pre-commit Hooks (Optional)

Install pre-commit:
```bash
pip install pre-commit

# Create .pre-commit-config.yaml
cat > .pre-commit-config.yaml << EOF
repos:
  - repo: https://github.com/psf/black
    rev: 22.10.0
    hooks:
      - id: black
        files: backend/
  - repo: https://github.com/pycqa/isort
    rev: 5.10.1
    hooks:
      - id: isort
        files: backend/
  - repo: https://github.com/pre-commit/mirrors-eslint
    rev: v8.28.0
    hooks:
      - id: eslint
        files: frontend/src/
        types: [file]
        types_or: [javascript, jsx, ts, tsx]
EOF

# Install hooks
pre-commit install
```

## Debugging

### Backend Debugging

```bash
# Run with debugger
python -m debugpy --listen 5678 --wait-for-client -m uvicorn main:app --reload

# Or use VS Code debugging configuration
```

Create `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "FastAPI",
      "type": "python",
      "request": "launch",
      "program": "-m",
      "args": ["uvicorn", "main:app", "--reload"],
      "console": "integratedTerminal",
      "cwd": "${workspaceFolder}/backend"
    }
  ]
}
```

### Frontend Debugging

```bash
# Debug in browser
npm start
# Open Chrome DevTools

# Debug tests
npm test -- --debug

# Debug with VS Code
# Install React DevTools extension
```

## Performance Testing

### Load Testing with Locust

Create `backend/tests/load_test.py`:
```python
from locust import HttpUser, task, between

class ChatUser(HttpUser):
    wait_time = between(1, 3)
    
    def on_start(self):
        """Login and get authentication token"""
        response = self.client.post("/auth/login", json={
            "username": "admin",
            "password": "secret123"
        })
        if response.status_code == 200:
            tokens = response.json()
            self.headers = {"Authorization": f"Bearer {tokens['access_token']}"}
        else:
            self.headers = {}
    
    @task
    def health_check(self):
        self.client.get("/health")
    
    @task 
    def auth_check(self):
        self.client.get("/auth/me", headers=self.headers)
    
    @task
    def list_conversations(self):
        self.client.get("/api/conversations/", headers=self.headers)
    
    @task
    def send_message(self):
        self.client.post("/api/chat/", 
                        json={"message": "Hello, this is a test message"},
                        headers=self.headers)
```

Run load tests:
```bash
pip install locust
locust -f backend/tests/load_test.py --host=http://localhost:8000
```

## Troubleshooting

### Common Issues

**Port already in use:**
```bash
# Find process using port
lsof -ti:8000 | xargs kill -9  # macOS/Linux
netstat -ano | findstr :8000   # Windows

# Or use different port
uvicorn main:app --port 8001
```

**Firestore connection issues:**
```bash
# Check authentication
gcloud auth list
gcloud auth application-default print-access-token

# Check project
gcloud config get-value project
```

**Frontend build issues:**
```bash
# Clear cache and rebuild
rm -rf node_modules package-lock.json
npm install
npm start
```

**Python import issues:**
```bash
# Check Python path
python -c "import sys; print(sys.path)"

# Reinstall dependencies
pip install --force-reinstall -r requirements.txt
```

### Environment Issues

**Virtual environment:**
```bash
# Recreate virtual environment
rm -rf venv
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate
pip install -r requirements.txt
```

**Node modules:**
```bash
# Clear npm cache
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

## Continuous Integration Setup

### GitHub Actions (Example)

Create `.github/workflows/test.yml`:
```yaml
name: Tests

on: [push, pull_request]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.13'
      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
      - name: Run tests
        run: |
          cd backend
          pytest --cov=. --cov-report=xml
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        
  frontend-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Set up Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: |
          cd frontend
          npm install
      - name: Run tests
        run: |
          cd frontend
          npm test -- --coverage --watchAll=false
```

## Best Practices

### Development Practices
- Use virtual environments for Python
- Keep dependencies updated
- Write tests for new features
- Use type hints and interfaces
- Follow code formatting standards

### Testing Practices
- Write unit tests for all business logic
- Test error conditions
- Use mocks for external services
- Test both happy path and edge cases
- Maintain >80% code coverage

### Debugging Practices
- Use proper logging levels
- Add meaningful error messages
- Test with real and mock data
- Use browser developer tools
- Monitor network requests

---

This test environment setup provides multiple approaches to fit different development preferences and requirements. Choose the method that best suits your workflow and infrastructure needs.