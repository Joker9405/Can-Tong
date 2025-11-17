// CanTong MVP front-end patch
// 目标：
// 1）搜索时仅依赖 data/crossmap.csv 里的 term 列（/ 分隔为多个单元）。
// 2）根据匹配到的 target_id，去 data/lexeme.csv 里取出对应词条并渲染。
// 3）保留原有 examples 展开效果，只把按钮位置调整到灰色 note 卡片下方。

const state = {
  lexemeById: new Map(),
  crossmapIndex: new Map(), // term(normalized) -> target_id
  lastLexeme: null,
};

// ---------- 工具：CSV 解析 ----------
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return [];
  const header = parseCsvRow(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const rowCells = parseCsvRow(lines[i]);
    if (!rowCells.length) continue;
    const obj = {};
    header.forEach((h, idx) => {
      obj[h] = rowCells[idx] ?? "";
    });
    rows.push(obj);
  }
  return rows;
}

function parseCsvRow(line) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

async function loadCsv(path) {
  const res = await fetch(path);
  if (!res.ok) {
    console.error("Failed to load", path, res.status);
    return [];
  }
  const text = await res.text();
  return parseCsv(text);
}

function normalizeTerm(str) {
  return str.trim().toLowerCase();
}

// ---------- 索引构建 ----------
function buildLexemeIndex(rows) {
  rows.forEach((row) => {
    const id = row.id || row.lexeme_id || row.target_id;
    if (!id) return;
    state.lexemeById.set(String(id), row);
  });
}

function buildCrossmapIndex(rows) {
  rows.forEach((row) => {
    const targetId = row.target_id || row.lexeme_id || row.id;
    const termCell = row.term || "";
    if (!targetId || !termCell) return;

    const terms = termCell
      .split("/")
      .map((t) => normalizeTerm(t))
      .filter(Boolean);

    terms.forEach((t) => {
      state.crossmapIndex.set(t, String(targetId));
    });
  });
}

// ---------- 搜索逻辑：只看 crossmap ----------
function findLexemeByQuery(query) {
  const key = normalizeTerm(query);
  if (!key) return null;
  const targetId = state.crossmapIndex.get(key);
  if (!targetId) return null;
  const lexeme = state.lexemeById.get(targetId);
  return lexeme || null;
}

function handleSearch(query) {
  const trimmed = query.trim();
  const noResultBlock = document.getElementById("no-result");
  const layout = document.getElementById("result-layout");
  const examplesPanel = document.getElementById("examples-panel");

  if (!trimmed) {
    noResultBlock.classList.add("hidden");
    layout.classList.add("hidden");
    examplesPanel.classList.add("hidden");
    state.lastLexeme = null;
    return;
  }

  const lexeme = findLexemeByQuery(trimmed);
  if (!lexeme) {
    noResultBlock.classList.remove("hidden");
    layout.classList.add("hidden");
    examplesPanel.classList.add("hidden");
    state.lastLexeme = null;
    return;
  }

  noResultBlock.classList.add("hidden");
  layout.classList.remove("hidden");

  state.lastLexeme = lexeme;
  renderLexeme(lexeme);

  // 默认收起 examples
  examplesPanel.classList.add("hidden");
}

// ---------- 渲染 ----------
function renderLexeme(row) {
  renderMainCard(row);
  renderPatternCard(row);
  renderNoteCard(row);
  renderExamples(row);
}

function getField(row, keys, fallback = "") {
  for (const k of keys) {
    if (row[k] && String(row[k]).trim() !== "") {
      return String(row[k]);
    }
  }
  return fallback;
}

function renderMainCard(row) {
  const card = document.getElementById("card-main");
  if (!card) return;

  const mainZhh = getField(row, ["zhh", "head_zhh", "main_zhh", "lexeme_zhh"]);
  const variants = getField(row, ["variants_zhh", "alias_zhh", "aliases_zhh"]);
  const items = [];

  if (mainZhh) items.push(mainZhh);

  if (variants) {
    variants
      .split("/")
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((v) => items.push(v));
  }

  if (!items.length) {
    card.innerHTML = "<div>（该词条缺少 zhh 字段）</div>";
    return;
  }

  let html = `<div class="card-main-title">${escapeHtml(items[0])}</div>`;

  const rest = items.slice(1);
  if (rest.length) {
    html += rest
      .map(
        (t) => `
      <div class="card-main-variant">
        <div>${escapeHtml(t)}</div>
        <button class="icon-sound-btn" data-say="${escapeAttr(t)}">
          <span class="icon-sound">🔊</span>
        </button>
      </div>`
      )
      .join("");
  }

  card.innerHTML = html;
}

