'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const app = express();
const ROOT_DIR = path.join(__dirname, '..');
const PRICES_FILE = path.join(ROOT_DIR, 'data', 'prices.json');
const PORTFOLIO_FILE = path.join(ROOT_DIR, 'data', 'portfolio.json');
const LEADS_FILE = path.join(ROOT_DIR, 'data', 'leads.json');

// Telegram Notification configuration (Optional environment variables)
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '';

// Admin Password & Hash Configuration (Zero plaintext client exposure)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'mila2026';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || crypto.createHash('sha256').update(ADMIN_PASSWORD).digest('hex');

// VK Service Token from environment (with fallback for dev)
const VK_SERVICE_TOKEN = (process.env.VK_SERVICE_TOKEN || '6aae6a7a6aae6a7a6aae6a7a9d69edbd7b66aae6aae6a7a0002bae5ba8df3e63de6749d').trim();

// In-Memory Sessions & Rate Limit Store
const activeSessions = new Map(); // token -> expiresAt
const rateLimitStore = new Map(); // key -> { count, resetAt }

function isRateLimited(key, maxLimit = 10, windowMs = 60 * 1000) {
  const now = Date.now();
  const entry = rateLimitStore.get(key) || { count: 0, resetAt: now + windowMs };
  if (now > entry.resetAt) {
    entry.count = 1;
    entry.resetAt = now + windowMs;
    rateLimitStore.set(key, entry);
    return false;
  }
  entry.count++;
  rateLimitStore.set(key, entry);
  return entry.count > maxLimit;
}

// Timing-safe password and session verification
function verifyAdminSecret(secret) {
  if (!secret || typeof secret !== 'string') return false;
  const clean = secret.trim();
  const now = Date.now();

  // 1. Check active session tokens
  if (activeSessions.has(clean)) {
    if (activeSessions.get(clean) > now) return true;
    activeSessions.delete(clean);
  }

  // 2. Timing-safe comparison with admin password hash
  const inputHash = crypto.createHash('sha256').update(clean).digest('hex');
  if (inputHash.length === ADMIN_PASSWORD_HASH.length) {
    try {
      return crypto.timingSafeEqual(Buffer.from(inputHash, 'utf8'), Buffer.from(ADMIN_PASSWORD_HASH, 'utf8'));
    } catch (_) {
      return false;
    }
  }
  return false;
}

// Admin Authentication Middleware
function requireAdminAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const tokenHeader = req.headers['x-admin-token'] || '';
  let candidate = '';

  if (authHeader.startsWith('Bearer ')) {
    candidate = authHeader.substring(7).trim();
  } else if (tokenHeader) {
    candidate = String(tokenHeader).trim();
  } else if (req.body && (req.body.token || req.body.password)) {
    candidate = String(req.body.token || req.body.password).trim();
  }

  if (candidate && verifyAdminSecret(candidate)) {
    return next();
  }
  return res.status(401).json({ error: 'Неверные учетные данные администратора или срок сессии истек' });
}

// Limit request body
app.use(express.json({ limit: '12mb' }));

// Comprehensive HTTP Security Headers & Restricted CORS
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://unpkg.com; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com; img-src 'self' data: https: blob:; font-src 'self' https://fonts.gstatic.com data:; connect-src 'self' https://api.vk.com https://*.yandexcloud.net;"
  );

  const origin = req.headers.origin;
  const allowedOrigins = [
    'https://xn--b1aygv.xn--p1ai',
    'https://цвор.рф',
    'https://mila-tsvor.vercel.app',
    'http://localhost:5055',
    'http://127.0.0.1:5055'
  ];
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Admin-Token');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

// ── AUTH LOGIN API (Protected from brute-force) ─────────────────────────────
app.post('/api/auth/login', (req, res) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  if (isRateLimited(`login:${clientIp}`, 5, 15 * 60 * 1000)) {
    return res.status(429).json({ error: 'Слишком много попыток входа. Попробуйте снова через 15 минут.' });
  }

  const { password } = req.body || {};
  if (!password || !verifyAdminSecret(String(password))) {
    return res.status(401).json({ error: 'Неверный пароль администратора' });
  }

  // Issue random secure session token valid for 4 hours
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const ttlMs = 4 * 3600 * 1000;
  activeSessions.set(sessionToken, Date.now() + ttlMs);

  return res.status(200).json({
    success: true,
    token: sessionToken,
    expiresIn: 14400
  });
});

