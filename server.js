/* ============================================================
   server.js — Fotofeya Mila Portfolio Local Runner (цвор.рф)
============================================================ */
'use strict';

const app = require('./api/index');
const PORT = process.env.PORT || 5055;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌸 Фотофея Мила (цвор.рф) запущен → http://localhost:${PORT}`);
});
