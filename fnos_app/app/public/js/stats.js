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

function deriveAchievements(totalsSource, activeDays) {
  const totals = normalizedMetrics(totalsSource);
  const allActions = totals.fish + totals.incense + totals.cicada + totals.mala + totals.garden + totals.bowl;
  const calmTotal = calmMinutes(totals);
  const days = finiteNumber(activeDays);
  const deeplyPracticedFeatures = [
    totals.fish >= 10000,
    totals.incense >= 27 && days >= 30,
    totals.cicada >= 10000,
    totals.mala >= 1080,
    totals.breath >= 180,
    totals.meditation >= 180,
    totals.garden >= 30 && days >= 30,
    totals.bowl >= 1000 && days >= 30,
  ].filter(Boolean).length;
  const values = {
    first: allActions + calmTotal,
    allActions,
    deeplyPracticedFeatures,
    fish: totals.fish,
    incense: totals.incense,
    cicada: totals.cicada,
    mala: totals.mala,
    breath: totals.breath,
    meditation: totals.meditation,
    garden: totals.garden,
    bowl: totals.bowl,
    days,
  };

  // 分阶段成就始终显示，阶段越高目标越远；这样修行簿既能给出即时反馈，
  // 也不会在完成一个小目标后就失去继续积累的方向。
  const staged = (series, icon, value, unit, stages) => stages.map((stage, index) => ({
    id: `${series}-${stage.goal}`,
    series,
    stage: index + 1,
    stageCount: stages.length,
    icon,
    title: stage.title,
    description: stage.description,
    value,
    goal: stage.goal,
    unit,
  }));

  const visibleAchievements = [
    { id: "first-step", icon: "一", title: "初见清净", description: "完成第一次禅意互动", value: values.first, goal: 1, unit: "次" },
    ...staged("woodenfish", "木", values.fish, "响", [
      { goal: 1, title: "木鱼初响", description: "累计敲响木鱼一声" },
      { goal: 100, title: "木鱼百响", description: "累计敲响木鱼一百次" },
      { goal: 1000, title: "木鱼千响", description: "累计敲响木鱼一千次" },
      { goal: 5000, title: "木鱼不息", description: "累计敲响木鱼五千次" },
    ]),
    ...staged("incense", "香", values.incense, "次", [
      { goal: 1, title: "香火初燃", description: "完成第一次赛博烧香" },
      { goal: 3, title: "三炷相续", description: "累计完成三次赛博烧香" },
      { goal: 9, title: "九炷有缘", description: "累计完成九次赛博烧香" },
    ]),
    ...staged("cicada", "哇", values.cicada, "哇", [
      { goal: 1, title: "竹声初起", description: "让竹知了响起一声" },
      { goal: 10, title: "十声回响", description: "让竹知了响起十声" },
      { goal: 100, title: "百哇成趣", description: "让竹知了响起一百声" },
      { goal: 1000, title: "千声成曲", description: "让竹知了响起一千声" },
    ]),
    ...staged("mala", "念", values.mala, "念", [
      { goal: 1, title: "一念入珠", description: "拨动第一颗念珠" },
      { goal: 27, title: "二十七念", description: "拨完一串念珠" },
      { goal: 108, title: "百八念珠", description: "完成一轮百八念珠" },
      { goal: 324, title: "三轮相续", description: "累计完成三轮百八念珠" },
    ]),
    ...staged("breath", "息", values.breath, "分钟", [
      { goal: 1, title: "一息之间", description: "完成一分钟莲花呼吸" },
      { goal: 10, title: "呼吸自在", description: "累计完成十分钟莲花呼吸" },
      { goal: 30, title: "莲息绵长", description: "累计完成三十分钟莲花呼吸" },
    ]),
    ...staged("meditation", "定", values.meditation, "分钟", [
      { goal: 5, title: "初入静坐", description: "累计入定五分钟" },
      { goal: 15, title: "静坐一刻", description: "累计入定十五分钟" },
      { goal: 45, title: "久坐不动", description: "累计入定四十五分钟" },
    ]),
    ...staged("days", "日", values.days, "日", [
      { goal: 1, title: "今日相逢", description: "在一个日子留下修行记录" },
      { goal: 7, title: "七日有缘", description: "在七个不同的日子留下记录" },
      { goal: 30, title: "月下修行", description: "在三十个不同的日子留下记录" },
    ]),
    ...staged("garden", "庭", values.garden, "座", [
      { goal: 1, title: "庭院初成", description: "保存第一座数字枯山水" },
      { goal: 3, title: "三作成景", description: "保存三座数字枯山水" },
      { goal: 10, title: "十方沙庭", description: "保存十座数字枯山水" },
    ]),
    ...staged("bowl", "钵", values.bowl, "响", [
      { goal: 1, title: "钵音初回", description: "让第一声颂钵自然回荡" },
      { goal: 10, title: "十声回荡", description: "让颂钵响起十次" },
      { goal: 50, title: "五十回响", description: "让颂钵响起五十次" },
    ]),
  ];

  // 隐藏成就只在完成后显示。目标刻意设在长期积累区间，避免把简单的
  // 早期目标误放进隐藏列表；所有数据仍来自 /api/stats，无需迁移旧文件。
  const hiddenAchievements = [
    ...staged("hidden-woodenfish", "木", values.fish, "响", [
      { goal: 10000, title: "万响归一", description: "累计敲响木鱼一万次" },
      { goal: 50000, title: "木鱼如潮", description: "累计敲响木鱼五万次" },
    ]),
    { id: "hidden-incense-27-days", icon: "香", title: "香火不绝", description: "累计完成二十七次赛博烧香，并在三十个不同日子留下记录", value: values.incense >= 27 && values.days >= 30 ? 1 : 0, goal: 1, unit: "" },
    { id: "hidden-incense-108-days", icon: "愿", title: "百八香愿", description: "累计完成一百零八次赛博烧香，并在一百个不同日子留下记录", value: values.incense >= 108 && values.days >= 100 ? 1 : 0, goal: 1, unit: "" },
    ...staged("hidden-cicada", "哇", values.cicada, "哇", [
      { goal: 10000, title: "竹声万里", description: "让竹知了响起一万声" },
      { goal: 100000, title: "万哇同鸣", description: "让竹知了响起十万声" },
    ]),
    ...staged("hidden-mala", "念", values.mala, "念", [
      { goal: 1080, title: "千念不息", description: "累计完成十轮百八念珠" },
      { goal: 10800, title: "念海无边", description: "累计完成一百轮百八念珠" },
    ]),
    ...staged("hidden-breath", "息", values.breath, "分钟", [
      { goal: 180, title: "莲息长明", description: "累计完成三小时莲花呼吸" },
      { goal: 600, title: "一日一息", description: "累计完成十小时莲花呼吸" },
    ]),
    ...staged("hidden-meditation", "定", values.meditation, "分钟", [
      { goal: 180, title: "三时入定", description: "累计入定三小时" },
      { goal: 600, title: "定中见山", description: "累计入定十小时" },
    ]),
    ...staged("hidden-days", "日", values.days, "日", [
      { goal: 100, title: "百日不辍", description: "在一百个不同的日子留下记录" },
      { goal: 365, title: "四时常在", description: "在三百六十五个不同的日子留下记录" },
    ]),
    { id: "hidden-garden-30-days", icon: "庭", title: "三十方庭", description: "保存三十座数字枯山水，并在三十个不同日子留下记录", value: values.garden >= 30 && values.days >= 30 ? 1 : 0, goal: 1, unit: "" },
    { id: "hidden-garden-100-days", icon: "景", title: "百景归心", description: "保存一百座数字枯山水，并在一百个不同日子留下记录", value: values.garden >= 100 && values.days >= 100 ? 1 : 0, goal: 1, unit: "" },
    { id: "hidden-bowl-1000-days", icon: "钵", title: "千音入定", description: "让颂钵响起一千次，并在三十个不同日子留下记录", value: values.bowl >= 1000 && values.days >= 30 ? 1 : 0, goal: 1, unit: "" },
    { id: "hidden-bowl-10000-days", icon: "音", title: "万音归寂", description: "让颂钵响起一万次，并在一百个不同日子留下记录", value: values.bowl >= 10000 && values.days >= 100 ? 1 : 0, goal: 1, unit: "" },
    { id: "hidden-all-features", icon: "圆", title: "八艺同修", description: "八种互动功能都达到各自的长期目标", value: values.deeplyPracticedFeatures, goal: 8, unit: "种" },
    { id: "hidden-total-practice", icon: "海", title: "功德如海", description: "累计完成十万次互动", value: values.allActions, goal: 100000, unit: "次" },
  ];

  const normalize = (achievement) => ({
    ...achievement,
    unlocked: achievement.value >= achievement.goal,
    progress: progressText(achievement.value, achievement.goal, achievement.unit),
  });
  const defaults = visibleAchievements.map(normalize);
  const hidden = hiddenAchievements.map(normalize);
  const unlockedHidden = hidden.filter((achievement) => achievement.unlocked);
  return {
    // defaults is kept as a compatibility alias for callers from older builds;
    // the UI presents every visible item under one unified “成就” heading.
    defaults,
    visible: defaults,
    hidden,
    unlockedHidden,
    all: [...defaults, ...unlockedHidden],
  };
}

