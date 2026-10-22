/**
 * Creates a deployment ZIP for Yandex Cloud Functions with proper forward-slash paths
 * Uses archiver to ensure cross-platform compatibility
 */
'use strict';

const archiver = require('archiver').default || require('archiver');
const fs = require('fs');
const path = require('path');

const srcDir = path.resolve(__dirname, '..');
const outPath = path.join(srcDir, 'tsvor-deploy.zip');

const EXCLUDE_DIRS = new Set(['.git', '.test-artifacts', 'scripts']);
const EXCLUDE_FILES_PATTERN = /\.(bak|log)$|^tsvor-.*\.(zip|tar\.gz)$/;

if (fs.existsSync(outPath)) fs.unlinkSync(outPath);

const output = fs.createWriteStream(outPath);
const archive = archiver('zip', { zlib: { level: 6 } });

output.on('close', () => {
  const mb = (archive.pointer() / 1024 / 1024).toFixed(1);
  console.log(`✅ Deploy ZIP created: ${outPath} (${mb} MB)`);
});
archive.on('error', err => { throw err; });
archive.pipe(output);

function addDir(dir, base) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    if (EXCLUDE_DIRS.has(item)) continue;
    if (EXCLUDE_FILES_PATTERN.test(item)) continue;
    const full = path.join(dir, item);
    const rel = path.relative(base, full).replace(/\\/g, '/');
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      addDir(full, base);
    } else {
      archive.file(full, { name: rel });
    }
  }
}

addDir(srcDir, srcDir);
archive.finalize();
