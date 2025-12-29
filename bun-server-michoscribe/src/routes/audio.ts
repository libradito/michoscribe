import { Hono } from 'hono';
import { getJobData } from '../config/firebase';
import { existsSync } from 'fs';
import { extname } from 'path';

const audio = new Hono();

// Get MIME type from file extension
function getMimeType(filePath: string): string {
  const ext = extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.webm': 'audio/webm',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.aac': 'audio/aac',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

// Stream original audio file
// GET /api/audio/:userId/:jobId/original
audio.get('/:userId/:jobId/original', async (c) => {
  const { userId, jobId } = c.req.param();

  if (!userId || !jobId) {
    return c.json({ error: 'Missing userId or jobId' }, 400);
  }

  try {
    // Get job data to find audio path
    const job = await getJobData(userId, jobId);

    if (!job) {
      return c.json({ error: 'Job not found' }, 404);
    }

    const audioPath = job.audioPath as string;

    if (!audioPath) {
      return c.json({ error: 'Audio path not found in job' }, 404);
    }

    // Check if file exists
    if (!existsSync(audioPath)) {
      console.error(`[Audio] File not found: ${audioPath}`);
      return c.json({ error: 'Audio file not found' }, 404);
    }

    const file = Bun.file(audioPath);
    const mimeType = getMimeType(audioPath);
    const fileSize = file.size;

    // Handle range requests for seeking
    const range = c.req.header('Range');

    if (range) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      console.log(`[Audio] Range request: ${start}-${end}/${fileSize}`);

      // Read the specific range
      const buffer = await file.slice(start, end + 1).arrayBuffer();

      return new Response(buffer, {
        status: 206,
        headers: {
          'Content-Type': mimeType,
          'Content-Length': chunkSize.toString(),
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=3600',
        },
      });
    }

    // Full file response
    console.log(`[Audio] Streaming full file: ${audioPath} (${fileSize} bytes)`);

    return new Response(file.stream(), {
      headers: {
        'Content-Type': mimeType,
        'Content-Length': fileSize.toString(),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error) {
    console.error('[Audio] Error streaming audio:', error);
    return c.json({ error: 'Failed to stream audio' }, 500);
  }
});

// Get audio metadata
// GET /api/audio/:userId/:jobId/metadata
audio.get('/:userId/:jobId/metadata', async (c) => {
  const { userId, jobId } = c.req.param();

  if (!userId || !jobId) {
    return c.json({ error: 'Missing userId or jobId' }, 400);
  }

  try {
    const job = await getJobData(userId, jobId);

    if (!job) {
      return c.json({ error: 'Job not found' }, 404);
    }

    const audioPath = job.audioPath as string;

    if (!audioPath || !existsSync(audioPath)) {
      return c.json({ error: 'Audio file not found' }, 404);
    }

    const file = Bun.file(audioPath);

    return c.json({
      fileName: job.fileName,
      duration: job.duration,
      size: file.size,
      mimeType: getMimeType(audioPath),
    });
  } catch (error) {
    console.error('[Audio] Error getting metadata:', error);
    return c.json({ error: 'Failed to get audio metadata' }, 500);
  }
});

export default audio;
