// backend/index.js

import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import { Redis } from '@upstash/redis/with-fetch';

const app = express();
app.use(express.json());
app.use(cors());

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

function normalizeUrl(url) {
  try {
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }
    return new URL(url).href;
  } catch {
    return null;
  }
}

app.post('/api/check', async (req, res) => {
  const { url } = req.body;
  const fullUrl = normalizeUrl(url);
  if (!fullUrl) return res.status(400).json({ error: 'Invalid URL' });

  const domain = new URL(fullUrl).hostname;
let result = {
  url: fullUrl,
  status: 'down',
  code: 0,
  timestamp: Date.now() // 👈 this is the fix
};
  try {
    const response = await fetch(fullUrl, { method: 'GET', timeout: 5000 });
    result.code = response.status;
    result.status = response.status >= 200 && response.status < 400 ? 'up' : 'down';
  } catch (err) {
    result.status = 'down';
  }
 console.log('🧪 DEBUG LINE: This code is live');

  // Store in Redis
  console.log('✅ Saving to Redis:', JSON.stringify(result));
  console.log('🧪 MARKER A — before Redis write');
  console.log('🧪 Type of value being written:', typeof JSON.stringify(result));
console.log('🧪 Sample value:', JSON.stringify(result));

  await redis.lpush(`uptime:history:${domain}`, JSON.stringify(result));
  console.log('🧪 MARKER B — after Redis write');
console.log('🧪 Type of value being written:', typeof JSON.stringify(result));
console.log('🧪 Sample value:', JSON.stringify(result));

  await redis.ltrim(`uptime:history:${domain}`, 0, 49);

  res.json(result);
});

app.get('/api/history', async (req, res) => {
  const { domain } = req.query;
  if (!domain) return res.status(400).json({ error: 'Missing domain' });

  try {
  const history = await redis.lrange(`uptime:history:${domain}`, 0, 49);
  console.log('📥 Raw Redis values:', history);

  const parsed = history.map((entry, i) => {
    try {
      return JSON.parse(entry);
    } catch (err) {
      console.error(`❌ Parse error at [${i}]:`, entry);
      return null;
    }
  }).filter(Boolean);

  res.json({ history: parsed });
} catch {
    res.status(500).json({ error: 'Error fetching history' });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));
