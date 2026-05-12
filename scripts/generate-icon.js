/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * 將正式圖示（resources/app-icon.png）同步到專案內所有使用處。
 * 請只編輯 app-icon.png；勿直接改 icon.png / tray / favicon，以免被覆寫。
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'resources', 'app-icon.png');
const targets = [
  path.join(root, 'resources', 'icon.png'),
  path.join(root, 'resources', 'tray-cat-icon.png'),
];
const publicDir = path.join(root, 'src', 'renderer', 'public');
const faviconPath = path.join(publicDir, 'favicon.png');

if (!fs.existsSync(source)) {
  console.error('[generate-icon] 缺少 resources/app-icon.png，請放入 PNG 圖示後再執行。');
  process.exit(1);
}

const buf = fs.readFileSync(source);
for (const dest of targets) {
  fs.writeFileSync(dest, buf);
}
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}
fs.writeFileSync(faviconPath, buf);
console.log(`[generate-icon] 已從 app-icon.png 同步至 icon.png、tray-cat-icon.png、src/renderer/public/favicon.png`);
