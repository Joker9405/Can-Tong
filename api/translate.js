// api/translate.js
// v20251201_case_insensitive_final
//
// 功能：
// - 只根据 data/crossmap.csv 里的 term/terms/keyword 精确匹配
// - 每个单元用 "/" 分隔为独立关键词
// - 英文大小写完全忽略（go shopping / Go shopping / GO SHOPPING 视为同一个）
// - 命中后通过 lexeme.csv 拿词条，通过 examples.csv 挂例句
//
// 返回：
// { ok, from, query, normalized_query, count, items }
// items: 每条为 lexeme.csv 的一行 + examples 数组

const fs = require('fs');
const path = require('path');
const url = require('url');

// 数据缓存，避免每次请求都重新读 CSV
let CACHE = null;

/** 简单 CSV 解析 */
function parseCsvSimple(csvText) {
  if (!csvText) return [];
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return [];

  const headerLine = lines[0].replace(/^\uFEFF/, '');
  const headers = headerLine.split(',').map((h) => h.trim());

  return lines.slice(1).map((line) => {
    const cols = line.split(',');
    const row = {};
    headers.forEach((h, i) => {
      row[h] = (cols[i] || '').trim();
    });
    return row;
  });
}

/** 规范化：去空格 + 转小写（只影响英文） */
function normaliseTerm(str) {
  if (!str) return '';
  return str.trim().toLowerCase();
}

/** 构建内存索引 */
function buildData() {
  if (CACHE) return CACHE;

  const dataDir = path.join(process.cwd(), 'data');

  const crossmapPath = path.join(dataDir, 'crossmap.csv');
  const lexemePath = path.join(dataDir, 'lexeme.csv');
  const examplesPath = path.join(dataDir, 'examples.csv');

  if (!fs.existsSync(crossmapPath)) {
    throw new Error('未找到 data/crossmap.csv，请确认文件路径');
  }
  if (!fs.existsSync(lexemePath)) {
    throw new Error('未找到 data/lexeme.csv，请确认文件路径');
  }

  const crossmapCsv = fs.readFileSync(crossmapPath, 'utf8');
  const lexemeCsv = fs.readFileSync(lexemePath, 'utf8');
  const examplesCsv = fs.existsSync(examplesPath)
    ? fs.readFileSync(examplesPath, 'utf8')
    : '';

  const crossmapRows = parseCsvSimple(crossmapCsv);
  const lexemeRows = parseCsvSimple(lexemeCsv);
  const exampleRows = examplesCsv ? parseCsvSimple(examplesCsv) : [];

  // term -> Set<target_id>
  const termIndex = new Map();

  for (const row of crossmapRows) {
    const targetId =
      (row.target_id || row.targetId || row.lexeme_id || '').trim();
    if (!targetId) continue;

    // 只把 term / terms / keyword 当成“可搜索关键词”
    const rawFields = [row.term, row.terms, row.keyword];

    const units = [];
    for (const field of rawFields) {
      if (!field) continue;
      field
        .split('/')
        .map((t) => t.trim())
        .filter(Boolean)
        .forEach((t) => units.push(t));
    }

    if (!units.length) continue;

    for (const unit of units) {
      const key = normaliseTerm(unit); // ✅ 索引统一转小写
      if (!key) continue;
      if (!termIndex.has(key)) termIndex.set(key, new Set());
      termIndex.get(key).add(targetId);
    }
  }

  // id -> lexemeRow
  const lexemeById = new Map();
  for (const row of lexemeRows) {
    const id = (row.id || row.lexeme_id || '').trim();
    if (!id) continue;
    lexemeById.set(id, row);
  }

  // lexemeId -> [exampleRow]
  const examplesByLexemeId = {};
  for (const e of exampleRows) {
    const lid =
      (e.lexeme_id || e.target_id || e.lexemeId || e.lexeme || '').trim();
    if (!lid) continue;
    if (!examplesByLexemeId[lid]) examplesByLexemeId[lid] = [];
    examplesByLexemeId[lid].push(e);
  }

  CACHE = { termIndex, lexemeById, examplesByLexemeId };
  return CACHE;
}

/** 读取 JSON body（POST 用） */
async function readJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;

  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        const obj = JSON.parse(data.toString('utf8'));
        resolve(obj);
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', (err) => reject(err));
  });
}

/** 精确查 crossmap */
function exactSearchByCrossmap(query) {
  const { termIndex, lexemeById, examplesByLexemeId } = buildData();

  const key = normaliseTerm(query); // ✅ 输入再统一转小写
  if (!key) return { normalized: '', items: [] };

  const idSet = termIndex.get(key);
  if (!idSet || !idSet.size) return { normalized: key, items: [] };

  const result = [];
  for (const id of idSet) {
    const lexeme = lexemeById.get(id);
    if (!lexeme) continue;
    const item = { ...lexeme, examples: examplesByLexemeId[id] || [] };
    result.push(item);
  }
  return { normalized: key, items: result };
}

// Vercel / Node 函数入口
module.exports = async (req, res) => {
  try {
    let rawQuery = '';

    if (req.method === 'GET') {
      const parsed = url.parse(req.url, true);
      rawQuery =
        (parsed.query.q ||
          parsed.query.query ||
          parsed.query.term ||
          parsed.query.keyword ||
          '').toString();
    } else if (req.method === 'POST') {
      const body = await readJsonBody(req);
      rawQuery =
        (body.q ||
          body.query ||
          body.term ||
          body.keyword ||
          body.input ||
          '').toString();
    } else {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({ ok: false, error: 'Method Not Allowed' }));
      return;
    }

    const query = rawQuery.trim();

    if (!query) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          ok: true,
          from: 'crossmap-exact',
          query: '',
          normalized_query: '',
          count: 0,
          items: [],
        }),
      );
      return;
    }

    const { normalized, items } = exactSearchByCrossmap(query);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        ok: true,
        from: 'crossmap-exact',
        query,             // 用户原始输入（可能有大写）
        normalized_query: normalized, // 实际参与匹配的小写
        count: items.length,
        items,
      }),
    );
  } catch (err) {
    console.error('translate error:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        ok: false,
        error: 'Internal Server Error',
        detail: err && err.message ? err.message : String(err),
      }),
    );
  }
};
