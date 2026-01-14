// docs/app.js
// 最小: docs/index.json を読み、一覧表示 + クライアント側検索
// 検索対象: title, tags, tbd, updated, id

const INDEX_URL = "./index.json";

const $q = document.getElementById("q");
const $clear = document.getElementById("clear");
const $list = document.getElementById("list");
const $count = document.getElementById("count");
const $status = document.getElementById("status");
const $empty = document.getElementById("empty");

let items = [];
let timer = null;

init().catch(err => {
  console.error(err);
  $status.textContent = "failed";
});

async function init() {
  $status.textContent = "loading…";
  items = await loadIndex();
  $status.textContent = "ready";
  render(items);

  $q.addEventListener("input", () => {
    // debounce（軽く）
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const q = $q.value.trim();
      render(filterItems(items, q));
    }, 80);
  });

  $clear.addEventListener("click", () => {
    $q.value = "";
    render(items);
    $q.focus();
  });
}

async function loadIndex() {
  const res = await fetch(INDEX_URL, { cache: "no-store" });
  if (!res.ok) throw new Error(`index.json fetch failed: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  // 念のため最低限正規化
  return data.map(normalizeItem).filter(Boolean);
}

function normalizeItem(x) {
  if (!x) return null;
  const id = String(x.id || "").trim();
  const title = String(x.title || id || "Untitled").trim();
  const path = String(x.path || "").trim(); // "notes/<id>/"
  const updated = String(x.updated || "").trim();
  const tags = Array.isArray(x.tags) ? x.tags.map(String) : [];
  const tbd = Array.isArray(x.tbd) ? x.tbd.map(String) : [];
  const confidence = Number.isFinite(Number(x.confidence)) ? Number(x.confidence) : null;

  if (!id || !path) return null;

  return {
    id,
    title,
    path: ensureTrailingSlash(path),
    updated,
    tags,
    tbd,
    confidence,
    _haystack: buildHaystack({ id, title, updated, tags, tbd })
  };
}

function buildHaystack({ id, title, updated, tags, tbd }) {
  // かなり雑でOK：小文字化して連結
  const parts = [
    id,
    title,
    updated,
    ...(tags || []),
    ...(tbd || [])
  ];
  return parts.join(" ").toLowerCase();
}

function filterItems(list, q) {
  if (!q) return list;
  const needle = q.toLowerCase();
  return list.filter(it => it._haystack.includes(needle));
}

function render(list) {
  $list.innerHTML = "";

  $count.textContent = String(list.length);
  $empty.hidden = list.length !== 0;

  const frag = document.createDocumentFragment();
  for (const it of list) frag.appendChild(renderItem(it));
  $list.appendChild(frag);
}

function renderItem(it) {
  const li = document.createElement("li");
  li.className = "item";

  const a = document.createElement("a");
  a.href = it.path;
  a.rel = "noopener";

  const row = document.createElement("div");
  row.className = "row";

  const h = document.createElement("div");
  h.className = "h";
  h.textContent = it.title || it.id;

  const small = document.createElement("div");
  small.className = "small";
  small.textContent = it.updated ? it.updated : it.id;

  row.appendChild(h);
  row.appendChild(small);

  a.appendChild(row);

  // tags
  const tags = [...(it.tags || [])].slice(0, 10);
  if (tags.length) {
    const wrap = document.createElement("div");
    wrap.className = "tags";
    for (const t of tags) {
      const s = document.createElement("span");
      s.className = "tag";
      s.textContent = t;
      wrap.appendChild(s);
    }
    a.appendChild(wrap);
  }

  // tbd（あれば小さく）
  const tbd = [...(it.tbd || [])].slice(0, 2);
  if (tbd.length) {
    const p = document.createElement("div");
    p.className = "small";
    p.textContent = "TBD: " + tbd.join(" / ");
    a.appendChild(p);
  }

  li.appendChild(a);
  return li;
}

function ensureTrailingSlash(path) {
  // "notes/<id>/" を想定。末尾が index.html でも動くようにする。
  if (!path) return path;
  if (path.endsWith(".html")) return path;
  return path.endsWith("/") ? path : path + "/";
}
