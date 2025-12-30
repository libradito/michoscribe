import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { initializeTopics, disconnectKafka } from './config/kafka';
import { initializeFirebase } from './config/firebase';
import transcriptionRoutes from './routes/transcription';
import audioRoutes from './routes/audio';
import chatRoutes from './routes/chat';
import { startChunkerWorker } from './workers/chunker';
import { startSttWorker } from './workers/sttWorker';
import { startProjectorWorker } from './workers/projector';
import { startEnricherWorker } from './workers/enricher';
import { startTranslatorWorker } from './workers/translatorWorker';
import { startEmbedderWorker } from './workers/embedderWorker';

const app = new Hono();

// Middleware
app.use('*', logger());
app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'http://localhost:3000' , 'http://localhost:3001', 'http://127.0.0.1:5173'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    exposeHeaders: ['Content-Length'],
    maxAge: 86400,
    credentials: true,
  })
);

// Health check
app.get('/', (c) => {
  return c.json({
    service: 'MichoScribe Transcription Server',
    status: 'running',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: Date.now() });
});

// Mount routes
app.route('/api/transcription', transcriptionRoutes);
app.route('/api/audio', audioRoutes);
app.route('/api/chat', chatRoutes);

// Initialize and start
async function start() {
  console.log('Starting MichoScribe server...');

  try {
    // Initialize Firebase Admin SDK
    initializeFirebase();
    console.log('Firebase initialized');

    // Initialize Kafka topics
    await initializeTopics();
    console.log('Kafka topics initialized');

    // Start workers
    await Promise.all([
      startChunkerWorker(),
      startSttWorker(),
      startProjectorWorker(),
      startEnricherWorker(),
      startTranslatorWorker(),
      startEmbedderWorker(),
    ]);
    console.log('All workers started');

    console.log(`Server running on http://localhost:3000`);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await disconnectKafka();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down...');
  await disconnectKafka();
  process.exit(0);
});

// Start the server
start();

export default {
  port: 3000,
  fetch: app.fetch,
};