function createAchievementItem(achievement) {
  const item = document.createElement("article");
  item.className = `milestone-item ${achievement.unlocked ? "unlocked" : "locked"}`;

  const seal = document.createElement("span");
  seal.className = "milestone-seal";
  seal.textContent = achievement.icon;
  seal.setAttribute("aria-hidden", "true");

  const copy = document.createElement("span");
  copy.className = "milestone-copy";
  const title = document.createElement("strong");
  title.textContent = achievement.title;
  const description = document.createElement("small");
  description.textContent = achievement.stage
    ? `第${achievement.stage}/${achievement.stageCount}阶段 · ${achievement.description}`
    : achievement.description;
  copy.append(title, description);

  const progress = document.createElement("span");
  progress.className = "milestone-progress";
  progress.textContent = achievement.unlocked ? "已解锁" : achievement.progress;
  item.append(seal, copy, progress);
  return item;
}

function renderAchievementGroup(titleText, achievements, emptyText = "") {
  const group = document.createElement("section");
  group.className = "achievement-group";
  if (titleText) {
    const heading = document.createElement("h4");
    heading.textContent = titleText;
    group.append(heading);
  }

  if (!achievements.length) {
    const empty = document.createElement("p");
    empty.className = "achievement-empty";
    empty.textContent = emptyText;
    group.append(empty);
    return group;
  }

  const list = document.createElement("div");
  list.className = "milestone-list";
  achievements.forEach((achievement) => list.append(createAchievementItem(achievement)));
  group.append(list);
  return group;
}

function renderMilestones(container, totals, activeDays, summaryElement) {
  if (!container) return;
  clear(container);
  const achievements = deriveAchievements(totals, activeDays);
  const totalUnlocked = achievements.all.filter((achievement) => achievement.unlocked).length;
  if (summaryElement) summaryElement.textContent = `${totalUnlocked} 项已解锁`;
  // 未完成的隐藏成就不会进入列表；已完成后与其他成就一并展示，界面不区分来源。
  container.append(renderAchievementGroup("", achievements.all));
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
