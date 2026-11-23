import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { generateThaiFemaleQueueTts } from './server/gemini.ts';

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  // Thai female voice queue announcement via Gemini TTS
  app.post('/api/tts', async (req, res) => {
    const rawQueue =
      typeof req.body?.queueNo === 'string' ? req.body.queueNo.trim() : '';
    const counter = Number(req.body?.counter);

    if (
      !/^[A-E]-?\d{1,4}$/i.test(rawQueue) ||
      !Number.isInteger(counter) ||
      counter < 1 ||
      counter > 5
    ) {
      res.status(400).json({ error: 'ข้อมูลหมายเลขคิวหรือช่องบริการไม่ถูกต้อง' });
      return;
    }

    try {
      const result = await generateThaiFemaleQueueTts(rawQueue, counter);
      res.json(result);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'ไม่สามารถสร้างเสียงประกาศเรียกคิวได้';
      const status = message.includes('GEMINI_API_KEY') ? 503 : 502;
      res.status(status).json({ error: message });
    }
  });

  // Ensure unknown /api routes return JSON 404
  app.all('/api/*', (_req, res) => {
    res.status(404).json({ error: 'ไม่พบ API ที่ร้องขอ' });
  });

  // Frontend Vite middleware in dev, static dist in production when built
  const distDir = path.resolve(process.cwd(), 'dist');
  const distIndex = path.resolve(distDir, 'index.html');
  const hasDist = fs.existsSync(distIndex);
  const preferDist = process.env.NODE_ENV === 'production' && hasDist;

  let mountedVite = false;
  if (!preferDist) {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
      mountedVite = true;
    } catch (err) {
      if (hasDist) {
        console.warn('Vite dev middleware unavailable, serving dist:', err);
      } else {
        throw err;
      }
    }
  }

  if (!mountedVite) {
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(distIndex);
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(
      `Phang Nga Queue Booking Server listening on http://0.0.0.0:${port}`,
    );
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
