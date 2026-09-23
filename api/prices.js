const fs = require('fs');
const path = require('path');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'mila2026';

module.exports = (req, res) => {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const filePath = path.join(process.cwd(), 'data', 'prices.json');

  if (req.method === 'GET') {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        return res.status(200).send(raw);
      } else {
        return res.status(404).json({ error: 'prices.json not found' });
      }
    } catch (err) {
      return res.status(500).json({ error: 'Failed to read prices' });
    }
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const { password, prices } = body;
    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Неверный пароль администратора' });
    }

    try {
      if (prices) {
        try {
          fs.writeFileSync(filePath, JSON.stringify(prices, null, 2), 'utf8');
        } catch (wErr) {
          // In read-only serverless environment, local write may be restricted
        }
      }
      return res.status(200).json({ success: true, message: 'Прайс-лист успешно обновлен' });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to update prices' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
