# MitaTime

> 現代極簡 · Dark Glassmorphism 番茄鐘 · Electron Desktop App

一款專為「進入心流」設計的桌面番茄鐘：深色毛玻璃介面、無邊框視窗、霓虹發光的倒數時鐘、滑入式設定面板、系統列常駐、全域快捷鍵 — 簡潔卻足夠強悍。

## ✨ 主要特色

| 主題 | 內容 |
| --- | --- |
| 視覺 | `frame: false` + `transparent: true` + `backdrop-filter` 毛玻璃；無襯線數字搭配 `text-shadow` 霓虹發光 |
| 互動 | 全視窗 hover 時設定面板與按鈕**淡入展開**；頂部隱形拖曳區 |
| 模式 | 專注（薄荷綠輝光）/ 休息（琥珀珊瑚輝光）/ idle 待命 |
| 計時 | 採用 `Date.now() + duration` 目標時間戳，每 200ms 比對 — 抗系統休眠誤差 |
| Tray | 關閉視窗 → 隱藏至系統列；左鍵展開、右鍵選單（展開 / 退出） |
| 快捷鍵 | 5 組全域熱鍵；觸發時若視窗隱藏會自動 `show()` 再執行 |
| 通知 | 由 Main Process `Notification` 模組發送；休息結束 → **自動進入專注**；專注結束 → 回到 idle |
| 安全 | `contextIsolation: true` / `sandbox: true` / `nodeIntegration: false` / CSP / IPC 白名單 |

## ⌨️ 全域快捷鍵

| 動作 | 快捷鍵 |
| --- | --- |
| ① 開始休息 | `Ctrl/Cmd + Alt + →` |
| ② 開始專注 | `Ctrl/Cmd + Alt + ←` |
| ③ 展開 / 縮小工具 | `Ctrl/Cmd + Alt + O` |
| ④ 重置 | `Ctrl/Cmd + Alt + R` |
| ⑤ 暫停 / 繼續 | `Ctrl/Cmd + Alt + P` |

## 🏗️ 架構

```
src/
├── main/                # Main Process（計時器邏輯 / 視窗 / Tray / 快捷鍵 / IPC）
│   ├── main.ts
│   ├── timer.ts         # 精準目標時間戳計時 + 通知流轉
│   ├── tray.ts
│   ├── shortcuts.ts
│   ├── ipc-handlers.ts
│   └── settings-store.ts
├── preload/
│   └── preload.ts       # contextBridge + 通道白名單
├── renderer/            # React + Vite（純 view 層）
│   ├── App.tsx
│   ├── components/
│   ├── hooks/useElectronBridge.ts
│   ├── store/timerStore.ts
│   └── styles/global.css
└── shared/              # 跨 process 型別 / 常數
    ├── constants.ts
    └── types.ts
```

> Main Process 是計時器的**唯一真相**，視窗隱藏時依然持續滴答。Renderer 僅負責顯示與輸入。

## 🚀 開始開發

```bash
# 1. 安裝依賴（建議使用 pnpm）
pnpm install

# 2. 啟動開發模式（自動編譯 main / 啟 vite / 開 Electron）
pnpm dev
```

開發模式會：

1. 透過 `scripts/generate-icon.js` 產生 `resources/icon.png`（純 Node 純文字腳本，零依賴）
2. 編譯 main / preload 至 `dist/`
3. 啟動 Vite dev server (`http://localhost:5173`)
4. 啟動 Electron 並載入 dev URL，開啟 DevTools

## 📦 打包

```bash
pnpm package
```

產出於 `release/`。預設配置支援 Windows NSIS、macOS DMG、Linux AppImage（請於 `electron-builder.yml` 視需求調整 / 加上代碼簽章環境變數）。

## 🔐 安全清單

- ✅ `contextIsolation: true`
- ✅ `nodeIntegration: false`
- ✅ `sandbox: true`
- ✅ `webSecurity: true`
- ✅ Preload 使用 `contextBridge` + 通道白名單
- ✅ 所有 IPC 輸入於 Main Process 驗證
- ✅ CSP headers
- ✅ `will-navigate` / `setWindowOpenHandler` 防劫持
- ✅ 無 `ipcRenderer.sendSync()`、無 `remote` 模組

## 💡 客製化

- 預設專注/休息時長：`src/shared/constants.ts` 的 `DEFAULT_FOCUS_SECONDS` / `DEFAULT_REST_SECONDS`
- 主題色：`src/renderer/styles/global.css` 的 `--color-focus-glow` / `--color-rest-glow`
- 視窗尺寸：`src/main/main.ts` 的 `BrowserWindow` 設定

## License

MIT
