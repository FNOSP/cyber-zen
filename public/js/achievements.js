const METRIC_ALIASES = {
  fish: ["fish", "woodenfish", "knocks", "woodenfishCount"],
  incense: ["incense", "incenseCount"],
  cicada: ["cicada", "waa", "cicadaCount"],
  mala: ["mala", "beads", "malaCount"],
  breath: ["breathMinutes", "breathingMinutes", "breath", "breathing"],
  meditation: ["meditationMinutes", "meditateMinutes", "meditation", "meditate"],
  garden: ["gardenSaves", "garden", "gardenCount"],
  bowl: ["bowlStrikes", "bowl", "singingBowl", "bowlCount"],
};

export const ACHIEVEMENT_GROUPS = [
  { id: "zenfun", title: "禅趣" },
  { id: "calm", title: "静心" },
  { id: "creative", title: "创作" },
  { id: "overall", title: "综合修行" },
];

export const LONG_TERM_GOALS = [
  { metric: "fish", goal: 10000 },
  { metric: "incense", goal: 27, days: 30 },
  { metric: "cicada", goal: 10000 },
  { metric: "mala", goal: 1080 },
  { metric: "breath", goal: 180 },
  { metric: "meditation", goal: 180 },
  { metric: "garden", goal: 30, days: 30 },
  { metric: "bowl", goal: 1000, days: 30 },
];

const visibleAchievements = [
  { id: "first-step", group: "overall", icon: "一", title: "初见清净", metric: "first", unit: "次", stages: [
    { goal: 1, description: "完成第一次禅意互动" },
  ] },
  { id: "woodenfish", group: "zenfun", icon: "木", title: "木鱼常鸣", metric: "fish", unit: "响", stages: [
    { goal: 1, description: "累计敲响木鱼一声" },
    { goal: 100, description: "累计敲响木鱼一百次" },
    { goal: 1000, description: "累计敲响木鱼一千次" },
    { goal: 5000, description: "累计敲响木鱼五千次" },
  ] },
  { id: "incense", group: "zenfun", icon: "香", title: "香火相续", metric: "incense", unit: "次", stages: [
    { goal: 1, description: "完成第一次赛博烧香" },
    { goal: 3, description: "累计完成三次赛博烧香" },
    { goal: 9, description: "累计完成九次赛博烧香" },
  ] },
  { id: "cicada", group: "zenfun", icon: "哇", title: "竹声回旋", metric: "cicada", unit: "哇", stages: [
    { goal: 1, description: "让竹知了响起一声" },
    { goal: 10, description: "让竹知了响起十声" },
    { goal: 100, description: "让竹知了响起一百声" },
    { goal: 1000, description: "让竹知了响起一千声" },
  ] },
  { id: "mala", group: "zenfun", icon: "念", title: "念珠相续", metric: "mala", unit: "念", stages: [
    { goal: 1, description: "拨动第一颗念珠" },
    { goal: 27, description: "拨完一串二十七颗念珠" },
    { goal: 108, description: "完成一轮百八念珠" },
    { goal: 324, description: "累计完成三轮百八念珠" },
  ] },
  { id: "breath", group: "calm", icon: "息", title: "莲息自在", metric: "breath", unit: "分钟", stages: [
    { goal: 1, description: "完成一分钟莲花呼吸" },
    { goal: 10, description: "累计完成十分钟莲花呼吸" },
    { goal: 30, description: "累计完成三十分钟莲花呼吸" },
  ] },
  { id: "meditation", group: "calm", icon: "定", title: "静坐入定", metric: "meditation", unit: "分钟", stages: [
    { goal: 5, description: "累计入定五分钟" },
    { goal: 15, description: "累计入定十五分钟" },
    { goal: 45, description: "累计入定四十五分钟" },
  ] },
  { id: "days", group: "overall", icon: "日", title: "日久相逢", metric: "days", unit: "日", stages: [
    { goal: 1, description: "在一个日子留下修行记录" },
    { goal: 7, description: "在七个不同的日子留下记录" },
    { goal: 30, description: "在三十个不同的日子留下记录" },
  ] },
  { id: "garden", group: "creative", icon: "庭", title: "沙庭成景", metric: "garden", unit: "座", stages: [
    { goal: 1, description: "保存第一座数字枯山水" },
    { goal: 3, description: "保存三座数字枯山水" },
    { goal: 10, description: "保存十座数字枯山水" },
  ] },
  { id: "bowl", group: "creative", icon: "钵", title: "钵音回响", metric: "bowl", unit: "响", stages: [
    { goal: 1, description: "让第一声颂钵自然回荡" },
    { goal: 10, description: "让颂钵响起十次" },
    { goal: 50, description: "让颂钵响起五十次" },
  ] },
];

