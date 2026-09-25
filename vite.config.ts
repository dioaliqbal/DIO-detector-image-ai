import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';
import dotenv from 'dotenv';
import { analyzeImageForensics } from './server/detectorService.ts';
import { matchRealtimeAiGenerator } from './server/realtimeMatcher.ts';
import { startVideoGeneration, checkVideoStatus, downloadVideoBuffer } from './server/veoService.ts';

dotenv.config();

function apiServerPlugin(): Plugin {
  return {
    name: 'api-server-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url === '/api/analyze' && req.method === 'POST') {
          try {
            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', async () => {
              try {
                const { base64Data, mimeType } = JSON.parse(body);
                if (!base64Data) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'base64Data is required' }));
                  return;
                }
                const result = await analyzeImageForensics(base64Data, mimeType || 'image/jpeg');
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(result));
              } catch (parseError: any) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: parseError?.message || 'Failed to process image' }));
              }
            });
          } catch (e: any) {
            next(e);
          }
        } else if (req.url === '/api/realtime-ai-match' && req.method === 'POST') {
          try {
            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', async () => {
              try {
                const { base64Data, mimeType, customQuery } = JSON.parse(body);
                if (!base64Data) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'base64Data is required' }));
                  return;
                }
                const result = await matchRealtimeAiGenerator(base64Data, mimeType || 'image/jpeg', customQuery);
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(result));
              } catch (parseError: any) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: parseError?.message || 'Failed to match AI generator' }));
              }
            });
          } catch (e: any) {
            next(e);
          }
        } else if (req.url === '/api/generate-video' && req.method === 'POST') {
          try {
            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', async () => {
              try {
                const { base64Data, mimeType, prompt, aspectRatio } = JSON.parse(body);
                if (!base64Data) {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'base64Data is required' }));
                  return;
                }
                const result = await startVideoGeneration({
                  base64Data,
                  mimeType: mimeType || 'image/jpeg',
                  prompt,
                  aspectRatio: aspectRatio === '9:16' ? '9:16' : '16:9',
                });
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(result));
              } catch (parseError: any) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: parseError?.message || 'Failed to start video generation' }));
              }
            });
          } catch (e: any) {
            next(e);
          }
        } else if (req.url === '/api/video-status' && req.method === 'POST') {
          try {
            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', async () => {
              try {
                const { operationName } = JSON.parse(body);
                const status = await checkVideoStatus(operationName);
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify(status));
              } catch (parseError: any) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: parseError?.message || 'Failed to check video status' }));
              }
            });
          } catch (e: any) {
            next(e);
          }
        } else if (req.url === '/api/video-download' && req.method === 'POST') {
          try {
            let body = '';
            req.on('data', (chunk) => {
              body += chunk;
            });
            req.on('end', async () => {
              try {
                const { operationName } = JSON.parse(body);
                const { stream, contentType } = await downloadVideoBuffer(operationName);
                res.statusCode = 200;
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
              } catch (parseError: any) {
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: parseError?.message || 'Failed to download video' }));
              }
            });
          } catch (e: any) {
            next(e);
          }
        } else {
          next();
        }
      });
    },
  };
}


export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), apiServerPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
