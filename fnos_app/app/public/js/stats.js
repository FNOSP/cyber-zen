import { $, api } from "./shared.js";

let initialized = false;

const METRICS = [
  { key: "fish", label: "木鱼", unit: "响", aliases: ["fish", "woodenfish", "knocks", "woodenfishCount"] },
  { key: "incense", label: "上香", unit: "次", aliases: ["incense", "incenseCount"] },
  { key: "cicada", label: "竹知了", unit: "哇", aliases: ["cicada", "waa", "cicadaCount"] },
  { key: "mala", label: "念珠", unit: "念", aliases: ["mala", "beads", "malaCount"] },
  { key: "breath", label: "莲花呼吸", unit: "分钟", aliases: ["breathMinutes", "breathingMinutes", "breath", "breathing"] },
  { key: "meditation", label: "入定", unit: "分钟", aliases: ["meditationMinutes", "meditateMinutes", "meditation", "meditate"] },
  { key: "garden", label: "沙庭", unit: "次", aliases: ["gardenSaves", "garden", "gardenCount"] },
  { key: "bowl", label: "颂钵", unit: "响", aliases: ["bowlStrikes", "bowl", "singingBowl", "bowlCount"] },
];

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function metricValue(source, metric) {
  for (const alias of metric.aliases) {
    if (source && source[alias] !== undefined) return finiteNumber(source[alias]);
  }
  return 0;
}

function normalizedMetrics(source) {
  return Object.fromEntries(METRICS.map((metric) => [metric.key, metricValue(source, metric)]));
}

function calmMinutes(values) {
  return values.breath + values.meditation;
}

function formatValue(value) {
  const number = finiteNumber(value);
  return number >= 10000 ? `${(number / 10000).toFixed(number >= 100000 ? 0 : 1)}万` : String(Math.round(number * 10) / 10);
}

function clear(element) {
  if (element) element.replaceChildren();
}

function createMetricCard(label, value, unit, modifier = "") {
  const card = document.createElement("div");
  card.className = `stat-card${modifier ? ` ${modifier}` : ""}`;

  const labelElement = document.createElement("span");
  labelElement.className = "stat-card-label";
  labelElement.textContent = label;

  const valueElement = document.createElement("strong");
  valueElement.className = "stat-card-value";
  valueElement.textContent = formatValue(value);

  const unitElement = document.createElement("small");
  unitElement.className = "stat-card-unit";
  unitElement.textContent = unit;

  card.append(labelElement, valueElement, unitElement);
  return card;
}

function renderMetricGrid(container, source, includeCalmTotal = true) {
  if (!container) return;
  clear(container);
  container.classList.add("stats-grid");
  const values = normalizedMetrics(source);
  for (const metric of METRICS) {
    container.append(createMetricCard(metric.label, values[metric.key], metric.unit));
  }
  if (includeCalmTotal) {
    container.append(createMetricCard("静心合计", calmMinutes(values), "分钟", "stat-card-highlight"));
  }
}

function dailyTotal(day) {
  if (day?.total !== undefined) return finiteNumber(day.total);
  const values = normalizedMetrics(day);
  return values.fish
    + values.incense
    + values.cicada
    + values.mala
    + values.garden
    + values.bowl
    + finiteNumber(day?.breathingSessions)
    + finiteNumber(day?.meditationSessions);
}

function normalizeDays(last7) {
  if (Array.isArray(last7)) return last7;
  if (last7 && typeof last7 === "object") {
    return Object.entries(last7).map(([date, values]) => ({ date, ...(values || {}) }));
  }
  return [];
}