// ── BOOKING LEADS API (Antispam, Logging & Telegram Alerts) ──────────────────
app.post('/api/booking', async (req, res) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  if (isRateLimited(`booking:${clientIp}`, 5, 10 * 60 * 1000)) {
    return res.status(429).json({ error: 'Слишком много запросов. Пожалуйста, подождите немного перед отправкой новой заявки.' });
  }

  const { name, phone, package: pkg, date, notes } = req.body || {};

  const cleanName = (name && String(name).trim().slice(0, 100)) || '';
  const cleanPhone = (phone && String(phone).trim().slice(0, 30)) || '';
  const cleanPkg = (pkg && String(pkg).trim().slice(0, 100)) || 'Не выбран';
  const cleanDate = (date && String(date).trim().slice(0, 50)) || 'Дата уточняется';
  const cleanNotes = (notes && String(notes).trim().slice(0, 500)) || '';

  if (!cleanName || cleanName.length < 2) {
    return res.status(400).json({ error: 'Пожалуйста, укажите ваше имя (не менее 2 символов)' });
  }

  const digits = cleanPhone.replace(/\D/g, '');
  if (digits.length < 11) {
    return res.status(400).json({ error: 'Пожалуйста, укажите полный номер телефона' });
  }

  const newLead = {
    id: `lead_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    createdAt: new Date().toISOString(),
    name: cleanName,
    phone: cleanPhone,
    package: cleanPkg,
    date: cleanDate,
    notes: cleanNotes,
    ip: String(clientIp).slice(0, 45)
  };

  // 1. Record lead locally / to temporary storage
  try {
    let leads = [];
    if (fs.existsSync(LEADS_FILE)) {
      try {
        leads = JSON.parse(fs.readFileSync(LEADS_FILE, 'utf8'));
      } catch (_) {
        leads = [];
      }
    }
    leads.unshift(newLead);
    if (leads.length > 200) leads = leads.slice(0, 200);
    try {
      fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf8');
    } catch (wErr) {
      // serverless fallback
    }
  } catch (err) {
    console.warn('Leads write warning:', err.message);
  }

  // 2. Dispatch Telegram Bot notification if credentials configured
  let tgSent = false;
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    try {
      const tgText = `🌸 *Новая заявка на съемку с сайта цвор.рф!*\n\n` +
        `👤 *Имя:* ${cleanName}\n` +
        `📞 *Телефон:* [${cleanPhone}](tel:${digits})\n` +
        `📦 *Тариф:* ${cleanPkg}\n` +
        `📅 *Дата:* ${cleanDate}\n` +
        `💬 *Пожелания:* ${cleanNotes || '—'}\n` +
        `⏱ *Время:* ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const tgRes = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: tgText,
          parse_mode: 'Markdown'
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);
      const tgData = await tgRes.json();
      tgSent = Boolean(tgData && tgData.ok);
    } catch (tgErr) {
      console.warn('Telegram notification dispatch failed:', tgErr.message);
    }
  }

  return res.status(200).json({
    success: true,
    message: 'Заявка успешно зафиксирована! Мила свяжется с вами в ближайшее время.',
    leadId: newLead.id,
    telegramNotified: tgSent
  });
});

// ── SERVERLESS EROFS-SAFE STORAGE PROVIDER ──────────────────────────────────
const TMP_DATA_DIR = path.join('/tmp', 'fotofeya_data');
const TMP_PRICES_FILE = path.join(TMP_DATA_DIR, 'prices.json');
const TMP_PORTFOLIO_FILE = path.join(TMP_DATA_DIR, 'portfolio.json');

let memoryPricesCache = null;
let memoryPortfolioCache = null;

function loadStoredPrices() {
  if (memoryPricesCache) return memoryPricesCache;
  if (fs.existsSync(TMP_PRICES_FILE)) {
    try {
      memoryPricesCache = JSON.parse(fs.readFileSync(TMP_PRICES_FILE, 'utf8'));
      return memoryPricesCache;
    } catch (_) {}
  }
  if (fs.existsSync(PRICES_FILE)) {
    try {
      memoryPricesCache = JSON.parse(fs.readFileSync(PRICES_FILE, 'utf8'));
      return memoryPricesCache;
    } catch (_) {}
  }
  return null;
}

