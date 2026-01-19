// src/palette.js
const PALETTE = [
  { bar: "#D8A6FF", soft: "#F4E9FF" }, // 紫
  { bar: "#BFA6FF", soft: "#F1EEFF" }, // 淡紫
  { bar: "#A6B8FF", soft: "#EEF2FF" }, // 藍紫

  { bar: "#FF9AD5", soft: "#FFE6F2" }, // 粉
  { bar: "#FF7FBF", soft: "#FFE0EE" }, // 亮粉
  { bar: "#FF8E8E", soft: "#FFE6E6" }, // 紅粉

  { bar: "#FFB36B", soft: "#FFF0E0" }, // 橘
  { bar: "#FFA24D", soft: "#FFEBD6" }, // 深橘
  { bar: "#FFD36E", soft: "#FFF7DD" }, // 黃

  { bar: "#FFE27D", soft: "#FFF9E6" }, // 淡黃
  { bar: "#B7F28A", soft: "#F0FCE8" }, // 黃綠
  { bar: "#9EE7A1", soft: "#E9FBEA" }, // 綠

  { bar: "#66D6A2", soft: "#E7FBF2" }, // 青綠
  { bar: "#6FE6D6", soft: "#E4FFFB" }, // 青
  { bar: "#7DD3FF", soft: "#E6F6FF" }, // 淺藍

  { bar: "#5BC0FF", soft: "#E1F3FF" }, // 藍
  { bar: "#8FB6FF", soft: "#E9F0FF" }, // 靛
  { bar: "#5F93FF", soft: "#E3ECFF" }, // 深藍

  { bar: "#A6E3FF", soft: "#EAF9FF" }, // 粉藍
  { bar: "#FFC6A6", soft: "#FFF1E8" }, // 杏
  { bar: "#FFB6C1", soft: "#FFE9EE" }, // 淡玫瑰

  { bar: "#C7A27C", soft: "#F6EEE6" }, // 奶茶
  { bar: "#B98D63", soft: "#F4E8DC" }, // 深奶茶
  { bar: "#D3B08A", soft: "#F8F0E7" }, // 淺奶茶
];


function hashStr(s = "") {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function hashShopColor(shop = "") {
  const key = (shop || "unknown").trim() || "unknown";
  const idx = hashStr(key) % PALETTE.length;
  const c = PALETTE[idx];

  return {
    barStyle: { backgroundColor: c.bar },
    softStyle: { backgroundColor: c.soft },
    dotStyle: { backgroundColor: c.bar },
    borderClass: "border-[#EADBC8]", // 你原本的奶茶邊框維持一致
  };
}
