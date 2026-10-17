<script setup>
import {
  ref,
  reactive,
  computed,
  watch,
  nextTick,
  onMounted,
  onBeforeUnmount,
  defineProps,
} from "vue";

/* ---------- настройки ---------- */
const STORAGE_KEY = "big-calendar-events";
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
// Цвета событий — только из палитры дизайн-системы
const COLORS = [
  { id: "primary", value: "#0f766e", label: "Основной" }, // color/primary/600
  { id: "blue", value: "#005a9c", label: "Синий" }, // color/accent/blue
  { id: "success", value: "#10b981", label: "Норма" }, // color/semantic/success
  { id: "warning", value: "#f59e0b", label: "Внимание" }, // color/semantic/warning
  { id: "emergency", value: "#dc2626", label: "Срочно" }, // color/semantic/emergency
];
const SHEET_QUERY = "(max-width: 1024px)"; // ниже этой ширины панель — выезжающий снизу лист
const PHONE_QUERY = "(max-width: 640px)"; // на телефонах события в ячейках — цветные точки

const props = defineProps({
  // true — календарь занимает ровно весь экран, страница не скроллится.
  // false — календарь занимает 100% высоты родителя (или --cal-height).
  fullscreen: { type: Boolean, default: true },
});

/* ---------- утилиты дат ---------- */
const pad = (n) => String(n).padStart(2, "0");
const toKey = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

const monthFmt = new Intl.DateTimeFormat("ru-RU", { month: "long" });
const dayFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
});
const weekdayFmt = new Intl.DateTimeFormat("ru-RU", { weekday: "long" });

function plural(n, forms) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}
const eventsWord = (n) =>
  `${n} ${plural(n, ["событие", "события", "событий"])}`;

/* ---------- состояние ---------- */
const today = new Date();
const todayKey = toKey(today);

const viewYear = ref(today.getFullYear());
const viewMonth = ref(today.getMonth());
const selectedKey = ref(null); // открыта ли панель
const panelKey = ref(null); // какой день показан в панели (остаётся во время анимации закрытия)

const events = reactive({}); // { 'YYYY-MM-DD': [{ id, title, time, color, done }] }

const form = reactive({ title: "", time: "", color: COLORS[0].value });
const titleInput = ref(null);
const scrollEl = ref(null);
const expandedId = ref(null); // раскрытое событие в панели
const isSheet = ref(false);
const isPhone = ref(false);
const gridEl = ref(null);
const rowH = ref(136); // реальная высота одной недели, измеряется ResizeObserver

/* ---------- загрузка / сохранение ---------- */
function seedDemo() {
  const shift = (days) =>
    toKey(
      new Date(today.getFullYear(), today.getMonth(), today.getDate() + days)
    );
  events[shift(0)] = [
    {
      id: crypto.randomUUID(),
      title: "Созвон с командой",
      time: "11:00",
      endTime: "11:30",
      location: "Zoom",
      attendees: "Аня, Игорь",
      link: "",
      notes: "Обсудить план на неделю и блокеры.",
      color: COLORS[0].value,
      done: false,
    },
    {
      id: crypto.randomUUID(),
      title: "Ревью pull request",
      time: "15:30",
      color: COLORS[1].value,
      done: false,
    },
  ];
  events[shift(2)] = [
    {
      id: crypto.randomUUID(),
      title: "Дедлайн по макетам",
      time: "",
      color: COLORS[3].value,
      done: false,
    },
  ];
  events[shift(5)] = [
    {
      id: crypto.randomUUID(),
      title: "День рождения Ани",
      time: "19:00",
      color: COLORS[4].value,
      done: false,
    },
  ];
}

let mq = null;
let phoneMq = null;
let ro = null;
const onMq = (e) => (isSheet.value = e.matches);
const onPhoneMq = (e) => (isPhone.value = e.matches);

onMounted(() => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      // события, сохранённые со старыми цветами, переводим на цвета палитры
      const legacy = {
        "#2b4bdb": COLORS[0].value,
        "#1f9d6b": COLORS[2].value,
        "#d98a0b": COLORS[3].value,
        "#d6455d": COLORS[4].value,
        "#7a4fd6": COLORS[1].value,
      };
      for (const list of Object.values(saved))
        for (const ev of list) ev.color = legacy[ev.color] ?? ev.color;
      Object.assign(events, saved);
    } else seedDemo();
  } catch {
    seedDemo();
  }
  // у старых событий нет новых полей — добавляем пустые значения
  for (const list of Object.values(events)) {
    for (const ev of list) {
      for (const k of ["endTime", "location", "attendees", "link", "notes"])
        if (typeof ev[k] !== "string") ev[k] = "";
    }
  }
  mq = window.matchMedia(SHEET_QUERY);
  isSheet.value = mq.matches;
  mq.addEventListener("change", onMq);
  phoneMq = window.matchMedia(PHONE_QUERY);
  isPhone.value = phoneMq.matches;
  phoneMq.addEventListener("change", onPhoneMq);
  if (gridEl.value && "ResizeObserver" in window) {
    ro = new ResizeObserver(
      ([entry]) => (rowH.value = entry.contentRect.height / 6)
    );
    ro.observe(gridEl.value);
  }
  window.addEventListener("keydown", onKeydown);
});
onBeforeUnmount(() => {
  mq?.removeEventListener("change", onMq);
  phoneMq?.removeEventListener("change", onPhoneMq);
  ro?.disconnect();
  window.removeEventListener("keydown", onKeydown);
  setScrollLock(false);
});