function persistStoredPrices(newPrices) {
  memoryPricesCache = newPrices;
  try {
    fs.writeFileSync(PRICES_FILE, JSON.stringify(newPrices, null, 2), 'utf8');
    return true;
  } catch (err) {
    try {
      if (!fs.existsSync(TMP_DATA_DIR)) {
        fs.mkdirSync(TMP_DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(TMP_PRICES_FILE, JSON.stringify(newPrices, null, 2), 'utf8');
      return true;
    } catch (tmpErr) {
      console.warn('Persistent storage warning (prices):', tmpErr.message);
      return false;
    }
  }
}

function loadStoredPortfolio() {
  if (memoryPortfolioCache) return memoryPortfolioCache;
  if (fs.existsSync(TMP_PORTFOLIO_FILE)) {
    try {
      memoryPortfolioCache = JSON.parse(fs.readFileSync(TMP_PORTFOLIO_FILE, 'utf8'));
      return memoryPortfolioCache;
    } catch (_) {}
  }
  if (fs.existsSync(PORTFOLIO_FILE)) {
    try {
      memoryPortfolioCache = JSON.parse(fs.readFileSync(PORTFOLIO_FILE, 'utf8'));
      return memoryPortfolioCache;
    } catch (_) {}
  }
  return [];
}

function persistStoredPortfolio(items) {
  memoryPortfolioCache = items;
  try {
    fs.writeFileSync(PORTFOLIO_FILE, JSON.stringify(items, null, 2), 'utf8');
    return true;
  } catch (err) {
    try {
      if (!fs.existsSync(TMP_DATA_DIR)) {
        fs.mkdirSync(TMP_DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(TMP_PORTFOLIO_FILE, JSON.stringify(items, null, 2), 'utf8');
      return true;
    } catch (tmpErr) {
      console.warn('Persistent storage warning (portfolio):', tmpErr.message);
      return false;
    }
  }
}

// ── PRICES API ──────────────────────────────────────────────────────────────
app.get('/api/prices', (req, res) => {
  try {
    const prices = loadStoredPrices();
    if (prices) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
      return res.status(200).json(prices);
    }
    return res.status(404).json({ error: 'prices.json not found' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to read prices' });
  }
});

app.post('/api/prices', requireAdminAuth, (req, res) => {
  const { prices } = req.body || {};
  if (prices) {
    prices.lastUpdated = new Date().toISOString();
    persistStoredPrices(prices);
    return res.status(200).json({ success: true, message: 'Прайс-лист успешно обновлен' });
  }
  return res.status(400).json({ error: 'Не переданы данные цен' });
});

// ── PORTFOLIO API ───────────────────────────────────────────────────────────
app.get('/api/portfolio', (req, res) => {
  try {
    const items = loadStoredPortfolio();
    const all = req.query.all === '1';
    const filtered = all ? items : items.filter(i => i.isActive !== false);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    return res.status(200).json(filtered);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to read portfolio' });
  }
});

app.post('/api/portfolio', requireAdminAuth, (req, res) => {
  const { items } = req.body || {};
  if (Array.isArray(items)) {
    persistStoredPortfolio(items);
    return res.status(200).json({ success: true, message: 'Галерея успешно обновлена' });
  }
  return res.status(400).json({ error: 'Некорректный формат данных (ожидался массив)' });
});

// ── SYNC VK ALBUMS & PHOTOS (Поддержка ключа сообщества и сервисного ключа) ──
app.post('/api/portfolio/sync-vk', requireAdminAuth, async (req, res) => {
  const { albumUrl, vkToken, count = 50 } = req.body || {};

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

    let token = (vkToken || VK_SERVICE_TOKEN).trim();

    const sizeOrder = ['w', 'z', 'y', 'x', 'm', 's'];
    const extractBestPhoto = (sizes) => {
      if (!Array.isArray(sizes) || sizes.length === 0) return null;
      for (const t of sizeOrder) {
        const found = sizes.find(s => s.type === t);
        if (found) return found;
      }
      return sizes[sizes.length - 1];
    };

    // Метод 1: Получение фото из постов стены
    const fetchFromWall = async (useToken = token, retryCount = 0) => {
      const wallUrl = new URL('https://api.vk.com/method/wall.get');
      wallUrl.searchParams.set('owner_id', ownerId);
      wallUrl.searchParams.set('count', String(Math.min(Number(count) || 50, 100)));
      wallUrl.searchParams.set('filter', 'owner');
      wallUrl.searchParams.set('v', '5.199');
      wallUrl.searchParams.set('access_token', useToken);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const wallRes = await fetch(wallUrl.toString(), { signal: controller.signal });
      clearTimeout(timeout);
      const wallData = await wallRes.json();

      if (wallData.error) {
        // Если передан токен сообщества (код 27) — автоматически используем встроенный сервисный токен
        if (wallData.error.error_code === 27 && useToken !== VK_SERVICE_TOKEN && retryCount === 0) {
          return await fetchFromWall(VK_SERVICE_TOKEN, 1);
        }
        if (wallData.error.error_code === 5) {
          if (useToken !== VK_SERVICE_TOKEN && retryCount === 0) {
            return await fetchFromWall(VK_SERVICE_TOKEN, 1);
          }
          throw new Error('Неверный ключ доступа VK или истек срок его действия.');
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
              const caption = (p.text && p.text.trim()) || 
                (post.text && post.text.trim().split('\n')[0].slice(0, 100)) || 
                'Сказочная съемка';
              extracted.push({
                vkId: p.id,
                ownerId: p.owner_id,
                imageUrl: best.url,
                date: p.date ? new Date(p.date * 1000).toISOString() : (post.date ? new Date(post.date * 1000).toISOString() : new Date().toISOString()),
                text: caption,
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
        if (vkData.error.error_code === 27 || vkData.error.error_code === 1051) {
          photos = await fetchFromWall(VK_SERVICE_TOKEN);
          warningNote = 'Загружены свежие фотоработы со стены группы ВКонтакте!';
        } else {
          photos = await fetchFromWall(VK_SERVICE_TOKEN);
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
            text: p.text || 'Фото из альбома VK',
            width: best ? best.width : 0,
            height: best ? best.height : 0
          };
        }).filter(p => Boolean(p.imageUrl));
      }
    } else {
      photos = await fetchFromWall(token);
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

// Helper for image format detection by Magic Bytes
function detectImageExtension(buffer) {
  if (!buffer || buffer.length < 8) return null;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return 'jpg';
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return 'png';
  // WebP: RIFF (bytes 0-3) ... WEBP (bytes 8-11)
  if (buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP') return 'webp';
  return null;
}

// ── MANUAL PHOTO UPLOAD OR EXTERNAL URL IMPORT ──────────────────────────────
app.post('/api/portfolio/upload', requireAdminAuth, (req, res) => {
  const { base64, imageUrl, title, category, categoryLabel, description } = req.body || {};

  if (!base64 && !imageUrl) {
    return res.status(400).json({ error: 'Не переданы данные изображения (base64 или imageUrl)' });
  }

  try {
    let finalImageUrl = imageUrl;

    if (base64) {
      if (typeof base64 !== 'string' || base64.length > 14 * 1024 * 1024) {
        return res.status(413).json({ error: 'Размер файла превышает допустимый лимит (максимум 10 МБ)' });
      }

      const uploadDir = path.join(ROOT_DIR, 'assets', 'images', 'uploads');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const cleanBase64 = base64.replace(/^data:image\/[a-zA-Z0-9+]+;base64,/, '');
      const fileBuffer = Buffer.from(cleanBase64, 'base64');

      // Strict validation of Magic Bytes (JPEG, PNG, WebP only)
      const detectedExt = detectImageExtension(fileBuffer);
      if (!detectedExt) {
        return res.status(400).json({ error: 'Недопустимый формат файла. Разрешены только форматы JPEG, PNG, WebP.' });
      }

      // Safe cryptographic filename generation
      const randomSuffix = crypto.randomBytes(4).toString('hex');
      const uniqueName = `upload_${Date.now()}_${randomSuffix}.${detectedExt}`;
      const filePath = path.join(uploadDir, uniqueName);

      try {
        fs.writeFileSync(filePath, fileBuffer);
      } catch (wErr) {
        // Read-only serverless fallback
      }
      finalImageUrl = `assets/images/uploads/${uniqueName}`;
    }

    let portfolio = loadStoredPortfolio();

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
      title: (title && String(title).slice(0, 100)) || 'Новая фоторабота',
      category: cleanCategory,
      categoryLabel: categoryLabel || catLabels[cleanCategory] || 'Сказочные образы',
      image: finalImageUrl,
      description: (description && String(description).slice(0, 300)) || '',
      isActive: true,
      sortOrder: 0,
      dateAdded: new Date().toISOString()
    };

    portfolio.unshift(newItem);
    persistStoredPortfolio(portfolio);

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

// Privacy Policy (152-ФЗ)
app.get(['/privacy', '/privacy.html'], (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.sendFile(path.join(ROOT_DIR, 'privacy.html'));
});

// Root landing & regional contacts alias
app.get(['/', '/index.html', '/contacts', '/contacts.html'], (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

module.exports = app;
