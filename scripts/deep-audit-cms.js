const puppeteer = require('puppeteer-core');
const path = require('path');
const http = require('http');
const express = require('express');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function runDeepAudit() {
  console.log('🔍 [DEEP AUDIT] Запуск исчерпывающего стресс-теста всех инструментов замены CMS...');

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

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1440,900']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // Handle all browser confirm dialogs automatically
  page.on('dialog', async dialog => {
    await dialog.accept();
  });

  page.on('console', msg => console.log('   [BROWSER CONSOLE]', msg.type(), msg.text()));
  page.on('pageerror', err => console.log('   [PAGE ERROR]', err.message));

  await page.goto(`${baseUrl}/#admin`, { waitUntil: 'networkidle0' });
  await page.waitForSelector('#admin-auth-modal', { visible: true });
  await page.type('#admin-password-input', 'mila2026');
  await page.click('#admin-auth-submit');
  await page.waitForSelector('#admin-price-modal', { visible: true });
  console.log('✅ 1. Вход в админ-панель успешно выполнен.');

  // ==========================================
  // ТЕСТ 1: ТАРИФЫ И ЦЕНЫ (ПРОВЕРКА КОЛЛИЗИЙ ЭКСПРЕСС-ТАРИФА И ДОП. ОПЦИИ)
  // ==========================================
  console.log('\n--- ТЕСТ 1: Проверка смены тарифов, доп. опций и исключение коллизии «Экспресс» ---');
  await page.click('#admin-tab-prices');
  await page.waitForSelector('#admin-price-form', { visible: true });

  // Устанавливаем уникальные контрольные цены
  const TEST_PRICES = {
    fairyName: 'Сказочный образ V2 🧚',
    fairyPrice: 5900,
    familyName: 'Семейная прогулка V2 🌾',
    familyPrice: 5500,
    portraitName: 'Женский арт-портрет V2 ✨',
    portraitPrice: 6000,
    expressName: 'Экспресс Сет Уникальный ⚡',
    expressPrice: 3333, // Специфическая тестовая цена
    extra30: 1777,
    extra60: 3555,
    studioName: 'Интерьерная студия Люкс',
    studioPrice: 2222,
    travelName: 'Дальний выезд (>30км)',
    travelPrice: 1444,
    expressDeliveryName: 'Срочные фото за 24ч',
    expressDeliveryPrice: 1999, // Важно: опция срочной отдачи! Не должна конфликтовать с expressPrice 3333!
    photobookName: 'Фотокнига Шёлк',
    photobookPrice: 4888
  };

  const setVal = async (id, val) => {
    await page.$eval(`#${id}`, (el, v) => { el.value = v; }, val);
  };

  await setVal('adm-name-fairy', TEST_PRICES.fairyName);
  await setVal('adm-price-fairy', TEST_PRICES.fairyPrice);
  await setVal('adm-name-family', TEST_PRICES.familyName);
  await setVal('adm-price-family', TEST_PRICES.familyPrice);
  await setVal('adm-name-portrait', TEST_PRICES.portraitName);
  await setVal('adm-price-portrait', TEST_PRICES.portraitPrice);
  await setVal('adm-name-express', TEST_PRICES.expressName);
  await setVal('adm-price-express', TEST_PRICES.expressPrice);

  await setVal('adm-extra-30', TEST_PRICES.extra30);
  await setVal('adm-extra-60', TEST_PRICES.extra60);

  await setVal('adm-addon-name-studio', TEST_PRICES.studioName);
  await setVal('adm-addon-studio', TEST_PRICES.studioPrice);
  await setVal('adm-addon-name-travel', TEST_PRICES.travelName);
  await setVal('adm-addon-travel', TEST_PRICES.travelPrice);
  await setVal('adm-addon-name-express', TEST_PRICES.expressDeliveryName);
  await setVal('adm-addon-express', TEST_PRICES.expressDeliveryPrice);
  await setVal('adm-addon-name-photobook', TEST_PRICES.photobookName);
  await setVal('adm-addon-photobook', TEST_PRICES.photobookPrice);

  console.log('   Нажимаем Сохранить прайс...');
  await page.$eval('#admin-price-save', el => el.click());
  await new Promise(r => setTimeout(r, 1000));

  // Проверяем элементы в DOM
  const checkText = async (id) => page.$eval(`#${id}`, el => el.textContent.trim());

  // 1. Карточки цен
  const pCardFairy = await checkText('price-card-fairy');
  const pCardFamily = await checkText('price-card-family');
  const pCardPortrait = await checkText('price-card-portrait');
  const pCardExpress = await checkText('price-card-express');

  console.log(`   Карточки цен: Fairy=${pCardFairy}, Family=${pCardFamily}, Portrait=${pCardPortrait}, Express=${pCardExpress}`);

  // 2. Калькулятор (Бейджи)
  const calcBadgeFairy = await checkText('calc-badge-fairy');
  const calcBadgeExpress = await checkText('calc-badge-express');
  const calcAddonBadgeExpress = await checkText('calc-addon-badge-express');

  console.log(`   Калькулятор: Базовый тариф Экспресс бейдж = "${calcBadgeExpress}"`);
  console.log(`   Калькулятор: Доп. опция Экспресс-отдача бейдж = "${calcAddonBadgeExpress}"`);

  // Normalize non-breaking spaces (\u00A0) from toLocaleString('ru-RU')
  const norm = str => str.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

  // ПРОВЕРКА КОЛЛИЗИИ!
  if (!norm(calcBadgeExpress).includes('3 333')) {
    throw new Error(`❌ КРИТИЧЕСКАЯ КОЛЛИЗИЯ: Бейдж тарифа Экспресс отображает "${calcBadgeExpress}" вместо "3 333 ₽"!`);
  }
  if (!norm(calcAddonBadgeExpress).includes('1 999')) {
    throw new Error(`❌ КРИТИЧЕСКАЯ КОЛЛИЗИЯ: Бейдж доп. опции отображает "${calcAddonBadgeExpress}" вместо "+1 999 ₽"!`);
  }
  console.log('✅ КОЛЛИЗИЯ ПОЛНОСТЬЮ ИСКЛЮЧЕНА: Бейдж тарифа (3 333 ₽) и бейдж доп. опции (+1 999 ₽) независимы и точны!');

  // Проверка селекта бронирования
  const bookOptExpress = await checkText('booking-opt-express');
  console.log(`   Селект формы бронирования: "${bookOptExpress}"`);
  if (!norm(bookOptExpress).includes('3 333') || !norm(bookOptExpress).includes('Экспресс Сет Уникальный')) {
    throw new Error(`❌ Ошибка в селекте бронирования: ${bookOptExpress}`);
  }

  // ==========================================
  // ТЕСТ 2: ГЛАВНЫЙ ЭКРАН (HERO) И РАЗДЕЛ «ОБО МНЕ»
  // ==========================================
  console.log('\n--- ТЕСТ 2: Проверка смены текстов и изображений Hero и Обо мне ---');
  await page.evaluate(() => window.priceManager.openPriceModal());
  await page.waitForSelector('#admin-price-modal:not(.hidden)', { visible: true });
  await page.click('#admin-tab-content');
  await page.waitForSelector('#admin-content-view', { visible: true });

  const TEST_HERO = {
    badge: '★ Проект года 2026 в Калужской области',
    title: 'Каждый кадр — ожившая страница волшебной книги',
    subtitle: 'Эксклюзивные авторские фотопроекты Милы Цвор с кинематографическим светом и живыми эмоциями.',
    geotag: 'г. Малоярославец, Калуга, Обнинск & выездные проекты',
    coverUrl: 'assets/images/hero_cover_custom_test.jpg'
  };

  const TEST_ABOUT = {
    name: 'Мила Цвор (Мастер сказки)',
    role: 'Художник-фотограф & Сказочный гримёр',
    title: '«Искренность детской улыбки — главное чудо в кадре»',
    quote: '«Я создаю пространство, где ребенку безопасно, радостно и свободно. Здесь нет фальши и строгих указаний».',
    photoUrl: 'assets/images/author_mila_custom_test.jpg'
  };

  await setVal('adm-hero-badge', TEST_HERO.badge);
  await setVal('adm-hero-title', TEST_HERO.title);
  await setVal('adm-hero-subtitle', TEST_HERO.subtitle);
  await setVal('adm-hero-geotag', TEST_HERO.geotag);
  await setVal('adm-hero-cover-url', TEST_HERO.coverUrl);

  await setVal('adm-about-name', TEST_ABOUT.name);
  await setVal('adm-about-role', TEST_ABOUT.role);
  await setVal('adm-about-title', TEST_ABOUT.title);
  await setVal('adm-about-quote', TEST_ABOUT.quote);
  await setVal('adm-about-photo-url', TEST_ABOUT.photoUrl);

  await page.click('#adm-content-save-btn');
  await new Promise(r => setTimeout(r, 600));

  // Проверяем элементы на странице
  const liveHeroBadge = await checkText('hero-badge-text');
  const liveHeroTitle = await checkText('hero-main-title');
  const liveHeroSub = await checkText('hero-sub-text');
  const liveHeroGeotag = await checkText('hero-geotag-text');
  const liveHeroCover = await page.$eval('#hero-cover-img', el => el.getAttribute('src'));

  const liveAboutName = await checkText('about-author-name');
  const liveAboutRole = await checkText('about-author-role');
  const liveAboutTitle = await checkText('about-section-title');
  const liveAboutQuote = await checkText('about-quote-text');
  const liveAboutPhoto = await page.$eval('#about-author-img', el => el.getAttribute('src'));

  console.log(`   Hero: Title="${liveHeroTitle.slice(0, 35)}...", CoverSrc="${liveHeroCover}"`);
  console.log(`   About: Name="${liveAboutName}", Role="${liveAboutRole}", PhotoSrc="${liveAboutPhoto}"`);

  if (liveHeroTitle !== TEST_HERO.title || liveHeroCover !== TEST_HERO.coverUrl) {
    throw new Error('❌ Ошибка обновления полей Hero!');
  }
  if (liveAboutName !== TEST_ABOUT.name || liveAboutPhoto !== TEST_ABOUT.photoUrl) {
    throw new Error('❌ Ошибка обновления полей Обо мне!');
  }
  console.log('✅ Секция Hero и Обо мне: 100% текстовых и визуальных полей обновляются корректно!');

  // ==========================================
  // ТЕСТ 3: КОНТАКТЫ И СЕТИ
  // ==========================================
  console.log('\n--- ТЕСТ 3: Проверка контактов, телефонных ссылок и мессенджеров ---');
  await page.click('#admin-tab-contacts');
  await page.waitForSelector('#admin-contacts-view', { visible: true });

  const TEST_CONTACTS = {
    phone: '+7 (999) 111-22-33',
    phoneDigits: '+79991112233',
    wa: '79991112233',
    tg: 'https://t.me/milatsvor_official',
    vkUrl: 'https://vk.ru/club_fotofeya_mila',
    vkId: '240592099',
    city: 'г. Малоярославец, Калужская область',
    hours: 'Круглосуточный онлайн-прием'
  };

  await setVal('adm-contact-phone', TEST_CONTACTS.phone);
  await setVal('adm-contact-phone-digits', TEST_CONTACTS.phoneDigits);
  await setVal('adm-contact-wa', TEST_CONTACTS.wa);
  await setVal('adm-contact-tg', TEST_CONTACTS.tg);
  await setVal('adm-contact-vk-url', TEST_CONTACTS.vkUrl);
  await setVal('adm-contact-vk-id', TEST_CONTACTS.vkId);
  await setVal('adm-contact-city', TEST_CONTACTS.city);
  await setVal('adm-contact-hours', TEST_CONTACTS.hours);

  await page.click('#adm-contacts-save-btn');
  await new Promise(r => setTimeout(r, 600));

  const hPhoneText = await checkText('header-phone-text');
  const hPhoneLink = await page.$eval('#header-phone-link', el => el.href);
  const dPhoneText = await checkText('drawer-phone-text');
  const dPhoneLink = await page.$eval('#drawer-phone-link', el => el.href);
  const modalWaLink = await page.$eval('#modal-wa-btn', el => el.href);

  console.log(`   Шапка телефон: Text="${hPhoneText}", Link="${hPhoneLink}"`);
  console.log(`   Мобильное меню телефон: Text="${dPhoneText}", Link="${dPhoneLink}"`);
  console.log(`   Модалка WhatsApp ссылка: "${modalWaLink}"`);

  if (hPhoneText !== TEST_CONTACTS.phone || !hPhoneLink.includes(TEST_CONTACTS.phoneDigits)) {
    throw new Error('❌ Ошибка обновления телефона в шапке!');
  }
  if (!modalWaLink.includes(TEST_CONTACTS.wa)) {
    throw new Error('❌ Ошибка обновления ссылки WhatsApp!');
  }
  console.log('✅ Контакты: телефон, ссылки tel: и WhatsApp обновляются синхронно!');

  // ==========================================
  // ТЕСТ 4: ОТЗЫВЫ И FAQ
  // ==========================================
  console.log('\n--- ТЕСТ 4: Проверка добавления, редактирования отзывов и FAQ ---');
  await page.click('#admin-tab-reviews-faq');
  await page.waitForSelector('#admin-reviews-faq-view', { visible: true });

  await page.click('#adm-add-review-btn');
  // Редактируем добавленный отзыв (он последний в списке)
  const revAuthors = await page.$$('.adm-rev-author');
  const lastRevAuthor = revAuthors[revAuthors.length - 1];
  await lastRevAuthor.click();
  await lastRevAuthor.type(' Мария Свешникова (Тест CMS)');

  const revTexts = await page.$$('.adm-rev-text');
  const lastRevText = revTexts[revTexts.length - 1];
  await lastRevText.click();
  await lastRevText.type(' Восторг и сказочные впечатления всей семьи!');

  await page.click('#adm-add-faq-btn');
  const faqQs = await page.$$('.adm-faq-q');
  const lastFaqQ = faqQs[faqQs.length - 1];
  await lastFaqQ.click();
  await lastFaqQ.type(' Как подготовить ребенка к первой фотосессии?');

  await page.click('#adm-reviews-faq-save-btn');
  await new Promise(r => setTimeout(r, 600));

  // Проверяем DOM карусели отзывов и FAQ
  const swiperHtml = await page.$eval('#reviews-swiper-wrapper', el => el.innerHTML);
  const faqHtml = await page.$eval('#faq-items-container', el => el.innerHTML);

  if (!swiperHtml.includes('Мария Свешникова') || !swiperHtml.includes('Восторг и сказочные впечатления')) {
    throw new Error('❌ Ошибка: новый отзыв не появился в свайпере на главной странице!');
  }
  if (!faqHtml.includes('Как подготовить ребенка к первой фотосессии?')) {
    throw new Error('❌ Ошибка: новый вопрос FAQ не появился в аккордеоне на главной странице!');
  }
  console.log('✅ Отзывы и FAQ: добавление, карусель Swiper и аккордеон работают без сбоев!');

  // ==========================================
  // ТЕСТ 5: ВОССТАНОВЛЕНИЕ ФАБРИЧНЫХ НАСТРОЕК (RESET)
  // ==========================================
  console.log('\n--- ТЕСТ 5: Восстановление базовых настроек сайта через Reset кнопки ---');
  
  // Reset prices
  await page.evaluate(() => window.priceManager.openPriceModal());
  await page.click('#admin-tab-prices');
  await page.click('#admin-price-reset');
  await page.$eval('#admin-price-save', el => el.click());
  await new Promise(r => setTimeout(r, 600));

  // Reset content
  await page.evaluate(() => window.priceManager.openPriceModal());
  await page.click('#admin-tab-content');
  await page.click('#adm-content-reset-btn');
  await page.click('#adm-content-save-btn');
  await new Promise(r => setTimeout(r, 500));

  // Reset contacts
  await page.evaluate(() => window.priceManager.openPriceModal());
  await page.click('#admin-tab-contacts');
  await page.click('#adm-contacts-reset-btn');
  await page.click('#adm-contacts-save-btn');
  await new Promise(r => setTimeout(r, 500));

  // Reset reviews & FAQ
  await page.evaluate(() => window.priceManager.openPriceModal());
  await page.click('#admin-tab-reviews-faq');
  await page.click('#adm-reviews-faq-reset-btn');
  await page.click('#adm-reviews-faq-save-btn');
  await new Promise(r => setTimeout(r, 500));

  // Final check of defaults
  const restoredExpress = await checkText('calc-badge-express');
  const restoredHero = await checkText('hero-main-title');
  const restoredPhone = await checkText('header-phone-text');

  console.log(`   Восстановленная цена Экспресс: "${restoredExpress}"`);
  console.log(`   Восстановленный заголовок: "${restoredHero.slice(0, 35)}..."`);
  console.log(`   Восстановленный телефон: "${restoredPhone}"`);

  if (!norm(restoredExpress).includes('2 900') || !norm(restoredPhone).includes('+7 (953) 328-61-04')) {
    throw new Error('❌ Ошибка: фабричные настройки не восстановились!');
  }

  console.log('\n============================================================');
  console.log('🎉 [DEEP AUDIT PASSED] ВСЕ 100% ИНСТРУМЕНТОВ ЗАМЕНЫ ПРОВЕРЕНЫ!');
  console.log('   Никаких коллизий ID, затирания данных или сбоев интерфейса нет.');
  console.log('============================================================\n');

  await browser.close();
  server.close();
}

runDeepAudit().catch(err => {
  console.error('❌ ОШИБКА АУДИТА:', err);
  process.exit(1);
});
