import assert from "node:assert/strict";
import test from "node:test";

import { ACHIEVEMENT_CATALOG, deriveAchievements } from "../public/js/achievements.js";

test("achievement series advances in one card without exposing secret goals", () => {
  const fresh = deriveAchievements({}, 0);
  const freshFish = fresh.visible.find((achievement) => achievement.id === "woodenfish");
  assert.equal(freshFish.title, "木鱼常鸣");
  assert.equal(freshFish.level, 0);
  assert.equal(freshFish.progress, "0/1响");
  assert.equal(fresh.unlockedHidden.length, 0);

  const advanced = deriveAchievements({ fish: 100 }, 1);
  const advancedFish = advanced.visible.find((achievement) => achievement.id === "woodenfish");
  assert.equal(advancedFish.title, "木鱼常鸣");
  assert.equal(advancedFish.level, 2);
  assert.equal(advancedFish.description, "累计敲响木鱼一千次");
  assert.equal(advancedFish.progress, "100/1000响");
  assert.equal(advanced.visible.filter((achievement) => achievement.id === "woodenfish").length, 1);

  const singleFeature = deriveAchievements({ fish: 1000000 }, 365);
  assert.equal(singleFeature.unlockedHidden.length, 0);

  const secretUnlocked = deriveAchievements({ fish: 1000, incense: 9, cicada: 1000, mala: 108 }, 30);
  const fourJoys = secretUnlocked.unlockedHidden.find((achievement) => achievement.id === "secret-four-joys");
  assert.equal(fourJoys.title, "四趣同游");
  assert.equal(fourJoys.description, "木鱼、烧香、竹知了与念珠都完成一次深入体验");
  assert.equal(fourJoys.progress, "已解锁 · 继续修行");
  assert.doesNotMatch(`${fourJoys.description} ${fourJoys.progress}`, /五千|5000/);

  assert.deepEqual(secretUnlocked.groups.map((group) => group.title), ["禅趣", "静心", "创作", "综合修行"]);
});

test("hidden achievements are difficult cross-feature challenges", () => {
  const fresh = deriveAchievements({}, 0);
  assert.ok(fresh.visible.length >= 10);
  assert.ok(fresh.hidden.length >= 10);
  assert.equal(fresh.unlockedHidden.length, 0);

  const singleMetrics = ["fish", "incense", "cicada", "mala", "breath", "meditation", "garden", "bowl"];
  for (const metric of singleMetrics) {
    const result = deriveAchievements({ [metric]: 1_000_000 }, 1000);
    assert.equal(result.unlockedHidden.length, 0, `${metric} alone must not unlock a hidden achievement`);
  }

  const calmPair = deriveAchievements({ breath: 60, meditation: 60 }, 1);
  assert.deepEqual(calmPair.unlockedHidden.map(({ id }) => id), ["secret-calm-pair"]);

  const catalogText = fresh.hidden.map(({ title, description }) => `${title} ${description}`).join(" ");
  assert.doesNotMatch(catalogText, /累计敲响木鱼一万次|竹知了响起一万声|累计入定三小时|累计完成三小时莲花呼吸/);

  const visibleText = fresh.groups
    .flatMap((group) => group.achievements)
    .map((achievement) => `${achievement.title} ${achievement.description}`)
    .join(" ");
  assert.doesNotMatch(visibleText, /默认成就|隐藏成就/);
});

test("achievement catalog stays serializable and hidden stages remain composite", () => {
  assert.doesNotThrow(() => JSON.stringify(ACHIEVEMENT_CATALOG));
  assert.equal(ACHIEVEMENT_CATALOG.length, new Set(ACHIEVEMENT_CATALOG.map(({ id }) => id)).size);

  const hidden = ACHIEVEMENT_CATALOG.filter(({ secret }) => secret);
  for (const achievement of hidden) {
    for (const stage of achievement.stages) {
      assert.ok(stage.requirements?.length >= 2, `${achievement.id} must use a composite requirement`);
    }
  }
});
