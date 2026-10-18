const fs = require('fs');
const path = require('path');

const htmlPath = path.resolve(__dirname, '../index.html');
const html = fs.readFileSync(htmlPath, 'utf8');

const regex = /\bid=["']([^"']+)["']/g;
const ids = {};
let match;
while ((match = regex.exec(html)) !== null) {
  const id = match[1];
  ids[id] = (ids[id] || 0) + 1;
}

const duplicates = Object.entries(ids).filter(([id, count]) => count > 1);

console.log('--- ID AUDIT REPORT FOR index.html ---');
console.log('Total unique IDs found:', Object.keys(ids).length);
console.log('Duplicates found:', duplicates.length);

if (duplicates.length > 0) {
  console.log('DUPLICATE IDS DETECTED:');
  duplicates.forEach(([id, count]) => {
    console.log(`❌ ID "${id}" appears ${count} times!`);
  });
  process.exit(1);
} else {
  console.log('✅ 100% CLEAN: Ноль дублирующихся ID во всем index.html!');
  process.exit(0);
}