function renderPatternCard(row) {
  const card = document.getElementById("card-pattern");
  if (!card) return;

  const chs = getField(row, ["pattern_chs", "chs_pattern", "chs"]);
  const en = getField(row, ["pattern_en", "en_pattern", "en"]);

  if (!chs && !en) {
    card.innerHTML = "<div class='card-pink-title'>（该词条暂无用法说明）</div>";
    return;
  }

  card.innerHTML = `
    <div class="card-pink-title">${escapeHtml(chs || "")}</div>
    <div class="card-pink-sub">${escapeHtml(en || "")}</div>
  `;
}

function renderNoteCard(row) {
  const card = document.getElementById("card-note");
  if (!card) return;

  const en = getField(row, ["note_en", "def_en", "explain_en"]);
  const chs = getField(row, ["note_chs", "def_chs", "explain_chs"]);

  if (!en && !chs) {
    card.innerHTML =
      "<div class='card-note-title'>（该词条暂无详细说明）</div>";
    return;
  }

  card.innerHTML = `
    <div class="card-note-title">${escapeHtml(en || "")}</div>
    <div class="card-note-sub">${escapeHtml(chs || "")}</div>
  `;
}

// 假设 examples_zhh / examples_en / examples_chs 用 || 分隔多条
function renderExamples(row) {
  const panel = document.getElementById("examples-panel");
  const inner = document.querySelector("#examples-panel .examples-inner");
  if (!panel || !inner) return;

  const zhhRaw = getField(row, ["examples_zhh", "example_zhh", "ex_zhh"]);
  const enRaw = getField(row, ["examples_en", "example_en", "ex_en"]);
  const chsRaw = getField(row, ["examples_chs", "example_chs", "ex_chs"]);

  const zList = zhhRaw.split("||").map((s) => s.trim()).filter(Boolean);
  const eList = enRaw.split("||").map((s) => s.trim());
  const cList = chsRaw.split("||").map((s) => s.trim());

  const maxLen = Math.max(zList.length, eList.length, cList.length);

  if (!maxLen) {
    inner.innerHTML = "<div>暂无例句</div>";
    return;
  }

  const rows = [];
  for (let i = 0; i < maxLen; i++) {
    const z = zList[i] || "";
    const e = eList[i] || "";
    const c = cList[i] || "";
    rows.push(`
      <div class="examples-row">
        <div class="examples-row-main">${escapeHtml(z)}</div>
        <div>
          <div class="examples-row-en">${escapeHtml(e)}</div>
          <div class="examples-row-chs">${escapeHtml(c)}</div>
        </div>
        <button class="icon-sound-btn" data-say="${escapeAttr(z)}">
          <span class="icon-sound">🔊</span>
        </button>
      </div>
    `);
  }

  inner.innerHTML = rows.join("");
}

// ---------- 例句展开按钮 ----------
function toggleExamples() {
  const panel = document.getElementById("examples-panel");
  if (!panel || !state.lastLexeme) return;
  panel.classList.toggle("hidden");
}

// ---------- TTS ----------
let cachedVoices = [];

function loadVoices() {
  cachedVoices = window.speechSynthesis
    ? window.speechSynthesis.getVoices()
    : [];
}

if (window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = loadVoices;
  loadVoices();
}

function pickYueVoice() {
  if (!cachedVoices.length) return null;
  const lower = (v) => v.lang.toLowerCase();
  let voice =
    cachedVoices.find((v) => lower(v).includes("yue")) ||
    cachedVoices.find((v) => lower(v).includes("zh-hk")) ||
    cachedVoices.find((v) => lower(v).includes("zh")) ||
    cachedVoices[0];
  return voice || null;
}

function speak(text) {
  if (!window.speechSynthesis || !text) return;
  const u = new SpeechSynthesisUtterance(text);
  const voice = pickYueVoice();
  if (voice) u.voice = voice;
  u.rate = 1;
  u.pitch = 1;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

// 统一事件代理：所有带 data-say 的按钮，都用粤语读出来
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-say]");
  if (!btn) return;
  const text = btn.getAttribute("data-say") || "";
  speak(text);
});

// ---------- HTML 转义 ----------
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/'/g, "&#39;");
}

// ---------- 初始化 ----------
async function init() {
  const input = document.getElementById("search-input");
  const examplesToggle = document.getElementById("examples-toggle");

  if (!input) {
    console.error("缺少 #search-input 元素");
    return;
  }

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      handleSearch(input.value);
    }
  });

  examplesToggle?.addEventListener("click", toggleExamples);

  try {
    const [lexemeRows, crossmapRows] = await Promise.all([
      loadCsv("./data/lexeme.csv"),
      loadCsv("./data/crossmap.csv"),
    ]);

    buildLexemeIndex(lexemeRows);
    buildCrossmapIndex(crossmapRows);
    console.log("CSV loaded: lexeme =", lexemeRows.length, "crossmap =", crossmapRows.length);
  } catch (err) {
    console.error("CSV 加载失败", err);
  }

  input.focus();
}

document.addEventListener("DOMContentLoaded", init);
