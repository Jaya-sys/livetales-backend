#!/bin/bash
# LiveTales Backend - Google Cloud Run Deployment Script
# Usage: ./deploy.sh [project-id] [region]

set -euo pipefail

# Configuration
PROJECT_ID="${1:-valiant-arcana-479318-n4}"
REGION="${2:-us-central1}"
SERVICE_NAME="livetales-backend"
GCS_BUCKET="livetales-valiant"
CORS_ORIGINS="https://doodle-narrate-art.lovable.app"

echo "=== LiveTales Backend Deployment ==="
echo "Project:  $PROJECT_ID"
echo "Region:   $REGION"
echo "Service:  $SERVICE_NAME"
echo ""

# 1. Set project
echo "[1/4] Setting GCP project..."
gcloud config set project "$PROJECT_ID"

# 2. Enable required APIs
echo "[2/4] Enabling required APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  aiplatform.googleapis.com \
  storage.googleapis.com \
  --project="$PROJECT_ID" --quiet

# 3. Build & Deploy from source
echo "[3/4] Building and deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --source . \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 2 \
  --timeout 3600 \
  --session-affinity \
  --min-instances 0 \
  --max-instances 3 \
  --set-env-vars "\
GOOGLE_GENAI_USE_VERTEXAI=TRUE,\
GOOGLE_CLOUD_PROJECT=$PROJECT_ID,\
GOOGLE_CLOUD_LOCATION=$REGION,\
APP_ENV=production,\
LOG_LEVEL=INFO,\
CORS_ORIGINS=$CORS_ORIGINS,\
ENABLE_IMAGEN=true,\
ENABLE_VEO=true,\
GCS_BUCKET=$GCS_BUCKET" \
  --project="$PROJECT_ID" --quiet

# 4. Verify
echo "[4/4] Verifying deployment..."
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --region "$REGION" \
  --project="$PROJECT_ID" \
  --format="value(status.url)")

echo ""
echo "=== Deployment Complete ==="
echo "Service URL: $SERVICE_URL"
echo ""

# Health check
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$SERVICE_URL/health")
if [ "$HTTP_STATUS" = "200" ]; then
  echo "Health check: PASSED"
  curl -s "$SERVICE_URL/health" | python3 -m json.tool
else
  echo "Health check: FAILED (HTTP $HTTP_STATUS)"
  exit 1
fi
