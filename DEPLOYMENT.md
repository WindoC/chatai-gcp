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

### 3.1 Update app.yaml Configuration
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

### 3.2 Build Frontend for Production
```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Build for production
npm run build

# Verify build was created
ls -la build/
```

### 3.3 Update main.py for Production
Ensure your `backend/main.py` handles the module structure correctly for App Engine:

```python
# Update import for App Engine
import sys
import os

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(__file__))

from main import app

# This is what App Engine looks for
if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
```

### 3.4 Create requirements.txt
Ensure your `backend/requirements.txt` has all dependencies:
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
Instead of putting secrets in app.yaml, use Google Cloud Console:

1. Go to [App Engine Settings](https://console.cloud.google.com/appengine/settings)
2. Click on "Environment Variables"
3. Add the following variables:
   - `GOOGLE_API_KEY`: Your Gemini API key
   - `GOOGLE_CLOUD_PROJECT`: Your GCP project ID
   - `DEBUG`: `false`

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

# Test health endpoint
curl https://YOUR_PROJECT_ID.appspot.com/health

# Test API documentation
open https://YOUR_PROJECT_ID.appspot.com/docs
```

### 6.2 Check Logs
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
Set up Firestore security rules (currently open for Phase 2):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Phase 2: Allow all reads/writes (no auth yet)
    match /{document=**} {
      allow read, write: if true;
    }
    
    // Phase 3: Add authentication rules
    // match /conversations/{conversationId} {
    //   allow read, write: if request.auth != null;
    // }
  }
}
```

Apply rules:
```bash
# Deploy Firestore rules
gcloud firestore rules deploy firestore.rules
```

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

**Next Steps**: After successful deployment, proceed with Phase 3 (Authentication) or Phase 4 (Encryption) as outlined in PLAN.md.