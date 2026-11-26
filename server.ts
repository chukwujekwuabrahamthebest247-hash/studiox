import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const DEFAULT_MODEL = 'qwen2.5-7b-instruct';

interface IncomingMessage {
  role: 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

function buildOpenAIMessages(systemPrompt: string | undefined, messages: IncomingMessage[]) {
  const formatted: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];

  if (systemPrompt && systemPrompt.trim()) {
    formatted.push({ role: 'system', content: systemPrompt.trim() });
  }

  for (const msg of messages) {
    let textContent = '';
    if (typeof msg.content === 'string') {
      textContent = msg.content;
    } else if (Array.isArray(msg.content)) {
      textContent = msg.content
        .filter((item) => item.type === 'text' && item.text)
        .map((item) => item.text)
        .join('\n');
    }

    if (textContent.trim()) {
      formatted.push({ role: msg.role, content: textContent });
    }
  }

  return formatted;
}

const app = express();
app.use(express.json({ limit: '25mb' }));

app.get('/api/gemini/status', (_req, res) => {
  res.json({
    configured: Boolean(process.env.OPENAI_BASE_URL),
    defaultModel: DEFAULT_MODEL,
    models: [
      { id: 'qwen2.5-7b-instruct', name: 'Qwen 2.5 7B (Colab)', badge: 'Recommended' },
    ],
  });
});

app.post('/api/gemini/chat', async (req, res) => {
  try {
    const baseUrl = process.env.OPENAI_BASE_URL?.replace(/\/+$/, '');
    if (!baseUrl) {
      res.status(500).json({ error: 'OPENAI_BASE_URL is not configured in Vercel Environment Variables.' });
      return;
    }

    const {
      systemPrompt,
      messages,
      temperature,
    } = req.body as {
      model?: string;
      systemPrompt?: string;
      messages?: IncomingMessage[];
      temperature?: number;
    };

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages array is required.' });
      return;
    }

    const openAIMessages = buildOpenAIMessages(systemPrompt, messages);

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY || 'sk-no-key-required'}`,
        'Bypass-Tunnel-Reminder': 'true',
      },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        messages: openAIMessages,
        temperature: typeof temperature === 'number' ? temperature : 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      res.status(response.status).json({ error: `Colab AI server error (${response.status}): ${errText}` });
      return;
    }

    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content ?? '';

    if (!text.trim()) {
      res.status(502).json({ error: 'Colab AI model returned an empty response.' });
      return;
    }

    res.json({ text, model: DEFAULT_MODEL });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to reach Colab AI server.' });
  }
});

// Only listen on a port when running locally (Vercel uses the exported app)
if (!process.env.VERCEL) {
  (async () => {
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
      console.log(`StudioX server listening on http://0.0.0:${PORT}`);
    });
  })();
}

export default app;
