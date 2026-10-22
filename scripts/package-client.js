const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const srcDir = path.resolve('H:/Work/Site_Photographer');
const dstDir = path.resolve('H:/Work/Сайт_Мила_Цвор_Финальный');
const zipFile = path.resolve('H:/Work/Сайт_Мила_Цвор_v1.9.7_Финальный.zip');

console.log('Syncing from', srcDir, 'to', dstDir);

if (!fs.existsSync(dstDir)) {
  fs.mkdirSync(dstDir, { recursive: true });
}

// Clean copy excluding unwanted files
const ignoreList = ['.git', 'node_modules', '.test-artifacts', '.bak', '.log', 'tsvor-function-posix.zip', 'tsvor-deploy.zip'];

function copyRecursive(src, dst) {
  const items = fs.readdirSync(src);
  for (const item of items) {
    if (ignoreList.some(ig => item === ig || item.endsWith(ig))) continue;
    const srcPath = path.join(src, item);
    const dstPath = path.join(dst, item);
    const stat = fs.statSync(srcPath);
    if (stat.isDirectory()) {
      if (!fs.existsSync(dstPath)) fs.mkdirSync(dstPath, { recursive: true });
      copyRecursive(srcPath, dstPath);
    } else {
      fs.copyFileSync(srcPath, dstPath);
    }
  }
}

copyRecursive(srcDir, dstDir);
console.log('✅ Synchronized to handover folder');

if (fs.existsSync(zipFile)) {
  fs.unlinkSync(zipFile);
}

try {
  execSync(`tar -a -cf "${zipFile}" -C "${dstDir}" *`, { stdio: 'inherit' });
  const stat = fs.statSync(zipFile);
  console.log(`✅ Client ZIP created: ${zipFile} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
} catch (err) {
  console.error('tar error:', err.message);
}
