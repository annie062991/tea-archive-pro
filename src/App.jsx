// src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import { hashShopColor } from "./palette";
import { loadDay, saveDay, loadYearDocs, deleteDay, buildYearStats, topShops, topCombos, weekdayHistogram, collectUniqueShopsByCount,
  collectUniqueItems, } from "./storage";

const SUGAR_OPTIONS = ["無糖", "一分", "微糖", "半糖", "少糖", "全糖", "固定"];
const ICE_OPTIONS = ["去冰", "微冰", "少冰", "正常", "常溫", "熱", "固定"];

const FAVOR_SHOPS = ["麻古", "清心福全", "茶湯會", "八曜和茶", "自己來", "一沐日"];
const FAVOR_ITEMS = ["梅子綠茶", "優多綠茶", "鐵觀音奶茶", "牧場黑烏龍 乳茶"];


const emptyRow = () => ({
  shop: "",
  item: "",
  price: "",
  sugar: "無糖",
  ice: "去冰",
  isEco: false,
  isGift: false,
});
function isRowFilled(r) {
  if (!r || typeof r !== "object") return false;
  const shop = (r.shop || "").trim();
  const item = (r.item || "").trim();
  const price = String(r.price ?? "").trim();
  // 只要有填任一欄（或勾選請客/環保杯）就算一杯
  return Boolean(shop || item || price || r.isEco || r.isGift);
}

// ===== 工具：日期轉字串 =====
function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function todayStr() {
  return toDateStr(new Date());
}

// ===== 計算實付金額（App 端用來顯示）=====
function calcFinalPrice(row) {
  const p = Number(row?.price) || 0;
  if (row?.isGift) return 0;
  if (row?.isEco) return Math.max(0, p - 5);
  return p;
}


// ===== 建立月份日曆資料（吃 docs）=====
// 回傳：{ "YYYY-MM-DD": { doc, count, spend } }
function buildMonthMap(docs, ym) {
  const map = {};

  for (const doc of Array.isArray(docs) ? docs : []) {
    const ds = doc?.dateStr;
    if (!ds || !ds.startsWith(`${ym}-`)) continue;

    const rows = Array.isArray(doc?.rows) ? doc.rows : [];
    if (rows.length === 0) continue;

    const count = rows.length;
    const spend = rows.reduce((acc, r) => acc + calcFinalPrice(r), 0);

    map[ds] = { doc, count, spend };
  }

  return map;
}



