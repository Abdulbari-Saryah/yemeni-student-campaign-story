"use strict";

const form = document.getElementById("amounts");
const keys = ["union", "wechat", "alipay", "bank", "pledges", "goal"];
const inputs = keys.map((key) => form.elements.namedItem(key));
const originalAmounts = Object.freeze({
  union: 22587, wechat: 77806.3, alipay: 66649.1, bank: null, pledges: 20000, goal: 1171580
});
const defaults = window.campaignAmounts ?? originalAmounts;
const publishedVersion = JSON.stringify(defaults);
const storageKey = "yemeni-student-campaign-story-amounts";
const poster = document.getElementById("poster");
const context = poster.getContext("2d");
const template = new Image();
const unionLogo = new Image();
const download = document.getElementById("download");
const reset = document.getElementById("reset");
const settings = document.getElementById("download-settings");
const error = document.getElementById("error");
const status = document.getElementById("status");
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const integer = new Intl.NumberFormat("en-US");
const decimal = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const arabic = '"Noto Sans Arabic", Tahoma, Arial';
const heroHeight = 456;

let current;
let frame = 0;
let displayed = [0, 0];
let templateReady = false;
const content = createPosterContent(update, () => {
  status.textContent = "تعذّر حفظ محتوى الملصق في المتصفح. نزّل ملف الإعدادات للاحتفاظ به.";
});

function parseYuan(value) {
  const normalized = value.trim()
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x6f0))
    .replace(/٫/g, ".")
    .replace(/٬/g, ",");
  if (!/^(?:\d{1,8}|\d{1,3}(?:,\d{3}){1,2})(?:\.\d{1,2})?$/.test(normalized)) return NaN;
  const [whole, fraction = ""] = normalized.replaceAll(",", "").split(".");
  if (Number(whole) > 99_999_999) return NaN;
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

function formatAmount(cents, alwaysDecimals = false) {
  return (alwaysDecimals || cents % 100 ? decimal : integer).format(cents / 100);
}

function fill(values) {
  inputs.forEach((input) => { input.value = values[input.name] ?? ""; });
}

function save() {
  try {
    const fields = Object.fromEntries(inputs.map((input) => [input.name, input.value]));
    localStorage.setItem(storageKey, JSON.stringify({ publishedVersion, fields }));
  } catch {
    status.textContent = "حفظ التعديلات في هذا المتصفح غير متاح.";
  }
}

function readSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved?.publishedVersion === publishedVersion && saved.fields) return saved.fields;
  } catch {
    // The published amounts are also available with browser storage disabled.
  }
  return defaults;
}

function update() {
  const values = {};
  let invalid = false;
  for (const input of inputs) {
    const optional = input.name === "bank" && ["", "-"].includes(input.value.trim());
    const amount = optional ? null : parseYuan(input.value);
    const bad = Number.isNaN(amount) || (input.name === "goal" && amount === 0);
    input.setAttribute("aria-invalid", String(bad));
    invalid ||= bad;
    values[input.name] = amount;
  }
  error.hidden = !invalid;
  download.disabled = invalid || !templateReady || !content.ready;
  settings.disabled = invalid || !content.ready;
  reset.disabled = !content.ready;
  if (invalid) return;

  const received = values.union + values.wechat + values.alipay + (values.bank ?? 0);
  const total = received + values.pledges;
  const percent = Math.round(100 * total / values.goal);
  const cashFraction = Math.min(1, received / values.goal);
  const totalFraction = Math.min(1, total / values.goal);
  current = { values, received, total, percent, cashFraction, totalFraction };

  document.getElementById("total").textContent = formatAmount(total, true);
  document.getElementById("percent").textContent = `${percent}%`;
  document.getElementById("received").textContent = formatAmount(received, true);
  document.getElementById("pledged").textContent = formatAmount(values.pledges);
  document.getElementById("progress").setAttribute("aria-valuenow", Math.min(100, percent));
  document.getElementById("received-bar").style.width = `${cashFraction * 100}%`;
  document.getElementById("pledge-bar").style.width = `${(totalFraction - cashFraction) * 100}%`;
  if (templateReady && content.ready) animatePoster();
}

function rectangle(x, y, width, height, radius, fillColor) {
  context.fillStyle = fillColor;
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
}

function text(value, x, y, { color = "#142c25", font, align = "right", direction = "rtl", maxWidth } = {}) {
  context.fillStyle = color;
  context.font = font;
  context.textAlign = align;
  context.direction = direction;
  if (maxWidth === undefined) context.fillText(value, x, y);
  else context.fillText(value, x, y, maxWidth);
  return context.measureText(value).width;
}

