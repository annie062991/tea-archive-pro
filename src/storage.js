// src/storage.js
const KEY_PREFIX = "tea-archive-pro::day::";

function dayKey(dateStr) {
  return `${KEY_PREFIX}${dateStr}`;
}

export function loadDay(dateStr) {
  try {
    const raw = localStorage.getItem(dayKey(dateStr));
    if (!raw) return null;
    const doc = JSON.parse(raw);
    // doc: { dateStr, rows }
    if (!doc || typeof doc !== "object") return null;
    if (!Array.isArray(doc.rows)) doc.rows = [];
    return doc;
  } catch {
    return null;
  }
}

export function saveDay(dateStr, rows) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const doc = { dateStr, rows: safeRows };
  localStorage.setItem(dayKey(dateStr), JSON.stringify(doc));
  return doc;
}
export function deleteDay(dateStr) {
  localStorage.removeItem(dayKey(dateStr));
}
// ------- helpers -------
function calcFinalPrice(row) {
  const p = Number(row?.price) || 0;
  if (row?.isGift) return 0;
  if (row?.isEco) return Math.max(0, p - 5);
  return p;
}

function isValidDateStr(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}

// ------- Year load -------
export function loadYearDocs(year) {
  const y = String(year);
  const docs = [];

  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith(KEY_PREFIX)) continue;

    const dateStr = k.slice(KEY_PREFIX.length);
    if (!isValidDateStr(dateStr)) continue;
    if (!dateStr.startsWith(`${y}-`)) continue;

    const doc = loadDay(dateStr);
    if (doc) docs.push(doc);
  }

  // sort by date
  docs.sort((a, b) => (a.dateStr < b.dateStr ? -1 : a.dateStr > b.dateStr ? 1 : 0));
  return docs;
}

// ------- Streak -------
export function bestStreakDays(dateStrs = []) {
  if (!Array.isArray(dateStrs) || dateStrs.length === 0) return 0;

  const sorted = [...new Set(dateStrs.filter(isValidDateStr))].sort();

  const toTime = (s) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d).getTime();
  };

  let best = 1;
  let cur = 1;

  for (let i = 1; i < sorted.length; i++) {
    const diffDays = Math.round((toTime(sorted[i]) - toTime(sorted[i - 1])) / 86400000);
    if (diffDays === 1) {
      cur += 1;
      best = Math.max(best, cur);
    } else {
      cur = 1;
    }
  }
  return best;
}

// ------- Top shops / combos / weekday -------
export function topShops(docs = [], n = 5) {
  const m = new Map();
  for (const d of Array.isArray(docs) ? docs : []) {
    const rows = Array.isArray(d?.rows) ? d.rows : [];
    for (const r of rows) {
      const shop = (r?.shop || "").trim();
      if (!shop) continue;
      m.set(shop, (m.get(shop) || 0) + 1);
    }
  }
  return Array.from(m.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([shop, count]) => ({ shop, count }));
}

export function topCombos(docs = [], n = 5) {
  const m = new Map();
  for (const d of Array.isArray(docs) ? docs : []) {
    const rows = Array.isArray(d?.rows) ? d.rows : [];
    for (const r of rows) {
      const shop = (r?.shop || "").trim();
      const item = (r?.item || "").trim();
      const sugar = (r?.sugar || "").trim();
      const ice = (r?.ice || "").trim();

      if (!shop && !item) continue;

      const key = `${shop}｜${item}（${sugar}/${ice}）`;
      m.set(key, (m.get(key) || 0) + 1);
    }
  }

  return Array.from(m.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([key, count]) => {
      // 解析回去給 UI 用（你也可以直接用 key 顯示）
      const [left, right] = key.split("（");
      const [shop, item] = left.split("｜");
      const [sugar, ice] = (right || "").replace("）", "").split("/");
      return { shop: shop || "", item: item || "", sugar: sugar || "", ice: ice || "", count };
    });
}

export function weekdayHistogram(docs = []) {
  // Sun..Sat 0..6
  const hist = Array(7).fill(0);

  for (const d of Array.isArray(docs) ? docs : []) {
    const ds = d?.dateStr;
    const rows = Array.isArray(d?.rows) ? d.rows : [];
    if (!isValidDateStr(ds)) continue;

    const date = new Date(ds); // YYYY-MM-DD
    const w = date.getDay();
    hist[w] += rows.length;
  }

  return hist;
}

