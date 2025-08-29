# Deployment Guide - ChatAI-GCP

This guide covers deploying the ChatAI-GCP application to Google App Engine for production use.

## Prerequisites

### Required Accounts & Services
- Google Cloud Platform account with billing enabled
- Google Cloud project with the following APIs enabled:
  - App Engine Admin API
  - Cloud Firestore API
  - Generative AI API (for Gemini)
- Google Cloud SDK (`gcloud`) installed locally

### Local Requirements
- Python 3.13+
- Node.js 18+
- Git

## Step 1: Google Cloud Project Setup

### 1.1 Create or Select Project
```bash
# List existing projects
gcloud projects list

# Create new project (if needed)
gcloud projects create YOUR_PROJECT_ID --name="ChatAI-GCP"

# Set active project
gcloud config set project YOUR_PROJECT_ID
```

### 1.2 Enable Required APIs
```bash
# Enable App Engine API
gcloud services enable appengine.googleapis.com

# Enable Firestore API
gcloud services enable firestore.googleapis.com

# Enable Generative AI API
gcloud services enable generativelanguage.googleapis.com
```

### 1.3 Initialize App Engine
```bash
# Initialize App Engine (select region when prompted)
gcloud app create --region=us-central1
```

### 1.4 Setup Firestore Database
```bash
# Create Firestore database in Native mode
gcloud firestore databases create --region=us-central1 --type=firestore-native
```

## Step 2: Get Google Gemini API Key

### 2.1 Get API Key
1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click "Create API Key"
3. Select your Google Cloud project
4. Copy the generated API key
5. Keep it secure - you'll need it for environment variables

### 2.2 Test API Key (Optional)
```bash
# Test the API key works
curl -H "Content-Type: application/json" \
     -d '{"contents":[{"parts":[{"text":"Hello"}]}]}' \
     -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=YOUR_API_KEY"
```

## Step 3: Prepare Application for Deployment

### 3.1 Configure Frontend Environment Variables
**CRITICAL**: Update the frontend environment variables for production deployment.

Edit `frontend/.env.local`:
```env
REACT_APP_API_URL=https://YOUR_PROJECT_ID.uw.r.appspot.com
```

Replace `YOUR_PROJECT_ID` with your actual Google Cloud project ID (e.g., `https://chat-470206.uw.r.appspot.com`).

**Why this is important:**
- React environment variables are built-in at compile time
- If you skip this step, your app will call `localhost:8000` instead of your deployed backend
- This causes authentication and all API calls to fail in production

### 3.2 Update app.yaml Configuration
Edit the `app.yaml` file in the project root:

```yaml
runtime: python313
service: default

instance_class: F1

automatic_scaling:
  min_instances: 0
  max_instances: 1
  target_cpu_utilization: 0.6

env_variables:
  GOOGLE_API_KEY: "YOUR_GEMINI_API_KEY_HERE"
  GOOGLE_CLOUD_PROJECT: "YOUR_PROJECT_ID_HERE"
  DEBUG: "false"
  FIRESTORE_DATABASE: "(default)"
  
  # Phase 3 Authentication - REQUIRED
  JWT_SECRET_KEY: "YOUR_STRONG_JWT_SECRET_KEY_HERE"
  JWT_ACCESS_EXPIRE_MINUTES: "30"
  JWT_REFRESH_EXPIRE_DAYS: "7"
  USERNAME: "admin"
  PASSWORD_HASH: "YOUR_SHA256_PASSWORD_HASH_HERE"
  
  # Security Settings
  AUTH_RATE_LIMIT: "10"
  CHAT_RATE_LIMIT: "30"
  

handlers:
  # Serve the React build files
  - url: /static
    static_dir: frontend/build/static
    secure: always

  - url: /favicon.ico
    static_files: frontend/build/favicon.ico
    upload: frontend/build/favicon.ico
    secure: always

  - url: /manifest.json
    static_files: frontend/build/manifest.json
    upload: frontend/build/manifest.json
    secure: always

  # Authentication routes
  - url: /auth/.*
    script: auto
    secure: always

  # API routes  
  - url: /api/.*
    script: auto
    secure: always

  - url: /health
    script: auto
    secure: always

  # Serve React app for all other routes
  - url: /.*
    static_files: frontend/build/index.html
    upload: frontend/build/index.html
    secure: always
```