function IconBtn({ title, onClick, children, danger = false }) {
  return (
    <button
      title={title}
      onClick={onClick}
      className={[
        "h-10 w-10 rounded-2xl border font-black shadow-sm active:scale-[0.98]",
        danger
          ? "border-red-200 bg-red-50 text-red-500"
          : "border-[#EADBC8] bg-white text-[#8B5E3C]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function BottomNav({ tab, setTab }) {
  const item = (k, label, icon) => (
    <button
      onClick={() => setTab(k)}
      className={[
        "flex-1 h-16 flex flex-col items-center justify-center gap-1 font-black",
        tab === k ? "text-[#8B5E3C]" : "text-[#8B5E3C]/40",
      ].join(" ")}
    >
      <div className="text-xl">{icon}</div>
      <div className="text-[11px] tracking-widest">{label}</div>
    </button>
  );

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50">
      <div className="max-w-5xl mx-auto px-6 pb-5">
        <div className="bg-[#FDFCFB] rounded-[2.2rem] border border-[#EADBC8] shadow-[0_10px_40px_rgba(67,40,24,0.12)] overflow-hidden">
          <div className="flex">
            {item("form", "對戰記錄", "🧾")}
            {item("calendar", "奶茶怪出戰紀錄", "🗓️")}
            {item("insights", "戰況分析", "📊")}
          </div>
        </div>
      </div>
      <div className="h-2" />
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState("form");
  const [storageRev, setStorageRev] = useState(0);
  // 表單日期
  const [dateStr, setDateStr] = useState(() => todayStr());

  // 月曆 / 分析：年月
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1..12

  // 表單狀態
  const [rows, setRows] = useState([emptyRow()]);
  const [activeIdx, setActiveIdx] = useState(0);


  // 讀當天資料（如果有）
  useEffect(() => {
    const doc = loadDay(dateStr);
    if (doc?.rows?.length) {
      setRows(doc.rows.map((r) => ({ ...r, price: String(r.price ?? "") })));
      setActiveIdx(0);
    } else {
      setRows([emptyRow()]);
      setActiveIdx(0);
    }
  }, [dateStr]);

  // 表單摘要
  const summary = useMemo(() => {
  const filled = rows.filter(isRowFilled);
  const count = filled.length;
  const spend = filled.reduce((acc, r) => acc + calcFinalPrice(r), 0);
  return { count, spend };
}, [rows]);

  const updateRow = (idx, patch) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };

  const addRow = () => {
    setRows((prev) => [...prev, emptyRow()]);
    setActiveIdx(rows.length);
  };

  const removeRow = (idx) => {
    setRows((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      return next.length ? next : [emptyRow()];
    });
    setActiveIdx((p) => (idx === p ? Math.max(0, p - 1) : p > idx ? p - 1 : p));
  };

  const resetRow = (idx) => updateRow(idx, emptyRow());

  const saveLocal = () => {
  const cleaned = rows.filter(isRowFilled);
  if (cleaned.length === 0) {
    deleteDay(dateStr); // ✅ 直接刪除那天紀錄
  } else {
    saveDay(dateStr, cleaned);
  }
  setStorageRev((v) => v + 1); // ✅ 讓日曆/分析立刻更新
  alert("已存檔 ✅");
};
const shopChips = useMemo(() => {
  const dynamic = collectUniqueShopsByCount(12);
  return dynamic.length ? dynamic : FAVOR_SHOPS; // 沒資料才用預設
}, [storageRev]);

const itemChips = useMemo(() => {
  const dynamic = collectUniqueItems(12);
  return dynamic.length ? dynamic : FAVOR_ITEMS;
}, [storageRev]);

 // ===== Insights data (year stats) =====
const yearDocs = useMemo(() => loadYearDocs(year), [year, storageRev]);
const yearStats = useMemo(() => buildYearStats(year), [year, storageRev]);
const docs = yearStats?.docs || [];
const streak = yearStats?.bestStreakDays ?? 0;

// 年度 Top 店家 / Top 組合
const topShopList = useMemo(() => topShops(docs, 5), [docs]);
const topComboList = useMemo(() => topCombos(docs, 5), [docs]);
const weekHist = useMemo(() => weekdayHistogram(docs), [docs]);

// ✅ 本月 YYYY-MM（給月篩選 & 顯示用）
const ym = useMemo(() => {
  return `${year}-${String(month).padStart(2, "0")}`;}, [year, month]);

// ✅ 本月 docs（只抓這個月有存檔的日子）
const monthDocs = useMemo(() => {
  return docs.filter((d) => (d?.dateStr || "").startsWith(`${ym}-`));
}, [docs, ym]);

// ===== Calendar data (month map) =====
const monthMap = useMemo(() => buildMonthMap(monthDocs, year, month), [monthDocs, year, month]);

const firstDayOfMonth = new Date(year, month - 1, 1);
const startWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7;
const daysInMonth = new Date(year, month, 0).getDate();

// ✅ 本月杯數 / 花費（從 monthMap 算）

const monthCups = useMemo(
  () => Object.values(monthMap).reduce((a, v) => a + (v?.count || 0), 0),
  [monthMap]
);

const monthSpend = useMemo(() => {
  return Object.values(monthMap).reduce((a, v) => a + (v?.spend || 0), 0);
}, [monthMap]);



// ✅ 本月 Top 店家 / Top 組合
const monthTopShops = useMemo(() => topShops(monthDocs, 3), [monthDocs]);
const monthTopCombos = useMemo(() => topCombos(monthDocs, 3), [monthDocs]);

// ✅ 年度 Top 店家 / Top 組合
const yearTopShops = useMemo(() => topShops(docs, 5), [docs]);
const yearTopCombos = useMemo(() => topCombos(docs, 5), [docs]);


// ✅ 本月環保次數（isEco）
const monthEcoCount = useMemo(() => {
  let n = 0;
  for (const d of monthDocs) {
    const rows = Array.isArray(d?.rows) ? d.rows : [];
    for (const r of rows) if (r?.isEco) n += 1;
  }
  return n;
}, [monthDocs]);
// ✅ 省下多少錢（每次環保杯 -5 元）
const monthEcoSaved = useMemo(() => {
  let saved = 0;
  for (const d of monthDocs) {
    const rows = Array.isArray(d?.rows) ? d.rows : [];
    for (const r of rows) {
      if (r?.isGift) continue;
      if (r?.isEco) saved += 5;
    }
  }
  return saved;
}, [monthDocs]);
// ✅ 本月環保目標（照你圖：6）
const ECO_GOAL = 6;

// ✅ 達成率
const ecoRate = useMemo(() => {
  if (ECO_GOAL <= 0) return 0;
  return Math.min(100, Math.round((monthEcoCount / ECO_GOAL) * 100));
}, [monthEcoCount]);

// ✅ 你喝掉...（用省下的錢換算）
const EQUIVS = [
  { name: "日本來回機票", price: 15000, unit: "張", icon: "✈️" },
  { name: "Nintendo Switch 2", price: 12000, unit: "台", icon: "🎮" },
];

const equivProgress = useMemo(() => {
  return EQUIVS.map((x) => {
    const ratio = x.price > 0 ? monthEcoSaved / x.price : 0;
    return { ...x, ratio };
  });
}, [monthEcoSaved]);



    () => Object.values(monthMap).reduce((a, v) => a + (v?.spend || 0), 0),
    [monthMap];

  return (
    <div className="min-h-screen bg-[#F7F1EA] text-[#432818] pb-28">
{/* Top header card */}
<header className="sticky top-0 z-40 bg-gradient-to-b from-[#FDFCFB] to-[#FDFCFB]/80 backdrop-blur border-b border-[#EADBC8]">
  <div className="max-w-5xl mx-auto px-6 py-5">
    <div className="bg-[#FDFCFB] rounded-[2.5rem] border border-[#EADBC8] shadow-[0_8px_30px_rgba(67,40,24,0.08)] px-7 py-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-black text-[#8B5E3C]/60 tracking-widest">
            TEA ARCHIVE PRO
          </p>
          <h1 className="text-2xl font-black tracking-tight mt-1">
            {tab === "form" ? "對戰記錄" : tab === "calendar" ? "奶茶怪出戰紀錄" : "對戰記錄"}
          </h1>
          <p className="text-[11px] font-black text-[#8B5E3C]/60 mt-2">
            {tab === "form"
              ? `${dateStr} · 今天喝幾杯、花多少，一眼就懂`
              : tab === "calendar"
              ? `${year}-${String(month).padStart(2, "0")} · 對戰記錄`
              : `${year} · 年度統計與最愛紀錄`}
          </p>
        </div>

        {tab === "form" ? (
          <button
            onClick={saveLocal}
            className="h-11 px-6 rounded-2xl bg-[#8B5E3C] text-white font-black text-sm shadow-md active:scale-[0.98]"
          >
            存檔
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (tab === "calendar") {
                  const d = new Date(year, month - 2, 1);
                  setYear(d.getFullYear());
                  setMonth(d.getMonth() + 1);
                } else {
                  setYear((y) => y - 1);
                }
              }}
              className="h-11 w-11 rounded-2xl border border-[#EADBC8] bg-white text-[#8B5E3C] font-black shadow-sm active:scale-[0.98]"
              title="上一個"
            >
              ←
            </button>
            <button
              onClick={() => {
                if (tab === "calendar") {
                  const d = new Date(year, month, 1);
                  setYear(d.getFullYear());
                  setMonth(d.getMonth() + 1);
                } else {
                  setYear((y) => y + 1);
                }
              }}
              className="h-11 w-11 rounded-2xl border border-[#EADBC8] bg-white text-[#8B5E3C] font-black shadow-sm active:scale-[0.98]"
              title="下一個"
            >
              →
            </button>
          </div>
        )}
      </div>

      {/* Summary strip */}
      <div className="mt-5 grid grid-cols-3 gap-3">
        <div className="bg-[#F7F1EA] rounded-2xl border border-[#EADBC8] px-5 py-4">
          <p className="text-[10px] font-black text-[#8B5E3C]/60 tracking-widest">
            {tab === "form" ? "今日杯數" : tab === "calendar" ? "本月飲用" : "年度飲用"}
          </p>
          <p className="text-2xl font-black mt-1 text-[#8B5E3C]">
            {tab === "form" ? summary.count : tab === "calendar" ? monthCups : yearStats.totalCups}
            <span className="text-xs font-black opacity-40 ml-1">杯</span>
          </p>
        </div>

        <div className="bg-[#F7F1EA] rounded-2xl border border-[#EADBC8] px-5 py-4">
          <p className="text-[10px] font-black text-[#8B5E3C]/60 tracking-widest">
            {tab === "form" ? "今日花費" : tab === "calendar" ? "本月花費" : "年度花費"}
          </p>
          <p className="text-2xl font-black mt-1 text-[#8B5E3C]">
            {tab === "form" ? summary.spend : tab === "calendar" ? monthSpend : yearStats.totalSpend}
            <span className="text-xs font-black opacity-40 ml-1">元</span>
          </p>
        </div>

        <div className="bg-[#F7F1EA] rounded-2xl border border-[#EADBC8] px-5 py-4">
          <p className="text-[10px] font-black text-[#8B5E3C]/60 tracking-widest">
            {tab === "form" ? "快速切換" : tab === "calendar" ? "點日期" : "最高連續"}
          </p>
          <p className="text-2xl font-black mt-1 text-[#8B5E3C]">
            {tab === "form" ? "今天" : tab === "calendar" ? "進表單" : streak}
            <span className="text-xs font-black opacity-40 ml-1">
              {tab === "insights" ? "天" : ""}
            </span>
          </p>
        </div>
      </div>

      {/* ✅ Tabs（放這裡！） */}
      <div className="mt-4 flex gap-2">
        {[
          { key: "form", label: "表單" },
          { key: "calendar", label: "月曆" },
          { key: "insights", label: "分析" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={[
              "px-5 h-11 rounded-full font-black text-sm border transition-all",
              tab === t.key
                ? "bg-[#8B5E3C] text-white border-[#8B5E3C] shadow"
                : "bg-white text-[#AF8F6F] border-[#EADBC8]",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  </div>
</header>


      
      {/* Pages */}
      <main className="max-w-5xl mx-auto px-6 py-7 space-y-6">
        {tab === "form" && (
          <>
            {rows.map((r, idx) => {
              const finalPrice = calcFinalPrice(r);
              const isActive = idx === activeIdx;

              return (
                <section
                  key={idx}
                  onClick={() => setActiveIdx(idx)}
                  className={[
                    "bg-[#FDFCFB] rounded-[2.5rem] border-2 transition-all",
                    "shadow-[0_8px_30px_rgba(67,40,24,0.06)]",
                    isActive ? "border-[#8B5E3C]" : "border-[#EADBC8]",
                  ].join(" ")}
                >
                  <div className="px-8 pt-7 pb-7">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-black text-[#8B5E3C]/40 tracking-widest">
                        飲品 {String(idx + 1).padStart(2, "0")}
                      </p>
                      <div className="flex gap-2">
                        <IconBtn
                          title="重設"
                          onClick={(e) => {
                            e.stopPropagation();
                            resetRow(idx);
                          }}
                        >
                          ↺
                        </IconBtn>
                        <IconBtn
                          title="刪除"
                          danger
                          onClick={(e) => {
                            e.stopPropagation();
                            removeRow(idx);
                          }}
                        >
                          🗑
                        </IconBtn>
                      </div>
                    </div>

                    {/* Shop */}
                    <div className="mt-6 space-y-2">
                      <p className="text-[10px] font-black text-[#8B5E3C] tracking-widest">店家名稱</p>
                      <input
                        value={r.shop}
                        onChange={(e) => updateRow(idx, { shop: e.target.value })}
                        placeholder="例如：可不可、50嵐、清心..."
                        className="w-full bg-[#F7F1EA] rounded-2xl px-5 h-14 text-sm font-black border border-[#EADBC8] outline-none focus:border-[#8B5E3C]"
                      />
                      <div className="flex gap-2 flex-wrap pt-1">
  {shopChips.map((s) => (
    <button
      key={s}
      onClick={() => updateRow(idx, { shop: s })}
      className={[
        "px-4 py-2 rounded-full text-[12px] font-black border transition-all",
        r.shop === s
          ? "bg-[#8B5E3C] text-white border-[#8B5E3C] shadow"
          : "bg-white text-[#AF8F6F] border-[#EADBC8]",
      ].join(" ")}
    >
      {s}
    </button>
  ))}
</div>
</div>

                    {/* Item */}
                    <div className="mt-6 space-y-2">
                      <p className="text-[10px] font-black text-[#8B5E3C] tracking-widest">品項名稱</p>
                      <input
                        value={r.item}
                        onChange={(e) => updateRow(idx, { item: e.target.value })}
                        placeholder="例如：熟成紅茶、珍奶、四季春..."
                        className="w-full bg-[#F7F1EA] rounded-2xl px-5 h-14 text-sm font-black border border-[#EADBC8] outline-none focus:border-[#8B5E3C]"
                      />
                      <p className="text-[10px] font-black text-[#8B5E3C]/60 pt-1">常用：</p>
                      <div className="flex gap-2 flex-wrap">
                        {itemChips.map((name) => (
  <button
    key={name}
    onClick={() => updateRow(idx, { item: name })}
    className="px-4 py-2 rounded-full text-[12px] font-black border bg-white text-[#8B5E3C] border-[#EADBC8] shadow-sm active:scale-[0.99]"
  >
    {name}
  </button>
))}
                      </div>
                    </div>

                    {/* Price */}
                    <div className="mt-7 space-y-2">
                      <p className="text-[10px] font-black text-[#8B5E3C] tracking-widest">金額與折扣</p>

                      <div className="flex flex-col gap-3">
                        <div className="flex gap-3 items-stretch">
                          <div className="flex-1">
                            <div className="relative">
                              <span className="absolute left-5 top-1/2 -translate-y-1/2 text-[#8B5E3C] font-black opacity-40">
                                $
                              </span>
                              <input
                                inputMode="numeric"
                                value={r.price}
                                onChange={(e) => {
                                  const v = e.target.value.replace(/[^\d]/g, "");
                                  updateRow(idx, { price: v });
                                }}
                                placeholder="0"
                                className="w-full bg-[#F7F1EA] rounded-2xl pl-10 pr-5 h-14 text-base font-black border border-[#EADBC8] outline-none focus:border-[#8B5E3C]"
                              />
                            </div>
                          </div>

                          <div className="w-[150px] bg-[#F7F1EA] rounded-2xl border border-[#EADBC8] flex flex-col justify-center items-center">
                            <p className="text-[10px] font-black text-[#8B5E3C]/60">實付</p>
                            <p className="text-2xl font-black text-[#432818] leading-none mt-1">
                              {finalPrice}
                              <span className="text-[10px] font-black opacity-30 ml-1">元</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex gap-3">
                          <button
                            onClick={() => updateRow(idx, { isEco: !r.isEco })}
                            className={[
                              "flex-1 h-12 rounded-full font-black text-sm flex items-center justify-center gap-2 border transition-all",
                              r.isEco
                                ? "bg-green-600 text-white border-green-600 shadow"
                                : "bg-white text-[#AF8F6F] border-[#EADBC8]",
                            ].join(" ")}
                          >
                            🌿 環保杯 -5
                          </button>

                          <button
                            onClick={() => updateRow(idx, { isGift: !r.isGift })}
                            className={[
                              "flex-1 h-12 rounded-full font-black text-sm flex items-center justify-center gap-2 border transition-all",
                              r.isGift
                                ? "bg-yellow-500 text-white border-yellow-500 shadow"
                                : "bg-white text-[#AF8F6F] border-[#EADBC8]",
                            ].join(" ")}
                          >
                            🎁 請客（0元）
                          </button>
                        </div>

                        <p className="text-[11px] font-black text-[#8B5E3C]/55">
                          小提醒：請客優先（即使環保杯也會是 0 元）
                        </p>
                      </div>
                    </div>

                    {/* Sugar / Ice */}
                    <div className="mt-8 space-y-4">
                      <div>
                        <p className="text-[10px] font-black text-[#8B5E3C] tracking-widest">甜度</p>
                        <div className="flex gap-2 overflow-x-auto pb-1 pt-2">
                          {SUGAR_OPTIONS.map((s) => (
                            <button
                              key={s}
                              onClick={() => updateRow(idx, { sugar: s })}
                              className={[
                                "shrink-0 px-4 py-3 rounded-2xl text-[12px] font-black border transition-all",
                                r.sugar === s
                                  ? "bg-[#8B5E3C] text-white border-[#8B5E3C] shadow"
                                  : "bg-[#F7F1EA] text-[#AF8F6F] border-[#EADBC8]",
                              ].join(" ")}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-[10px] font-black text-[#8B5E3C] tracking-widest">冰塊</p>
                        <div className="flex gap-2 overflow-x-auto pb-1 pt-2">
                          {ICE_OPTIONS.map((ic) => (
                            <button
                              key={ic}
                              onClick={() => updateRow(idx, { ice: ic })}
                              className={[
                                "shrink-0 px-4 py-3 rounded-2xl text-[12px] font-black border transition-all",
                                r.ice === ic
                                  ? "bg-[#8B5E3C] text-white border-[#8B5E3C] shadow"
                                  : "bg-[#F7F1EA] text-[#AF8F6F] border-[#EADBC8]",
                              ].join(" ")}
                            >
                              {ic}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              );
            })}

            <button
              onClick={addRow}
              className="w-full py-10 border-2 border-dashed border-[#EADBC8] rounded-[3rem] text-[#8B5E3C] font-black flex flex-col items-center gap-2 bg-[#FDFCFB] shadow-[0_8px_30px_rgba(67,40,24,0.04)] active:scale-[0.99]"
            >
              <span className="text-4xl leading-none">＋</span>
              <span className="text-[12px] tracking-widest">新增一筆</span>
            </button>
          </>
        )}

        {tab === "calendar" && (
          <section className="bg-[#FDFCFB] rounded-[2.5rem] border border-[#EADBC8] shadow-[0_8px_30px_rgba(67,40,24,0.06)] p-6">
            <div className="grid grid-cols-7 text-center text-[12px] font-black text-[#8B5E3C]/70 mb-3">
              {["一", "二", "三", "四", "五", "六", "日"].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-3">
              {Array.from({ length: startWeekday }).map((_, i) => (
                <div key={`pad-${i}`} />
              ))}

              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const ds = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                const hit = monthMap[ds];
                const firstRow = hit?.doc?.rows?.[0];
                const shop = firstRow?.shop || "";
                const item = firstRow?.item || "";
                const color = hashShopColor(shop);

                return (
                  <button
                    key={ds}
                    onClick={() => {
                      setDateStr(ds);
                      setTab("form");
                    }}
                    className={[
                      "relative rounded-2xl border border-[#EADBC8] bg-[#F7F1EA]/40",
                      "h-[132px] text-left p-3 shadow-sm active:scale-[0.99]",
                      "overflow-hidden flex flex-col",
                      hit ? "bg-[#FDFCFB]" : "bg-[#F7F1EA]/40",
                    ].join(" ")}
                  >
                      {/* 上排：日期 + 杯數 */}
                    <div className="flex items-start justify-between shrink-0">
                      <div className="text-[12px] font-black text-[#8B5E3C]">{day}</div>
                      {hit ? (
                        <div className="text-[11px] font-black text-white bg-[#8B5E3C] px-2 py-1 rounded-xl">
                          {hit.count}
                        </div>
                      ) : null}
                    </div>
  {/* 下排：彩色卡片（吃剩餘高度） */}
                    {hit ? (
  <div className="mt-2 flex-1 min-h-0 overflow-hidden relative">
    {(() => {
      const rows = Array.isArray(hit?.doc?.rows) ? hit.doc.rows : [];
      const show = rows.slice(0, 2);

      return (
        <div className="h-full flex flex-col gap-2">
          {show.map((row, idx2) => {
            const shop2 = (row?.shop || "").trim();
            const item2 = (row?.item || "").trim();
            const c2 = hashShopColor(shop2);

return (
  <div
    key={idx2}
    className={[
      "rounded-xl overflow-hidden border",
      c2.borderClass,
    ].join(" ")}
    style={c2.softStyle} // ✅ 淡色底
  >
    <div
      className="h-7 px-3 flex items-center"
      style={c2.barStyle} // ✅ 深色條
    >
      <span className="h-2 w-2 rounded-full" style={c2.dotStyle} />
      <div className="text-[11px] font-black text-white truncate">
        {shop2 || "（未填店家）"}
      </div>
    </div>

    <div className="px-3 py-1">
      <div className="text-[11px] font-black text-[#432818] truncate">
        {item2 || "（未填品項）"}
      </div>
    </div>
  </div>
);
          })}

          {rows.length > 2 && (
            <div className="absolute bottom-2 right-2 text-[11px] font-black bg-[#8B5E3C] text-white px-2 py-1 rounded-full shadow">
              +{rows.length - 2}
            </div>
          )}
        </div>
      );
    })()}
  </div>
) : (
  <div className="mt-auto text-[11px] font-black text-[#8B5E3C]/25">—</div>
)}

                  </button>
                );
              })}
            </div>
            </section>
        )}

        {tab === "insights" && (
           <div className="space-y-6">
    {/* ✅ 本月環保卡 */}
    <section className="bg-[#FDFCFB] rounded-[2.5rem] border border-[#EADBC8] shadow-[0_8px_30px_rgba(67,40,24,0.06)] p-7">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-2xl bg-green-50 border border-green-100 flex items-center justify-center text-2xl">
            🌿
          </div>
          <div>
            <div className="text-2xl font-black">今天也很環保喔</div>
            <div className="text-[12px] font-black text-[#8B5E3C]/60 mt-1">
              本月環保次數：{monthEcoCount} / {ECO_GOAL}
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-[11px] font-black text-[#8B5E3C]/50 tracking-widest">累計省下</div>
          <div className="text-3xl font-black text-green-600">${monthEcoSaved}</div>
          <div className="text-[12px] font-black text-[#8B5E3C]/70 mt-1">
            達成率：{ecoRate}%
          </div>
        </div>
      </div>  
      

      {/* 進度條 */}
      <div className="mt-5 w-full h-4 rounded-full bg-[#F7F1EA] border border-[#EADBC8] overflow-hidden">
        <div className="h-full rounded-full bg-green-500" style={{ width: `${ecoRate}%` }} />
      </div>
    </section>

    {/* ✅ 本月最愛紀錄 */}
    <section className="bg-[#FDFCFB] rounded-[2.5rem] border border-[#EADBC8] shadow-[0_8px_30px_rgba(67,40,24,0.06)] p-7">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-white border border-[#EADBC8] flex items-center justify-center text-xl">
          ☕
        </div>
        <div>
          <div className="text-2xl font-black">本月最愛紀錄</div>
          <div className="text-[12px] font-black text-[#8B5E3C]/60">{ym}</div>
        </div>
      </div>

      <div className="mt-6 grid md:grid-cols-2 gap-6">
        {/* 本月最愛店家 TOP3 */}
        <div>
          <div className="text-[12px] font-black text-[#8B5E3C]/60 tracking-widest mb-3">
            最愛店家 TOP 3
          </div>

          <div className="space-y-3">
            {monthTopShops.length ? (
              monthTopShops.map((x, idx) => (
                <div
                  key={x.shop}
                  className="bg-[#F7F1EA]/40 rounded-2xl px-5 py-4 flex items-center justify-between"
                >
                  <div className="font-black text-[#432818]">
                    {idx + 1}. {x.shop}
                  </div>
                  <div className="font-black text-[#8B5E3C]">{x.count} 次</div>
                </div>
              ))
            ) : (
              <div className="text-[12px] font-black text-[#8B5E3C]/40">目前沒有資料</div>
            )}
          </div>
        </div>

        {/* 本月最愛組合 TOP3 */}
        <div>
          <div className="text-[12px] font-black text-[#8B5E3C]/60 tracking-widest mb-3">
            最愛組合 TOP 3
          </div>

          <div className="space-y-3">
            {monthTopCombos.length ? (
              monthTopCombos.map((x, idx) => (
                <div
                  key={`${x.shop}-${x.item}-${idx}`}
                  className="bg-[#F7F1EA]/40 rounded-2xl px-5 py-4 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0 font-black text-[#432818] truncate">
                    {idx + 1}. {x.shop} {x.item}（{x.sugar}/{x.ice}）
                  </div>
                  <div className="font-black text-[#8B5E3C] whitespace-nowrap">{x.count} 次</div>
                </div>
              ))
            ) : (
              <div className="text-[12px] font-black text-[#8B5E3C]/40">目前沒有資料</div>
            )}
          </div>
        </div>
      </div>
    </section>

    {/* ✅ 年度最愛紀錄 */}
    <section className="bg-[#FDFCFB] rounded-[2.5rem] border border-[#EADBC8] shadow-[0_8px_30px_rgba(67,40,24,0.06)] p-7">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-white border border-[#EADBC8] flex items-center justify-center text-xl">
          📈
        </div>
        <div>
          <div className="text-2xl font-black">年度最愛紀錄</div>
          <div className="text-[12px] font-black text-[#8B5E3C]/60">{year}</div>
        </div>
      </div>

      <div className="mt-6 grid md:grid-cols-2 gap-6">
        {/* 年度最愛店家 TOP5 */}
        <div>
          <div className="text-[12px] font-black text-[#8B5E3C]/60 tracking-widest mb-3">
            年度最愛店家 TOP 5
          </div>

          <div className="space-y-3">
            {yearTopShops.length ? (
              yearTopShops.map((x, idx) => (
                <div
                  key={x.shop}
                  className="bg-[#F7F1EA]/40 rounded-2xl px-5 py-4 flex items-center justify-between"
                >
                  <div className="font-black text-[#432818]">
                    {idx + 1}. {x.shop}
                  </div>
                  <div className="font-black text-[#8B5E3C]">{x.count} 次</div>
                </div>
              ))
            ) : (
              <div className="text-[12px] font-black text-[#8B5E3C]/40">目前沒有資料</div>
            )}
          </div>
        </div>

        {/* 年度最佳組合 TOP5 */}
        <div>
          <div className="text-[12px] font-black text-[#8B5E3C]/60 tracking-widest mb-3">
            年度最佳組合 TOP 5
          </div>

          <div className="space-y-3">
            {yearTopCombos.length ? (
              yearTopCombos.map((x, idx) => (
                <div
                  key={`${x.shop}-${x.item}-${idx}`}
                  className="bg-[#F7F1EA]/40 rounded-2xl px-5 py-4 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0 font-black text-[#432818] truncate">
                    {idx + 1}. {x.shop} {x.item}（{x.sugar}/{x.ice}）
                  </div>
                  <div className="font-black text-[#8B5E3C] whitespace-nowrap">{x.count} 杯</div>
                </div>
              ))
            ) : (
              <div className="text-[12px] font-black text-[#8B5E3C]/40">目前沒有資料</div>
            )}
          </div>
        </div>
      </div>
    </section>

    {/* ✅ 你喝掉…（換算省下的錢） */}
    <section className="bg-[#FDFCFB] rounded-[2.5rem] border border-[#EADBC8] shadow-[0_8px_30px_rgba(67,40,24,0.06)] p-7">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-2xl bg-white border border-[#EADBC8] flex items-center justify-center text-xl">
          🌀
        </div>
        <div>
          <div className="text-2xl font-black">你喝掉...</div>
          <div className="text-[12px] font-black text-[#8B5E3C]/60">
            用「本月環保省下的錢」換算
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {equivProgress.map((x) => {
          const pct = Math.min(100, Math.round(x.ratio * 100));
          return (
            <div key={x.name} className="bg-[#F7F1EA]/40 rounded-2xl p-5 border border-[#EADBC8]">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-2xl bg-white border border-[#EADBC8] flex items-center justify-center text-xl">
                    {x.icon}
                  </div>
                  <div>
                    <div className="text-xl font-black">{x.name}</div>
                    <div className="text-[12px] font-black text-[#8B5E3C]/50">
                      市價約 ${x.price.toLocaleString()}
                    </div>
                  </div>
                </div>

                <div className="text-right font-black">
                  <div className="text-[13px] text-[#8B5E3C]/60">已喝掉</div>
                  <div className="text-xl text-blue-600">
                    {x.ratio.toFixed(1)} {x.unit}
                  </div>
                </div>
              </div>

              <div className="mt-4 w-full h-4 rounded-full bg-[#F7F1EA] border border-[#EADBC8] overflow-hidden">
                <div className="h-full rounded-full bg-blue-500"
                 style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
   </div>
)}
</main>
  </div>
  );}