// ------- Build year stats (basic totals + docs) -------
export function buildYearStats(year) {
  const docs = loadYearDocs(year);

  let totalCups = 0;
  let totalSpend = 0;

  for (const d of docs) {
    const rows = Array.isArray(d?.rows) ? d.rows : [];
    totalCups += rows.length;
    for (const r of rows) totalSpend += calcFinalPrice(r);
  }

  const streak = bestStreakDays(docs.filter((d) => (d?.rows || []).length > 0).map((d) => d.dateStr));
  const shopDistinct = new Set(
    docs.flatMap((d) => (d?.rows || []).map((r) => (r?.shop || "").trim()).filter(Boolean))
  ).size;

  return {
    year,
    docs,
    totalCups,
    totalSpend,
    bestStreakDays: streak,
    shopDistinct,
  };
}
// ------- Collect unique shops/items from ALL saved docs -------
export function collectUniqueShops(limit = 12) {
  const set = new Set();

  // 由新到舊掃 localStorage（越新的越先進 chips）
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(KEY_PREFIX)) keys.push(k);
  }

  // 依日期新→舊排序（key 裡含 dateStr）
  keys.sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));

  for (const k of keys) {
    const dateStr = k.slice(KEY_PREFIX.length);
    const doc = loadDay(dateStr);
    const rows = Array.isArray(doc?.rows) ? doc.rows : [];

    for (const r of rows) {
      const shop = (r?.shop || "").trim();
      if (!shop) continue;
      if (!set.has(shop)) set.add(shop);
      if (set.size >= limit) return Array.from(set);
    }
  }

  return Array.from(set);
}

export function collectUniqueItems(limit = 12) {
  const set = new Set();

  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(KEY_PREFIX)) keys.push(k);
  }

  keys.sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));

  for (const k of keys) {
    const dateStr = k.slice(KEY_PREFIX.length);
    const doc = loadDay(dateStr);
    const rows = Array.isArray(doc?.rows) ? doc.rows : [];

    for (const r of rows) {
      const item = (r?.item || "").trim();
      if (!item) continue;
      if (!set.has(item)) set.add(item);
      if (set.size >= limit) return Array.from(set);
    }
  }

  return Array.from(set);
}
// ------- Collect shops sorted by frequency (desc), tie -> recency -------
export function collectUniqueShopsByCount(limit = 12) {
  const countMap = new Map(); // shop -> count
  const lastSeenMap = new Map(); // shop -> latest dateStr (string)

  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(KEY_PREFIX)) keys.push(k);
  }

  // 日期新 -> 舊（讓 lastSeen 只要第一次看到就是最新）
  keys.sort((a, b) => (a > b ? -1 : a < b ? 1 : 0));

  for (const k of keys) {
    const dateStr = k.slice(KEY_PREFIX.length);
    const doc = loadDay(dateStr);
    const rows = Array.isArray(doc?.rows) ? doc.rows : [];

    for (const r of rows) {
      const shop = (r?.shop || "").trim();
      if (!shop) continue;

      countMap.set(shop, (countMap.get(shop) || 0) + 1);

      // 新到舊掃描：第一次遇到就是最近
      if (!lastSeenMap.has(shop)) lastSeenMap.set(shop, dateStr);
    }
  }

  // 轉成陣列排序
  const list = Array.from(countMap.entries()).map(([shop, count]) => ({
    shop,
    count,
    lastSeen: lastSeenMap.get(shop) || "0000-00-00",
  }));

  list.sort((a, b) => {
    // 1) 次數多的在前
    if (b.count !== a.count) return b.count - a.count;
    // 2) 次數一樣，最近出現的在前
    if (b.lastSeen !== a.lastSeen) return b.lastSeen > a.lastSeen ? 1 : -1;
    // 3) 再一樣就字母排序（穩定）
    return a.shop.localeCompare(b.shop, "zh-Hant");
  });

  return list.slice(0, limit).map((x) => x.shop);
}
