import express from 'express';

const app = express();
app.use(express.json({ limit: '25mb' }));

app.get('/api/gemini/status', (_req, res) => {
  res.json({
    configured: Boolean(process.env.OPENAI_BASE_URL),
    defaultModel: 'qwen2.5-7b-instruct',
    models: [{ id: 'qwen2.5-7b-instruct', name: 'Qwen 2.5 7B (Colab)', badge: 'Recommended' }],
  });
});

app.post('/api/gemini/chat', async (req, res) => {
  try {
    const baseUrl = process.env.OPENAI_BASE_URL?.replace(/\/+$/, '');
    if (!baseUrl) {
      res.status(500).json({ error: 'OPENAI_BASE_URL is missing in Vercel.' });
      return;
    }

    const { systemPrompt, messages, temperature } = req.body;
    const formatted: Array<{ role: string; content: string }> = [];

    if (systemPrompt?.trim()) {
      formatted.push({ role: 'system', content: systemPrompt.trim() });
    }

    for (const msg of messages || []) {
      const text = typeof msg.content === 'string'
        ? msg.content
        : Array.isArray(msg.content)
        ? msg.content.filter((i: any) => i.type === 'text').map((i: any) => i.text).join('\n')
        : '';
      if (text.trim()) formatted.push({ role: msg.role, content: text });
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY || 'sk-no-key-required'}`,
        'Bypass-Tunnel-Reminder': 'true',
      },
      body: JSON.stringify({
        model: 'qwen2.5-7b-instruct',
        messages: formatted,
        temperature: typeof temperature === 'number' ? temperature : 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      res.status(response.status).json({ error: `Colab error (${response.status}): ${errText}` });
      return;
    }

    const data = await response.json();
    const text = data?.choices?.?.message?.content ?? '';
    res.json({ text, model: 'qwen2.5-7b-instruct' });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Failed to reach Colab.' });
  }
});

export default app;
