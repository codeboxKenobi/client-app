<script setup>
import {
  ref,
  computed,
  watch,
  nextTick,
  onMounted,
  onBeforeUnmount,
} from "vue";
import { useRoute, useRouter } from "vue-router";

const STORAGE_KEY = "app-sidebar-collapsed";
const NARROW_QUERY = "(max-width: 1024px)"; // планшеты и телефоны: узкая полоса с иконками, раскрывается поверх страницы
const PHONE_QUERY = "(max-width: 640px)"; // телефоны: бокового меню нет, только гамбургер

// name совпадает с дочерними маршрутами /dashboard/*
const NAV = [
  {
    name: "calendar",
    to: "/dashboard/calendar",
    label: "Календарь",
    icon: "M4 5.5h12v10.5H4zM4 9h12M7.5 3.5v3M12.5 3.5v3",
  },
  {
    name: "staff",
    to: "/dashboard/staff",
    label: "Персонал",
    icon: "M7.5 9a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5zM2.5 16c0-2.8 2.2-4.5 5-4.5s5 1.7 5 4.5M13 4a2.5 2.5 0 0 1 0 5M14 11.8c1.9.5 3.5 1.9 3.5 4.2",
  },
  {
    name: "roles",
    to: "/dashboard/roles",
    label: "Роли",
    icon: "M10 2.8 4 5v4.6c0 3.6 2.4 6.2 6 7.6 3.6-1.4 6-4 6-7.6V5zM7.5 10l1.8 1.8 3.4-3.6",
  },
  {
    name: "guide",
    to: "/dashboard/guide",
    label: "Руководство",
    icon: "M4 4.5A1.5 1.5 0 0 1 5.5 3H16v12H5.5A1.5 1.5 0 0 0 4 16.5zM4 16.5A1.5 1.5 0 0 0 5.5 18H16M7.5 7h5M7.5 10h5",
  },
];
const LOGOUT_ICON =
  "M8 4H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3M12 7l3 3-3 3M15 10H8";

/* ---------- «ResizeObserver loop completed with undelivered notifications» ----------
   Обработчики всех ResizeObserver на странице (в т.ч. в календаре) переносятся на следующий кадр,
   поэтому цикл наблюдателя не ломается. Патч ставится в setup — раньше, чем создаются дочерние страницы. */
let patchedRO = false;
const NativeRO =
  typeof window !== "undefined" ? window.ResizeObserver : undefined;
if (NativeRO && !NativeRO.__deferred) {
  window.ResizeObserver = class extends NativeRO {
    constructor(callback) {
      super((entries, observer) =>
        requestAnimationFrame(() => callback(entries, observer))
      );
    }
  };
  window.ResizeObserver.__deferred = true;
  patchedRO = true;
}
// запасной вариант: сообщение не доходит до красного окна webpack-dev-server
function hideRoLoopError(e) {
  if (String(e.message).includes("ResizeObserver loop"))
    e.stopImmediatePropagation();
}
if (typeof window !== "undefined")
  window.addEventListener("error", hideRoLoopError, true);

const route = useRoute();
const router = useRouter();
// размеры считаем сразу, до первой отрисовки — иначе на телефоне на миг мелькнёт десктопный вид
const matches = (q) =>
  typeof window !== "undefined" && window.matchMedia(q).matches;
const isMobile = ref(matches(NARROW_QUERY)); // ширина до 1024px
const isPhone = ref(matches(PHONE_QUERY)); // ширина до 640px
const collapsed = ref(false); // десктоп: меню свёрнуто в иконки (запоминается)
const mobileOpen = ref(false); // планшеты/телефоны: гамбургер-меню открыто
const burgerEl = ref(null);
const sidebarEl = ref(null);

// rail — только иконки; на мобильных сайдбара нет, есть гамбургер с меню целиком
const rail = computed(() =>
  isPhone.value ? false : isMobile.value ? !mobileOpen.value : collapsed.value
);
const pageTitle = computed(() => route.meta.title ?? "МедПортал");

let mq = null;
let phoneMq = null;
const onMq = (e) => {
  isMobile.value = e.matches;
  mobileOpen.value = false;
};
const onPhoneMq = (e) => {
  isPhone.value = e.matches;
  mobileOpen.value = false;
};

