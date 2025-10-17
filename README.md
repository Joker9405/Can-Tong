# Can-Tong 粵語學習助手（雲端詞庫 + 發音 · 極簡對話版）

保持極簡對話體驗，新增 **雲端詞庫/模型** 與 **雲端發音** 插口（可選）。未設置端點時自動回退到本地演示規則與瀏覽器語音。

## 覆蓋使用
把 `index.html`、`style.css`、`app.js`、`README.md` 覆蓋到 `joker9405.github.io/Can-Tong/` 根目錄即可。

## 快速接雲（不改 UI）
打開 `app.js`，在頂部 **CFG** 填你的端點：
```js
const CFG = {
  CLOUD_TRANSLATE_ENDPOINT: "https://your.domain/api/translate",
  CLOUD_TTS_ENDPOINT: "https://your.domain/api/tts",
  CLOUD_HEADERS: { "Authorization": "Bearer YOUR_TOKEN" } // 如需
};
```
頁面右上狀態會顯示「雲端：已配置」。

### 1) 翻譯端點（雲端詞庫/模型）
- 接受 `POST` JSON：
```json
{ "text": "原文", "source": "auto", "target": "yue-Hant-HK", "n": 3 }
```
- 返回任一格式：
```json
{ "items": [ {"text":"粵語句1","note":"日常用"}, {"text":"粵語句2","note":"地道"} ] }
```
或
```json
{ "texts": ["粵語句1","粵語句2"] }
```
或
```json
{ "text": "粵語句1" }
```
前端會自動規整為 1～3 條候選，右側附「發音」按鈕。

### 2) 發音端點（雲端 TTS）
- 接受 `POST` JSON：
```json
{ "text": "要讀出的粵語", "voice": "zh-HK", "format": "mp3" }
```
- 直接返回 **audio/mpeg**（或 audio/ogg、audio/wav）。前端自動播放。  
- 若未設置或失敗，回退到**瀏覽器語音**（SpeechSynthesis）。

## CORS
你的端點需允許：
```
Access-Control-Allow-Origin: https://joker9405.github.io
Access-Control-Allow-Headers: Content-Type, Authorization
```

---
© Can-Tong cloud-ready simple chat
