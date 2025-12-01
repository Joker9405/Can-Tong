// api/translate.js
// 精准匹配版：只根据 data/crossmap.csv 里的 term 精确匹配，
// 每个 term 用 “/” 分隔为一个独立关键词，输入完整匹配其中任意一个时，
// 返回对应 target_id 的词条内容。
//
// 说明：
// - 仅使用 crossmap.csv 里的 term -> target_id 做检索，不再做模糊搜索。
// - lexeme.csv 只用来根据 target_id 取具体词条内容。
// - examples.csv（如果存在）用来挂载例句，保留你现在的例句结构能力。
// - 返回结构为 { ok, from, query, count, items }，items 里每条是：
//   { id, zhh, zhh_pron, alias_zhh, chs, en, note_chs, note_en, variants_chs, variants_en, examples }
//
// 大小写规则：
// - crossmap.csv 里的 term 在建索引时统一用 normaliseTerm() 做处理：trim + toLowerCase()
// - 用户输入 query 也用 normaliseTerm() 处理
// => 这样英文大小写自动忽略（how / HOW / How 都视为同一个 key），中文不受影响。

const fs = require('fs');
const path = require('path');

// 数据缓存，避免每次请求都重新读 CSV
let CACHE = null;

function parseCsvSimple(csvText) {
  if (!csvText) return [];
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return [];

  // 去掉 BOM
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

/**
 * 规范化 term：
 * - 去掉首尾空格
 * - 全部转小写（只影响英文 / 拉丁字母，中文不会变）
 * => 实现英文大小写不敏感搜索
 */
function normaliseTerm(str) {
  if (!str) return '';
  // 英文大小写不敏感，中文和其他不变
  return str.trim().toLowerCase();
}

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
    // crossmap 支持多种列名：term / terms / keyword
    const rawTermField =
      row.term || row.terms || row.keyword || ''; // 支持几种可能的列名
    const targetId =
      (row.target_id || row.targetId || row.lexeme_id || '').trim();

    if (!rawTermField || !targetId) continue;

    // 一个单元格可能是 "how/怎样/点样" 这种，用 "/" 分开
    const units = rawTermField
      .split('/')
      .map((t) => t.trim())
      .filter(Boolean);

    for (const unit of units) {
      const key = normaliseTerm(unit); // 这里统一做大小写处理
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

async function readJsonBody(req) {
  // 如果框架已经解析了 req.body（对象），直接用
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

/**
 * 精确查 crossmap：
 * - 用户输入 query 经过 normaliseTerm -> key
 * - 在 termIndex 里取出对应的 target_id 集合
 * - 再从 lexemeById 里拿到真正的词条
 */
function exactSearchByCrossmap(query) {
  const { termIndex, lexemeById, examplesByLexemeId } = buildData();

  const key = normaliseTerm(query);
  if (!key) return [];

  const idSet = termIndex.get(key);
  if (!idSet || !idSet.size) return [];

  const result = [];
  for (const id of idSet) {
    const lexeme = lexemeById.get(id);
    if (!lexeme) continue;

    const item = Object.assign({}, lexeme);
    item.examples = examplesByLexemeId[id] || [];
    result.push(item);
  }
  return result;
}

// Vercel / Node 函数入口
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: false, error: 'Method Not Allowed' }));
    return;
  }

  try {
    const body = await readJsonBody(req);
    const rawQuery =
      (body.q ||
        body.query ||
        body.term ||
        body.keyword ||
        body.input ||
        '').toString();
    const query = rawQuery.trim();

    if (!query) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          ok: true,
          from: 'crossmap-exact',
          query: '',
          count: 0,
          items: [],
        }),
      );
      return;
    }

    const items = exactSearchByCrossmap(query);

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        ok: true,
        from: 'crossmap-exact',
        query,
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
