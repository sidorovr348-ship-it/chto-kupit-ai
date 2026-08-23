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


app.post('/search', async (req, res) => {
  try {
    const {
      query,
      mode = 'find',
      location = 'Находка, Приморский край, Россия'
    } = req.body;

    if (!query) {
      return res.status(400).json({
        ok: false,
        error: 'query is required'
      });
    }

    if (!process.env.SERPER_API_KEY) {
      return res.status(500).json({
        ok: false,
        error: 'SERPER_API_KEY is not configured'
      });
    }

    let searchQuery;

    if (mode === 'cheaper') {
      searchQuery =
        `${query} похожий аналог дешевле цена купить ${actualLocation}`;
    } else {
      searchQuery =
        `${query} купить цена ${actualLocation}`;
    }

    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': process.env.SERPER_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        q: searchQuery,
        gl: 'ru',
        hl: 'ru',
        num: 20
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('SERPER ERROR:', JSON.stringify(data));
      return res.status(response.status).json({
        ok: false,
        error: data
      });
    }

    const allowed = [
      'ozon.ru',
      'wildberries.ru',
      'market.yandex.ru',
      'dns-shop.ru',
      'mvideo.ru',
      'citilink.ru'
    ];

    const results = Array.isArray(data.organic)
      ? data.organic
          .filter(item => {
            const url = String(item.link || '').toLowerCase();

            if (!allowed.some(domain => url.includes(domain))) {
              return false;
            }

            if (
              url.includes('global.wildberries.ru') ||
              url.includes('/usa') ||
              url.includes('/us/')
            ) {
              return false;
            }

            return true;
          })
          .map(item => ({
            title: item.title || '',
            url: item.link || '',
            content: item.snippet || ''
          }))
          .slice(0, 10)
      : [];

    res.json({
      ok: true,
      mode,
      location: actualLocation,
      results
    });

  } catch (error) {
    console.error('SEARCH ERROR:', error);

    res.status(500).json({
      ok: false,
      error: 'Search request failed'
    });
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`ЧтоКупить AI API запущен на 127.0.0.1:${PORT}`);
});
