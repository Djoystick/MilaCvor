'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const ROOT_DIR = path.join(__dirname, '..');
const PRICES_FILE = path.join(ROOT_DIR, 'data', 'prices.json');
const PORTFOLIO_FILE = path.join(ROOT_DIR, 'data', 'portfolio.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'mila2026';

app.use(express.json({ limit: '15mb' }));

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

// ── PRICES API ──────────────────────────────────────────────────────────────
app.get('/api/prices', (req, res) => {
  try {
    if (fs.existsSync(PRICES_FILE)) {
      const raw = fs.readFileSync(PRICES_FILE, 'utf8');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      return res.status(200).send(raw);
    }
    return res.status(404).json({ error: 'prices.json not found' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to read prices' });
  }
});

app.post('/api/prices', (req, res) => {
  const { password, prices } = req.body || {};
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Неверный пароль администратора' });
  }

  try {
    if (prices) {
      try {
        prices.lastUpdated = new Date().toISOString();
        fs.writeFileSync(PRICES_FILE, JSON.stringify(prices, null, 2), 'utf8');
      } catch (wErr) {
        // Read-only fallback in serverless
      }
    }
    return res.status(200).json({ success: true, message: 'Прайс-лист успешно обновлен' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update prices' });
  }
});

// ── PORTFOLIO API ───────────────────────────────────────────────────────────
app.get('/api/portfolio', (req, res) => {
  try {
    if (fs.existsSync(PORTFOLIO_FILE)) {
      const raw = fs.readFileSync(PORTFOLIO_FILE, 'utf8');
      const items = JSON.parse(raw);
      const all = req.query.all === '1';
      const filtered = all ? items : items.filter(i => i.isActive !== false);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      return res.status(200).json(filtered);
    }
    return res.status(404).json({ error: 'portfolio.json not found' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to read portfolio' });
  }
});

app.post('/api/portfolio', (req, res) => {
  const { password, items } = req.body || {};
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Неверный пароль администратора' });
  }

  try {
    if (Array.isArray(items)) {
      try {
        fs.writeFileSync(PORTFOLIO_FILE, JSON.stringify(items, null, 2), 'utf8');
      } catch (wErr) {
        // Read-only filesystem fallback in serverless
      }
      return res.status(200).json({ success: true, message: 'Галерея успешно обновлена' });
    }
    return res.status(400).json({ error: 'Некорректный формат данных (ожидался массив)' });
  } catch (err) {
    return res.status(500).json({ error: `Ошибка записи портфолио: ${err.message}` });
  }
});

// ── SYNC VK ALBUMS & PHOTOS (Поддержка ключа сообщества и сервисного ключа) ──
app.post('/api/portfolio/sync-vk', async (req, res) => {
  const { password, albumUrl, vkToken, count = 50 } = req.body || {};
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Неверный пароль администратора' });
  }

  try {
    let ownerId = '-240592099'; // Default group ID: club_fotofeya_mila
    let albumId = 'wall';
    let isSpecificAlbum = false;

    if (albumUrl) {
      const albumMatch = String(albumUrl).match(/album(-?\d+)_(\d+|wall|profile|saved)/i);
      const clubMatch = String(albumUrl).match(/(?:club|public)(-?\d+)/i);
      if (albumMatch) {
        const rawOwner = albumMatch[1];
        ownerId = rawOwner.startsWith('-') ? rawOwner : `-${rawOwner}`;
        albumId = albumMatch[2];
        if (albumId !== 'wall') isSpecificAlbum = true;
      } else if (clubMatch) {
        const rawOwner = clubMatch[1];
        ownerId = rawOwner.startsWith('-') ? rawOwner : `-${rawOwner}`;
        albumId = 'wall';
      }
    }

    const token = (vkToken || process.env.VK_SERVICE_TOKEN || '').trim();
    if (!token) {
      return res.status(400).json({ 
        error: 'Пожалуйста, укажите ключ доступа VK (ключ сообщества или сервисный ключ).' 
      });
    }

    const sizeOrder = ['w', 'z', 'y', 'x', 'm', 's'];
    const extractBestPhoto = (sizes) => {
      if (!Array.isArray(sizes) || sizes.length === 0) return null;
      for (const t of sizeOrder) {
        const found = sizes.find(s => s.type === t);
        if (found) return found;
      }
      return sizes[sizes.length - 1];
    };

    // Метод 1: Получение фото из постов стены (работает со всеми типами токенов: Ключ сообщества, Пользователь, Сервисный)
    const fetchFromWall = async () => {
      const wallUrl = new URL('https://api.vk.com/method/wall.get');
      wallUrl.searchParams.set('owner_id', ownerId);
      wallUrl.searchParams.set('count', String(Math.min(Number(count) || 50, 100)));
      wallUrl.searchParams.set('filter', 'owner');
      wallUrl.searchParams.set('v', '5.199');
      wallUrl.searchParams.set('access_token', token);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const wallRes = await fetch(wallUrl.toString(), { signal: controller.signal });
      clearTimeout(timeout);
      const wallData = await wallRes.json();

      if (wallData.error) {
        if (wallData.error.error_code === 5) {
          throw new Error('Неверный ключ доступа VK или истек срок его действия. Создайте свежий ключ в настройках группы (Управление -> Работа с API).');
        }
        throw new Error(wallData.error.error_msg || `код ${wallData.error.error_code}`);
      }

      const items = (wallData.response && wallData.response.items) || [];
      const extracted = [];
      for (const post of items) {
        if (!Array.isArray(post.attachments)) continue;
        for (const att of post.attachments) {
          if (att.type === 'photo' && att.photo) {
            const p = att.photo;
            const best = extractBestPhoto(p.sizes);
            if (best && best.url) {
              extracted.push({
                vkId: p.id,
                ownerId: p.owner_id,
                imageUrl: best.url,
                date: p.date ? new Date(p.date * 1000).toISOString() : (post.date ? new Date(post.date * 1000).toISOString() : new Date().toISOString()),
                text: (p.text && p.text.trim()) || (post.text && post.text.trim().slice(0, 120)) || 'Фотография из сообщества VK',
                width: best.width || 0,
                height: best.height || 0
              });
            }
          }
        }
      }
      return extracted;
    };

    let photos = [];
    let warningNote = null;

    // Если запрошен конкретный закрытый/отдельный альбом — пробуем photos.get
    if (isSpecificAlbum) {
      const vkUrl = new URL('https://api.vk.com/method/photos.get');
      vkUrl.searchParams.set('owner_id', ownerId);
      vkUrl.searchParams.set('album_id', albumId);
      vkUrl.searchParams.set('rev', '1');
      vkUrl.searchParams.set('count', String(Math.min(Number(count) || 50, 100)));
      vkUrl.searchParams.set('photo_sizes', '1');
      vkUrl.searchParams.set('v', '5.199');
      vkUrl.searchParams.set('access_token', token);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const vkRes = await fetch(vkUrl.toString(), { signal: controller.signal });
      clearTimeout(timeout);
      const vkData = await vkRes.json();

      if (vkData.error) {
        // Ошибка 27: токен сообщества не имеет права вызывать photos.get в VK API
        if (vkData.error.error_code === 27) {
          warningNote = 'Ключ сообщества VK поддерживает загрузку фото со стены группы. Загружены свежие фото со стены! Чтобы импортировать отдельный закрытый альбом, создайте сервисный ключ на dev.vk.com.';
          photos = await fetchFromWall();
        } else if (vkData.error.error_code === 5) {
          return res.status(400).json({ error: 'Неверный ключ доступа VK или истек срок его действия.' });
        } else {
          return res.status(400).json({ 
            error: `Ошибка VK API: ${vkData.error.error_msg || 'Неизвестная ошибка'} (код ${vkData.error.error_code})` 
          });
        }
      } else {
        const rawItems = (vkData.response && vkData.response.items) || [];
        photos = rawItems.map(p => {
          const best = extractBestPhoto(p.sizes);
          return {
            vkId: p.id,
            ownerId: p.owner_id,
            imageUrl: best ? best.url : '',
            date: p.date ? new Date(p.date * 1000).toISOString() : new Date().toISOString(),
            text: p.text || '',
            width: best ? best.width : 0,
            height: best ? best.height : 0
          };
        }).filter(p => Boolean(p.imageUrl));
      }
    } else {
      // Стандартный режим (стена группы) — сразу опрашиваем wall.get (идеально для ключа сообщества)
      try {
        photos = await fetchFromWall();
      } catch (wErr) {
        // Если wall.get не сработал — fallback на photos.get (на случай сервисного ключа)
        const vkUrl = new URL('https://api.vk.com/method/photos.get');
        vkUrl.searchParams.set('owner_id', ownerId);
        vkUrl.searchParams.set('album_id', 'wall');
        vkUrl.searchParams.set('rev', '1');
        vkUrl.searchParams.set('count', String(Math.min(Number(count) || 50, 100)));
        vkUrl.searchParams.set('photo_sizes', '1');
        vkUrl.searchParams.set('v', '5.199');
        vkUrl.searchParams.set('access_token', token);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const vkRes = await fetch(vkUrl.toString(), { signal: controller.signal });
        clearTimeout(timeout);
        const vkData = await vkRes.json();
        if (vkData.error) {
          throw new Error(vkData.error.error_msg || `код ${vkData.error.error_code}`);
        }
        const rawItems = (vkData.response && vkData.response.items) || [];
        photos = rawItems.map(p => {
          const best = extractBestPhoto(p.sizes);
          return {
            vkId: p.id,
            ownerId: p.owner_id,
            imageUrl: best ? best.url : '',
            date: p.date ? new Date(p.date * 1000).toISOString() : new Date().toISOString(),
            text: p.text || '',
            width: best ? best.width : 0,
            height: best ? best.height : 0
          };
        }).filter(p => Boolean(p.imageUrl));
      }
    }

    return res.status(200).json({
      success: true,
      count: photos.length,
      warning: warningNote,
      photos
    });
  } catch (err) {
    return res.status(500).json({ error: `Сбой синхронизации с VK: ${err.message}` });
  }
});

// ── MANUAL PHOTO UPLOAD OR EXTERNAL URL IMPORT ──────────────────────────────
app.post('/api/portfolio/upload', (req, res) => {
  const { password, base64, imageUrl, title, category, categoryLabel, description } = req.body || {};
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Неверный пароль администратора' });
  }

  if (!base64 && !imageUrl) {
    return res.status(400).json({ error: 'Не переданы данные изображения (base64 или imageUrl)' });
  }

  try {
    let finalImageUrl = imageUrl;

    if (base64) {
      const uploadDir = path.join(ROOT_DIR, 'assets', 'images', 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const extMatch = base64.match(/^data:image\/([a-zA-Z0-9+]+);base64,/);
      const ext = extMatch ? (extMatch[1] === 'jpeg' ? 'jpg' : extMatch[1]) : 'jpg';
      const cleanBase64 = base64.replace(/^data:image\/[a-zA-Z0-9+]+;base64,/, '');
      const uniqueName = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${ext}`;
      const filePath = path.join(uploadDir, uniqueName);

      fs.writeFileSync(filePath, Buffer.from(cleanBase64, 'base64'));
      finalImageUrl = `assets/images/uploads/${uniqueName}`;
    }

    let portfolio = [];
    if (fs.existsSync(PORTFOLIO_FILE)) {
      portfolio = JSON.parse(fs.readFileSync(PORTFOLIO_FILE, 'utf8'));
    }

    const newId = portfolio.length > 0 ? Math.max(...portfolio.map(p => Number(p.id) || 0)) + 1 : 1;
    const catLabels = {
      fairy: 'Сказочные образы',
      family: 'Детские & Семейные',
      autumn: 'Осенние истории',
      portrait: 'Женский арт-портрет'
    };

    const cleanCategory = category || 'fairy';
    const newItem = {
      id: newId,
      title: title || 'Новая фоторабота',
      category: cleanCategory,
      categoryLabel: categoryLabel || catLabels[cleanCategory] || 'Сказочные образы',
      image: finalImageUrl,
      description: description || '',
      isActive: true,
      sortOrder: 0,
      dateAdded: new Date().toISOString()
    };

    portfolio.unshift(newItem);
    try {
      fs.writeFileSync(PORTFOLIO_FILE, JSON.stringify(portfolio, null, 2), 'utf8');
    } catch (wErr) {
      // serverless fallback
    }

    return res.status(200).json({ success: true, item: newItem });
  } catch (err) {
    return res.status(500).json({ error: `Ошибка добавления фото: ${err.message}` });
  }
});

// Static assets
app.use('/assets', express.static(path.join(ROOT_DIR, 'assets'), { maxAge: '7d' }));
app.use('/css', express.static(path.join(ROOT_DIR, 'css'), { maxAge: '1d' }));
app.use('/js', express.static(path.join(ROOT_DIR, 'js'), { maxAge: '1d' }));
app.use('/data', express.static(path.join(ROOT_DIR, 'data'), { maxAge: '1m' }));

// Favicon & Touch Icon direct routes (for search engine crawlers and browsers)
app.get(['/favicon.ico'], (req, res) => {
  res.setHeader('Content-Type', 'image/x-icon');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(path.join(ROOT_DIR, 'assets', 'images', 'favicon.ico'));
});

app.get(['/apple-touch-icon.png', '/apple-touch-icon-precomposed.png'], (req, res) => {
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(path.join(ROOT_DIR, 'assets', 'images', 'apple-touch-icon.png'));
});

app.get(['/logo.png'], (req, res) => {
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(path.join(ROOT_DIR, 'assets', 'images', 'logo.png'));
});

// SEO Routes
app.get('/robots.txt', (req, res) => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(path.join(ROOT_DIR, 'robots.txt'));
});

app.get('/sitemap.xml', (req, res) => {
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(path.join(ROOT_DIR, 'sitemap.xml'));
});

app.get('/google6a6aa1a658ed51f0.html', (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.sendFile(path.join(ROOT_DIR, 'google6a6aa1a658ed51f0.html'));
});

// Root landing & regional contacts alias
app.get(['/', '/index.html', '/contacts', '/contacts.html'], (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

module.exports = app;
