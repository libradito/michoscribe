import { spawn } from 'child_process';
import { mkdir, rm } from 'fs/promises';
import { join, dirname } from 'path';

const ALLOWED_FORMATS = ['audio/wav', 'audio/mpeg', 'audio/mp3', 'audio/webm', 'audio/x-wav'];
const ALLOWED_EXTENSIONS = ['.wav', '.mp3', '.webm'];
const MAX_DURATION_SECONDS = 300; // 5 minutes
const CHUNK_DURATION_SECONDS = 30;

export interface AudioValidation {
  valid: boolean;
  error?: string;
  duration?: number;
}

export interface ChunkInfo {
  index: number;
  path: string;
  startTime: number;
  endTime: number;
}

export function validateAudioFormat(mimeType: string, fileName: string): boolean {
  const extension = fileName.toLowerCase().slice(fileName.lastIndexOf('.'));
  return ALLOWED_FORMATS.includes(mimeType) || ALLOWED_EXTENSIONS.includes(extension);
}

export async function getAudioDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const ffprobe = spawn('ffprobe', [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      filePath
    ]);

    let output = '';
    let errorOutput = '';

    ffprobe.stdout.on('data', (data) => {
      output += data.toString();
    });

    ffprobe.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    ffprobe.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe failed: ${errorOutput}`));
        return;
      }
      const duration = parseFloat(output.trim());
      if (isNaN(duration)) {
        reject(new Error('Could not parse audio duration'));
        return;
      }
      resolve(duration);
    });
  });
}

export async function validateAudio(filePath: string, mimeType: string, fileName: string): Promise<AudioValidation> {
  if (!validateAudioFormat(mimeType, fileName)) {
    return {
      valid: false,
      error: 'Invalid audio format. Supported formats: WAV, MP3, WebM'
    };
  }

  try {
    const duration = await getAudioDuration(filePath);

    if (duration > MAX_DURATION_SECONDS) {
      return {
        valid: false,
        error: `Audio duration exceeds maximum of ${MAX_DURATION_SECONDS / 60} minutes`,
        duration
      };
    }

    return { valid: true, duration };
  } catch (error) {
    return {
      valid: false,
      error: `Failed to process audio: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
}

export async function splitAudioIntoChunks(
  inputPath: string,
  outputDir: string,
  duration: number
): Promise<ChunkInfo[]> {
  // Ensure output directory exists
  await mkdir(outputDir, { recursive: true });

  const chunks: ChunkInfo[] = [];
  const numChunks = Math.ceil(duration / CHUNK_DURATION_SECONDS);

  for (let i = 0; i < numChunks; i++) {
    const startTime = i * CHUNK_DURATION_SECONDS;
    const chunkDuration = Math.min(CHUNK_DURATION_SECONDS, duration - startTime);
    const outputPath = join(outputDir, `chunk_${i.toString().padStart(3, '0')}.wav`);

    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y', // Overwrite output
        '-i', inputPath,
        '-ss', startTime.toString(),
        '-t', chunkDuration.toString(),
        '-acodec', 'pcm_s16le', // WAV format for best compatibility
        '-ar', '16000', // 16kHz sample rate (optimal for Whisper)
        '-ac', '1', // Mono
        outputPath
      ]);

      let errorOutput = '';

      ffmpeg.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`ffmpeg chunk ${i} failed: ${errorOutput}`));
          return;
        }
        resolve();
      });
    });

    chunks.push({
      index: i,
      path: outputPath,
      startTime,
      endTime: startTime + chunkDuration,
    });
  }

  return chunks;
}

export async function cleanupFiles(paths: string[]): Promise<void> {
  for (const path of paths) {
    try {
      await rm(path, { recursive: true, force: true });
    } catch (error) {
      console.error(`Failed to cleanup ${path}:`, error);
    }
  }
}

export function getUploadPath(userId: string, jobId: string, fileName: string): string {
  const extension = fileName.slice(fileName.lastIndexOf('.'));
  return join(process.cwd(), 'uploads', userId, jobId, `original${extension}`);
}

export function getChunksDir(userId: string, jobId: string): string {
  return join(process.cwd(), 'uploads', userId, jobId, 'chunks');
}

export async function ensureUploadDir(filePath: string): Promise<void> {
  await mkdir(dirname(filePath), { recursive: true });
}
