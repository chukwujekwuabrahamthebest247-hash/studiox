import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DEFAULT_GEMINI_MODEL = 'gemini-4-hydrogen';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Google API key (GEMINI_API_KEY) is not configured in Settings > Secrets.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function parseDataUrl(dataUrl: string): { mimeType: string; data: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!match) return null;
  return {
    mimeType: match[1] || 'image/png',
    data: match[2],
  };
}

interface IncomingMessage {
  role: 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

function buildGeminiContents(messages: IncomingMessage[], extraImage?: string | null) {
  const contents = messages.map((msg) => {
    const role = msg.role === 'assistant' ? 'model' : 'user';
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

    if (typeof msg.content === 'string') {
      if (msg.content) {
        parts.push({ text: msg.content });
      }
    } else if (Array.isArray(msg.content)) {
      for (const item of msg.content) {
        if (item.type === 'text' && item.text) {
          parts.push({ text: item.text });
        } else if (item.type === 'image_url' && item.image_url?.url) {
          const parsed = parseDataUrl(item.image_url.url);
          if (parsed) {
            parts.push({ inlineData: parsed });
          }
        }
      }
    }

    if (parts.length === 0) {
      parts.push({ text: ' ' });
    }

    return { role, parts };
  });

  if (extraImage && contents.length > 0) {
    const parsed = parseDataUrl(extraImage);
    if (parsed) {
      const lastUser = [...contents].reverse().find((c) => c.role === 'user') || contents[contents.length - 1];
      lastUser.parts.unshift({ inlineData: parsed });
    }
  }

  return contents;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.get('/api/gemini/status', (_req, res) => {
    res.json({
      configured: Boolean(process.env.GEMINI_API_KEY),
      defaultModel: DEFAULT_GEMINI_MODEL,
      models: [
        { id: 'gemini-4-hydrogen', name: 'Gemini 4 Hydrogen', badge: 'Recommended' },
        { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', badge: 'Fast' },
      ],
    });
  });

  app.post('/api/gemini/chat', async (req, res) => {
    try {
      const {
        model,
        systemPrompt,
        messages,
        temperature,
        image,
        responseMimeType,
      } = req.body as {
        model?: string;
        systemPrompt?: string;
        messages?: IncomingMessage[];
        temperature?: number;
        image?: string | null;
        responseMimeType?: string;
      };

      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: 'messages array is required.' });
        return;
      }

      const ai = getGeminiClient();
      const targetModel = (model && typeof model === 'string' && model.trim()) || DEFAULT_GEMINI_MODEL;
      const contents = buildGeminiContents(messages, image);

      const config: Record<string, unknown> = {};
      if (systemPrompt && systemPrompt.trim()) {
        config.systemInstruction = systemPrompt;
      }
      if (responseMimeType) {
        config.responseMimeType = responseMimeType;
      }
      // Gemini 4 series models do not accept legacy temperature/topP/topK sampling parameters.
      if (typeof temperature === 'number' && !targetModel.startsWith('gemini-4-')) {
        config.temperature = temperature;
      }

      const response = await ai.models.generateContent({
        model: targetModel,
        contents,
        config: Object.keys(config).length > 0 ? config : undefined,
      });

      const text = response.text ?? '';
      if (!text.trim()) {
        res.status(502).json({ error: 'Google Gemini returned an empty response.' });
        return;
      }

      res.json({ text, model: targetModel });
    } catch (err: any) {
      const status =
        typeof err?.status === 'number'
          ? err.status
          : typeof err?.code === 'number'
          ? err.code
          : 500;
      const message = err?.message || 'Google Gemini request failed.';
      res.status(status >= 400 && status < 600 ? status : 500).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.join(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`StudioX server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start StudioX server:', err);
  process.exit(1);
});
