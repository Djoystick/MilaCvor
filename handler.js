/* ============================================================
   handler.js — Yandex Cloud Functions Serverless Handler
   Fotofeya Mila Portfolio (цвор.рф)
============================================================ */
'use strict';

const serverless = require('serverless-http');
const app = require('./api/index');

const serverlessHandler = serverless(app, {
  binary: [
    'image/*',
    'font/*',
    'application/octet-stream',
    'application/pdf'
  ]
});

module.exports.handler = async (event, context) => {
  if (event && event.url) {
    const cleanPath = event.url.split('?')[0] || '/';
    event.path = cleanPath;
    event.requestPath = cleanPath;
    event.rawPath = cleanPath;
  }
  return await serverlessHandler(event, context);
};
