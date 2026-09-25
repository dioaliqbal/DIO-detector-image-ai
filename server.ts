import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { analyzeImageForensics } from './server/detectorService.ts';
import { matchRealtimeAiGenerator } from './server/realtimeMatcher.ts';
import { startVideoGeneration, checkVideoStatus, downloadVideoBuffer } from './server/veoService.ts';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '25mb' }));

app.post('/api/analyze', async (req, res) => {
  try {
    const { base64Data, mimeType } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: 'base64Data is required' });
    }
    const result = await analyzeImageForensics(base64Data, mimeType || 'image/jpeg');
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('API /api/analyze error:', error);
    return res.status(500).json({ error: error?.message || 'Internal server error during detection' });
  }
});

// Real-time AI Matcher & Search Grounding
app.post('/api/realtime-ai-match', async (req, res) => {
  try {
    const { base64Data, mimeType, customQuery } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: 'base64Data is required' });
    }
    const result = await matchRealtimeAiGenerator(base64Data, mimeType || 'image/jpeg', customQuery);
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('API /api/realtime-ai-match error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to match AI generator' });
  }
});

// Veo Video Generation: Start
app.post('/api/generate-video', async (req, res) => {
  try {
    const { base64Data, mimeType, prompt, aspectRatio } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: 'base64Data is required' });
    }
    const result = await startVideoGeneration({
      base64Data,
      mimeType: mimeType || 'image/jpeg',
      prompt,
      aspectRatio: aspectRatio === '9:16' ? '9:16' : '16:9',
    });
    return res.status(200).json(result);
  } catch (error: any) {
    console.error('API /api/generate-video error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to start video generation' });
  }
});

// Veo Video Generation: Status Poll
app.post('/api/video-status', async (req, res) => {
  try {
    const { operationName } = req.body;
    if (!operationName) {
      return res.status(400).json({ error: 'operationName is required' });
    }
    const status = await checkVideoStatus(operationName);
    return res.status(200).json(status);
  } catch (error: any) {
    console.error('API /api/video-status error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to check video status' });
  }
});

// Veo Video Generation: Download / Stream
app.post('/api/video-download', async (req, res) => {
  try {
    const { operationName } = req.body;
    if (!operationName) {
      return res.status(400).json({ error: 'operationName is required' });
    }
    const { stream, contentType } = await downloadVideoBuffer(operationName);
    res.setHeader('Content-Type', contentType || 'video/mp4');
    if (stream?.pipeTo) {
      stream.pipeTo(
        new WritableStream({
          write(chunk) {
            res.write(chunk);
          },
          close() {
            res.end();
          },
        })
      );
    } else if (stream?.pipe) {
      stream.pipe(res);
    } else {
      res.end();
    }
  } catch (error: any) {
    console.error('API /api/video-download error:', error);
    return res.status(500).json({ error: error?.message || 'Failed to download video' });
  }
});

// Serve frontend build if present
const distPath = path.resolve(process.cwd(), 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
