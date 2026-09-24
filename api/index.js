'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const ROOT_DIR = path.join(__dirname, '..');
const PRICES_FILE = path.join(ROOT_DIR, 'data', 'prices.json');
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'mila2026';

app.use(express.json({ limit: '2mb' }));

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});

// API Routes
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
        // Read-only filesystem fallback in serverless
      }
    }
    return res.status(200).json({ success: true, message: 'Прайс-лист успешно обновлен' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update prices' });
  }
});

// Static assets
app.use('/assets', express.static(path.join(ROOT_DIR, 'assets'), { maxAge: '7d' }));
app.use('/css', express.static(path.join(ROOT_DIR, 'css'), { maxAge: '1d' }));
app.use('/js', express.static(path.join(ROOT_DIR, 'js'), { maxAge: '1d' }));
app.use('/data', express.static(path.join(ROOT_DIR, 'data'), { maxAge: '1m' }));

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

// Root landing & regional contacts alias
app.get(['/', '/index.html', '/contacts', '/contacts.html'], (req, res) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=300');
  res.sendFile(path.join(ROOT_DIR, 'index.html'));
});

module.exports = app;
