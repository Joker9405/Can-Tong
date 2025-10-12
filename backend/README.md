# Backend for Cantonese MVP

本資料夾預留用於實現後端服務，以便持續存儲和管理眾包貢獻、發音以及情感標註數據。當前前端版本僅在瀏覽器本地保存任務貢獻並提供 JSON 導出功能，維護者可手動將 JSON 合併至詞庫。本後端設計提供未來擴展的基礎，讓翻譯器具備“學習”能力，通過集中存儲和分析語料來不斷改進翻譯準確度和情感理解。

## 目標

1. **集中管理詞條與發音**：將 `data/lexicon.json` 中的詞條結構化存儲到資料庫中，支持增刪改查。對應的錄音文件可存放在服務器或雲端存儲，並記錄在資料庫中。
2. **存儲眾包貢獻**：為貢獻者提供 API 端點來提交新詞條、情緒標註和錄音，後端驗證後寫入資料庫，方便後續審核和合併。
3. **支持機器學習**：集中收集的語料將用於訓練模型，例如情感分類、詞語生成和語音合成，提升翻譯和發音準確度。
4. **API 端點**：提供 RESTful API 或 GraphQL 端點，供前端查詢翻譯結果、提交任務、檢索情緒標註等。

## 建議技術棧

* **Node.js + Express**：快速搭建 API 服務，與前端同語言並方便部署。
* **資料庫**：
  * **SQLite** 或 **LowDB**：適合早期簡單部署和原型驗證，可快速讀寫 JSON 結構。
  * **PostgreSQL** 或 **MongoDB**：適合長期擴展，支持複雜查詢、事務和高併發。
* **文件存儲**：
  * 可將錄音文件上傳到服務器的 `public/audio/` 目錄，或使用雲端對象存儲（如 AWS S3、Azure Blob）。

## 範例：簡易 Express 服務

以下是一個簡單的 Express 伺服器範例，用於讀取和寫入 `data/lexicon.json`。這僅用於示範，實際使用時應加上驗證、錯誤處理和資料庫操作。

```js
// backend/index.js
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json());

const lexiconPath = path.join(__dirname, '..', 'data', 'lexicon.json');

// 取得全部詞條
app.get('/api/lexicon', (req, res) => {
  fs.readFile(lexiconPath, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Unable to read lexicon' });
    res.json(JSON.parse(data));
  });
});

// 新增詞條
app.post('/api/lexicon', (req, res) => {
  const newEntry = req.body;
  fs.readFile(lexiconPath, 'utf8', (err, data) => {
    if (err) return res.status(500).json({ error: 'Unable to read lexicon' });
    const lexicon = JSON.parse(data);
    lexicon.push(newEntry);
    fs.writeFile(lexiconPath, JSON.stringify(lexicon, null, 2), 'utf8', err2 => {
      if (err2) return res.status(500).json({ error: 'Unable to write lexicon' });
      res.json({ message: 'Entry added' });
    });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});
```

要運行此範例：

```bash
cd cantonese-mvp/backend
npm install express
node index.js
```

此服務將在本地 `http://localhost:3000/api/lexicon` 提供查詢和新增詞條的 API。未來可將其擴展為連接數據庫、上傳錄音並處理情緒標註等功能。

---

此資料夾暫為雛形，歡迎有後端開發經驗的貢獻者補全 API、資料庫模型和部署腳本，與前端聯繫形成完整系統。