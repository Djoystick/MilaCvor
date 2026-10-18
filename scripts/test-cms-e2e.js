const puppeteer = require('puppeteer-core');
const path = require('path');
const http = require('http');
const express = require('express');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function run() {
  console.log('🌸 [E2E] Запуск автономного теста расширенной CMS админ-панели...');

  const app = express();
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));
  
  const apiRouter = require('../api/index.js');
  app.use(apiRouter);
  app.use(express.static(path.resolve(__dirname, '..')));

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`📡 [E2E] Тестовый сервер поднят на: ${baseUrl}`);

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // 1. Открываем сайт с хэшем #admin
  console.log('🔑 [E2E] Переходим по URL с хэшем #admin...');
  await page.goto(`${baseUrl}/#admin`, { waitUntil: 'networkidle0' });

  // 2. Проверяем модальное окно авторизации
  await page.waitForSelector('#admin-auth-modal', { visible: true });
  console.log('✅ [E2E] Модальное окно авторизации появилось');

  // 3. Вводим пароль администратора
  await page.type('#admin-password-input', 'mila2026');
  await page.click('#admin-auth-submit');

  // 4. Проверяем, что открылась панель управления со всеми 5 вкладками
  await page.waitForSelector('#admin-price-modal', { visible: true });
  console.log('✅ [E2E] Авторизация успешна! Открыта панель управления');

  const tabsCount = await page.$$eval('.admin-tab-btn', els => els.length);
  console.log(`   Количество вкладок управления: ${tabsCount}`);
  if (tabsCount !== 5) {
    throw new Error(`Ожидалось 5 вкладок, обнаружено: ${tabsCount}`);
  }

  // 5. Тестируем вкладку 3: "Главная & Обо мне"
  console.log('📝 [E2E] Переключаемся на вкладку «Главная & Обо мне»...');
  await page.click('#admin-tab-content');
  await page.waitForSelector('#admin-content-view', { visible: true });

  const initH1 = await page.$eval('#adm-hero-title', el => el.value);
  console.log(`   Текущий заголовок H1 в редакторе: "${initH1.slice(0, 45)}..."`);

  // Меняем заголовок и имя
  const testTitle = 'Подарите ребенку настоящую сказку (Тест CMS)';
  const testAuthor = 'Мила Цвор (Фотофея автор)';

  await page.$eval('#adm-hero-title', (el, val) => el.value = val, testTitle);
  await page.$eval('#adm-about-name', (el, val) => el.value = val, testAuthor);

  console.log('💾 [E2E] Сохраняем новые тексты («Сохранить тексты и фото»)...');
  await page.click('#adm-content-save-btn');
  await new Promise(r => setTimeout(r, 600));

  // Проверяем реактивное обновление на странице сайта
  const liveH1 = await page.$eval('#hero-main-title', el => el.textContent);
  const liveAuthor = await page.$eval('#about-author-name', el => el.textContent);
  console.log(`   Обновленный заголовок на сайте: "${liveH1}"`);
  console.log(`   Обновленное имя автора на сайте: "${liveAuthor}"`);

  if (liveH1 !== testTitle || liveAuthor !== testAuthor) {
    throw new Error('❌ Ошибка: тексты на главной странице не синхронизировались!');
  }
  console.log('✅ [E2E] Реактивная смена текстов Hero и Обо мне работает безупречно!');

  // 6. Тестируем вкладку 5: "Контакты & Сети"
  console.log('📞 [E2E] Переключаемся на вкладку «Контакты & Сети»...');
  await page.click('#admin-tab-contacts');
  await page.waitForSelector('#admin-contacts-view', { visible: true });

  const testPhone = '+7 (999) 555-44-33';
  await page.$eval('#adm-contact-phone', (el, val) => el.value = val, testPhone);
  await page.$eval('#adm-contact-phone-digits', (el, val) => el.value = val, '+79995554433');

  await page.click('#adm-contacts-save-btn');
  await new Promise(r => setTimeout(r, 600));

  const liveHeaderPhone = await page.$eval('#header-phone-text', el => el.textContent);
  const liveHeaderLink = await page.$eval('#header-phone-link', el => el.href);
  console.log(`   Обновленный телефон в шапке: "${liveHeaderPhone}" (${liveHeaderLink})`);

  if (liveHeaderPhone !== testPhone) {
    throw new Error('❌ Ошибка: телефон в шапке не обновился!');
  }
  console.log('✅ [E2E] Смена контактов и телефонных номеров работает безупречно!');

  // 7. Тестируем вкладку 4: "Отзывы & FAQ"
  console.log('⭐ [E2E] Переключаемся на вкладку «Отзывы & FAQ»...');
  await page.click('#admin-tab-reviews-faq');
  await page.waitForSelector('#admin-reviews-faq-view', { visible: true });

  await page.click('#adm-add-review-btn');
  const reviewsCount = await page.$$eval('#adm-reviews-list > div', els => els.length);
  console.log(`   Количество отзывов в списке после добавления: ${reviewsCount}`);

  await page.click('#adm-add-faq-btn');
  const faqCount = await page.$$eval('#adm-faq-list > div', els => els.length);
  console.log(`   Количество FAQ вопросов после добавления: ${faqCount}`);

  // 8. Проверяем работу кнопок сброса к исходным значениям (Reset to Factory Defaults)
  console.log('🔄 [E2E] Проверяем сброс к исходным значениям...');
  page.on('dialog', async dialog => {
    await dialog.accept();
  });

  await page.click('#admin-tab-content');
  await page.click('#adm-content-reset-btn');
  await page.click('#adm-content-save-btn');
  await new Promise(r => setTimeout(r, 500));

  await page.click('#admin-tab-contacts');
  await page.click('#adm-contacts-reset-btn');
  await page.click('#adm-contacts-save-btn');
  await new Promise(r => setTimeout(r, 500));

  await page.click('#admin-tab-reviews-faq');
  await page.click('#adm-reviews-faq-reset-btn');
  await page.click('#adm-reviews-faq-save-btn');
  await new Promise(r => setTimeout(r, 500));

  const restoredH1 = await page.$eval('#hero-main-title', el => el.textContent);
  const restoredPhone = await page.$eval('#header-phone-text', el => el.textContent);
  console.log(`   Восстановленный H1: "${restoredH1.slice(0, 35)}..."`);
  console.log(`   Восстановленный телефон: "${restoredPhone}"`);

  console.log('🎉 [E2E] ВСЕ ТЕСТЫ РАСШИРЕННОЙ CMS АДМИН-ПАНЕЛИ УСПЕШНО ПРОЙДЕНЫ!');

  await browser.close();
  server.close();
}

run().catch(err => {
  console.error('❌ Ошибка в E2E тесте:', err);
  process.exit(1);
});