### 3.3 Build Frontend for Production
**IMPORTANT**: Build the frontend AFTER updating environment variables.

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Build for production (this bakes in the REACT_APP_API_URL)
npm run build

# Verify build was created
ls -la build/

# Verify the build includes correct API URL (optional check)
grep -r "chat-470206" build/ || echo "WARNING: Build might still contain localhost URLs"
```

### 3.4 Prepare Backend Dependencies for App Engine
**CRITICAL**: App Engine looks for `requirements.txt` in the project root, but your dependencies are in `backend/requirements.txt`.

Copy the backend requirements to the project root:
```bash
# Copy backend requirements to root for App Engine
cp backend/requirements.txt requirements.txt
```

**Why this is needed:**
- App Engine installs dependencies from root `requirements.txt`
- Without this, you'll get "No module named uvicorn" errors
- The backend entrypoint runs from `backend/` directory but needs root dependencies

### 3.5 Verify Backend Configuration
Your backend should be configured with:
- `app.yaml` with proper entrypoint: `cd backend && PYTHONPATH=/workspace:/workspace/backend python -m uvicorn main:app --host 0.0.0.0 --port $PORT`
- Root `requirements.txt` with all dependencies (copied from backend)
- All Python modules properly structured with `__init__.py` files

### 3.6 Dependencies Overview
Your `backend/requirements.txt` should include:
```txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
python-multipart==0.0.6
pydantic==2.5.0
pydantic-settings==2.1.0
google-generativeai==0.3.2
google-cloud-firestore==2.13.1
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-dotenv==1.0.0
aiofiles==23.2.1
gunicorn==21.2.0
```

## Step 4: Deploy to Google App Engine

### 4.1 Initial Deployment
```bash
# From project root directory
gcloud app deploy

# When prompted, confirm deployment
# This will take 5-10 minutes for first deployment
```

### 4.2 Set Environment Variables (Secure Method)
Instead of putting secrets in app.yaml, use Google Cloud Console or Secret Manager:

**Option A: App Engine Environment Variables**
1. Go to [App Engine Settings](https://console.cloud.google.com/appengine/settings)
2. Click on "Environment Variables"
3. Add the following variables:
   - `GOOGLE_API_KEY`: Your Gemini API key
   - `GOOGLE_CLOUD_PROJECT`: Your GCP project ID
   - `DEBUG`: `false`
   - `JWT_SECRET_KEY`: Strong random secret (generate with `python -c "import secrets; print(secrets.token_hex(32))"`)
   - `JWT_ACCESS_EXPIRE_MINUTES`: `30`
   - `JWT_REFRESH_EXPIRE_DAYS`: `7`
   - `USERNAME`: Your login username (e.g., `admin`)
   - `PASSWORD_HASH`: SHA256 hash of your password (generate with `python -c "import hashlib; print(hashlib.sha256('your_password'.encode()).hexdigest())"`)
   - `AUTH_RATE_LIMIT`: `10`
   - `CHAT_RATE_LIMIT`: `30`
   - `AES_KEY_HASH`: Server secret for AES key derivation (generate with `python -c "import secrets; print(secrets.token_hex(32))"`)

**Option B: Secret Manager (Recommended for Production)**
```bash
# Enable Secret Manager API
gcloud services enable secretmanager.googleapis.com

# Create secrets
echo -n "your_gemini_api_key" | gcloud secrets create gemini-api-key --data-file=-
echo -n "your_jwt_secret" | gcloud secrets create jwt-secret-key --data-file=-
echo -n "your_password_hash" | gcloud secrets create password-hash --data-file=-
echo -n "your_aes_server_secret" | gcloud secrets create aes-key-hash --data-file=-

# Grant App Engine access to secrets
gcloud secrets add-iam-policy-binding gemini-api-key --member="serviceAccount:YOUR_PROJECT_ID@appspot.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding jwt-secret-key --member="serviceAccount:YOUR_PROJECT_ID@appspot.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding password-hash --member="serviceAccount:YOUR_PROJECT_ID@appspot.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
gcloud secrets add-iam-policy-binding aes-key-hash --member="serviceAccount:YOUR_PROJECT_ID@appspot.gserviceaccount.com" --role="roles/secretmanager.secretAccessor"
```

**⚠️ Security Notes:**
- Never commit secrets to version control
- Use strong, unique passwords and JWT secrets
- Regularly rotate authentication credentials
- Monitor access logs for suspicious activity

Then update app.yaml to remove the env_variables section.

### 4.3 Deploy with Updated Configuration
```bash
# Deploy updated configuration
gcloud app deploy

