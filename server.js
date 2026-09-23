const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5055;
const BASE_DIR = __dirname;
const DATA_DIR = path.join(BASE_DIR, 'data');
const PRICES_FILE = path.join(DATA_DIR, 'prices.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'mila2026';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff'
};

const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];

  // API Route: Prices
  if (reqPath === '/api/prices') {
    if (req.method === 'GET') {
      fs.readFile(PRICES_FILE, 'utf8', (err, data) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Не удалось прочитать цены' }));
          return;
        }
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache'
        });
        res.end(data);
      });
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => {
        body += chunk.toString();
        if (body.length > 1e6) req.destroy(); // 1MB limit
      });

      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (!parsed.password || parsed.password !== ADMIN_PASSWORD) {
            res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'Неверный пароль администратора' }));
            return;
          }

          if (!parsed.prices) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'Отсутствуют данные цен' }));
            return;
          }

          parsed.prices.lastUpdated = new Date().toISOString();
          fs.writeFileSync(PRICES_FILE, JSON.stringify(parsed.prices, null, 2), 'utf8');

          res.writeHead(200, {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*'
          });
          res.end(JSON.stringify({ success: true, message: 'Прайс-лист успешно сохранен на сервере' }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: 'Ошибка формата JSON' }));
        }
      });
      return;
    }
  }

  // Static File Serving
  if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

  const safePath = path.normalize(reqPath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(BASE_DIR, safePath);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Site_Photographer Server listening on http://localhost:${PORT} and http://127.0.0.1:${PORT}`);
});