watch(
  events,
  (val) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(val));
    } catch {
      /* хранилище недоступно — работаем в памяти */
    }
  },
  { deep: true }
);

/* ---------- сетка месяца ---------- */
const monthLabel = computed(() => {
  const name = monthFmt.format(new Date(viewYear.value, viewMonth.value, 1));
  return name.charAt(0).toUpperCase() + name.slice(1);
});

const cells = computed(() => {
  const first = new Date(viewYear.value, viewMonth.value, 1);
  const offset = (first.getDay() + 6) % 7; // неделя с понедельника
  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(viewYear.value, viewMonth.value, 1 - offset + i);
    return {
      key: toKey(date),
      day: date.getDate(),
      outside: date.getMonth() !== viewMonth.value,
      weekend: i % 7 > 4,
      isToday: toKey(date) === todayKey,
    };
  });
});

function sortedEvents(key) {
  const list = events[key] ?? [];
  return [...list].sort((a, b) => {
    if (!a.time && b.time) return -1;
    if (a.time && !b.time) return 1;
    return a.time.localeCompare(b.time);
  });
}

// Сколько событий помещается в ячейке при текущей высоте недели — остальные сворачиваются в «ещё N»
const dayViews = computed(() => {
  const map = {};
  for (const c of cells.value) {
    const list = sortedEvents(c.key);
    const total = list.length;
    let limit;
    if (isPhone.value) {
      limit = 3;
    } else {
      const avail = rowH.value - 48; // минус отступы и число дня
      const fitAll = Math.floor((avail + 3) / 23.2);
      limit =
        total <= fitAll
          ? total
          : Math.max(0, Math.floor((avail - 19.2 + 3) / 23.2));
    }
    limit = Math.min(limit, total);
    const rest = total - limit;
    let more = "";
    if (rest > 0)
      more = isPhone.value
        ? `+${rest}`
        : limit > 0
        ? `ещё ${rest}`
        : eventsWord(rest);
    map[c.key] = { shown: list.slice(0, limit), more };
  }
  return map;
});

/* ---------- навигация ---------- */
function shiftMonth(delta) {
  const d = new Date(viewYear.value, viewMonth.value + delta, 1);
  viewYear.value = d.getFullYear();
  viewMonth.value = d.getMonth();
}
function goToday() {
  viewYear.value = today.getFullYear();
  viewMonth.value = today.getMonth();
  if (selectedKey.value !== todayKey) openDay(todayKey);
}

/* ---------- панель дня ---------- */
const isOpen = computed(() => selectedKey.value !== null);
const panelDate = computed(() =>
  panelKey.value ? fromKey(panelKey.value) : null
);
const panelTitle = computed(() =>
  panelDate.value ? dayFmt.format(panelDate.value) : ""
);
const panelWeekday = computed(() => {
  if (!panelDate.value) return "";
  const w = weekdayFmt.format(panelDate.value);
  return w.charAt(0).toUpperCase() + w.slice(1);
});
const panelEvents = computed(() =>
  panelKey.value ? sortedEvents(panelKey.value) : []
);

function openDay(key) {
  if (selectedKey.value === key) {
    closeDay();
    return;
  }
  selectedKey.value = key;
  expandedId.value = null;
  const d = fromKey(key);
  // клик по дню соседнего месяца переключает месяц
  if (d.getMonth() !== viewMonth.value || d.getFullYear() !== viewYear.value) {
    viewYear.value = d.getFullYear();
    viewMonth.value = d.getMonth();
  }
  resetForm();
}
function closeDay() {
  selectedKey.value = null;
}
function resetForm() {
  form.title = "";
  form.time = "";
  form.color = COLORS[0].value;
}

