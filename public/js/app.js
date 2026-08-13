import { $, $$ } from "./shared.js";
import { initClassics } from "./classics.js";
import { initMala } from "./mala.js";
import { initBreathing, initMeditation } from "./practice.js";
import { initGarden } from "./garden.js";
import { initBowl } from "./bowl.js";
import { initStats } from "./stats.js";

let currentPage = "home";

function openPage(page) {
  const previous = currentPage;
  currentPage = page;
  $$(".page").forEach((element) => {
    const active = element.dataset.page === page;
    element.classList.toggle("active", active);
    element.toggleAttribute("inert", !active);
    element.setAttribute("aria-hidden", String(!active));
  });
  window.dispatchEvent(new CustomEvent("zen:pagechange", { detail: { page, previous } }));
}

function initNavigation() {
  $$('[data-open]').forEach((button) => button.addEventListener("click", () => openPage(button.dataset.open)));
  $$(".back").forEach((button) => button.addEventListener("click", () => openPage("home")));
}

function initAtmosphere() {
  const particles = $("#particles");
  for (let index = 0; index < 24; index += 1) {
    const particle = document.createElement("i");
    particle.className = "particle";
    particle.style.cssText = `left:${Math.random() * 100}%;top:${80 + Math.random() * 50}%;animation-duration:${12 + Math.random() * 14}s;animation-delay:${-Math.random() * 20}s`;
    particles.appendChild(particle);
  }
  const date = new Date();
  const week = "日一二三四五六";
  $$(".sharedDate").forEach((element) => {
    element.textContent = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 星期${week[date.getDay()]}`;
  });
}

async function boot() {
  initNavigation();
  initAtmosphere();
  const initializers = [initClassics, initMala, initBreathing, initMeditation, initGarden, initBowl, initStats];
  for (const initialize of initializers) {
    try {
      await initialize();
    } catch (error) {
      console.error(error);
    }
  }
  openPage(currentPage);
}

void boot();
