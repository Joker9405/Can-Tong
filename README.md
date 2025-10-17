# Can‑Tong 粵語學習助手（簡版對話）

- ChatGPT 風格對話：每次輸入一句、AI 回一句。
- 取消設置/雲端面板：頁面保持極簡。
- 非固定三擋：回傳 1～3 條可用講法，每行自帶「發音」按鈕。
- 統一輸出 **繁體·港式** 粵語正字。

> 此為純前端 Demo（GitHub Pages），使用簡易詞庫+規則。若要真實高準確度中英粵互譯，請在你自己的服務端接入開源模型 API。前端無需大改。

## 使用
把 `index.html`、`style.css`、`app.js`、`README.md` 覆蓋到倉庫根目錄，刷新即用。

## 發音（TTS）
優先使用 `zh-HK` 語音；無則退回 `yue/cantonese` 或 `zh`。若瀏覽器沒有語音包，按鈕可能無聲。

---
© Can‑Tong simple chat