onMounted(() => {
  try {
    collapsed.value = localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    /* хранилище недоступно */
  }
  mq = window.matchMedia(NARROW_QUERY);
  isMobile.value = mq.matches;
  mq.addEventListener("change", onMq);
  phoneMq = window.matchMedia(PHONE_QUERY);
  isPhone.value = phoneMq.matches;
  phoneMq.addEventListener("change", onPhoneMq);
  window.addEventListener("keydown", onKeydown);
});
onBeforeUnmount(() => {
  if (patchedRO) window.ResizeObserver = NativeRO;
  window.removeEventListener("error", hideRoLoopError, true);
  mq?.removeEventListener("change", onMq);
  phoneMq?.removeEventListener("change", onPhoneMq);
  window.removeEventListener("keydown", onKeydown);
});

watch(collapsed, (v) => {
  try {
    localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
  } catch {
    /* хранилище недоступно */
  }
});
watch(
  () => route.fullPath,
  () => (mobileOpen.value = false)
);

// кнопка скрытия меню: на десктопе — свернуть/развернуть, на планшете — раскрыть/убрать поверх страницы
function toggleMenu() {
  if (isMobile.value) mobileOpen.value = !mobileOpen.value;
  else collapsed.value = !collapsed.value;
}
function openMobile() {
  mobileOpen.value = true;
  nextTick(() => sidebarEl.value?.querySelector(".sb__close")?.focus());
}
function closeMobile() {
  if (!mobileOpen.value) return;
  mobileOpen.value = false;
  nextTick(() => burgerEl.value?.focus({ preventScroll: true }));
}
function onKeydown(e) {
  if (e.key === "Escape") closeMobile();
}
const hrefOf = (to) => router.resolve(to).href;
const isActive = (to) => route.path === to || route.path.startsWith(to + "/");
// переход с проверкой: если он не удался (например, не загрузился chunk страницы), открываем адрес напрямую
async function go(to) {
  closeMobile();
  if (route.path === to) return;
  try {
    await router.push(to);
  } catch (err) {
    console.error("Ошибка перехода на", to, err);
    window.location.assign(hrefOf(to));
  }
}
function logout() {
  // здесь сбросьте токен / сессию
  router.push({ name: "home" });
}
</script>

