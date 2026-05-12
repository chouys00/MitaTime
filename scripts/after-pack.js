/* eslint-disable @typescript-eslint/no-var-requires */
/**
 * electron-builder afterPack hook：
 * 由於 electron-builder.yml 設定 `signAndEditExecutable: false`（為了避免 winCodeSign
 * 解壓時的 Windows symlink 權限錯誤），electron-builder 不會幫我們改寫 exe 的圖示
 * 與中繼資料。因此這裡用 rcedit 自行寫入，效果等同於官方的編輯流程。
 *
 * 範圍：只處理 Windows 包裝後的 win-unpacked/MitaTime.exe。
 *      Portable 外殼 (MitaTime 0.1.0.exe) 的圖示由 NSIS 編譯期透過 win.icon 直接內嵌。
 */
const path = require('node:path');
const fs = require('node:fs');
const { rcedit } = require('rcedit');

const PRODUCT_NAME = 'MitaTime';
const FILE_DESCRIPTION = 'MitaTime — 番茄鐘';
const COMPANY_NAME = 'MitaTime';

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;

  const appOutDir = context.appOutDir;
  const productFilename = context.packager.appInfo.productFilename;
  const exePath = path.join(appOutDir, `${productFilename}.exe`);

  if (!fs.existsSync(exePath)) {
    console.warn(`[after-pack] 找不到 exe：${exePath}，略過 rcedit。`);
    return;
  }

  const iconPath = path.resolve(__dirname, '..', 'resources', 'icon.ico');
  if (!fs.existsSync(iconPath)) {
    throw new Error(`[after-pack] 缺少 ${iconPath}，請先執行 pnpm generate-icon。`);
  }

  const version = context.packager.appInfo.version; // e.g. "0.1.0"
  const fileVersion = `${version}.0`;

  console.log(`[after-pack] 改寫 ${exePath} 圖示與中繼資料…`);
  await rcedit(exePath, {
    icon: iconPath,
    'version-string': {
      ProductName: PRODUCT_NAME,
      FileDescription: FILE_DESCRIPTION,
      CompanyName: COMPANY_NAME,
      LegalCopyright: `Copyright © ${new Date().getFullYear()} ${COMPANY_NAME}`,
      InternalName: PRODUCT_NAME,
      OriginalFilename: `${PRODUCT_NAME}.exe`,
    },
    'product-version': version,
    'file-version': fileVersion,
  });
  console.log('[after-pack] 完成。');
};
