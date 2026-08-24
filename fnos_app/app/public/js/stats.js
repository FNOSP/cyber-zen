import { $, api } from "./shared.js";
import { deriveAchievements } from "./achievements.js";

export { deriveAchievements } from "./achievements.js";

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

function createAchievementItem(achievement) {
  const item = document.createElement("article");
  item.className = `milestone-item ${achievement.unlocked ? "unlocked" : "locked"}${achievement.complete ? " complete" : ""}${achievement.secret ? " secret" : ""}`;

  const seal = document.createElement("span");
  seal.className = `milestone-seal seal-level-${achievement.visualLevel}`;
  seal.textContent = achievement.icon;
  seal.setAttribute("aria-hidden", "true");

  const copy = document.createElement("span");
  copy.className = "milestone-copy";
  const title = document.createElement("strong");
  title.textContent = achievement.title;
  const description = document.createElement("small");
  description.textContent = achievement.description;
  copy.append(title, description);

  const progress = document.createElement("span");
  progress.className = "milestone-progress";
  progress.textContent = achievement.progress;
  item.append(seal, copy, progress);
  return item;
}

function renderAchievementGroup(groupData) {
  const groupElement = document.createElement("section");
  groupElement.className = "achievement-group";
  groupElement.dataset.feature = groupData.id;
  const heading = document.createElement("h4");
  heading.className = "achievement-group-title";
  heading.textContent = groupData.title;
  groupElement.append(heading);

  const list = document.createElement("div");
  list.className = "milestone-list";
  groupData.achievements.forEach((achievement) => list.append(createAchievementItem(achievement)));
  groupElement.append(list);
  return groupElement;
}

function renderMilestones(container, totals, activeDays, summaryElement) {
  if (!container) return;
  clear(container);
  const achievements = deriveAchievements(totals, activeDays);
  const totalUnlocked = achievements.all.filter((achievement) => achievement.unlocked).length;
  const totalComplete = achievements.all.filter((achievement) => achievement.complete).length;
  if (summaryElement) summaryElement.textContent = `${totalUnlocked} 项已解锁 · ${totalComplete} 项圆满`;
  achievements.groups.forEach((group) => container.append(renderAchievementGroup(group)));
}

export function initStats() {
  if (initialized) return;

  const todayElement = $("#statsToday");
  const weekElement = $("#statsWeek");
  const totalsElement = $("#statsTotals");
  const milestonesElement = $("#statsMilestones");
  const achievementSummaryElement = $("#statsAchievementSummary");
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
      renderMilestones(milestonesElement, response?.totals || {}, response?.activeDays, achievementSummaryElement);
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