<template>
  <div
    class="app"
    :class="{
      'app--rail': rail,
      'app--open': isMobile && mobileOpen,
      'app--phone': isPhone,
    }"
  >
    <!-- затемнение под гамбургер-меню (только на мобильных) -->
    <div class="app__backdrop" aria-hidden="true" @click="closeMobile"></div>

    <!-- ===== СЛЕВА: сайдбар ===== -->
    <div class="sb-wrap">
      <aside
        id="sidebar"
        ref="sidebarEl"
        class="sb"
        aria-label="Основное меню"
        :inert="isPhone && !mobileOpen ? '' : undefined"
      >
        <div class="sb__head">
          <a
            :href="hrefOf('/dashboard/calendar')"
            class="sb__brand"
            @click.prevent="go('/dashboard/calendar')"
            aria-label="МедПортал"
          >
            <span class="sb__logo" aria-hidden="true">
              <svg viewBox="0 0 20 20" width="20" height="20">
                <path
                  d="M10 4v12M4 10h12"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2.4"
                  stroke-linecap="round"
                />
              </svg>
            </span>
            <span class="sb__brand-name">МедПортал</span>
          </a>
          <button
            v-if="isPhone"
            class="btn btn--icon sb__close"
            type="button"
            aria-label="Закрыть меню"
            @click="closeMobile"
          >
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
              <path
                d="m5 5 10 10M15 5 5 15"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </div>

        <nav class="sb__nav">
          <ul class="sb__list">
            <li v-for="n in NAV" :key="n.name">
              <a
                :href="hrefOf(n.to)"
                class="sb__link"
                :class="{ 'is-active': isActive(n.to) }"
                :aria-current="isActive(n.to) ? 'page' : undefined"
                @click.prevent="go(n.to)"
                :title="rail ? n.label : undefined"
                :aria-label="n.label"
              >
                <svg
                  class="sb__icon"
                  viewBox="0 0 20 20"
                  width="20"
                  height="20"
                  aria-hidden="true"
                >
                  <path
                    :d="n.icon"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.7"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
                <span class="sb__label">{{ n.label }}</span>
              </a>
            </li>
          </ul>
        </nav>

        <div class="sb__foot">
          <button
            class="sb__link"
            type="button"
            :title="rail ? 'Выйти' : undefined"
            :aria-label="rail ? 'Выйти' : undefined"
            @click="logout"
          >
            <svg
              class="sb__icon"
              viewBox="0 0 20 20"
              width="20"
              height="20"
              aria-hidden="true"
            >
              <path
                :d="LOGOUT_ICON"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span class="sb__label">Выйти</span>
          </button>
          <button
            v-if="!isPhone"
            class="sb__link"
            type="button"
            :aria-expanded="!rail"
            aria-controls="sidebar"
            :title="rail ? 'Развернуть меню' : undefined"
            :aria-label="rail ? 'Развернуть меню' : 'Свернуть меню'"
            @click="toggleMenu"
          >
            <svg
              class="sb__icon sb__chev"
              viewBox="0 0 20 20"
              width="20"
              height="20"
              aria-hidden="true"
            >
              <path
                d="M12.5 4.5 7 10l5.5 5.5"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <span class="sb__label">{{ rail ? "Меню" : "Свернуть меню" }}</span>
          </button>
        </div>
      </aside>
    </div>

    <!-- ===== СПРАВА: окно для дочерних страниц (calendar, staff) ===== -->
    <div class="app__main">
      <header v-if="isPhone" class="top">
        <button
          ref="burgerEl"
          class="btn btn--icon"
          type="button"
          aria-label="Открыть меню"
          aria-controls="sidebar"
          :aria-expanded="mobileOpen"
          @click="openMobile"
        >
          <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
            <path
              d="M3.5 6h13M3.5 10h13M3.5 14h13"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
            />
          </svg>
        </button>
        <h1 class="top__title">{{ pageTitle }}</h1>
      </header>

      <main class="content">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.app {
  /* палитра — как в календаре */
  --primary-600: #0f766e;
  --primary-700: #115e59;
  --primary-50: #f0fdfa;
  --bg: #f8fafc;
  --surface: #ffffff;
  --muted: #f1f5f9;
  --line: #e2e8f0;
  --ink: #0f172a;
  --ink-soft: #475569;
  --accent: var(--primary-600);
  --sb-w: 264px;
  --sb-rail: 76px;
  --ease: cubic-bezier(0.32, 0.72, 0, 1);

  /* занимает весь экран независимо от высоты родителей — иначе сайдбар схлопывается по высоте */
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: row;
  min-height: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-tap-highlight-color: transparent;
}
.app *,
.app *::before,
.app *::after {
  box-sizing: border-box;
}

/* =====================  САЙДБАР (слева)  ===================== */
.sb-wrap {
  position: relative;
  z-index: 20;
  flex: none;
  width: var(--sb-w);
  height: 100%;
  transition: width 0.3s var(--ease);
}
.app--rail .sb-wrap {
  width: var(--sb-rail);
}
.sb {
  position: absolute;
  inset: 0 auto 0 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border-right: 1px solid var(--line);
  overflow-x: clip;
  transition: width 0.3s var(--ease), box-shadow 0.3s;
}
.sb__head {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-height: 72px;
  padding: 14px 12px;
}
.sb__brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  padding-left: 2px;
  border-radius: 10px;
  color: var(--ink);
  text-decoration: none;
}
.sb__brand:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
.sb__logo {
  flex: none;
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--primary-600);
  color: #fff;
}
.sb__brand-name {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.01em;
  white-space: nowrap;
}
.sb__nav {
  flex: 1 1 auto;
  min-height: 112px;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 4px 12px;
}
.sb__list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.sb__link {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  height: 44px;
  margin: 0;
  padding: 0 12px;
  border: 0;
  border-radius: 8px;
  background: none;
  color: var(--ink-soft);
  font: inherit;
  font-size: 15px;
  font-weight: 600;
  text-align: left;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}
