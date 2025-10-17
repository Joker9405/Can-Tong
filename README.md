# Can‑Tong 前端（演示模式 + 雲端可接）

這是一個可直接覆蓋到 GitHub Pages 的前端，小步快跑：
- **演示模式（無後端）**：本地規則 + OpenCC（HK 變體）實現「統一輸出為粵語正字」與**三擋變體**（一般 / 地道 / 禮貌）
- **雲端模式（可選）**：支持 OpenAI 兼容的 `/v1/chat/completions` 端點（OpenAI / vLLM / 一些網關 / Ollama OpenAI 兼容服務），用於**英文翻譯與高質量潤色**

> 注意：本倉庫不包含語料與服務端代碼。RAG / zh-HK 神經 TTS 仍未接入，只是預留位。

## 快速開始

1. 將四個文件（`index.html`、`style.css`、`app.js`、`README.md`）放到你的 GitHub Pages 根目錄（例如 `joker9405.github.io/Can-Tong/`）。
2. 打開頁面即可使用「演示模式」。
3. 如需連接雲端模型：打開「雲端模型連接」折疊面板，填入：
   - **提供商**：OpenAI/兼容（或 Ollama）
   - **API Base**：如 `https://api.openai.com/v1` 或 `http://localhost:11434/v1`
   - **API Key**：OpenAI 需填；Ollama 通常不需要
   - **模型名**：如 `gpt-4o-mini`、`qwen2.5-7b-instruct`、`llama-3.1-8b-instruct` 等
4. 點擊「保存配置」→「測試連接」。成功後，輸入英文會自動走雲端翻譯；中文/粵語也可讓雲端「修飾」。

## 設計說明

- **統一輸出為粵語正字（繁體，港式）**：
  - 先用 OpenCC HK 變體將簡體/傳統統一處理
  - 再用本地啟發式（`app.js` 的 `yueHeuristic`）弱化普通話味道
- **三擋變體**：
  - `buildThreeVariantsLocal()` 會生成一般/地道/禮貌三個版本
  - 若配置了雲端，還會嘗試用一次雲端做 JSON 形式的**精修**，顯著提高地道度與風格差異
- **差異高亮**：簡單詞級對比，突出各擋不同

## 雲端對接 API（OpenAI 兼容）

`POST {API_BASE}/chat/completions` 以 JSON 請求，要求模型返回：
```json
{"general":"", "colloquial":"", "polite":""}
```
所有文本要求**繁體粵語**。

## 常見問題

- **CDN 無法訪問**：頁面使用了 `opencc-js` 與 `tinyld` 的 CDN。若你的網絡環境無法拉取，請自行下載並改為本地引用。
- **英文輸入在未連雲端時效果一般**：演示模式不做機器翻譯，建議配置雲端模型。
- **RAG / TTS**：此版僅預留 UI 標識，後續可再接。

---

© Can‑Tong demo front-end
