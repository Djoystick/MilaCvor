/**
 * =====================================================================
 *  Visual Regression Testing — Production Web Craft
 *  Pixel-level screenshot comparison (before/after) без внешних зависимостей.
 *  Использует pixelmatch + pngjs если установлены, иначе — file-size delta fallback.
 * =====================================================================
 *
 *  Команды:
 *    node scripts/visual-regression.js baseline   — сохранить эталонные скриншоты
 *    node scripts/visual-regression.js check      — сравнить с эталоном
 *    node scripts/visual-regression.js            — авто: нет baseline → создать, есть → сравнить
 *
 *  Пороги:
 *    DIFF_THRESHOLD = 2%   — WARN (не блокирует деплой, только предупреждает)
 *    DIFF_FAIL      = 10%  — FAIL (критическая регрессия)
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ARTIFACTS  = path.join(process.cwd(), '.test-artifacts');
const BASELINE   = path.join(ARTIFACTS, 'baseline');
const DIFF_DIR   = path.join(ARTIFACTS, 'diff');
const WARN_PCT   = 2;
const FAIL_PCT   = 10;

const FILES = ['desktop-preview.png', 'mobile-preview.png'];

// ── Helpers ──────────────────────────────────────────────────────────────

function ensureDir(d) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

function formatPct(v) {
  return v.toFixed(2) + '%';
}

function tryRequire(mod) {
  try { return require(mod); } catch (_) { return null; }
}

// ── Pixel-diff engine (pixelmatch + pngjs if available) ──────────────────

function pixelDiff(baselinePath, currentPath, diffPath) {
  const pixelmatch = tryRequire('pixelmatch');
  const { PNG }    = tryRequire('pngjs') || {};

  if (!pixelmatch || !PNG) return null; // fallback needed

  const baseData = PNG.sync.read(fs.readFileSync(baselinePath));
  const currData = PNG.sync.read(fs.readFileSync(currentPath));

  const { width, height } = baseData;

  // If dimensions differ — full regression
  if (currData.width !== width || currData.height !== height) {
    return { pct: 100, reason: `Размеры изменились: ${baseData.width}×${baseData.height} → ${currData.width}×${currData.height}` };
  }

  const diffPng = new PNG({ width, height });
  const numDiff = pixelmatch(
    baseData.data, currData.data, diffPng.data,
    width, height,
    { threshold: 0.1, includeAA: false }
  );

  // Save diff image
  ensureDir(DIFF_DIR);
  fs.writeFileSync(diffPath, PNG.sync.write(diffPng));

  const totalPx = width * height;
  return { pct: (numDiff / totalPx) * 100, numDiff, totalPx };
}

// ── File-size delta fallback (when pixelmatch/pngjs not installed) ────────

function sizeDelta(baselinePath, currentPath) {
  const baseSize = fs.statSync(baselinePath).size;
  const currSize = fs.statSync(currentPath).size;
  const delta    = Math.abs(currSize - baseSize);
  const pct      = (delta / baseSize) * 100;
  return { pct, baseSize, currSize, isFallback: true };
}

// ── Core functions ────────────────────────────────────────────────────────

function saveBaseline() {
  ensureDir(BASELINE);
  let savedCount = 0;

  console.log('\n📸 [Visual Regression] Сохранение эталонных скриншотов в baseline...');

  for (const file of FILES) {
    const src = path.join(ARTIFACTS, file);
    const dst = path.join(BASELINE, file);

    if (!fs.existsSync(src)) {
      console.log(`   ⚠️  ${file} — не найден в .test-artifacts/ (сначала запустите npm run test:harness)`);
      continue;
    }

    fs.copyFileSync(src, dst);
    const size = (fs.statSync(dst).size / 1024).toFixed(1);
    console.log(`   ✅ ${file} → baseline/ (${size} KB)`);
    savedCount++;
  }

  if (savedCount === 0) {
    console.log('\n❌ Baseline не создан — нет скриншотов в .test-artifacts/. Запустите сначала: npm run test:harness');
    process.exit(1);
  }

  console.log(`\n✅ [Baseline] Сохранено ${savedCount} эталонных скриншотов.`);
  console.log('   Следующий запуск: node scripts/visual-regression.js check\n');
}

function checkRegression() {
  console.log('\n🔍 [Visual Regression] Сравнение текущих скриншотов с эталоном...');

  if (!fs.existsSync(BASELINE)) {
    console.log('   ⚠️  Baseline не создан. Запустите: node scripts/visual-regression.js baseline');
    process.exit(0);
  }

  const pixelmatch = tryRequire('pixelmatch');
  const pngjs      = tryRequire('pngjs');
  const engineName = (pixelmatch && pngjs) ? 'Pixelmatch (точный)' : 'File-size delta (приближённый)';
  console.log(`   🔧 Движок сравнения: ${engineName}`);

  const results = [];
  let hasFail   = false;

  for (const file of FILES) {
    const baselinePath = path.join(BASELINE, file);
    const currentPath  = path.join(ARTIFACTS, file);
    const diffPath     = path.join(DIFF_DIR, file.replace('.png', '-diff.png'));

    if (!fs.existsSync(baselinePath)) {
      console.log(`   ⚠️  ${file} — нет в baseline, пропуск`);
      continue;
    }

    if (!fs.existsSync(currentPath)) {
      console.log(`   ⚠️  ${file} — нет в .test-artifacts/ (запустите test:harness)`);
      continue;
    }

    let result;
    if (pixelmatch && pngjs) {
      result = pixelDiff(baselinePath, currentPath, diffPath);
      if (result === null) {
        result = sizeDelta(baselinePath, currentPath);
      }
    } else {
      result = sizeDelta(baselinePath, currentPath);
    }

    const label   = file.replace('-preview.png', '');
    const icon    = label === 'desktop' ? '🖥' : '📱';
    const pct     = result.pct;
    const pctStr  = formatPct(pct);

    let status;
    if (pct < WARN_PCT) {
      status = `✅ ${pctStr} изменений — всё чисто`;
    } else if (pct < FAIL_PCT) {
      status = `⚠️  ${pctStr} изменений — визуальные отличия обнаружены`;
    } else {
      status = `❌ ${pctStr} изменений — критическая регрессия!`;
      hasFail = true;
    }

    if (result.isFallback) {
      const delta = Math.abs((result.currSize || 0) - (result.baseSize || 0));
      console.log(`   ${icon}  ${label.charAt(0).toUpperCase() + label.slice(1)}: ${status} [Δ ${delta} байт]`);
    } else {
      console.log(`   ${icon}  ${label.charAt(0).toUpperCase() + label.slice(1)}: ${status}`);
      if (result.numDiff !== undefined) {
        console.log(`      └─ ${result.numDiff} пикселей из ${result.totalPx} отличаются`);
      }
      if (result.reason) {
        console.log(`      └─ ${result.reason}`);
      }
      if (pct >= WARN_PCT && fs.existsSync(diffPath)) {
        console.log(`      └─ Diff-карта: .test-artifacts/diff/${path.basename(diffPath)}`);
      }
    }

    results.push({ file, pct, status });
  }

  if (results.length === 0) {
    console.log('\n   ℹ️  Нет файлов для сравнения.\n');
    process.exit(0);
  }

  const allClean = results.every(r => r.pct < WARN_PCT);
  const anyWarn  = results.some(r => r.pct >= WARN_PCT && r.pct < FAIL_PCT);

  console.log('\n' + '─'.repeat(60));
  if (allClean) {
    console.log('✅ [Visual Regression] Регрессий не обнаружено — интерфейс стабилен.');
  } else if (anyWarn && !hasFail) {
    console.log('⚠️  [Visual Regression] Визуальные изменения обнаружены (не блокируют деплой).');
    console.log('   Совет: проверьте diff-карту и обновите baseline командой:');
    console.log('   node scripts/visual-regression.js baseline');
  } else if (hasFail) {
    console.log('❌ [Visual Regression] КРИТИЧЕСКАЯ РЕГРЕССИЯ — проверьте изменения в верстке!');
    console.log('   Деплой не рекомендуется до ревью diff-карты.');
  }
  console.log('─'.repeat(60) + '\n');

  // Exit 0 even on WARN — regression is advisory, not blocking
  // Exit 2 on FAIL for CI pipeline differentiation
  if (hasFail) process.exit(2);
  process.exit(0);
}

// ── Entry point ───────────────────────────────────────────────────────────

const cmd = process.argv[2];

if (cmd === 'baseline') {
  saveBaseline();
} else if (cmd === 'check') {
  checkRegression();
} else {
  // Auto-mode: create baseline if missing, else check
  if (!fs.existsSync(BASELINE) || fs.readdirSync(BASELINE).length === 0) {
    console.log('ℹ️  [Visual Regression] Baseline не найден — создаём эталон...');
    saveBaseline();
  } else {
    checkRegression();
  }
}