function wrapLines(value, font, width) {
  if (!value.trim()) return [];
  context.font = font;
  context.direction = "rtl";
  const rows = [];
  let line = "";
  for (const word of value.trim().split(/[ \t\r\n]+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width <= width) {
      line = candidate;
      continue;
    }
    if (line) rows.push(line);
    line = "";
    for (const letter of word) {
      if (line && context.measureText(line + letter).width > width) {
        rows.push(line);
        line = "";
      }
      line += letter;
    }
  }
  if (line) rows.push(line);
  return rows;
}

function storyLayout() {
  const { story, aftermath, appeal, thanks } = content.values;
  const groups = [
    { value: story, font: `500 35px ${arabic}`, color: "#233a31" },
    { value: aftermath, font: `500 35px ${arabic}`, color: "#233a31" },
    { value: appeal, font: `750 34px ${arabic}`, color: "#613d19" },
    { value: thanks, font: `650 34px ${arabic}`, color: "#233a31" }
  ].map((group) => ({ ...group, rows: wrapLines(group.value, group.font, 1175) }))
    .filter((group) => group.rows.length);
  const rowHeight = 55;
  const gap = 20;
  const height = groups.length
    ? 67 + groups.reduce((sum, group) => sum + group.rows.length * rowHeight, 0) + (groups.length - 1) * gap
    : 0;
  return { groups, rowHeight, gap, height };
}

function paintStory({ groups, rowHeight, gap, height }) {
  if (!height) return;
  context.fillStyle = "#f4f1e8";
  context.fillRect(0, heroHeight, 1440, height);
  rectangle(70, heroHeight + 20, 1300, height - 40, 22, "#fffdf7");
  rectangle(1354, heroHeight + 46, 5, height - 92, 2.5, "#bd8842");
  let baseline = heroHeight + 83;
  for (const { rows, font, color } of groups) {
    for (const row of rows) {
      text(row, 1326, baseline, { font, color });
      baseline += rowHeight;
    }
    baseline += gap;
  }
}

function paintHero() {
  const { values } = content;
  text(values.kicker, 1312, 78, { color: "#f3cb86", font: `700 28px ${arabic}`, maxWidth: 710 });
  const headlineFont = `800 62px ${arabic}`;
  const headline = values.headline.split("\n").flatMap((line) => wrapLines(line, headlineFont, 820));
  const gap = Math.min(79, 252 / Math.max(1, headline.length - 1));
  const span = Math.max(0, headline.length - 1) * gap;
  const start = values.subtitle.trim() ? Math.min(253 - span / 2, 347 - span) : 253 - span / 2;
  headline.forEach((row, index) => {
    text(row, 1364, start + index * gap, { color: "#fffaf0", font: headlineFont });
  });
  text(values.subtitle, 1364, headline.length ? start + span + 68 : 253, {
    color: "#f3cb86", font: `650 37px ${arabic}`, maxWidth: 820
  });
  if (values.caption) {
    context.font = `500 20px ${arabic}`;
    const width = Math.min(280, context.measureText(values.caption).width + 22);
    rectangle(27, 411, width, 33, 5, "#0b201cde");
    text(values.caption, 27 + width / 2, 435, {
      color: "#f7eece", font: `500 20px ${arabic}`, align: "center", maxWidth: width - 22
    });
  }
}