function addEvent() {
  const title = form.title.trim();
  const key = panelKey.value;
  if (!title || !key) return;
  if (!events[key]) events[key] = [];
  events[key].push({
    id: crypto.randomUUID(),
    title,
    time: form.time,
    endTime: "",
    location: "",
    attendees: "",
    link: "",
    notes: "",
    color: form.color,
    done: false,
  });
  form.title = "";
  form.time = "";
  if (!isSheet.value) nextTick(() => titleInput.value?.focus());
}
function removeEvent(id) {
  const key = panelKey.value;
  if (!key) return;
  if (expandedId.value === id) expandedId.value = null;
  events[key] = events[key].filter((e) => e.id !== id);
  if (!events[key].length) delete events[key];
}
function toggleDone(ev) {
  ev.done = !ev.done;
}

/* ---------- раскрытие события ---------- */
function toggleExpand(id) {
  expandedId.value = expandedId.value === id ? null : id;
  if (expandedId.value) {
    // после раскрытия подводим событие в видимую область списка
    setTimeout(() => {
      scrollEl.value
        ?.querySelector(`[data-id="${id}"]`)
        ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 300);
  }
}
const endBeforeStart = (ev) =>
  Boolean(ev.time && ev.endTime && ev.endTime < ev.time);
function timeRange(ev) {
  if (!ev.time) return "Весь день";
  return ev.endTime && !endBeforeStart(ev)
    ? `${ev.time}–${ev.endTime}`
    : ev.time;
}
function fixTitle(ev) {
  ev.title = ev.title.trim() || "Без названия";
}
// ссылка открывается только если это http(s)
function safeHref(raw) {
  const v = (raw ?? "").trim();
  if (!v) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

function onKeydown(e) {
  if (e.key !== "Escape") return;
  if (expandedId.value) expandedId.value = null;
  else if (isOpen.value) closeDay();
}

watch(selectedKey, (val) => {
  if (!val) return;
  panelKey.value = val;
  // на телефонах не открываем клавиатуру автоматически
  if (!isSheet.value)
    nextTick(() =>
      setTimeout(() => titleInput.value?.focus({ preventScroll: true }), 320)
    );
});

/* ---------- блокировка прокрутки страницы ---------- */
let locked = false;
const prevOverflow = { html: "", body: "" };
function setScrollLock(lock) {
  if (typeof document === "undefined") return;
  if (lock && !locked) {
    prevOverflow.html = document.documentElement.style.overflow;
    prevOverflow.body = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    locked = true;
  } else if (!lock && locked) {
    document.documentElement.style.overflow = prevOverflow.html;
    document.body.style.overflow = prevOverflow.body;
    locked = false;
  }
}
// страница не скроллится: в режиме fullscreen всегда, иначе только пока открыт лист
watch(
  [isOpen, isSheet, () => props.fullscreen],
  ([open, sheet, full]) => setScrollLock(full || (open && sheet)),
  { immediate: true }
);
</script>

<template>
  <section
    class="cal"
    :class="{ 'cal--open': isOpen, 'cal--fullscreen': fullscreen }"
  >
    <!-- ===== Календарь ===== -->
    <div class="cal__main">
      <header class="cal__head">
        <div class="cal__title">
          <h2>{{ monthLabel }}</h2>
          <span class="cal__year">{{ viewYear }}</span>
        </div>

        <div class="cal__nav">
          <button class="btn btn--ghost" type="button" @click="goToday">
            Сегодня
          </button>
          <button
            class="btn btn--icon"
            type="button"
            aria-label="Предыдущий месяц"
            @click="shiftMonth(-1)"
          >
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
              <path
                d="M12.5 4.5 7 10l5.5 5.5"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
          <button
            class="btn btn--icon"
            type="button"
            aria-label="Следующий месяц"
            @click="shiftMonth(1)"
          >
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
              <path
                d="M7.5 4.5 13 10l-5.5 5.5"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
        </div>
      </header>

      <div class="cal__weekdays" aria-hidden="true">
        <span
          v-for="(w, i) in WEEKDAYS"
          :key="w"
          :class="{ 'is-weekend': i > 4 }"
          >{{ w }}</span
        >
      </div>

      <div ref="gridEl" class="cal__grid" role="grid">
        <button
          v-for="cell in cells"
          :key="cell.key"
          type="button"
          class="day"
          :class="{
            'day--outside': cell.outside,
            'day--weekend': cell.weekend,
            'day--today': cell.isToday,
            'day--selected': cell.key === selectedKey,
          }"
          :aria-pressed="cell.key === selectedKey"
          :aria-label="`${cell.day} ${monthFmt.format(
            fromKey(cell.key)
          )}, ${eventsWord((events[cell.key] ?? []).length)}`"
          @click="openDay(cell.key)"
        >
          <span class="day__num">{{ cell.day }}</span>

          <span class="day__chips">
            <span
              v-for="ev in dayViews[cell.key].shown"
              :key="ev.id"
              class="chip"
              :class="{ 'chip--done': ev.done }"
              :style="{ '--c': ev.color }"
            >
              <b v-if="ev.time">{{ ev.time }}</b>
              <span>{{ ev.title }}</span>
            </span>
            <span v-if="dayViews[cell.key].more" class="day__more">{{
              dayViews[cell.key].more
            }}</span>
          </span>
        </button>
      </div>
    </div>

    <!-- затемнение под листом (только на узких экранах) -->
    <div class="cal__backdrop" aria-hidden="true" @click="closeDay"></div>

    <!-- ===== Панель дня: справа на десктопе, лист снизу на планшетах и телефонах ===== -->
    <aside
      class="cal__side"
      role="dialog"
      aria-label="События дня"
      :aria-modal="isSheet && isOpen ? 'true' : undefined"
      :inert="isOpen ? undefined : ''"
    >
      <div v-if="panelKey" class="side">
        <header class="side__head">
          <div>
            <p class="side__weekday">{{ panelWeekday }}</p>
            <h3>{{ panelTitle }}</h3>
            <p class="side__count">
              {{
                panelEvents.length
                  ? eventsWord(panelEvents.length)
                  : "Событий нет"
              }}
            </p>
          </div>
          <button
            class="btn btn--icon"
            type="button"
            aria-label="Закрыть панель"
            @click="closeDay"
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
        </header>

        <!-- прокручивается только список -->
        <div ref="scrollEl" class="side__scroll">
          <ul v-if="panelEvents.length" class="list">
            <li
              v-for="ev in panelEvents"
              :key="ev.id"
              :data-id="ev.id"
              class="item"
              :class="{
                'item--done': ev.done,
                'item--open': expandedId === ev.id,
              }"
              :style="{ '--c': ev.color }"
            >
              <div class="item__row">
                <label class="item__check">
                  <input
                    type="checkbox"
                    :checked="ev.done"
                    @change="toggleDone(ev)"
                  />
                  <span class="item__box" aria-hidden="true"></span>
                  <span class="sr-only">Выполнено</span>
                </label>

                <button
                  class="item__body"
                  type="button"
                  :aria-expanded="expandedId === ev.id"
                  :aria-controls="`ev-details-${ev.id}`"
                  @click="toggleExpand(ev.id)"
                >
                  <span class="item__text">
                    <span class="item__title">{{ ev.title }}</span>
                    <span class="item__meta">
                      <span class="item__time">{{ timeRange(ev) }}</span>
                      <span v-if="ev.location" class="item__loc">{{
                        ev.location
                      }}</span>
                    </span>
                  </span>
                  <svg
                    class="item__chev"
                    viewBox="0 0 20 20"
                    width="18"
                    height="18"
                    aria-hidden="true"
                  >
                    <path
                      d="m5 7.5 5 5 5-5"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>

                <button
                  class="btn btn--icon btn--sm btn--danger"
                  type="button"
                  :aria-label="`Удалить «${ev.title}»`"
                  @click="removeEvent(ev.id)"
                >
                  <svg
                    viewBox="0 0 20 20"
                    width="16"
                    height="16"
                    aria-hidden="true"
                  >
                    <path
                      d="M4.5 6h11M8 6V4.5h4V6m-6 0 .6 9h6.8l.6-9"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.6"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>
              </div>

              <!-- подробности события: плавно раскрываются -->
              <div
                :id="`ev-details-${ev.id}`"
                class="item__collapse"
                :inert="expandedId === ev.id ? undefined : ''"
              >
                <div class="item__collapse-inner">
                  <div class="details">
                    <label class="field">
                      <span>Название</span>
                      <input
                        v-model="ev.title"
                        type="text"
                        maxlength="80"
                        autocomplete="off"
                        @blur="fixTitle(ev)"
                      />
                    </label>

                    <div class="details__pair">
                      <label class="field">
                        <span>Начало</span>
                        <input v-model="ev.time" type="time" />
                      </label>
                      <label class="field">
                        <span>Конец</span>
                        <input
                          v-model="ev.endTime"
                          type="time"
                          :min="ev.time || undefined"
                        />
                      </label>
                    </div>
                    <p
                      v-if="endBeforeStart(ev)"
                      class="field-error"
                      role="alert"
                    >
                      Конец раньше начала
                    </p>

                    <label class="field">
                      <span>Место</span>
                      <input
                        v-model="ev.location"
                        type="text"
                        maxlength="80"
                        placeholder="Кабинет, адрес или онлайн"
                        autocomplete="off"
                      />
                    </label>

                    <label class="field">
                      <span>Участники</span>
                      <input
                        v-model="ev.attendees"
                        type="text"
                        maxlength="120"
                        placeholder="Имена через запятую"
                        autocomplete="off"
                      />
                    </label>

                    <label class="field">
                      <span>Ссылка</span>
                      <input
                        v-model="ev.link"
                        type="url"
                        inputmode="url"
                        placeholder="https://example.com"
                        autocomplete="off"
                      />
                    </label>
                    <a
                      v-if="safeHref(ev.link)"
                      class="details__link"
                      :href="safeHref(ev.link)"
                      target="_blank"
                      rel="noopener noreferrer"
                      >Открыть ссылку</a
                    >

                    <label class="field">
                      <span>Описание</span>
                      <textarea
                        v-model="ev.notes"
                        rows="4"
                        maxlength="1000"
                        placeholder="Заметки, повестка, что подготовить"
                      ></textarea>
                    </label>

                    <fieldset class="field">
                      <legend>Цвет</legend>
                      <div class="colors">
                        <label
                          v-for="c in COLORS"
                          :key="c.id"
                          class="swatch"
                          :title="c.label"
                        >
                          <input
                            v-model="ev.color"
                            type="radio"
                            :name="`color-${ev.id}`"
                            :value="c.value"
                          />
                          <span :style="{ background: c.value }"></span>
                          <span class="sr-only">{{ c.label }}</span>
                        </label>
                      </div>
                    </fieldset>

                    <div class="details__foot">
                      <span class="details__saved"
                        >Изменения сохраняются сразу</span
                      >
                      <button
                        class="btn btn--ghost"
                        type="button"
                        @click="toggleExpand(ev.id)"
                      >
                        Свернуть
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          </ul>
          <p v-else class="empty">
            На этот день ничего не запланировано. Добавьте первое событие ниже.
          </p>
        </div>

        <!-- форма всегда прижата к низу и целиком видна -->
        <div
          class="form-wrap"
          :class="{ 'form-wrap--hidden': expandedId !== null }"
          :inert="expandedId !== null ? '' : undefined"
        >
          <form class="form" @submit.prevent="addEvent">
            <label class="field">
              <span>Название</span>
              <input
                ref="titleInput"
                v-model="form.title"
                type="text"
                maxlength="80"
                placeholder="Например, встреча с клиентом"
                autocomplete="off"
                enterkeyhint="done"
              />
            </label>

            <div class="form__row">
              <label class="field field--time">
                <span>Время</span>
                <input v-model="form.time" type="time" />
              </label>

              <fieldset class="field field--colors">
                <legend>Цвет</legend>
                <div class="colors">
                  <label
                    v-for="c in COLORS"
                    :key="c.id"
                    class="swatch"
                    :title="c.label"
                  >
                    <input
                      v-model="form.color"
                      type="radio"
                      name="event-color"
                      :value="c.value"
                    />
                    <span :style="{ background: c.value }"></span>
                    <span class="sr-only">{{ c.label }}</span>
                  </label>
                </div>
              </fieldset>
            </div>

            <button
              class="btn btn--primary"
              type="submit"
              :disabled="!form.title.trim()"
            >
              Добавить событие
            </button>
          </form>
        </div>
      </div>
    </aside>
  </section>
</template>

<style scoped>
.cal {
  /* палитра */
  --primary-600: #0f766e;
  --primary-700: #115e59;
  --primary-50: #f0fdfa;
  --blue: #005a9c;
  --bg: #f8fafc;
  --surface: #ffffff;
  --muted: #f1f5f9;
  --border: #e2e8f0;
  --text-1: #0f172a;
  --text-2: #475569;
  --text-3: #64748b;
  --success: #10b981;
  --warning: #f59e0b;
  --error: #ef4444;
  --emergency: #dc2626;

  /* роли */
  --ink: var(--text-1);
  --ink-soft: var(--text-2);
  --ink-faint: var(--text-3);
  --paper: var(--surface);
  --line: var(--border);
  --accent: var(--primary-600);
  --accent-soft: var(--primary-50);
  --side-w: clamp(340px, 32vw, 420px);

  display: flex;
  align-items: stretch;
  width: 100%;
  height: var(--cal-height, 100%);
  max-width: 100%;
  min-width: 0;
  min-height: 0;
  background: var(--bg);
  color: var(--ink);
  border: 1px solid var(--line);
  border-radius: 14px;
  overflow: clip; /* clip, а не hidden — чтобы работал sticky у панели */
  font-family: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-tap-highlight-color: transparent;
}
/* на весь экран: страница под календарём не скроллится */
.cal.cal--fullscreen {
  position: fixed;
  inset: 0;
  z-index: 1;
  width: auto;
  height: auto;
  max-width: none;
  border: 0;
  border-radius: 0;
}
.cal *,
.cal *::before,
.cal *::after {
  box-sizing: border-box;
}

/* =====================  КАЛЕНДАРЬ  ===================== */
.cal__main {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 24px;
}

.cal__head {
  display: flex;
  flex-wrap: nowrap;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  gap: 12px 16px;
  margin-bottom: 20px;
}
.cal__title {
  display: flex;
  align-items: baseline;
  gap: 10px;
  min-width: 0;
}
.cal__title h2 {
  margin: 0;
  white-space: nowrap;
  font-size: clamp(24px, 4vw, 34px);
  line-height: 1.1;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.cal__year {
  font-size: clamp(16px, 2.4vw, 22px);
  font-weight: 400;
  color: var(--ink-faint);
  font-variant-numeric: tabular-nums;
}
.cal__nav {
  display: flex;
  align-items: center;
  gap: 6px;
}

.cal__weekdays {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  padding-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-soft);
}
.cal__weekdays span {
  padding: 0 8px;
}
.cal__weekdays .is-weekend {
  color: var(--ink-faint);
}

.cal__grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  grid-template-rows: repeat(
    6,
    minmax(0, 1fr)
  ); /* высота календаря задана контейнером — месяцы не «прыгают» */
  min-height: 0;
  border-top: 1px solid var(--line);
  border-left: 1px solid var(--line);
}

/* ---------- ячейка дня ---------- */
.day {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  padding: 8px 8px 6px;
  border: 0;
  border-right: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  background: var(--paper);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s;
}
.day:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
  z-index: 2;
}
.day--weekend {
  background: var(--muted);
}
.day--outside .day__num,
.day--outside .day__chips {
  opacity: 0.38;
}
.day--selected,
.day--selected.day--weekend {
  background: var(--accent-soft);
  box-shadow: inset 0 0 0 2px var(--accent);
  z-index: 1;
}
@media (hover: hover) {
  .day:hover {
    background: var(--primary-50);
  }
  .day--selected:hover {
    background: var(--accent-soft);
  }
}

.day__num {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.day--today .day__num {
  background: var(--primary-600);
  color: #fff;
}

.day__chips {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.chip {
  display: flex;
  align-items: baseline;
  gap: 5px;
  padding: 2px 6px 2px 7px;
  border-left: 3px solid var(--c);
  border-radius: 3px;
  background: color-mix(in srgb, var(--c) 12%, white);
  font-size: 12px;
  line-height: 1.35;
  overflow: hidden;
  white-space: nowrap;
}
.chip b {
  flex: none;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: color-mix(in srgb, var(--c) 65%, var(--text-1));
}
.chip span {
  overflow: hidden;
  text-overflow: ellipsis;
}
.chip--done {
  opacity: 0.55;
  text-decoration: line-through;
}
.day__more {
  padding-left: 7px;
  font-size: 12px;
  font-weight: 500;
  color: var(--ink-soft);
}

/* =====================  ПАНЕЛЬ ДНЯ — по умолчанию лист снизу  ===================== */
.cal__backdrop {
  position: fixed;
  inset: 0;
  z-index: 90;
  background: rgba(15, 23, 42, 0.45);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s;
}
.cal--open .cal__backdrop {
  opacity: 1;
  pointer-events: auto;
}

.cal__side {
  position: fixed;
  inset: auto 0 0 0;
  z-index: 100;
  display: flex;
  flex-direction: column;
  max-width: 680px;
  max-height: min(90vh, 760px);
  max-height: min(90dvh, 760px);
  margin-inline: auto;
  background: var(--bg);
  border-radius: 18px 18px 0 0;
  box-shadow: 0 -12px 40px rgba(15, 23, 42, 0.22);
  transform: translateY(105%);
  visibility: hidden;
  transition: transform 0.32s cubic-bezier(0.32, 0.72, 0, 1),
    visibility 0s 0.32s;
}
.cal--open .cal__side {
  transform: none;
  visibility: visible;
  transition: transform 0.32s cubic-bezier(0.32, 0.72, 0, 1), visibility 0s;
}

.side {
  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  gap: 14px;
  padding: 22px 18px calc(16px + env(safe-area-inset-bottom, 0px));
}
.side::before {
  content: "";
  position: absolute;
  top: 8px;
  left: 50%;
  width: 40px;
  height: 4px;
  margin-left: -20px;
  border-radius: 2px;
  background: var(--ink-faint);
  opacity: 0.6;
}

.side__head {
  flex: none;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.side__weekday {
  margin: 0 0 2px;
  font-size: 14px;
  color: var(--ink-soft);
}
.side__head h3 {
  margin: 0;
  font-size: clamp(22px, 5vw, 28px);
  line-height: 1.15;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.side__count {
  margin: 6px 0 0;
  font-size: 14px;
  color: var(--ink-soft);
}

/* только список скроллится, шапка и форма остаются на месте */
.side__scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  margin-inline: -4px;
  padding-inline: 4px;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.item {
  background: var(--paper);
  border: 1px solid var(--line);
  border-left: 4px solid var(--c);
  border-radius: 8px;
  animation: pop 0.22s ease-out;
  transition: box-shadow 0.2s;
}
.item--open {
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.1);
}
.item__row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 6px 6px 8px;
}
.item__body {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 6px 6px 6px 4px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.item__body:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
.item__text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.item__title {
  font-size: 15px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.item__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0 12px;
  min-width: 0;
  font-size: 13px;
  color: var(--ink-soft);
}
.item__time {
  font-variant-numeric: tabular-nums;
}
.item__loc {
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.item__chev {
  flex: none;
  color: var(--text-3);
  transition: transform 0.25s;
}
.item--open .item__chev {
  transform: rotate(180deg);
}

/* плавное раскрытие по высоте содержимого */
.item__collapse {
  display: grid;
  grid-template-rows: 0fr;
  visibility: hidden;
  transition: grid-template-rows 0.28s cubic-bezier(0.32, 0.72, 0, 1),
    visibility 0s 0.28s;
}
.item--open .item__collapse {
  grid-template-rows: 1fr;
  visibility: visible;
  transition: grid-template-rows 0.28s cubic-bezier(0.32, 0.72, 0, 1),
    visibility 0s;
}
.item__collapse-inner {
  min-height: 0;
  overflow: hidden;
}
.details {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin: 0 10px;
  padding: 14px 2px 14px;
  border-top: 1px solid var(--line);
}
.details__pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}
.field-error {
  margin: -4px 0 0;
  font-size: 13px;
  color: var(--error);
}
.details__link {
  align-self: flex-start;
  font-size: 14px;
  font-weight: 600;
  color: var(--primary-600);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.details__link:hover {
  color: var(--primary-700);
}
.details__link:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 2px;
}
.details__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
}
.details__saved {
  font-size: 13px;
  color: var(--text-3);
}
.item--done .item__title {
  text-decoration: line-through;
  color: var(--ink-faint);
}

.item__check {
  position: relative;
  display: grid;
  place-items: center;
  flex: none;
  width: 32px;
  height: 32px;
  cursor: pointer;
}
.item__check input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}
.item__box {
  width: 20px;
  height: 20px;
  border: 2px solid var(--ink-faint);
  border-radius: 6px;
  background: var(--paper);
  transition: background-color 0.15s, border-color 0.15s;
}
.item__check input:checked + .item__box {
  background-color: var(--c);
  border-color: var(--c);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath d='m5 10.5 3.2 3.2L15 6.8' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-size: 100%;
}
.item__check input:focus-visible + .item__box {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.empty {
  margin: 0;
  padding: 16px;
  border: 1px dashed var(--ink-faint);
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--ink-soft);
}

/* ---------- форма ---------- */
.form-wrap {
  flex: none;
  display: grid;
  grid-template-rows: 1fr;
  border-top: 1px solid var(--line);
  transition: grid-template-rows 0.28s cubic-bezier(0.32, 0.72, 0, 1),
    border-color 0.28s, visibility 0s;
}
.form-wrap--hidden {
  grid-template-rows: 0fr;
  border-top-color: transparent;
  visibility: hidden;
  transition: grid-template-rows 0.28s cubic-bezier(0.32, 0.72, 0, 1),
    border-color 0.28s, visibility 0s 0.28s;
}
.form {
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 4px 4px;
  margin: 0 -4px;
}
.form__row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px 16px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
.field > span,
.field > legend {
  padding: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-soft);
}
.field input[type="text"],
.field input[type="url"],
.field input[type="time"],
.field textarea {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  -webkit-appearance: none;
  appearance: none;
  height: 44px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--paper);
  color: var(--ink);
  font: inherit;
  font-size: 16px; /* 16px — чтобы iOS не приближал страницу при фокусе */
}
.field textarea {
  height: auto;
  min-height: 96px;
  max-height: 220px;
  padding: 10px 12px;
  line-height: 1.45;
  resize: vertical;
}
.field input:focus-visible,
.field textarea:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
  border-color: transparent;
}
.field--time {
  flex: 1 1 120px;
  min-width: 0;
  max-width: 160px;
}
.colors {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 44px;
}
.swatch {
  position: relative;
  display: block;
  cursor: pointer;
}
.swatch input {
  position: absolute;
  inset: -4px;
  width: calc(100% + 8px);
  height: calc(100% + 8px);
  margin: 0;
  opacity: 0;
  cursor: pointer;
}
.swatch span:not(.sr-only) {
  display: block;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  box-shadow: 0 0 0 2px var(--bg);
  transition: box-shadow 0.15s, transform 0.15s;
}
.swatch input:checked + span {
  box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--ink);
  transform: scale(1.05);
}
.swatch input:focus-visible + span {
  box-shadow: 0 0 0 2px var(--bg), 0 0 0 4px var(--accent);
}

/* ---------- кнопки ---------- */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 44px;
  padding: 0 16px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--ink);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s, opacity 0.15s;
}
.btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.btn--ghost {
  border-color: var(--line);
  background: var(--paper);
}
.btn--icon {
  width: 44px;
  padding: 0;
  color: var(--ink-soft);
}
.btn--sm {
  width: 36px;
  height: 36px;
}
.btn--primary {
  background: var(--accent);
  color: #fff;
}
.btn--primary:active:not(:disabled) {
  background: var(--primary-700);
}
.btn--primary:disabled {
  background: var(--muted);
  color: var(--text-3);
  cursor: not-allowed;
}
.btn--danger:focus-visible {
  outline-color: var(--error);
}
@media (hover: hover) {
  .btn--ghost:hover {
    background: var(--muted);
  }
  .btn--icon:hover {
    background: var(--muted);
    color: var(--ink);
  }
  .cal__side .btn--icon:hover {
    background: var(--muted);
  }
  .btn--danger:hover {
    background: color-mix(in srgb, var(--error) 10%, white);
    color: var(--error);
  }
  .btn--primary:hover:not(:disabled) {
    background: var(--primary-700);
  }
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

@keyframes pop {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

/* =====================  ДЕСКТОП: панель справа  ===================== */
@media (min-width: 1025px) {
  .cal__backdrop {
    display: none;
  }

  .cal__side {
    position: relative;
    inset: auto;
    z-index: auto;
    display: block;
    flex: none;
    width: 0;
    max-width: none;
    max-height: none;
    margin: 0;
    border-radius: 0;
    border-left: 0 solid var(--line);
    box-shadow: none;
    transform: none;
    visibility: visible;
    overflow-x: clip;
    overflow-y: visible;
    transition: width 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  }
  .cal--open .cal__side {
    width: var(--side-w);
    border-left-width: 1px;
    transition: width 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  }

  /* панель «прилипает» к окну и никогда не выше экрана — внутри скроллится только список */
  .side {
    position: sticky;
    top: 0;
    width: var(--side-w);
    height: 100%;
    max-height: 100vh;
    max-height: 100dvh;
    padding: 28px 24px 24px;
    gap: 18px;
  }
  .side::before {
    display: none;
  }
}

/* =====================  ПЛАНШЕТЫ  ===================== */
@media (max-width: 1024px) {
  .cal__main {
    padding: 20px;
  }
}

/* =====================  ТЕЛЕФОНЫ  ===================== */
@media (max-width: 640px) {
  .cal__main {
    padding: 12px 10px 14px;
  }
  .cal__head {
    gap: 8px;
    min-height: 36px;
    margin-bottom: 12px;
  }
  .cal__title {
    gap: 6px;
  }
  .cal__title h2 {
    font-size: 20px;
  }
  .cal__year {
    font-size: 14px;
  }
  .cal__nav {
    flex: none;
    gap: 4px;
  }
  .cal__nav .btn {
    height: 36px;
  }
  .cal__nav .btn--ghost {
    padding: 0 10px;
  }
  .cal__nav .btn--icon {
    width: 36px;
  }
  .cal__weekdays {
    font-size: 12px;
  }
  .cal__weekdays span {
    padding: 0;
    text-align: center;
  }
  .day {
    align-items: center;
    gap: 4px;
    padding: 5px 2px 4px;
  }
  .day__num {
    width: 26px;
    height: 26px;
    font-size: 13px;
  }
  /* вместо текста событий — цветные точки */
  .day__chips {
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
    gap: 3px;
  }
  .chip {
    width: 7px;
    height: 7px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: var(--c);
    font-size: 0;
  }
  .chip b,
  .chip span {
    display: none;
  }
  .day__more {
    padding: 0;
    font-size: 10px;
    line-height: 7px;
  }
  .side {
    padding-inline: 14px;
  }
  .field--time {
    max-width: none;
  }
}

/* очень узкие экраны */
@media (max-width: 360px) {
  .cal__main {
    padding-inline: 6px;
  }
  .colors {
    gap: 6px;
  }
}

/* низкие экраны (телефон горизонтально): прокручивается вся панель целиком */
@media (max-height: 560px) {
  .side {
    overflow-y: auto;
    overscroll-behavior: contain;
    gap: 10px;
  }
  .side__scroll {
    flex: none;
    overflow: visible;
  }
  .form {
    padding-top: 12px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .cal__side,
  .cal__backdrop,
  .day,
  .item,
  .item__collapse,
  .item__chev,
  .form-wrap,
  .swatch span {
    transition: none !important;
    animation: none !important;
  }
}
</style>
