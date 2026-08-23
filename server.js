require('dotenv').config({ path: '/root/chto-kupit-ai.env' });

const express = require('express');

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '15mb' }));

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});


app.get('/health', (req, res) => {
  res.json({
    ok: true,
    service: 'chto-kupit-ai-api',
    ai_token: Boolean(process.env.HF_TOKEN)
  });
});

app.post('/analyze', async (req, res) => {
  try {
    const { prompt, image, images } = req.body;

    const inputImages = Array.isArray(images)
      ? images
      : (image ? [image] : []);

    if (!prompt && inputImages.length === 0) {
      return res.status(400).json({
        ok: false,
        error: 'prompt or image/images is required'
      });
    }

    const content = [];

    if (prompt) {
      content.push({
        type: 'text',
        text: prompt
      });
    }

    for (const item of inputImages) {
      const imageData = item.startsWith('data:')
        ? item
        : `data:image/jpeg;base64,${item}`;

      content.push({
        type: 'image_url',
        image_url: {
          url: imageData
        }
      });
    }

    const response = await fetch(
      'https://router.huggingface.co/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HF_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'Qwen/Qwen2.5-VL-72B-Instruct',
          messages: [
            {
              role: 'user',
              content
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('HF ERROR:', JSON.stringify(data));
      return res.status(response.status).json({
        ok: false,
        error: data
      });
    }

    res.json({
      ok: true,
      result: data.choices?.[0]?.message?.content || ''
    });

  } catch (error) {
    console.error('AI ERROR:', error);

    res.status(500).json({
      ok: false,
      error: 'AI request failed'
    });
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`ЧтоКупить AI API запущен на 127.0.0.1:${PORT}`);
});
