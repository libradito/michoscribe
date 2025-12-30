# MichoScribe

Audio transcription web application with AI-powered chat to query your transcripts.

## Features

- Upload audio files (WAV, MP3, WebM)
- Automatic speech-to-text transcription
- AI-powered chat to ask questions about your transcripts
- Multi-language support
- User authentication via Firebase
- Real-time transcription status updates

## Tech Stack

**Frontend:**
- React Router
- TypeScript
- Firebase Auth & Realtime Database
- Vite

**Backend:**
- Bun runtime
- Hono framework
- Firebase Admin SDK
- FFmpeg for audio processing

## Getting Started

### Prerequisites

- Docker and Docker Compose
- Firebase project with:
  - Authentication enabled
  - Realtime Database
  - Storage bucket
- Firebase Admin SDK credentials (JSON file)

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/your-username/michos-transcriptions.git
   cd michos-transcriptions
   ```

2. Create environment files:

   **Root `.env`** (for frontend build):
   ```env
   VITE_FIREBASE_API_KEY=your-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   VITE_FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
   VITE_FIREBASE_APP_ID=your-app-id
   VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id
   VITE_BUN_SERVER_URL=http://localhost:3000
   ```

   **Backend `.env`** (`bun-server-michoscribe/.env`):
   ```env
   OPENAI_API_KEY=your-openai-key
   FIREBASE_SERVICE_ACCOUNT=path/to/credentials.json
   ```

3. Place your Firebase Admin SDK credentials JSON in `bun-server-michoscribe/`

4. Run with Docker:
   ```bash
   docker compose up --build
   ```

5. Access the application:
   - Frontend: http://localhost:3001
   - Backend API: http://localhost:3000

## Project Structure

```
michos-transcriptions/
├── bun-server-michoscribe/    # Backend API server
│   ├── src/
│   │   ├── routes/            # API endpoints
│   │   ├── workers/           # Background processing
│   │   ├── config/            # Firebase & database config
│   │   └── lib/               # Utilities
│   └── Dockerfile
├── michoscribe-react-router/  # Frontend React app
│   ├── app/
│   │   ├── components/        # React components
│   │   ├── hooks/             # Custom hooks
│   │   ├── routes/            # Page routes
│   │   └── lib/               # Firebase utilities
│   └── Dockerfile
├── docker-compose.yml         # Docker orchestration
└── README.md
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/transcription/upload` | Upload audio file |
| GET | `/api/transcription/user-stats` | Get user statistics |
| DELETE | `/api/transcription/:jobId` | Delete a transcription |
| POST | `/api/chat` | Chat with transcripts |
| GET | `/api/audio/stream/:userId/:jobId` | Stream audio file |

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
