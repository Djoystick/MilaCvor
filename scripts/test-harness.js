/**
 * ===================================================================
 *  Production Web Craft: E2E Test Harness & Quality Gate
 *  цвор.рф (Fotofeya Mila Portfolio)
 * ===================================================================
 */

'use strict';

const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');

// 1. Locate installed Google Chrome or Edge on Windows
function findBrowserExecutable() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  throw new Error('❌ Ни Chrome, ни Edge не найдены на машине. Укажите PUPPETEER_EXECUTABLE_PATH.');
}

// 2. Quality Gate Thresholds
const THRESHOLDS = {
  MAX_LCP_MS: 1500,       // Цель < 1.2s, предел < 1.5s
  MAX_CLS: 0.02,          // Цель 0.000, допуск до 0.02
  MAX_DCL_MS: 800,        // DOMContentLoaded < 800ms
  MAX_TTFB_MS: 300        // TTFB < 300ms
};

/**
 * Visual Settlement Protocol:
 * Гарантирует 100% стабилизацию рендеринга перед захватом скриншотов:
 * 1. Ожидание завершения загрузки веб-шрифтов (document.fonts.ready).
 * 2. Ожидание завершения входных анимаций (CSS transitions, opacity > 0.95).
 * 3. Буферизация для композитинга GPU.
 */
async function waitForVisualSettlement(page, label = 'Page', { minWait = 1800, maxWait = 4000 } = {}) {
  process.stdout.write(`   ⏳  [Visual Settlement] Ожидание стабилизации шрифтов и анимаций (${label})... `);
  const start = Date.now();

  try {
    await page.evaluate(async () => {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
    });
  } catch (e) {}

  await page.evaluate(async (minWaitMs, maxWaitMs) => {
    return new Promise((resolve) => {
      const startTime = performance.now();

      const checkState = () => {
        const elapsed = performance.now() - startTime;

        const h1 = document.querySelector('h1');
        const h1Opacity = h1 ? parseFloat(window.getComputedStyle(h1).opacity) : 1;

        const cta = document.querySelector('a[href^="#"], button[type="submit"], .btn-primary');
        const ctaOpacity = cta ? parseFloat(window.getComputedStyle(cta).opacity) : 1;

        if ((h1Opacity >= 0.95 && ctaOpacity >= 0.95 && elapsed >= minWaitMs) || elapsed >= maxWaitMs) {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setTimeout(resolve, 150);
            });
          });
        } else {
          setTimeout(checkState, 100);
        }
      };

      checkState();
    });
  }, minWait, maxWait);

  const duration = Date.now() - start;
  console.log(`готово (${duration} ms) ✅`);
}