.sb__link:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.sb__link.is-active {
  background: var(--primary-50);
  color: var(--primary-700);
}
.sb__link.is-active::before {
  content: "";
  position: absolute;
  left: -12px;
  top: 10px;
  bottom: 10px;
  width: 3px;
  border-radius: 0 3px 3px 0;
  background: var(--primary-600);
}
@media (hover: hover) {
  .sb__link:hover {
    background: var(--muted);
    color: var(--ink);
  }
  .sb__link.is-active:hover {
    background: var(--primary-50);
    color: var(--primary-700);
  }
}
.sb__icon {
  flex: none;
}
.sb__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: opacity 0.2s;
}
.sb__foot {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  border-top: 1px solid var(--line);
}
.sb__chev {
  transition: transform 0.3s var(--ease);
}

/* свёрнутое меню: иконка по центру, подпись мелким шрифтом под ней */
.app--rail .sb__brand-name {
  width: 0;
  opacity: 0;
  pointer-events: none;
}
.app--rail .sb__link {
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  height: 52px;
  padding: 0;
}
.app--rail .sb__label {
  max-width: 100%;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.1;
}
.app--rail .sb__link.is-active::before {
  top: 8px;
  bottom: 8px;
}
.app--rail .sb__chev {
  transform: rotate(180deg);
}

/* =====================  ОКНО СПРАВА  ===================== */
.app__main {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  min-height: 0;
}
.top {
  display: none;
}
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--ink-soft);
  font: inherit;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}
.btn--icon {
  width: 44px;
}
.btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
@media (hover: hover) {
  .btn--icon:hover {
    background: var(--muted);
    color: var(--ink);
  }
}

.content {
  position: relative;
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
}
.content > :deep(*) {
  min-height: 100%;
}
/* календарь в режиме fullscreen не перекрывает сайдбар, а занимает только это окно */
.content :deep(.cal.cal--fullscreen) {
  position: relative !important;
  inset: auto !important;
  z-index: auto !important;
  width: 100% !important;
  height: 100% !important;
  max-width: 100% !important;
  border: 0 !important;
  border-radius: 0 !important;
}

.app__backdrop {
  display: none;
}

/* =====================  ПЛАНШЕТЫ (до 1024px)  ===================== */
/* сайдбар остаётся слева узкой полосой; кнопка раскрывает его поверх окна, повторное нажатие убирает */
@media (max-width: 1024px) {
  .app .sb-wrap {
    width: var(--sb-rail);
  }
  .app--open .sb-wrap {
    z-index: 100;
  }
  .app--open .sb {
    width: min(var(--sb-w), 86vw);
    box-shadow: 12px 0 40px rgba(15, 23, 42, 0.22);
  }
  .app__backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 90;
    background: rgba(15, 23, 42, 0.45);
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.25s;
  }
  .app--open .app__backdrop {
    opacity: 1;
    pointer-events: auto;
  }
}

/* =====================  ТЕЛЕФОНЫ (до 640px)  ===================== */
/* бокового меню нет: сверху панель с гамбургером, меню выезжает слева поверх страницы */
@media (max-width: 640px) {
  .top {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 56px;
    padding: calc(6px + env(safe-area-inset-top, 0px)) 12px 6px 8px;
    background: var(--surface);
    border-bottom: 1px solid var(--line);
  }
  .top__title {
    margin: 0;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 18px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  .app .sb-wrap {
    position: fixed;
    inset: 0 auto 0 0;
    z-index: 100;
    width: min(var(--sb-w), 86vw);
    transform: translateX(-105%);
    visibility: hidden;
    transition: transform 0.32s var(--ease), visibility 0s 0.32s;
  }
  .app--open .sb-wrap {
    transform: none;
    visibility: visible;
    transition: transform 0.32s var(--ease), visibility 0s;
  }
  .sb {
    padding-bottom: env(safe-area-inset-bottom, 0px);
    box-shadow: 12px 0 40px rgba(15, 23, 42, 0.22);
  }
  .sb__head {
    padding-top: calc(14px + env(safe-area-inset-top, 0px));
  }
}

/* низкие экраны (телефон горизонтально): меню прокручивается целиком */
@media (max-height: 480px) {
  .sb__nav {
    min-height: 0;
  }
  .sb {
    overflow-y: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .sb-wrap,
  .sb,
  .sb__label,
  .sb__chev,
  .app__backdrop,
  .sb__link {
    transition: none !important;
  }
}
</style>