const hiddenAchievements = [
  { id: "secret-four-joys", group: "zenfun", icon: "趣", title: "四趣同游", secret: true, stages: [
    { description: "木鱼、烧香、竹知了与念珠都完成一次深入体验", requirements: [
      { metric: "fish", goal: 1000, label: "木鱼", unit: "响" },
      { metric: "incense", goal: 9, label: "上香", unit: "次" },
      { metric: "cicada", goal: 1000, label: "竹知了", unit: "哇" },
      { metric: "mala", goal: 108, label: "念珠", unit: "念" },
    ] },
    { description: "让四种禅趣都成为长久相伴", requirements: [
      { metric: "fish", goal: 5000, label: "木鱼", unit: "响" },
      { metric: "incense", goal: 27, label: "上香", unit: "次" },
      { metric: "cicada", goal: 5000, label: "竹知了", unit: "哇" },
      { metric: "mala", goal: 1080, label: "念珠", unit: "念" },
    ] },
  ] },
  { id: "secret-three-sounds", group: "zenfun", icon: "和", title: "三音相和", secret: true, stages: [
    { description: "让木鱼、竹知了与颂钵汇成三种回响", requirements: [
      { metric: "fish", goal: 1080, label: "木鱼", unit: "响" },
      { metric: "cicada", goal: 1080, label: "竹知了", unit: "哇" },
      { metric: "bowl", goal: 108, label: "颂钵", unit: "响" },
    ] },
  ] },
  { id: "secret-ritual-circle", group: "zenfun", icon: "愿", title: "百八圆融", secret: true, stages: [
    { description: "在香、念珠与钵音之间完成一场百八圆融", requirements: [
      { metric: "incense", goal: 27, label: "上香", unit: "次" },
      { metric: "mala", goal: 1080, label: "念珠", unit: "念" },
      { metric: "bowl", goal: 108, label: "颂钵", unit: "响" },
    ] },
  ] },
  { id: "secret-calm-pair", group: "calm", icon: "衡", title: "息定相生", secret: true, stages: [
    { description: "莲花呼吸与入定计时都累计完成一小时", requirements: [
      { metric: "breath", goal: 60, label: "呼吸", unit: "分钟" },
      { metric: "meditation", goal: 60, label: "入定", unit: "分钟" },
    ] },
    { description: "莲花呼吸与入定计时都累计完成五小时", requirements: [
      { metric: "breath", goal: 300, label: "呼吸", unit: "分钟" },
      { metric: "meditation", goal: 300, label: "入定", unit: "分钟" },
    ] },
  ] },
  { id: "secret-calm-habit", group: "calm", icon: "习", title: "百坐成习", secret: true, stages: [
    { description: "呼吸与入定各完成五十四次，并积累十八小时静心时光", requirements: [
      { metric: "breathingSessions", goal: 54, label: "呼吸", unit: "次" },
      { metric: "meditationSessions", goal: 54, label: "入定", unit: "次" },
      { metric: "calmTotal", goal: 1080, label: "静心", unit: "分钟" },
    ] },
  ] },
  { id: "secret-motion-calm", group: "calm", icon: "宜", title: "动静相宜", secret: true, stages: [
    { description: "在一万次禅趣互动之外，也留下十小时静心时光", requirements: [
      { metric: "zenActions", goal: 10000, label: "禅趣", unit: "次" },
      { metric: "calmTotal", goal: 600, label: "静心", unit: "分钟" },
    ] },
  ] },
  { id: "secret-sand-song", group: "creative", icon: "境", title: "沙音共境", secret: true, stages: [
    { description: "在二十七座沙庭中留下百八声钵音", requirements: [
      { metric: "garden", goal: 27, label: "沙庭", unit: "座" },
      { metric: "bowl", goal: 108, label: "颂钵", unit: "响" },
    ] },
    { description: "让一百零八座沙庭与千余声钵音彼此相映", requirements: [
      { metric: "garden", goal: 108, label: "沙庭", unit: "座" },
      { metric: "bowl", goal: 1080, label: "颂钵", unit: "响" },
    ] },
  ] },
  { id: "secret-wind-garden", group: "creative", icon: "风", title: "松风入庭", secret: true, stages: [
    { description: "让竹声、沙庭与钵音共同构成一处松风之境", requirements: [
      { metric: "cicada", goal: 5000, label: "竹知了", unit: "哇" },
      { metric: "garden", goal: 30, label: "沙庭", unit: "座" },
      { metric: "bowl", goal: 300, label: "颂钵", unit: "响" },
    ] },
  ] },
  { id: "secret-eight-arts", group: "overall", icon: "圆", title: "八艺同修", secret: true, stages: [
    { description: "八种互动功能都达到各自的长期目标", requirements: [
      { metric: "activeFeatures", goal: 8, label: "已体验", unit: "种" },
      { metric: "deeplyPracticedFeatures", goal: 8, label: "长期修习", unit: "种" },
    ] },
  ] },
  { id: "secret-long-companion", group: "overall", icon: "岁", title: "岁月同行", secret: true, stages: [
    { description: "在一百个不同日子留下记录，并深入修习至少四种功能", requirements: [
      { metric: "days", goal: 100, label: "记录", unit: "日" },
      { metric: "deeplyPracticedFeatures", goal: 4, label: "深入修习", unit: "种" },
    ] },
    { description: "走过三百六十五个记录日，并深入修习全部八种功能", requirements: [
      { metric: "days", goal: 365, label: "记录", unit: "日" },
      { metric: "deeplyPracticedFeatures", goal: 8, label: "深入修习", unit: "种" },
    ] },
  ] },
  { id: "secret-great-harmony", group: "overall", icon: "禅", title: "万象归禅", secret: true, stages: [
    { description: "十万次互动、千分钟静心与百日记录汇于一处", requirements: [
      { metric: "allActions", goal: 100000, label: "互动", unit: "次" },
      { metric: "calmTotal", goal: 1000, label: "静心", unit: "分钟" },
      { metric: "days", goal: 100, label: "记录", unit: "日" },
      { metric: "deeplyPracticedFeatures", goal: 8, label: "深入修习", unit: "种" },
    ] },
  ] },
];

