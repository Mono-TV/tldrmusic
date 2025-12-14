# TLDR Music API

FastAPI backend for TLDR Music chart data, deployed on Google Cloud Run.

## API Endpoints

### Charts
- `GET /chart/current` - Get current week's chart
- `GET /chart/{week}` - Get chart by week (e.g., 2025-W50)
- `GET /chart/history` - List all available weeks

### Search
- `GET /search?q=query` - Search songs by title/artist
- `GET /song/{id}` - Get song by MongoDB ID

### Regional
- `GET /regional` - Get all regional charts
- `GET /regional/{region}` - Get specific region (telugu, punjabi, etc.)

### Admin (requires X-API-Key header)
- `POST /admin/upload` - Upload new chart data
- `POST /admin/sync` - Sync from current.json file
- `DELETE /admin/chart/{week}` - Delete a chart

## Local Development

1. Create `.env` file:
```bash
cp .env.example .env
# Edit .env with your MongoDB URI
```

2. Install dependencies:
```bash
pip install -r requirements.txt
```

3. Run locally:
```bash
uvicorn main:app --reload --port 8080
```

4. Open http://localhost:8080/docs for Swagger UI

## Deploy to Google Cloud Run

### Prerequisites
- Google Cloud CLI (`gcloud`) installed
- Docker installed
- GCP project with Cloud Run enabled

### Deployment Steps

1. **Set your GCP project:**
```bash
gcloud config set project YOUR_PROJECT_ID
```

2. **Build and push Docker image:**
```bash
# Build image
gcloud builds submit --tag gcr.io/YOUR_PROJECT_ID/tldrmusic-api

# Or use Docker locally
docker build -t gcr.io/YOUR_PROJECT_ID/tldrmusic-api .
docker push gcr.io/YOUR_PROJECT_ID/tldrmusic-api
```

3. **Deploy to Cloud Run:**
```bash
gcloud run deploy tldrmusic-api \
  --image gcr.io/YOUR_PROJECT_ID/tldrmusic-api \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "MONGODB_URI=your-mongodb-uri,MONGODB_DB=tldrmusic,ADMIN_API_KEY=your-key"
```

4. **Get your API URL:**
```bash
gcloud run services describe tldrmusic-api --format='value(status.url)'
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string (Atlas format) |
| `MONGODB_DB` | Database name (default: `tldrmusic`) |
| `ADMIN_API_KEY` | API key for admin endpoints |

## Initial Data Sync

After deployment, sync your existing chart data:

```bash
curl -X POST "https://YOUR_CLOUD_RUN_URL/admin/sync" \
  -H "X-API-Key: your-admin-key"
```

Or upload JSON directly:

```bash
curl -X POST "https://YOUR_CLOUD_RUN_URL/admin/upload" \
  -H "X-API-Key: your-admin-key" \
  -H "Content-Type: application/json" \
  -d @../frontend/current.json
```
