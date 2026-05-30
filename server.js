const http  = require('http');
const https = require('https');
const fs    = require('fs');
const path  = require('path');
require('dotenv').config();

const PORT = 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); }
      catch { reject(new Error('Invalid JSON')); }
    });
  });
}

function httpsPost(url, headers, bodyObj) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(bodyObj);
    const buf  = Buffer.from(body, 'utf8');
    const u    = new URL(url);
    const opts = {
      hostname: u.hostname,
      path:     u.pathname + u.search,
      method:   'POST',
      headers:  { ...headers, 'Content-Length': buf.length },
    };
    const req = https.request(opts, res => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({
        status: res.statusCode,
        json: () => JSON.parse(Buffer.concat(chunks).toString('utf8')),
      }));
    });
    req.on('error', reject);
    req.write(buf);
    req.end();
  });
}

http.createServer(async (req, res) => {

  if (req.method === 'POST' && req.url === '/api/claude') {
    try {
      const { prompt, maxTokens = 512 } = await readBody(req);
      const up = await httpsPost(
        'https://api.anthropic.com/v1/messages',
        {
          'Content-Type':      'application/json',
          'x-api-key':         process.env.ANTHROPIC_API_KEY || '',
          'anthropic-version': '2023-06-01',
        },
        { model: 'claude-sonnet-4-20250514', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }
      );
      const data = up.json();
      res.writeHead(up.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/openrouter') {
    try {
      const { prompt, maxTokens = 800, model = 'nvidia/nemotron-3-super-120b-a12b:free' } = await readBody(req);
      const up = await httpsPost(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          'Content-Type':  'application/json',
          'Authorization': 'Bearer ' + (process.env.OPENROUTER_API_KEY || ''),
          'X-Title':       'Wordbook',
        },
        { model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }
      );
      const data = up.json();
      res.writeHead(up.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  const filePath = path.join(__dirname, req.url === '/' ? 'index.html' : req.url);
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); res.end('Not found'); return; }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
    res.end(data);
  });

}).listen(PORT, () => {
  console.log('서버 실행: http://localhost:' + PORT);
});