// This catalog contains data only and can be serialized directly for export.
export const ACHIEVEMENT_CATALOG = [...visibleAchievements, ...hiddenAchievements];

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : 0;
}

function metricValue(source, aliases) {
  for (const alias of aliases) {
    if (source && source[alias] !== undefined) return finiteNumber(source[alias]);
  }
  return 0;
}

function formatValue(value) {
  const number = finiteNumber(value);
  return number >= 10000 ? `${(number / 10000).toFixed(number >= 100000 ? 0 : 1)}万` : String(Math.round(number * 10) / 10);
}

function deriveValues(source, activeDays) {
  const values = Object.fromEntries(
    Object.entries(METRIC_ALIASES).map(([metric, aliases]) => [metric, metricValue(source, aliases)]),
  );
  values.days = finiteNumber(activeDays);
  values.breathingSessions = finiteNumber(source?.breathingSessions);
  values.meditationSessions = finiteNumber(source?.meditationSessions);
  values.calmTotal = values.breath + values.meditation;
  values.zenActions = values.fish + values.cicada + values.mala;
  values.allActions = values.zenActions + values.incense + values.garden + values.bowl;
  values.first = values.allActions + values.calmTotal;
  values.activeFeatures = Object.keys(METRIC_ALIASES).filter((metric) => values[metric] > 0).length;
  values.deeplyPracticedFeatures = LONG_TERM_GOALS.filter(({ metric, goal, days = 0 }) => (
    values[metric] >= goal && values.days >= days
  )).length;
  return values;
}

function stageReached(stage, metric, values) {
  if (stage.requirements) {
    return stage.requirements.every(({ metric: requirementMetric, goal }) => values[requirementMetric] >= goal);
  }
  return values[metric] >= stage.goal;
}

function stageProgress(stage, definition, values) {
  if (stage.requirements) {
    return stage.requirements.map(({ metric, goal, label, unit = "" }) => (
      `${label}${formatValue(Math.min(values[metric], goal))}/${formatValue(goal)}${unit}`
    )).join(" · ");
  }
  return `${formatValue(Math.min(values[definition.metric], stage.goal))}/${formatValue(stage.goal)}${definition.unit || ""}`;
}

function deriveAchievement(definition, values) {
  let level = 0;
  while (level < definition.stages.length && stageReached(definition.stages[level], definition.metric, values)) {
    level += 1;
  }

  const complete = level === definition.stages.length;
  const target = definition.stages[Math.min(level, definition.stages.length - 1)];
  const concealNextSecret = definition.secret && level > 0 && !complete;
  const displayedStage = concealNextSecret ? definition.stages[level - 1] : target;
  const progress = complete
    ? "已圆满"
    : concealNextSecret
      ? "已解锁 · 继续修行"
      : stageProgress(target, definition, values);

  return {
    id: definition.id,
    group: definition.group,
    icon: definition.icon,
    title: definition.title,
    description: complete ? `最高目标已完成 · ${displayedStage.description}` : displayedStage.description,
    progress,
    level,
    visualLevel: level === 0 ? 0 : complete ? 4 : Math.min(3, level),
    unlocked: level > 0,
    complete,
    secret: Boolean(definition.secret),
  };
}

export function deriveAchievements(totalsSource = {}, activeDays = 0) {
  const values = deriveValues(totalsSource, activeDays);
  const visible = ACHIEVEMENT_CATALOG
    .filter(({ secret }) => !secret)
    .map((definition) => deriveAchievement(definition, values));
  const hidden = ACHIEVEMENT_CATALOG
    .filter(({ secret }) => secret)
    .map((definition) => deriveAchievement(definition, values));
  const unlockedHidden = hidden.filter(({ unlocked }) => unlocked);
  const all = [...visible, ...unlockedHidden];
  const groups = ACHIEVEMENT_GROUPS.map(({ id, title }) => ({
    id,
    title,
    achievements: all.filter((achievement) => achievement.group === id),
  })).filter(({ achievements }) => achievements.length);

  return { visible, hidden, unlockedHidden, all, groups };
}
