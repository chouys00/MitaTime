/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * 將正式圖示（resources/app-icon.png）同步到專案內所有使用處。
 * 請只編輯 app-icon.png；勿直接改 icon.png / tray / favicon / icon.ico，以免被覆寫。
 *
 * 產出：
 *  - resources/icon.png（BrowserWindow / Linux build / Tray fallback）
 *  - resources/tray-cat-icon.png（系統列圖示）
 *  - resources/icon.ico（Windows 打包與 BrowserWindow 在 Win 平台使用，多解析度）
 *  - src/renderer/public/favicon.png（前端 favicon）
 *
 * 註：來源檔即使副檔名是 .png，實際也可能是 JPEG，因此一律透過 sharp 重新編碼為標準 PNG。
 */
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const pngToIco = require('png-to-ico').default;

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'resources', 'app-icon.png');
const pngTargets = [
  path.join(root, 'resources', 'icon.png'),
  path.join(root, 'resources', 'tray-cat-icon.png'),
];
const publicDir = path.join(root, 'src', 'renderer', 'public');
const faviconPath = path.join(publicDir, 'favicon.png');
const icoPath = path.join(root, 'resources', 'icon.ico');

// Windows 工作列釘選、Alt-Tab、桌面捷徑與檔案總管會挑不同解析度，
// 因此 .ico 至少要涵蓋 16/24/32/48/64/128/256。
const ICO_SIZES = [16, 24, 32, 48, 64, 128, 256];

async function main() {
  if (!fs.existsSync(source)) {
    console.error('[generate-icon] 缺少 resources/app-icon.png，請放入圖示後再執行。');
    process.exit(1);
  }

  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // 1) 將來源（可能是 JPEG）重新編碼為 1024x1024 標準 PNG，供其他用途
  const basePng = await sharp(source)
    .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  for (const dest of pngTargets) {
    fs.writeFileSync(dest, basePng);
  }
  fs.writeFileSync(faviconPath, basePng);

  // 2) 產生多解析度 PNG buffer，再合併為單一 .ico
  const sizedBuffers = await Promise.all(
    ICO_SIZES.map((size) =>
      sharp(source)
        .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .png()
        .toBuffer(),
    ),
  );

  const icoBuffer = await pngToIco(sizedBuffers);
  fs.writeFileSync(icoPath, icoBuffer);

  console.log(
    '[generate-icon] 已從 app-icon.png 同步至 icon.png、tray-cat-icon.png、icon.ico、src/renderer/public/favicon.png',
  );
}

main().catch((err) => {
  console.error('[generate-icon] 失敗：', err);
  process.exit(1);
});
