# Can-Tong

這個項目是一個開源的中文/英文翻譯粵語網站雛形。它允許用戶輸入普通話或英文词句，翻译對應或更多类近的粵語词句，提供正字以及發音。項目設計支持使用者擴充詞庫，完成每日任務後即可解鎖本人發音默认日后该字句的官方发音。

## 功能

* **即時翻譯** – 根據本地詞庫 (`data/lexicon.json`) 將輸入的中文或英文句子翻译為粵語文本正确文字和参与者发音。
* **發音播放** – 優先播放 `public/audio` 目錄中對應的 mp3 錄音，若沒有錄音則使用瀏覽器內建的粵語語音合成（zh‑HK）。
* **每日任務** – 每天會隨機給出 5 條常用短語，鼓勵使用者填寫對應的粵語表達，並可選擇備註。完成任務後可解鎖當日發音和收藏功能。
* **眾包貢獻** – 使用者可以導出自己填寫的詞條 JSON，通過 GitHub Pull Request 上傳至 `data/lexicon.json` 和 `data/devAudioMap.json`，從而共同完善詞庫和錄音。

## 結構

```
cantonese-mvp
├── public/
│   └── audio/            # 錄音文件
├── data/
│   ├── lexicon.json       # 詞庫：意圖列表、粵語正字、粵拼
│   └── devAudioMap.json   # 粵語正字到錄音檔名的映射
├── src/
│   ├── App.tsx            # 主界面邏輯
│   └── main.tsx           # React 入口
├── index.html             # 頁面入口
├── package.json           # 項目配置
└── vite.config.ts         # Vite 配置
```

## 開發與運行

1. 確保已安裝 [Node.js](https://nodejs.org/) 和 [pnpm](https://pnpm.io/)（或 npm/yarn）。
2. 在命令行中執行：

```bash
pnpm install
pnpm dev
```

3. 打開瀏覽器訪問 `http://localhost:5173` 以查看本項目。

4. 如需打包生產版：

```bash
pnpm build
```

5. 如果您使用在線 IDE（如 StackBlitz），則不需要運行以上命令；您只需打開本倉庫並編輯文件即可。

## 貢獻指南

1. 在 `data/lexicon.json` 中新增或修改詞條。每個詞條為一個對象，包含：
   * `id` – 唯一標識
   * `intents` – 中文/英文意圖或關鍵詞列表
   * `yue` – 對應的粵語正字
   * `jyut` – 對應的粵拼（Jyutping）
   * `note` – 可選，備註說明
2. 在 `data/devAudioMap.json` 中新增對應條目的錄音映射，例如：
   ```json
   {
     "我掛住你": "ngo5-gwaa3-zyu6-nei5.mp3"
   }
   ```
3. 將錄音文件以 mp3 格式放入 `public/audio/` 目錄，文件名需與映射中對應。
4. 提交 Pull Request，維護者將進行審核與合併。