# View deployment
gcloud app browse
```

## Step 5: Post-Deployment Configuration

### 5.1 Custom Domain (Optional)
```bash
# Map custom domain
gcloud app domain-mappings create www.yourdomain.com

# Add SSL certificate (automatic with Google managed certificates)
gcloud app ssl-certificates create --domains=www.yourdomain.com
```

### 5.2 Set Up Monitoring
```bash
# Enable Cloud Logging
gcloud logging sinks create chatai-gcp \
    logging.googleapis.com/projects/YOUR_PROJECT_ID/logs/appengine

# Set up alerts in Google Cloud Console
# Navigate to Monitoring > Alerting
```

## Step 6: Verification

### 6.1 Test Deployment
```bash
# Get app URL
gcloud app browse

# Test health endpoint (public)
curl https://YOUR_PROJECT_ID.uw.r.appspot.com/health

# Test authentication endpoint
curl -X POST https://YOUR_PROJECT_ID.uw.r.appspot.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your_password"}'

# Test protected endpoint (should return 401 without auth)
curl https://YOUR_PROJECT_ID.uw.r.appspot.com/api/conversations/

# Test protected endpoint with authentication
# First get token from login response above, then:
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     https://YOUR_PROJECT_ID.uw.r.appspot.com/api/conversations/

# Test API documentation (should redirect to login)
open https://YOUR_PROJECT_ID.uw.r.appspot.com/docs

# Test the web application (should show login screen)
open https://YOUR_PROJECT_ID.uw.r.appspot.com/
```

### 6.2 Frontend Verification
**Critical**: Verify frontend is calling the correct backend URL:

1. **Open your deployed app**: https://YOUR_PROJECT_ID.uw.r.appspot.com
2. **Open browser developer tools** (F12)
3. **Go to Network tab**
4. **Try to login** - you should see API calls to:
   - ✅ `https://YOUR_PROJECT_ID.uw.r.appspot.com/auth/login`
   - ❌ NOT `http://localhost:8000/auth/login`

5. **If you see localhost calls**:
   ```bash
   # Update environment variable
   echo "REACT_APP_API_URL=https://YOUR_PROJECT_ID.uw.r.appspot.com" > frontend/.env.local
   
   # Rebuild and redeploy
   cd frontend && npm run build && cd .. && gcloud app deploy
   ```

### 6.3 Check Logs
```bash
# View recent logs
gcloud app logs tail -s default

# View logs in browser
gcloud app logs read --limit=50
```

## Step 7: Ongoing Deployment

### 7.1 Regular Deployment Process
```bash
# 1. Build frontend
cd frontend
npm run build
cd ..

# 2. Run tests
cd backend
pytest
cd ..

# 3. Deploy
gcloud app deploy

# 4. Verify deployment
gcloud app browse
```

### 7.2 Rollback if Needed
```bash
# List versions
gcloud app versions list

# Rollback to previous version
gcloud app versions migrate PREVIOUS_VERSION_ID

# Delete bad version
gcloud app versions delete BAD_VERSION_ID
```

## Security Configuration

### 7.1 App Engine Security
- All traffic automatically uses HTTPS
- CORS is configured in the application
- No public access to backend files

### 7.2 Firestore Security Rules
**For Phase 3 with Authentication:**

Update `firestore.rules`:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Phase 3: Production rules with security
    // Note: App Engine uses service account authentication, not user auth tokens
    // So we allow access to authenticated service account (the application itself)
    
    match /conversations/{conversationId} {
      // Allow application service account to read/write conversations
      allow read, write: if true;
    }
    
    // For Phase 4+ with user-level authentication:
    // You would implement custom claims or additional validation
    // match /conversations/{conversationId} {
    //   allow read, write: if request.auth != null && 
    //                          request.auth.uid == resource.data.userId;
    // }
  }
}
```

Apply rules:
```bash
# Deploy Firestore rules
gcloud firestore rules deploy firestore.rules

# Test rules (optional)
firebase emulators:start --only firestore
```

**Security Notes for Phase 3:**
- Application-level authentication (JWT) protects API endpoints
- Firestore access is through service account (backend only)
- No direct client-side Firestore access
- All data access goes through authenticated API endpoints

## Troubleshooting

### Common Deployment Issues

**Build Failures:**
```bash
# Clear npm cache and rebuild
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

