# LiveTales

**Interactive AI-powered storytelling for children ages 3–13.**

Kids draw on a canvas, chat with Tali (an AI friend powered by Gemini Live API), and together create fully illustrated, narrated storybooks in real-time.

![Architecture](docs/architecture.png)

## Features

- **Real-time voice conversation** with Tali via Gemini 2.0 Flash Live API (bidirectional audio streaming)
- **Interactive drawing canvas** with colors, brush sizes, undo/clear
- **AI story generation** — Gemini 2.5 Flash turns drawings + conversation into 6-page stories
- **AI illustrations** — Imagen 3.0 generates watercolor-style storybook art for each page
- **TTS narration** — Gemini TTS reads stories expressively
- **Animated video** — Veo 2.0 animates illustrations into gentle story videos
- **Story library** — save and revisit completed stories

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui, Zustand, Framer Motion |
| Backend | Python 3.12, FastAPI, WebSockets, Google ADK |
| Voice | Gemini 2.0 Flash Live Preview (native audio bidi-streaming) |
| Story | Gemini 2.5 Flash (multimodal vision + text) |
| Images | Imagen 3.0 |
| Narration | Gemini 2.5 Flash Preview TTS |
| Video | Veo 2.0 |
| Cloud | Google Cloud Run, Vertex AI, Cloud Storage |

## Prerequisites

- **Python 3.12+**
- **Node.js 18+** and **npm**
- **Google Cloud account** with a project that has the following APIs enabled:
  - Vertex AI API
  - Cloud Run API (for deployment)
  - Cloud Storage API (for Veo video generation)
- A **Google API key** (for development) or **Vertex AI credentials** (for production)

## Quick Start

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd livetales
```

### 2. Backend Setup

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Option A: Google AI Studio (development)
GOOGLE_API_KEY=your-api-key-here
GOOGLE_GENAI_USE_VERTEXAI=FALSE

# Option B: Vertex AI (production)
# GOOGLE_GENAI_USE_VERTEXAI=TRUE
# GOOGLE_CLOUD_PROJECT=your-project-id
# GOOGLE_CLOUD_LOCATION=us-central1

# App
APP_ENV=development
LOG_LEVEL=INFO
CORS_ORIGINS=http://localhost:8080,http://localhost:5173

# Features
ENABLE_IMAGEN=true
ENABLE_VEO=false
```

Start the backend:

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

The backend will be running at `http://localhost:8000`. Verify with:

```bash
curl http://localhost:8000/health
```

### 3. Frontend Setup

```bash
cd ../doodle-narrate-art  # or wherever your frontend is located

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The frontend will be running at `http://localhost:8080`.

### 4. Use the App

1. Open `http://localhost:8080` in your browser
2. Click **"Start Creating"** to enter the Studio
3. Click the **microphone button** to start a voice session with Tali
4. **Draw** on the canvas — Tali will react to your drawings
5. Click **"Next Page"** to generate story pages with illustrations
6. After 6 pages, watch your complete animated storybook!

## Deployment (Google Cloud Run)

### Build and push the Docker image

```bash
cd backend

# Build
docker build -t livetales-backend .

# Tag for Artifact Registry
docker tag livetales-backend gcr.io/<YOUR_PROJECT_ID>/livetales-backend

# Push
docker push gcr.io/<YOUR_PROJECT_ID>/livetales-backend
```

### Deploy to Cloud Run

```bash
gcloud run deploy livetales-backend \
  --image gcr.io/<YOUR_PROJECT_ID>/livetales-backend \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "GOOGLE_GENAI_USE_VERTEXAI=TRUE,GOOGLE_CLOUD_PROJECT=<YOUR_PROJECT_ID>,GOOGLE_CLOUD_LOCATION=us-central1,CORS_ORIGINS=https://your-frontend-domain.com"
```

## Architecture

```
Browser (React)                    Google Cloud
┌─────────────────┐               ┌──────────────────────────────┐
│  Drawing Canvas  │──WebSocket──▶│  FastAPI Backend (Cloud Run) │
│  Voice Input     │◀─────────────│                              │
│  Storybook View  │              │  ┌─ ADK Runner ───────────┐  │
│                  │              │  │ Gemini 2.0 Flash Live   │  │
│                  │              │  │ (Voice Conversation)    │  │
│                  │              │  └─────────────────────────┘  │
│                  │              │                              │
│                  │              │  ┌─ Async Pipeline ────────┐  │
│                  │              │  │ Gemini 2.5 Flash (Story)│  │
│                  │              │  │ Imagen 3.0 (Images)     │  │
│                  │              │  │ Gemini TTS (Narration)  │  │
│                  │              │  │ Veo 2.0 (Video)         │  │
│                  │              │  └─────────────────────────┘  │
└─────────────────┘               └──────────────────────────────┘
```

## Project Structure

```
livetales/
├── backend/
│   ├── main.py                 # FastAPI server, WebSocket, async pipelines
│   ├── agents/
│   │   └── orchestrator.py     # Tali agent definition (ADK + Gemini Live)
│   ├── config/
│   │   └── settings.py         # Environment configuration
│   ├── tools/                  # ADK function tools
│   ├── Dockerfile              # Cloud Run container
│   ├── requirements.txt
│   └── .env.example
├── doodle-narrate-art/         # Frontend (React)
│   ├── src/
│   │   ├── pages/              # Landing, Studio, Library
│   │   ├── components/         # Canvas, Storybook, VoiceBar
│   │   ├── hooks/              # useVoiceSession (WebSocket + audio)
│   │   └── stores/             # Zustand state management
│   └── package.json
└── README.md
```

## License

Built for the Gemini Live Agent Challenge.