async function runHarness() {
  const startTime = Date.now();
  console.log('\n🌸 [Test Harness] Запуск проверки качества цвор.рф перед деплоем...');

  // Start local Express server on ephemeral port (0 = OS assigns free port)
  const app = require('../api/index');
  const server = await new Promise((resolve, reject) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
    s.on('error', reject);
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`📡 [Test Harness] Тестовый сервер поднят на ${baseUrl}`);

  const chromePath = findBrowserExecutable();
  console.log(`🌐 [Test Harness] Используется браузер: ${chromePath}`);

  let browser;
  const errors = [];
  const warnings = [];

  try {
    browser = await puppeteer.launch({
      executablePath: chromePath,
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    const page = await browser.newPage();

    // Track console & network errors
    const pageErrors = [];
    const failedRequests = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        if (!text.includes('favicon.ico') && !text.includes('yandex.ru')) {
          pageErrors.push(text);
        }
      }
    });

    page.on('pageerror', err => {
      pageErrors.push(err.message || String(err));
    });

    page.on('requestfailed', req => {
      const url = req.url();
      const err = req.failure()?.errorText || '';
      if (err !== 'net::ERR_ABORTED' && !url.includes('favicon.ico') && !url.includes('mc.yandex.ru') && !url.includes('google-analytics')) {
        failedRequests.push(`${req.method()} ${url} (${err || 'failed'})`);
      }
    });

    // -------------------------------------------------------------
    // TEST 1: Desktop Landing Page (1440x900) & Core Web Vitals
    // -------------------------------------------------------------
    console.log('\n🖥️  [TEST 1] Проверка десктопного рендеринга и Core Web Vitals (1440x900)...');
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    
    const navResponse = await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle0', timeout: 15000 });
    const httpStatus = navResponse ? navResponse.status() : 0;

    if (httpStatus !== 200) {
      errors.push(`Landing вернул HTTP статус ${httpStatus} вместо 200`);
    }

    // Measure Web Vitals in-browser
    const vitals = await page.evaluate(() => {
      return new Promise(resolve => {
        let clsValue = 0;
        let lcpValue = 0;
        const shiftDetails = [];

        try {
          const clsObserver = new PerformanceObserver(list => {
            for (const entry of list.getEntries()) {
              if (!entry.hadRecentInput) {
                clsValue += entry.value;
                for (const s of entry.sources || []) {
                  if (s.node) {
                    shiftDetails.push({
                      tag: s.node.tagName,
                      id: s.node.id,
                      class: s.node.className,
                      value: entry.value.toFixed(4)
                    });
                  }
                }
              }
            }
          });
          clsObserver.observe({ type: 'layout-shift', buffered: true });
        } catch (e) {}

        try {
          const lcpObserver = new PerformanceObserver(list => {
            const entries = list.getEntries();
            if (entries.length) {
              const last = entries[entries.length - 1];
              lcpValue = last.renderTime || last.loadTime || last.startTime;
            }
          });
          lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
        } catch (e) {}

        setTimeout(() => {
          const nav = performance.getEntriesByType('navigation')[0] || {};
          resolve({
            cls: clsValue,
            shiftDetails,
            lcp: lcpValue || (nav.domContentLoadedEventEnd - nav.startTime) || 0,
            dcl: Math.round(nav.domContentLoadedEventEnd - nav.startTime || 0),
            load: Math.round(nav.loadEventEnd - nav.startTime || 0),
            ttfb: Math.round(nav.responseStart - nav.startTime || 0),
            pageTitle: document.title || '',
            h1Text: document.querySelector('h1')?.innerText?.trim() || ''
          });
        }, 800);
      });
    });

    console.log(`   ⏱️  LCP: ${Math.round(vitals.lcp)} ms ${vitals.lcp <= THRESHOLDS.MAX_LCP_MS ? '✅' : '⚠️'}`);
    console.log(`   📐  CLS: ${vitals.cls.toFixed(4)} ${vitals.cls <= THRESHOLDS.MAX_CLS ? '✅' : '❌'}`);
    if (vitals.shiftDetails && vitals.shiftDetails.length > 0) {
      console.log('   🔍  Элементы, вызвавшие сдвиг (CLS):');
      vitals.shiftDetails.forEach(s => console.log(`      - <${s.tag} id="${s.id}" class="${s.class?.substring(0, 40)}"> (shift: ${s.value})`));
    }
    console.log(`   ⚡  DCL: ${vitals.dcl} ms ${vitals.dcl <= THRESHOLDS.MAX_DCL_MS ? '✅' : '⚠️'}`);
    console.log(`   🌐  TTFB: ${vitals.ttfb} ms`);
    console.log(`   🏷️  Title: "${vitals.pageTitle}"`);
    console.log(`   📝  H1: "${vitals.h1Text.substring(0, 50)}..."`);

    if (!vitals.h1Text) {
      errors.push('Заголовок H1 пустой или не отрендерился');
    }
    if (vitals.cls > THRESHOLDS.MAX_CLS) {
      errors.push(`CLS ${vitals.cls.toFixed(4)} превышает допустимый порог ${THRESHOLDS.MAX_CLS}`);
    }

    // -------------------------------------------------------------
    // SEO & OpenGraph Social Meta Audit (Phase 2)
    // -------------------------------------------------------------
    console.log('\n🔍  [SEO & OpenGraph] Валидация поисковых и соцсетевых мета-тегов...');
    const seoData = await page.evaluate(() => {
      const getMeta = (prop, name) => {
        const el = document.querySelector(`meta[property="${prop}"]`) || document.querySelector(`meta[name="${name || prop}"]`);
        return el ? el.getAttribute('content') : null;
      };
      const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || null;
      const favicon = document.querySelector('link[rel*="icon"]')?.getAttribute('href') || null;
      const jsonLd = document.querySelector('script[type="application/ld+json"]')?.textContent || null;
      let hasValidJsonLd = false;
      if (jsonLd) {
        try {
          const parsed = JSON.parse(jsonLd);
          hasValidJsonLd = !!(parsed['@context'] && (parsed['@type'] || (Array.isArray(parsed['@graph']) && parsed['@graph'].length > 0)));
        } catch (e) {}
      }

      return {
        title: document.title || '',
        description: getMeta('description', 'description'),
        ogTitle: getMeta('og:title'),
        ogDesc: getMeta('og:description'),
        ogImage: getMeta('og:image'),
        ogUrl: getMeta('og:url'),
        canonical,
        favicon,
        hasValidJsonLd
      };
    });

    console.log(`   🏷️  Title: "${seoData.title.substring(0, 45)}..." ${seoData.title.length >= 15 ? '✅' : '⚠️'}`);
    console.log(`   📝  Description: ${seoData.description ? 'присутствует ✅' : 'отсутствует ❌'}`);
    console.log(`   🌐  OpenGraph (VK/TG): ${seoData.ogTitle && seoData.ogImage ? 'настроен (og:title, og:image) ✅' : 'неполный ⚠️'}`);
    console.log(`   🔗  Canonical: ${seoData.canonical ? seoData.canonical + ' ✅' : 'отсутствует ⚠️'}`);
    console.log(`   ⭐  Schema.org JSON-LD: ${seoData.hasValidJsonLd ? 'валидный микроформат ✅' : 'отсутствует ⚠️'}`);

    if (!seoData.title || seoData.title.length < 10) errors.push('SEO: тег <title> пустой или короче 10 символов');
    if (!seoData.description) warnings.push('SEO: отсутствует тег <meta name="description">');

    // Capture Desktop Screenshot
    const artifactsDir = path.join(__dirname, '../.test-artifacts');
    if (!fs.existsSync(artifactsDir)) fs.mkdirSync(artifactsDir, { recursive: true });
    await waitForVisualSettlement(page, 'Desktop');
    const desktopScreenshotPath = path.join(artifactsDir, 'desktop-preview.png');
    await page.screenshot({ path: desktopScreenshotPath, fullPage: false });
    console.log(`   📸  Скриншот Desktop сохранен: .test-artifacts/desktop-preview.png`);

    // -------------------------------------------------------------
    // TEST 2: Mobile Viewport Audit (375x812 - iPhone) & Touch Targets (Phase 2)
    // -------------------------------------------------------------
    console.log('\n📱 [TEST 2] Проверка мобильной верстки, отсутствия скролла и эргономики (375x812)...');
    await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await page.reload({ waitUntil: 'networkidle0' });

    // Capture Mobile Screenshot with Visual Settlement
    await waitForVisualSettlement(page, 'Mobile');
    const mobileScreenshotPath = path.join(artifactsDir, 'mobile-preview.png');
    await page.screenshot({ path: mobileScreenshotPath, fullPage: false });
    console.log(`   📸  Скриншот Mobile сохранен: .test-artifacts/mobile-preview.png`);

    // Sync to Antigravity brain artifact folder for agent visual review
    const brainDir = 'C:\\Users\\Djoystick\\.gemini\\antigravity\\brain\\0b737243-3db0-4fc2-b99a-8b7033f5b4be';
    if (fs.existsSync(brainDir)) {
      try {
        fs.copyFileSync(mobileScreenshotPath, path.join(brainDir, 'preview_mobile_photographer.png'));
        fs.copyFileSync(desktopScreenshotPath, path.join(brainDir, 'preview_desktop_photographer.png'));
      } catch (e) {}
    }

    const mobileMetrics = await page.evaluate(() => {
      const scrollW = document.documentElement.scrollWidth;
      const innerW = window.innerWidth;
      const overflow = scrollW > innerW;
      
      const ctaButtons = Array.from(document.querySelectorAll('a[href^="tel:"], a[href*="t.me"], button, .btn-primary'))
        .filter(b => b.offsetParent !== null);

      return {
        scrollWidth: scrollW,
        innerWidth: innerW,
        hasHorizontalOverflow: overflow,
        overflowDelta: scrollW - innerW,
        visibleActionsCount: ctaButtons.length
      };
    });

    if (mobileMetrics.hasHorizontalOverflow) {
      errors.push(`❌ Нарушен Mobile-First: горизонтальный скролл на 375px (+${mobileMetrics.overflowDelta}px)!`);
      console.log(`   ❌ Обнаружен горизонтальный скролл: ${mobileMetrics.scrollWidth}px > ${mobileMetrics.innerWidth}px (+${mobileMetrics.overflowDelta}px)`);
    } else {
      console.log(`   ✅ Горизонтальный скролл отсутствует: ${mobileMetrics.scrollWidth}px <= ${mobileMetrics.innerWidth}px`);
    }

    // Touch Targets Audit (Apple HIG & Google Material >= 44x44px)
    const touchAudit = await page.evaluate(() => {
      const interactive = Array.from(document.querySelectorAll('button, a, input[type="button"], input[type="submit"], [role="button"]'));
      const visible = interactive.filter(el => {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.top < window.innerHeight * 4;
      });

      const sub44 = [];
      visible.forEach(el => {
        if (el.tagName === 'A' && el.parentElement && el.parentElement.tagName === 'P') return;
        const rect = el.getBoundingClientRect();
        const minDim = Math.min(rect.width, rect.height);
        if (minDim < 44) {
          sub44.push({
            tag: el.tagName,
            id: el.id || '',
            class: (el.className || '').toString().slice(0, 30),
            text: (el.innerText || el.getAttribute('aria-label') || el.value || '').trim().slice(0, 20),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          });
        }
      });

      return {
        total: visible.length,
        sub44Count: sub44.length,
        sub44Samples: sub44.slice(0, 5)
      };
    });

    console.log(`   👆  Touch Targets (44×44px Apple/Google): ${touchAudit.total - touchAudit.sub44Count}/${touchAudit.total} элементов соответствуют стандарту`);
    if (touchAudit.sub44Count > 0) {
      console.log(`   ℹ️  Зафиксировано ${touchAudit.sub44Count} элементов < 44px (под пальцы):`);
      touchAudit.sub44Samples.forEach(s => {
        console.log(`      - <${s.tag} id="${s.id}" class="${s.class}"> "${s.text}" (${s.width}x${s.height}px)`);
      });
    }

    // -------------------------------------------------------------
    // TEST 3: Auxiliary Surfaces (/privacy)
    // -------------------------------------------------------------
    console.log('\n🔒 [TEST 3] Проверка целостности страницы политики конфиденциальности (/privacy)...');
    const privRes = await page.goto(`${baseUrl}/privacy`, { waitUntil: 'domcontentloaded' });
    if (privRes.status() !== 200) {
      errors.push(`Страница /privacy вернула статус ${privRes.status()}`);
    } else {
      console.log('   ✅ /privacy доступна и рендерится без ошибок');
    }

    // -------------------------------------------------------------
    // TEST 4: Synthetic User Flow (E2E-клиент - Phase 3)
    // -------------------------------------------------------------
    console.log('\n🤖 [TEST 4] Автономный Synthetic User Flow (эмуляция бронирования)...');
    try {
      await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle0' });
      await page.setViewport({ width: 1440, height: 900 });

      // 1. Fill booking form
      await page.waitForSelector('#booking-name', { timeout: 5000 });
      await page.type('#booking-name', 'Тест Тестович', { delay: 20 });
      await page.type('#booking-phone', '9990000000', { delay: 20 });

      // 2. Accept 152-FZ consent
      await page.evaluate(() => {
        const el = document.getElementById('booking-pdn-consent');
        if (el) el.checked = true;
      });

      // 3. Submit booking and intercept /api/booking response
      const [apiResponse] = await Promise.all([
        page.waitForResponse(res => res.url().includes('/api/booking') && res.request().method() === 'POST', { timeout: 8000 }),
        page.click('#booking-submit-btn')
      ]);

      const resStatus = apiResponse.status();
      const resBody = await apiResponse.json().catch(() => ({}));

      if (resStatus === 200 && resBody.success) {
        console.log(`   ✅ API /api/booking вернул 200 { success: true } (ID: ${resBody.id || 'ok'})`);
      } else {
        errors.push(`Synthetic Client: API вернул статус ${resStatus} вместо 200: ${JSON.stringify(resBody)}`);
      }

      // 4. Verify Success Modal is visible
      await page.waitForSelector('#success-modal:not(.hidden)', { timeout: 5000 });
      console.log('   ✅ Модальное окно подтверждения (#success-modal) успешно открыто');
    } catch (e2eErr) {
      errors.push(`Synthetic User Flow сбой: ${e2eErr.message}`);
      console.log(`   ❌ Сбой Synthetic User Flow: ${e2eErr.message}`);
    }

    // Check collected errors
    if (pageErrors.length > 0) {
      console.log('\n⚠️  Ошибки консоли браузера:');
      pageErrors.forEach(e => console.log(`   - ${e}`));
      errors.push(`В консоли браузера зафиксировано ошибок: ${pageErrors.length}`);
    }

    if (failedRequests.length > 0) {
      console.log('\n⚠️  Сбойные сетевые запросы:');
      failedRequests.forEach(f => console.log(`   - ${f}`));
      errors.push(`Сбойных сетевых запросов: ${failedRequests.length}`);
    }

  } catch (err) {
    errors.push(`Критический сбой тестового раннера: ${err.message}`);
  } finally {
    if (browser) await browser.close();
    server.close();
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  // -------------------------------------------------------------
  // VISUAL REGRESSION CHECK (WARN-only, не блокирует деплой)
  // -------------------------------------------------------------
  try {
    const { spawnSync } = require('child_process');
    const vrtScript = path.join(__dirname, 'visual-regression.js');
    if (fs.existsSync(vrtScript)) {
      const vrtResult = spawnSync(process.execPath, [vrtScript, 'check'], {
        cwd: path.join(__dirname, '..'),
        stdio: 'inherit',
        encoding: 'utf8'
      });
      // Регрессия не блокирует Quality Gate — только предупреждение
      if (vrtResult.status !== 0) {
        warnings.push('Visual Regression: обнаружены визуальные изменения > порога (см. вывод выше)');
      }
    }
  } catch (vrtErr) {
    warnings.push(`Visual Regression: ошибка запуска скрипта: ${vrtErr.message}`);
  }

  console.log('\n=============================================================');
  if (errors.length === 0) {
    console.log(`🎉 [QUALITY GATE PASSED] Все тесты цвор.рф успешно пройдены за ${duration}s!`);
    console.log('   Проект готов к деплою на Vercel и Yandex Cloud.');
    console.log('=============================================================\n');
    process.exit(0);
  } else {
    console.error(`🚫 [QUALITY GATE FAILED] Обнаружено проблем: ${errors.length} (за ${duration}s)`);
    errors.forEach(e => console.error(`   ❌ ${e}`));
    console.error('=============================================================\n');
    process.exit(1);
  }
}

runHarness();