function shortDate(dateValue) {
  const match = String(dateValue || "").match(/(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${Number(match[2])}/${Number(match[3])}` : String(dateValue || "—");
}

function renderWeek(container, last7) {
  if (!container) return;
  clear(container);
  const days = normalizeDays(last7).slice(-7);
  const chart = document.createElement("div");
  chart.className = "week-chart";
  chart.setAttribute("role", "img");
  chart.setAttribute("aria-label", "最近七天互动次数柱形图");

  if (!days.length) {
    const empty = document.createElement("p");
    empty.className = "stats-empty";
    empty.textContent = "还没有七日记录，今天正适合从一念开始。";
    container.append(empty);
    return;
  }

  const maximum = Math.max(1, ...days.map(dailyTotal));
  for (const day of days) {
    const total = dailyTotal(day);
    const column = document.createElement("div");
    column.className = "week-day";
    column.title = `${day.date || "当日"} · ${formatValue(total)} 次互动`;

    const value = document.createElement("span");
    value.className = "week-value";
    value.textContent = formatValue(total);

    const track = document.createElement("span");
    track.className = "week-bar-track";
    const bar = document.createElement("i");
    bar.className = "week-bar";
    const height = total ? Math.max(10, (total / maximum) * 100) : 2;
    bar.style.height = `${height}%`;
    bar.style.setProperty("--bar-height", `${height}%`);
    track.append(bar);

    const date = document.createElement("span");
    date.className = "week-date";
    date.textContent = shortDate(day.date);
    column.append(value, track, date);
    chart.append(column);
  }
  container.append(chart);
}

function progressText(current, goal, unit) {
  return `${formatValue(Math.min(current, goal))}/${formatValue(goal)}${unit}`;
}

function deriveMilestones(totalsSource, activeDays) {
  const totals = normalizedMetrics(totalsSource);
  const allActions = totals.fish + totals.incense + totals.cicada + totals.mala + totals.garden + totals.bowl;
  const days = finiteNumber(activeDays);
  return [
    {
      icon: "一",
      title: "初见清净",
      description: "完成第一次禅意互动",
      unlocked: allActions >= 1 || calmMinutes(totals) > 0,
      progress: progressText(allActions + calmMinutes(totals), 1, "次"),
    },
    {
      icon: "木",
      title: "木鱼千响",
      description: "累计敲响木鱼一千次",
      unlocked: totals.fish >= 1000,
      progress: progressText(totals.fish, 1000, "响"),
    },
    {
      icon: "念",
      title: "百八念珠",
      description: "拨过一轮百八念珠",
      unlocked: totals.mala >= 108,
      progress: progressText(totals.mala, 108, "念"),
    },
    {
      icon: "定",
      title: "静坐一刻",
      description: "累计入定十五分钟",
      unlocked: totals.meditation >= 15,
      progress: progressText(totals.meditation, 15, "分钟"),
    },
    {
      icon: "七",
      title: "七日有缘",
      description: "在七个不同的日子留下记录",
      unlocked: days >= 7,
      progress: progressText(days, 7, "日"),
    },
    {
      icon: "庭",
      title: "庭院初成",
      description: "保存第一座数字枯山水",
      unlocked: totals.garden >= 1,
      progress: progressText(totals.garden, 1, "座"),
    },
    {
      icon: "钵",
      title: "钵音回响",
      description: "让第一声颂钵自然回荡",
      unlocked: totals.bowl >= 1,
      progress: progressText(totals.bowl, 1, "响"),
    },
    {
      icon: "香",
      title: "香火初燃",
      description: "点燃第一炉赛博清香",
      unlocked: totals.incense >= 1,
      progress: progressText(totals.incense, 1, "次"),
    },
    {
      icon: "哇",
      title: "童声回响",
      description: "让竹知了响起十声",
      unlocked: totals.cicada >= 10,
      progress: progressText(totals.cicada, 10, "哇"),
    },
    {
      icon: "息",
      title: "呼吸自在",
      description: "累计完成十分钟莲花呼吸",
      unlocked: totals.breath >= 10,
      progress: progressText(totals.breath, 10, "分钟"),
    },
  ];
}

function renderMilestones(container, totals, activeDays) {
  if (!container) return;
  clear(container);
  const list = document.createElement("div");
  list.className = "milestone-list";
  for (const milestone of deriveMilestones(totals, activeDays)) {
    const item = document.createElement("article");
    item.className = `milestone-item ${milestone.unlocked ? "unlocked" : "locked"}`;

    const seal = document.createElement("span");
    seal.className = "milestone-seal";
    seal.textContent = milestone.icon;
    seal.setAttribute("aria-hidden", "true");

    const copy = document.createElement("span");
    copy.className = "milestone-copy";
    const title = document.createElement("strong");
    title.textContent = milestone.title;
    const description = document.createElement("small");
    description.textContent = milestone.description;
    copy.append(title, description);

    const progress = document.createElement("span");
    progress.className = "milestone-progress";
    progress.textContent = milestone.unlocked ? "已结缘" : milestone.progress;
    item.append(seal, copy, progress);
    list.append(item);
  }
  container.append(list);
}

export function initStats() {
  if (initialized) return;

  const todayElement = $("#statsToday");
  const weekElement = $("#statsWeek");
  const totalsElement = $("#statsTotals");
  const milestonesElement = $("#statsMilestones");
  const refreshButton = $("#statsRefresh");
  if (!todayElement || !weekElement || !totalsElement || !milestonesElement) return;

  initialized = true;
  let loading = false;
  let isStatsPage = false;
  let refreshTimer = 0;

  async function refresh() {
    if (loading) return;
    loading = true;
    if (refreshButton) {
      refreshButton.disabled = true;
      refreshButton.classList.add("loading");
    }
    try {
      const response = await api("/api/stats");
      renderMetricGrid(todayElement, response?.today || {});
      renderWeek(weekElement, response?.last7);
      renderMetricGrid(totalsElement, response?.totals || {});
      renderMilestones(milestonesElement, response?.totals || {}, response?.activeDays);
    } catch {
      if (!todayElement.children.length) {
        const error = document.createElement("p");
        error.className = "stats-empty stats-error";
        error.textContent = "修行记录暂时没有读取到，稍后再来看看。";
        todayElement.append(error);
      }
    } finally {
      loading = false;
      if (refreshButton) {
        refreshButton.disabled = false;
        refreshButton.classList.remove("loading");
      }
    }
  }

  refreshButton?.addEventListener("click", () => void refresh());
  window.addEventListener("zen:pagechange", (event) => {
    isStatsPage = event.detail?.page === "stats";
    if (isStatsPage) void refresh();
  });
  window.addEventListener("zen:statschange", () => {
    if (!isStatsPage) return;
    clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(() => void refresh(), 250);
  });

  void refresh();
}
