/**
 * Can-Tong MVP — app.js (Drop-in Fix Pack for "L61 不显示释义/英文解释")
 *
 * 你要改的就是：把你项目里的 app.js 替换/合并这份的关键逻辑：
 * 1) 右侧面板渲染：不再按 proverb/adj 等类型分支（slang 会漏掉），而是“有啥显示啥”
 * 2) 字段取值更安全：trim + undefined 兜底，避免某列为空导致整段渲染中断
 * 3) （可选但强烈建议）用 PapaParse 解析 CSV，避免未来遇到逗号/引号/换行列错位
 *
 * 你需要在页面里准备以下 4 个 DOM 节点（可以改成你自己的选择器）：
 *  - #rhsZhDef   右侧中文释义（或解释）
 *  - #rhsEnDef   右侧英文释义（或解释）
 *  - #rhsZhNote  右侧中文补充/用法（可空）
 *  - #rhsEnNote  右侧英文补充/用法（可空）
 *
 * 如果你页面不是这些 ID：
 *  - 直接改 CONFIG.selectors 里的选择器即可（不用改其他逻辑）
 *
 * CSV 列下标（非常重要）：
 *  - 你需要把 SCHEMA 的列下标对齐到你当前 CSV 的真实列位置
 *  - 只要对齐一次，L61 这种“slang:”行就不会再丢右侧内容
 */

/** =========================
 *  0) 配置区（只改这里）
 *  ========================= */
const CONFIG = {
  csvUrl: "/data/lexicon.csv", // 改成你的实际路径
  selectors: {
    rhsZhDef: "#rhsZhDef",
    rhsEnDef: "#rhsEnDef",
    rhsZhNote: "#rhsZhNote",
    rhsEnNote: "#rhsEnNote"
  },
  debug: false
};

/**
 * CSV 列映射（按你截图推测的默认值）
 * ⚠️ 你必须核对：每一列到底对应什么，否则会“有数据但显示空”
 *
 * 常见一行结构（示例）：
 * [0] rowId/lineNo
 * [1] 粤语词
 * [2] jyutping
 * [3] 近义/相关（可带 ;）
 * [4] 中文短释义
 * [5] 英文短释义
 * [6] 中文解释（可能以“俚语：/俗语：/形容词：”开头）
 * [7] 英文解释（可能以“slang:/proverb:/adj:”开头）
 * [8] 中文用法/补充
 * [9] 英文用法/补充
 */
const SCHEMA = {
  termYue: 1,
  jyutping: 2,
  synonyms: 3,
  zhShort: 4,
  enShort: 5,
  zhDef: 6,
  enDef: 7,
  zhNote: 8,
  enNote: 9
};

/** =========================
 *  1) 工具函数
 *  ========================= */
function $(sel) {
  return document.querySelector(sel);
}

function asText(v) {
  if (v === null || v === undefined) return "";
  return String(v).replace(/\uFEFF/g, "").trim(); // 去 BOM + trim
}

function pick(row, idx) {
  return asText(Array.isArray(row) ? row[idx] : row?.[idx]);
}

function setText(sel, text) {
  const el = $(sel);
  if (!el) return;
  el.textContent = asText(text);
}

function normalizePrefix(s) {
  // 显示时可去掉“俚语：/俗语：/形容词：”等前缀，保留也行
  return asText(s)
    .replace(/^(俚语|俗语|形容词|名词|动词|口语|书面语)\s*[:：]\s*/i, "")
    .replace(/^(slang|proverb|adj|noun|verb)\s*:\s*/i, "");
}

function safeLog(...args) {
  if (CONFIG.debug) console.log("[CanTong]", ...args);
}

/** =========================
 *  2) CSV 读取与解析
 *  ========================= */

// 方案A（推荐）：PapaParse（需要 index.html 引入）
// <script src="https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js"></script>
function parseCsvText(csvText) {
  const text = asText(csvText);
  if (window.Papa) {
    const parsed = Papa.parse(text, {
      header: false,
      skipEmptyLines: true
    });
    return parsed.data || [];
  }

  // 方案B（兜底）：非常简陋的解析，仅用于无逗号/引号场景
  // ⚠️ 建议你一定上 PapaParse，否则未来会再次出现“某行坏掉”
  return text
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.split(","));
}

async function loadRows() {
  const res = await fetch(CONFIG.csvUrl, { cache: "no-store" });
  if (!res.ok) throw new Error(`CSV fetch failed: ${res.status}`);
  const csvText = await res.text();
  const rows = parseCsvText(csvText);

  safeLog("Loaded rows:", rows.length);
  return rows;
}

/** =========================
 *  3) 行 -> entry（结构化）
 *  ========================= */
function rowToEntry(row) {
  const entry = {
    termYue: pick(row, SCHEMA.termYue),
    jyutping: pick(row, SCHEMA.jyutping),
    synonyms: pick(row, SCHEMA.synonyms),
    zhShort: pick(row, SCHEMA.zhShort),
    enShort: pick(row, SCHEMA.enShort),
    zhDef: pick(row, SCHEMA.zhDef),
    enDef: pick(row, SCHEMA.enDef),
    zhNote: pick(row, SCHEMA.zhNote),
    enNote: pick(row, SCHEMA.enNote),
    __raw: row
  };

  // 统一清洗文本（避免“有内容但都是空格/不可见字符”）
  entry.zhDef = normalizePrefix(entry.zhDef);
  entry.enDef = normalizePrefix(entry.enDef);
  entry.zhNote = asText(entry.zhNote);
  entry.enNote = asText(entry.enNote);

  return entry;
}

/** =========================
 *  4) 右侧面板渲染（关键修复点）
 *  ========================= */
function renderRightPanels(entry) {
  // ✅ 关键：不按类型分支！slang/proverb/adj 都直接显示
  setText(CONFIG.selectors.rhsZhDef, entry.zhDef || entry.zhShort);
  setText(CONFIG.selectors.rhsEnDef, entry.enDef || entry.enShort);

  // note/用法：没有就清空，避免残留
  setText(CONFIG.selectors.rhsZhNote, entry.zhNote);
  setText(CONFIG.selectors.rhsEnNote, entry.enNote);

  safeLog("Rendered:", entry.termYue, {
    zhDef: entry.zhDef,
    enDef: entry.enDef,
    zhNote: entry.zhNote,
    enNote: entry.enNote,
    rawLen: Array.isArray(entry.__raw) ? entry.__raw.length : null
  });
}

/** =========================
 *  5) 绑定到你现有的“选词”逻辑
 *  =========================
 *
 * 你项目里一定已经有：用户搜索/点击某个词条 -> 拿到 row -> 更新 UI
 * 你只要在那个地方调用：
 *   renderRightPanels(rowToEntry(row))
 *
 * 下面提供一个最小可运行的 demo 绑定（按需删掉）
 */
let __rows = [];

async function initLexicon() {
  __rows = await loadRows();
  // 默认渲染第一条（你可以删掉）
  if (__rows[0]) renderRightPanels(rowToEntry(__rows[0]));
}

// 你可以在 console 手动测试：
//   debugRenderByTerm("侧侧膊")
window.debugRenderByTerm = function (term) {
  const t = asText(term);
  const hit = __rows.find((r) => pick(r, SCHEMA.termYue) === t);
  if (!hit) {
    console.warn("Not found:", t);
    return;
  }
  renderRightPanels(rowToEntry(hit));
};

// 自动初始化（如你项目已有 init，请把 initLexicon() 合并进去）
initLexicon().catch((err) => console.error(err));