function paintContent() {
  const { values, images } = content;
  const quoteFont = "700 37px Tahoma, Arial";
  const sourceFont = "20px Tahoma, Arial";
  context.font = quoteFont;
  const quoteWidth = Math.min(900, context.measureText(values.quote).width);
  context.font = sourceFont;
  const sourceWidth = Math.min(255, context.measureText(values.citation).width);
  const gap = quoteWidth && sourceWidth ? 34 : 0;
  const quoteRight = 720 + (quoteWidth + sourceWidth + gap) / 2;
  if (quoteWidth) text(values.quote, quoteRight, 1061, { font: quoteFont, maxWidth: quoteWidth, color: "#193b30" });
  if (gap) rectangle(quoteRight - quoteWidth - gap / 2, 1038, 1, 28, 0, "#c9ac7b");
  if (sourceWidth) text(values.citation, quoteRight - quoteWidth - gap, 1057, {
    font: sourceFont, color: "#624c2e", maxWidth: sourceWidth
  });
  text(values.encouragement, 70, 1155, { font: "25px Tahoma, Arial", color: "#526458", align: "left", maxWidth: 970 });
  text(values.wechatTitle, 1107, 1223, { font: "700 25px Tahoma, Arial", align: "center", maxWidth: 475 });
  text(values.alipayTitle, 683, 1223, { font: "700 25px Tahoma, Arial", align: "center", maxWidth: 245 });
  text(values.bankTitle, 499, 1227, { font: "700 25px Tahoma, Arial", maxWidth: 405 });
  text("رقم الحساب", 499, 1268, { font: "18px Tahoma, Arial", color: "#486155" });
  text(values.bankNumber, 499, 1309, {
    font: '700 32px "Segoe UI", Arial', direction: "ltr", maxWidth: 405
  });
  text("اسم صاحب الحساب", 499, 1346, { font: "18px Tahoma, Arial", color: "#486155" });
  text(values.bankHolder, 499, 1376, {
    font: '700 22px "Segoe UI", Arial', direction: /^[a-z]/i.test(values.bankHolder.trim()) ? "ltr" : "rtl", maxWidth: 405
  });

  const centers = [1003, 1209, 683];
  qrKeys.forEach((key, index) => {
    const center = centers[index];
    const image = images[key];
    const scale = 170 / Math.max(image.naturalWidth, image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    rectangle(center - 91, 1236, 182, 182, 8, "#e3e6de");
    rectangle(center - 90, 1237, 180, 180, 7, "#fff");
    context.drawImage(image, center - width / 2, 1327 - height / 2, width, height);
    text(values[`${key}Name`], center, 1442, { font: "700 19px Tahoma, Arial", align: "center", maxWidth: 194 });
  });
  const footerFont = "700 25px Tahoma, Arial";
  context.font = footerFont;
  context.direction = "rtl";
  const footerWidth = Math.min(1160, context.measureText(values.footer).width);
  const logoWidth = 108;
  const logoHeight = 70;
  const footerGap = footerWidth ? 20 : 0;
  const logoX = (1440 + footerWidth + footerGap - logoWidth) / 2;
  const logoY = 1496;
  rectangle(logoX, logoY, logoWidth, logoHeight, 9, "#fff");
  const scale = Math.min((logoWidth - 14) / unionLogo.naturalWidth, (logoHeight - 14) / unionLogo.naturalHeight);
  const width = unionLogo.naturalWidth * scale;
  const height = unionLogo.naturalHeight * scale;
  context.drawImage(unionLogo, logoX + (logoWidth - width) / 2, logoY + (logoHeight - height) / 2, width, height);
  text(values.footer, logoX - footerGap, 1541, { font: footerFont, color: "#f9f5e9", maxWidth: 1160 });
}

function paintPoster(cashFraction, totalFraction) {
  const { values, received, total, percent } = current;
  const story = storyLayout();
  const posterHeight = template.naturalHeight + story.height * 2;
  if (poster.height !== posterHeight) poster.height = posterHeight;
  context.setTransform(2, 0, 0, 2, 0, 0);
  context.drawImage(template, 0, 0, 2880, heroHeight * 2, 0, 0, 1440, heroHeight);
  paintHero();
  paintStory(story);
  const lowerHeight = template.naturalHeight / 2 - heroHeight;
  context.translate(0, story.height);
  context.drawImage(template, 0, heroHeight * 2, 2880, lowerHeight * 2, 0, heroHeight, 1440, lowerHeight);
  paintContent();
  const totalWidth = text(formatAmount(total, true), 1331, 628, {
    font: '700 88px "Segoe UI", Arial', direction: "ltr"
  });
  text("يوان", 1316 - totalWidth, 628, { font: "700 31px Tahoma, Arial", color: "#4b6157" });
  const badge = `نحو ⁦${percent}%⁩ من الهدف`;
  context.font = "700 30px Tahoma, Arial";
  const badgeWidth = context.measureText(badge).width + 36;
  rectangle(109, 489, badgeWidth, 56, 15, "#edf3e9");
  text(badge, 109 + badgeWidth / 2, 527, {
    font: "700 30px Tahoma, Arial", color: "#215541", align: "center"
  });

  const x = 109, y = 668, width = 1222, height = 28;
  rectangle(x, y, width, height, 14, "#e3eae0");
  context.save();
  context.clip();
  const cashStart = x + width * (1 - cashFraction);
  context.fillStyle = "#227654";
  context.fillRect(cashStart, y, width * cashFraction, height);
  const pledgeStart = x + width * (1 - totalFraction);
  context.beginPath();
  context.rect(pledgeStart, y, cashStart - pledgeStart, height);
  context.clip();
  context.fillStyle = "#e8bd72";
  context.fillRect(pledgeStart, y, cashStart - pledgeStart, height);
  context.strokeStyle = "#b98037";
  context.lineWidth = 3;
  context.beginPath();
  for (let stripe = pledgeStart - height; stripe < cashStart; stripe += 8) {
    context.moveTo(stripe, y + height);
    context.lineTo(stripe + height, y);
  }
  context.stroke();
  context.restore();

  const summaryFont = "23px Tahoma, Arial";
  rectangle(1318, 725, 13, 13, 6.5, "#227654");
  text(`المستلم ⁦${formatAmount(received, true)}⁩ يوان`, 1308, 739, { font: summaryFont });
  rectangle(1011, 725, 13, 13, 6.5, "#bc863d");
  text(`التعهدات ⁦${formatAmount(values.pledges)}⁩ يوان`, 1001, 739, { font: summaryFont });
  text(`الهدف ⁦${formatAmount(values.goal)}⁩ يوان`, 109, 739, { font: "700 23px Tahoma, Arial", align: "left" });

  [1352, 1089.6, 827.2, 564.8, 302.4].forEach((right, index) => {
    const amount = values[keys[index]];
    text(amount === null ? "-" : formatAmount(amount), right, 952, {
      font: '700 32px "Segoe UI", Arial', direction: "ltr", maxWidth: 222
    });
  });
}

function animatePoster() {
  cancelAnimationFrame(frame);
  const start = displayed;
  const end = [current.cashFraction, current.totalFraction];
  if (motion.matches || (start[0] === end[0] && start[1] === end[1])) {
    displayed = end;
    paintPoster(...displayed);
    return;
  }
  const began = performance.now();
  function tick(now) {
    const progress = Math.min(1, (now - began) / 260);
    const eased = 1 - (1 - progress) ** 3;
    displayed = end.map((fraction, index) => start[index] + (fraction - start[index]) * eased);
    paintPoster(...displayed);
    if (progress < 1) frame = requestAnimationFrame(tick);
  }
  frame = requestAnimationFrame(tick);
}

function saveFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function feedback(message) {
  status.textContent = message;
  status.scrollIntoView({ block: "nearest" });
}

form.addEventListener("submit", (event) => event.preventDefault());
form.addEventListener("input", () => {
  status.textContent = "";
  update();
  if (error.hidden) save();
});
reset.addEventListener("click", () => {
  fill(originalAmounts);
  content.restoreOriginal();
  update();
  save();
  document.getElementById("payment-status").textContent = "";
  feedback("تمت استعادة المبالغ والرموز وبيانات البنك والنصوص الأصلية.");
});
download.addEventListener("click", () => {
  cancelAnimationFrame(frame);
  displayed = [current.cashFraction, current.totalFraction];
  paintPoster(...displayed);
  try {
    poster.toBlob((blob) => {
      if (blob) saveFile(blob, "Yemeni-Student-Campaign-Story.png");
      else feedback("تعذّر تجهيز الصورة. أعد تحميل الصفحة وحاول مرة أخرى.");
    }, "image/png");
  } catch {
    feedback("افتح الموقع من رابط GitHub Pages أو من خادم محلي لتنزيل الصورة.");
  }
});
settings.addEventListener("click", () => {
  const values = Object.fromEntries(Object.entries(current.values).map(([key, cents]) => [
    key, cents === null ? null : cents / 100
  ]));
  const contentSettings = Object.fromEntries(Object.entries(content.values).filter(([key, value]) =>
    !key.endsWith("Image") || formatPattern.test(value)));
  const file = new Blob([
    `window.campaignAmounts = ${JSON.stringify(values, null, 2)};\n`,
    `window.campaignContent = ${JSON.stringify(contentSettings, null, 2)};\n`
  ], {
    type: "text/javascript;charset=utf-8"
  });
  saveFile(file, "campaign.js");
});

fill(readSaved());
update();
template.addEventListener("load", async () => {
  try {
    await Promise.all([
      document.fonts.load(`500 36px ${arabic}`, "نداء إنساني عاجل").catch(() => []),
      unionLogo.decode()
    ]);
  } catch {
    feedback("تعذّر تحميل شعار الاتحاد. أعد تحميل الصفحة.");
    return;
  }
  templateReady = true;
  update();
});
template.addEventListener("error", () => feedback("تعذّر تحميل قالب الملصق. أعد تحميل الصفحة."));
unionLogo.src = "ysuc-logo.png";
template.src = "poster-template.png?v=6";