**Module Import Errors:**
- Ensure all Python modules are in requirements.txt
- Check that imports use relative paths correctly
- Verify __init__.py files exist in all Python packages

**Environment Variable Issues:**
```bash
# Check current environment variables
gcloud app describe

# Update environment variables
gcloud app deploy --promote --stop-previous-version
```

**Quota/Billing Issues:**
- Ensure billing is enabled on the GCP project
- Check quotas in GCP Console → IAM & Admin → Quotas
- Monitor usage in App Engine → Dashboard

**Frontend API URL Issues:**
```bash
# Problem: Frontend calls localhost instead of App Engine URL
# Solution: Check and rebuild frontend

# 1. Check current frontend environment
cat frontend/.env.local
# Should show: REACT_APP_API_URL=https://YOUR_PROJECT_ID.uw.r.appspot.com

# 2. If wrong, update it:
echo "REACT_APP_API_URL=https://YOUR_PROJECT_ID.uw.r.appspot.com" > frontend/.env.local

# 3. Rebuild frontend with correct URL
cd frontend
npm run build
cd ..

# 4. Redeploy
gcloud app deploy

# 5. Verify in browser console - should not see localhost:8000 requests
```

**Authentication Issues:**
```bash
# Check if JWT_SECRET_KEY is set
gcloud app versions describe VERSION_ID --service=default

# Test login endpoint directly
curl -X POST https://YOUR_PROJECT_ID.uw.r.appspot.com/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your_password"}' \
  -v

# Check authentication logs
gcloud app logs tail -s default --filter="auth"

# Verify password hash is correct
python -c "import hashlib; print(hashlib.sha256('your_password'.encode()).hexdigest())"
```

**Common Errors:**
- **Frontend calls `localhost:8000`**: Update `frontend/.env.local` and rebuild
- **"No module named uvicorn"**: Copy `cp backend/requirements.txt requirements.txt` and redeploy
- `401 Unauthorized`: Check username/password and JWT_SECRET_KEY
- `500 Internal Server Error`: Check environment variables are set
- `422 Validation Error`: Check request format and required fields
- `429 Too Many Requests`: Rate limiting is working (wait or increase limits)
- **CORS errors**: Check frontend is using HTTPS URLs, not HTTP

### Performance Optimization

**App Engine Configuration:**
```yaml
# For higher traffic, update app.yaml
instance_class: F2  # or F4 for more resources
automatic_scaling:
  min_instances: 1  # Keep warm instance
  max_instances: 10  # Scale up to 10 instances
  target_cpu_utilization: 0.5
```

**Cold Start Reduction:**
- Keep min_instances: 1 for production
- Use warmup requests
- Optimize import statements

## Cost Management

### Expected Costs (USD/month)
- **App Engine**: $0-50 (depending on usage)
- **Firestore**: $0-20 (for typical chat usage)
- **Gemini API**: $0-100 (depending on conversation volume)
- **Total**: $0-170/month for moderate usage

### Cost Optimization
- Set billing alerts
- Use App Engine flexible environment for predictable traffic
- Monitor API usage in Google Cloud Console
- Implement caching where appropriate

## Maintenance

### Regular Tasks
- **Weekly**: Check logs for errors
- **Monthly**: Review usage and costs
- **Quarterly**: Update dependencies
- **Annually**: Review security settings

### Updates
```bash
# Update backend dependencies
cd backend
pip install --upgrade -r requirements.txt

# Update frontend dependencies
cd frontend
npm update

# Test and deploy
npm run build
cd ..
gcloud app deploy
```

## Support

For deployment issues:
- Check Google Cloud Status page
- Review App Engine documentation
- Use `gcloud app logs tail` for real-time debugging
- Monitor in Google Cloud Console → App Engine → Dashboard

---

## Quick Fix for localhost API URL Issue

If your deployed app is calling `localhost:8000` instead of your App Engine URL:

```bash
# 1. Update frontend environment
echo "REACT_APP_API_URL=https://YOUR_PROJECT_ID.uw.r.appspot.com" > frontend/.env.local

# 2. Rebuild frontend 
cd frontend && npm run build && cd ..

# 3. Redeploy
gcloud app deploy

# 4. Verify in browser dev tools - should see App Engine URLs, not localhost
```

---

**Next Steps**: Your ChatAI-GCP application with Phase 4 end-to-end encryption is now deployed and ready for production use!