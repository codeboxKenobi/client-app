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
  defineEmits,
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
const SMALL_QUERY = "(max-width: 768px)"; // на малых экранах время выбирается в окне, а не вводится вручную

// поля времени события (используются и в создании, и в раскрытом событии)
const TIME_FIELDS = [
  { key: "time", label: "Начало" },
  { key: "endTime", label: "Конец" },
];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

// рабочий диапазон дня, в котором ищем свободные окна
const DAY_START = "08:00";
const DAY_END = "22:00";
const DEFAULT_DURATION = 60; // минут: длительность события без времени конца
const MIN_WINDOW = 30; // окна короче этого не показываем

const props = defineProps({
  // true — календарь занимает ровно весь экран, страница не скроллится.
  // false — календарь занимает 100% высоты родителя (или --cal-height).
  fullscreen: { type: Boolean, default: true },
  // список сотрудников для выбора исполнителя и ассистентов (имена строками)
  // пациенты для поиска: [{ id, name, phone }]. Новые пациенты, добавленные в календаре, приходят событием patient-add
  patients: {
    type: Array,
    default: () => [
      { id: "p1", name: "Иванова Мария Сергеевна", phone: "+7 900 111-22-33" },
      { id: "p2", name: "Петров Алексей Иванович", phone: "+7 912 345-67-89" },
      {
        id: "p3",
        name: "Сидорова Елена Викторовна",
        phone: "+7 921 555-01-02",
      },
      { id: "p4", name: "Козлов Дмитрий Андреевич", phone: "+7 903 777-88-99" },
      { id: "p5", name: "Смирнова Ольга Петровна", phone: "+7 985 222-33-44" },
      {
        id: "p6",
        name: "Васильев Игорь Николаевич",
        phone: "+7 977 101-20-30",
      },
    ],
  },
  staff: {
    type: Array,
    default: () => [
      "Иванов А.П.",
      "Петров С.И.",
      "Сидорова Е.В.",
      "Козлова М.Н.",
      "Смирнов Д.А.",
      "Белова О.Р.",
    ],
  },
});

const emit = defineEmits(["patient-add", "patient-update"]);

/* ---------- утилиты дат ---------- */

// Уникальный id. crypto.randomUUID есть только в защищённом контексте (HTTPS/localhost) —
// на обычном HTTP его нет, поэтому есть запасные варианты без зависимостей.
function uid() {
  const c = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  if (c && typeof c.getRandomValues === "function") {
    const b = c.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40; // версия 4
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(
      16,
      20
    )}-${h.slice(20)}`;
  }
  return `id-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}
const pad = (n) => String(n).padStart(2, "0");
const toKey = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (key) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

function minutesNow() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

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

const emptyForm = () => ({
  title: "", // ФИО выбранного пациента
  patientId: "",
  time: "",
  endTime: "",
  location: "",
  performer: "", // исполнитель
  assistants: [], // ассистенты (несколько)
  notes: "",
  color: COLORS[0].value,
});
const form = reactive(emptyForm()); // черновик нового события
const creating = ref(false); // открыта форма нового события со всеми полями
const titleInput = ref(null);
const scrollEl = ref(null);
const expandedId = ref(null); // раскрытое событие в панели
const isSheet = ref(false);
const isPhone = ref(false);
const isSmall = ref(false);
const gridEl = ref(null);
const rowH = ref(136); // реальная высота одной недели, измеряется ResizeObserver
const colW = ref(188); // реальная ширина одного дня
const nowMin = ref(minutesNow()); // текущее время в минутах от полуночи, обновляется раз в полминуты

/* ---------- загрузка / сохранение ---------- */
function seedDemo() {
  const shift = (days) =>
    toKey(
      new Date(today.getFullYear(), today.getMonth(), today.getDate() + days)
    );
  events[shift(0)] = [
    {
      id: uid(),
      title: "Иванова Мария Сергеевна",
      patientId: "p1",
      time: "11:00",
      endTime: "11:30",
      location: "каб. 101",
      performer: "Иванов А.П.",
      assistants: ["Козлова М.Н."],
      notes: "Повторный приём.",
      color: COLORS[0].value,
      done: false,
    },
    {
      id: uid(),
      title: "Петров Алексей Иванович",
      patientId: "p2",
      time: "15:30",
      color: COLORS[1].value,
      done: false,
    },
  ];
  events[shift(2)] = [
    {
      id: uid(),
      title: "Сидорова Елена Викторовна",
      patientId: "p3",
      time: "",
      color: COLORS[3].value,
      done: false,
    },
  ];
  events[shift(5)] = [
    {
      id: uid(),
      title: "Козлов Дмитрий Андреевич",
      patientId: "p4",
      time: "19:00",
      color: COLORS[4].value,
      done: false,
    },
  ];
}

let mq = null;
let phoneMq = null;
let smallMq = null;
let ro = null;
let timer = null;
const onMq = (e) => (isSheet.value = e.matches);
const onPhoneMq = (e) => (isPhone.value = e.matches);
const onSmallMq = (e) => (isSmall.value = e.matches);

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
      // раньше было текстовое поле «Участники»: если там имя сотрудника из списка — переносим в исполнителя
      if (typeof ev.performer !== "string") {
        const old = typeof ev.attendees === "string" ? ev.attendees.trim() : "";
        ev.performer = props.staff.includes(old) ? old : "";
      }
      if (!Array.isArray(ev.assistants)) ev.assistants = [];
      for (const k of ["endTime", "location", "notes"])
        if (typeof ev[k] !== "string") ev[k] = "";
      delete ev.attendees;
      delete ev.link;
    }
  }
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_PATIENTS) || "[]");
    if (Array.isArray(saved))
      addedPatients.value = saved.filter(
        (x) => x && x.id && typeof x.name === "string"
      );
  } catch {
    /* хранилище недоступно */
  }
  try {
    const phones = JSON.parse(localStorage.getItem(STORAGE_PHONES) || "{}");
    if (phones && typeof phones === "object" && !Array.isArray(phones))
      phoneEdits.value = phones;
  } catch {
    /* хранилище недоступно */
  }
  mq = window.matchMedia(SHEET_QUERY);
  isSheet.value = mq.matches;
  mq.addEventListener("change", onMq);
  phoneMq = window.matchMedia(PHONE_QUERY);
  isPhone.value = phoneMq.matches;
  phoneMq.addEventListener("change", onPhoneMq);
  smallMq = window.matchMedia(SMALL_QUERY);
  isSmall.value = smallMq.matches;
  smallMq.addEventListener("change", onSmallMq);
  if (gridEl.value && "ResizeObserver" in window) {
    ro = new ResizeObserver(([entry]) => {
      rowH.value = entry.contentRect.height / 6;
      colW.value = entry.contentRect.width / 7;
    });
    ro.observe(gridEl.value);
  }
  window.addEventListener("keydown", onKeydown);
  timer = setInterval(() => (nowMin.value = minutesNow()), 30000);
});
onBeforeUnmount(() => {
  mq?.removeEventListener("change", onMq);
  phoneMq?.removeEventListener("change", onPhoneMq);
  smallMq?.removeEventListener("change", onSmallMq);
  ro?.disconnect();
  clearInterval(timer);
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
    return (
      a.time.localeCompare(b.time) ||
      (a.location || "").localeCompare(b.location || "", "ru")
    );
  });
}

/* ---------- текущая и следующая запись (только для сегодняшнего дня) ---------- */
const endMin = (e) => {
  const s = toMin(e.time);
  return e.endTime && toMin(e.endTime) > s
    ? toMin(e.endTime)
    : s + DEFAULT_DURATION;
};
const untilLabel = (m) => durationLabel(Math.max(1, m));
// исполнитель и ассистенты одной строкой: «Иванов А.П. + Козлова М.Н.»
const teamLabel = (ev) =>
  [ev.performer, ...(ev.assistants ?? [])].filter(Boolean).join(" + ");
// кабинет и команда одной строкой
const whereLabel = (ev) =>
  [ev.location, teamLabel(ev)].filter(Boolean).join(" · ");
// current — ВСЕ записи, которые идут сейчас (в том числе параллельные у разных специалистов);
// upcoming — ВСЕ записи на ближайшее время начала. Выполненные и «весь день» не учитываются.
const live = computed(() => {
  const n = nowMin.value;
  const timed = (events[todayKey] ?? [])
    .filter((e) => e.time && !e.done)
    .map((e) => ({ e, s: toMin(e.time), end: endMin(e) }))
    .sort((a, b) => a.s - b.s);
  const current = timed.filter((x) => x.s <= n && n < x.end).map((x) => x.e);
  const future = timed.filter((x) => x.s > n);
  const upcoming = future.length
    ? future.filter((x) => x.s === future[0].s).map((x) => x.e)
    : [];
  return {
    current,
    upcoming,
    currentIds: new Set(current.map((e) => e.id)),
    nextIds: new Set(upcoming.map((e) => e.id)),
  };
});

// Размеры элементов в ячейке (px) — для расчёта, сколько всего помещается
const CHIP_STEP = 23.2; // строка события вместе с промежутком
// Три плотности плашек со свободными окнами: обычная «08:00–10:00», компактная и мини (только начало).
// Если окна не влезают в ячейку, берётся следующая, более плотная плотность.
const FWIN_TIERS = [
  { id: "full", w: 84, step: 22 },
  { id: "compact", w: 70, step: 17 },
  { id: "mini", w: 30, step: 15 },
];

// Что показывать в ячейке: свободные окна ВСЕ (переносятся по несколько в ряд, при нехватке места становятся компактнее),
// события — в оставшемся месте, остальные сворачиваются в «ещё N». Если окна не влезают даже в мини-виде — последняя плашка «+N».
const dayViews = computed(() => {
  const map = {};
  for (const c of cells.value) {
    const list = sortedEvents(c.key);
    const total = list.length;
    const freeAll = !c.outside && c.key >= todayKey ? windowsFor(c.key) : [];
    const phone = isPhone.value;
    // на телефоне события — точки в одну строку; на широком экране — строки
    const avail = phone ? rowH.value - 39 - (total ? 10 : 0) : rowH.value - 48;
    // сегодня место под текущее и следующее событие резервируется раньше свободных окон
    const liveIds =
      c.key === todayKey
        ? [...live.value.currentIds, ...live.value.nextIds]
        : [];
    const reserve = phone
      ? 0
      : Math.min(
          liveIds.length,
          Math.max(0, Math.floor((avail + 3) / CHIP_STEP))
        );
    const availFree =
      avail -
      (reserve ? reserve * CHIP_STEP + (total > reserve ? 19.2 : 0) : 0);
    const innerW = phone ? colW.value - 5 : colW.value - 17;
    const tiers = phone ? [FWIN_TIERS[2]] : FWIN_TIERS;
    let tier = tiers[tiers.length - 1];
    let perRow = 1;
    let free = freeAll;
    if (freeAll.length) {
      let found = false;
      for (const t of tiers) {
        const pr = Math.max(1, Math.floor((innerW + 3) / (t.w + 3)));
        const slots = Math.max(0, Math.floor((availFree + 3) / t.step)) * pr;
        tier = t;
        perRow = pr;
        if (slots >= freeAll.length) {
          found = true;
          break;
        }
      }
      if (!found) {
        // даже в самом плотном виде не влезает — обрезаем, последнее место занимает «+N»
        const slots =
          Math.max(0, Math.floor((availFree + 3) / tier.step)) * perRow;
        free =
          slots === 0
            ? []
            : [
                ...freeAll.slice(0, slots - 1),
                {
                  more: true,
                  start: "more",
                  label: `+${freeAll.length - slots + 1}`,
                },
              ];
      }
    }
    let limit;
    if (phone) {
      limit = 3;
    } else {
      const freeLines = Math.ceil(free.length / perRow);
      const availEv = avail - freeLines * tier.step; // остальное место — событиям
      const fitAll = Math.floor((availEv + 3) / CHIP_STEP);
      limit =
        total <= fitAll
          ? total
          : Math.max(0, Math.floor((availEv - 19.2 + 3) / CHIP_STEP));
    }
    if (reserve) limit = Math.max(limit, reserve);
    limit = Math.min(limit, total);
    const rest = total - limit;
    let more = "";
    if (rest > 0)
      more = phone ? `+${rest}` : limit > 0 ? `ещё ${rest}` : eventsWord(rest);
    // сегодня текущее и следующее событие всегда остаются видимыми, даже если ячейка свёрнута в «ещё N»
    let shown = list.slice(0, limit);
    if (c.key === todayKey && limit < total) {
      const must = liveIds.slice(0, limit);
      const picked = new Set(must);
      for (const e of list) if (picked.size < limit) picked.add(e.id);
      shown = list.filter((e) => picked.has(e.id));
    }
    map[c.key] = { shown, more, free, freeTier: tier.id };
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
// прошедшие дни (до сегодняшнего) — только просмотр: ничего нельзя добавить, изменить или удалить
const panelReadonly = computed(
  () => Boolean(panelKey.value) && panelKey.value < todayKey
);

/* ---------- свободные окна ---------- */
const toMin = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
const fmtMin = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
function durationLabel(min) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h} ч` : "", m ? `${m} мин` : ""].filter(Boolean).join(" ");
}

/* ---------- ограничение: нельзя выбрать прошедшее время ---------- */
// ближайшее допустимое время дня: для сегодня — текущее время, округлённое вверх до 5 минут; для будущих дней ограничения нет
const ceil5 = (m) => Math.ceil(m / 5) * 5;
const minTimeFor = (key) =>
  key === todayKey ? fmtMin(Math.min(1439, ceil5(nowMin.value))) : "";
const dayMin = computed(() =>
  panelKey.value ? minTimeFor(panelKey.value) : ""
);
// минимум для поля: конец — не раньше начала и не раньше текущего времени
function minFor(t, key) {
  const m = dayMin.value;
  if (key === "endTime" && t.time && (!m || t.time > m)) return t.time;
  return m || undefined;
}
// у раскрытого события время меняется сразу: прошедшее значение отклоняем и возвращаем прежнее
const timeNote = reactive({ id: null, text: "" });
function setEventTime(ev, key, e) {
  const v = e.target.value;
  const m = dayMin.value;
  if (v && m && v < m) {
    timeNote.id = ev.id;
    timeNote.text = "Нельзя выбрать прошедшее время";
    e.target.value = ev[key];
    return;
  }
  timeNote.id = null;
  ev[key] = v;
}

// свободные окна любого дня: [{ start, end, len }]
function windowsFor(key) {
  // для сегодняшнего дня прошедшие окна не показываем: отсчёт идёт от текущего времени
  const dayStart = Math.max(
    toMin(DAY_START),
    key === todayKey ? ceil5(nowMin.value) : 0
  );
  const dayEnd = toMin(DAY_END);
  const busy = (events[key] ?? [])
    .filter((e) => e.time) // события «весь день» время не занимают
    .map((e) => {
      const s = toMin(e.time);
      const end =
        e.endTime && toMin(e.endTime) > s
          ? toMin(e.endTime)
          : s + DEFAULT_DURATION;
      return [s, end];
    })
    .sort((a, b) => a[0] - b[0]);

  const res = [];
  let cursor = dayStart;
  const push = (from, to) => {
    if (to - from >= MIN_WINDOW)
      res.push({
        start: fmtMin(from),
        end: fmtMin(to),
        len: durationLabel(to - from),
      });
  };
  for (const [s, e] of busy) {
    if (cursor >= dayEnd) break;
    push(cursor, Math.min(s, dayEnd));
    cursor = Math.max(cursor, e);
  }
  if (cursor < dayEnd) push(cursor, dayEnd);
  return res;
}
const freeWindows = computed(() =>
  panelKey.value ? windowsFor(panelKey.value) : []
);

// клик по свободному окну — новая запись с временем этого окна
function createInWindow(w, k) {
  const key = k ?? panelKey.value;
  if (!key || key < todayKey) return;
  // окно могло «устареть», пока открыта страница: начало не раньше текущего времени
  const min = minTimeFor(key);
  let start = w.start;
  if (min && start < min) {
    if (toMin(w.end) <= toMin(min)) return; // окно целиком в прошлом
    start = min;
  }
  startCreate();
  form.time = start;
  form.endTime = w.end;
}

// клик по свободному окну в ячейке календаря — открыть день и сразу форму нового события
function openFreeWindow(key, w) {
  if (key < todayKey) return; // прошедший день — только просмотр
  if (selectedKey.value !== key) openDay(key);
  panelKey.value = key;
  createInWindow(w, key);
}

function onFreeClick(e, key, w) {
  if (w.more) return; // «+N» — клик уходит в ячейку и открывает день
  e.stopPropagation();
  openFreeWindow(key, w);
}

// клик по событию в ячейке календаря — открыть день и раскрыть это событие
function openEvent(key, id) {
  if (selectedKey.value !== key) openDay(key);
  else resetForm();
  expandedId.value = id;
  setTimeout(() => {
    scrollEl.value
      ?.querySelector(`[data-id="${id}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, 350); // ждём конца анимации открытия панели
}

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
  Object.assign(form, emptyForm());
  creating.value = false;
  resetPatientUi();
}
function startCreate() {
  if (panelReadonly.value) return;
  expandedId.value = null;
  creating.value = true;
  if (!isSheet.value)
    nextTick(() => titleInput.value?.focus({ preventScroll: true }));
}
function cancelCreate() {
  resetForm();
}

function addEvent() {
  const title = form.title.trim();
  const key = panelKey.value;
  if (
    !title ||
    !key ||
    key < todayKey ||
    formEndError.value ||
    formPastError.value
  )
    return;
  if (!events[key]) events[key] = [];
  events[key].push({
    id: uid(),
    title,
    patientId: form.patientId,
    time: form.time,
    endTime: form.endTime,
    location: form.location.trim(),
    performer: form.performer,
    assistants: [...form.assistants],
    notes: form.notes.trim(),
    color: form.color,
    done: false,
  });
  resetForm();
}
function removeEvent(id) {
  const key = panelKey.value;
  if (!key || key < todayKey) return;
  if (expandedId.value === id) expandedId.value = null;
  events[key] = events[key].filter((e) => e.id !== id);
  if (!events[key].length) delete events[key];
}
function toggleDone(ev) {
  if (panelReadonly.value) return;
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
const formEndError = computed(() => endBeforeStart(form));
const formPastError = computed(() => {
  const m = dayMin.value;
  if (!m) return "";
  if (form.time && form.time < m) return "Начало не может быть в прошлом";
  if (form.endTime && form.endTime < m) return "Конец не может быть в прошлом";
  return "";
});
function timeRange(ev) {
  if (!ev.time) return "Весь день";
  return ev.endTime && !endBeforeStart(ev)
    ? `${ev.time}–${ev.endTime}`
    : ev.time;
}
/* ---------- пациенты: поиск, выбор, добавление нового ---------- */
const STORAGE_PATIENTS = "big-calendar-patients";
const addedPatients = ref([]); // пациенты, добавленные в календаре (хранятся в localStorage)
const STORAGE_PHONES = "big-calendar-patient-phones";
const phoneEdits = ref({}); // { patientId: 'новый телефон' } — правки телефонов (хранятся в localStorage)
const patientList = computed(() =>
  [
    ...props.patients,
    ...addedPatients.value.filter(
      (x) => !props.patients.some((p) => p.id === x.id)
    ),
  ].map((p) => ({
    ...p,
    phone: formatPhone(phoneEdits.value[p.id] || p.phone),
  }))
);
const phoneEdit = reactive({ key: null, value: "", error: "" }); // редактирование телефона выбранного пациента
const pat = reactive({
  open: false,
  key: null,
  query: "",
  active: 0,
  adding: false,
  name: "",
  phone: "",
  error: "",
});
let patTarget = null; // событие или черновик формы, для которого открыт выбор
const norm = (v) =>
  String(v ?? "")
    .toLowerCase()
    .replace(/ё/g, "е");
const digitsOf = (v) => String(v ?? "").replace(/\D/g, "");

/* ---------- маска телефона: +7 (900) 000-00-00 ---------- */
function formatPhone(value) {
  let d = digitsOf(value);
  if (!d) return "";
  if (d[0] === "7" || d[0] === "8") d = d.slice(1); // код страны вводится маской
  d = d.slice(0, 10);
  let out = "+7";
  if (d.length) out += " (" + d.slice(0, 3);
  if (d.length > 3) out += ") " + d.slice(3, 6); // скобка и дефисы добавляются только вместе со следующей цифрой,
  if (d.length > 6) out += "-" + d.slice(6, 8); // поэтому Backspace стирает цифры, а не разделители
  if (d.length > 8) out += "-" + d.slice(8, 10);
  return out;
}
// ввод в поле телефона: target[key] — значение, target.error — сообщение об ошибке
function onMaskInput(e, target, key) {
  const el = e.target;
  const atEnd = el.selectionStart === el.value.length;
  const digitsBefore = digitsOf(el.value.slice(0, el.selectionStart)).length;
  const formatted = formatPhone(el.value);
  el.value = formatted;
  target[key] = formatted;
  target.error = "";
  if (atEnd) return;
  // возвращаем курсор после того же количества цифр
  let seen = 0,
    pos = 0;
  while (pos < formatted.length && seen < digitsBefore)
    if (/\d/.test(formatted[pos++])) seen++;
  el.setSelectionRange(pos, pos);
}
const keyOf = (t) => t.id ?? "new";

// поиск по ФИО (любые части слов, в любом порядке) и по цифрам телефона
const patientMatches = computed(() => {
  const words = norm(pat.query).split(/\s+/).filter(Boolean);
  const digits = digitsOf(pat.query);
  return patientList.value
    .filter((p) => {
      if (!words.length) return true;
      const name = norm(p.name);
      return (
        words.every((w) => name.includes(w)) ||
        (digits.length >= 2 && digitsOf(p.phone).includes(digits))
      );
    })
    .sort((a, b) => a.name.localeCompare(b.name, "ru"))
    .slice(0, 50);
});
const patientOf = (t) =>
  t.patientId
    ? patientList.value.find((p) => p.id === t.patientId) ?? null
    : null;
const isPatientOpen = (t) => pat.open && pat.key === keyOf(t);
const isAddingPatient = (t) => pat.adding && pat.key === keyOf(t);
const isEditingPhone = (t) => phoneEdit.key === keyOf(t);
const comboValue = (t) => (isPatientOpen(t) ? pat.query : t.title);

function resetPatientUi() {
  pat.open = false;
  pat.adding = false;
  pat.error = "";
  phoneEdit.key = null;
}
function openPatient(t) {
  if (isPatientOpen(t)) return;
  patTarget = t;
  pat.key = keyOf(t);
  pat.query = "";
  pat.active = 0;
  pat.adding = false;
  pat.error = "";
  pat.open = true;
}
function closePatient() {
  pat.open = false;
}
function onPatientInput(t, e) {
  if (!isPatientOpen(t)) openPatient(t);
  pat.query = e.target.value;
  pat.active = 0;
}
function scrollActive() {
  nextTick(() =>
    document
      .getElementById(`pat-opt-${pat.active}`)
      ?.scrollIntoView({ block: "nearest" })
  );
}
function onPatientKeydown(e, t) {
  const n = patientMatches.value.length; // последняя строка (индекс n) — «Добавить нового»
  if (e.key === "Escape" && isPatientOpen(t)) {
    e.stopPropagation();
    closePatient();
  } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    if (!isPatientOpen(t)) return openPatient(t);
    pat.active = (pat.active + (e.key === "ArrowDown" ? 1 : n)) % (n + 1);
    scrollActive();
  } else if (e.key === "Enter" && isPatientOpen(t)) {
    e.preventDefault(); // Enter не отправляет форму события, пока открыт список
    if (pat.active < n) selectPatient(t, patientMatches.value[pat.active]);
    else startAddPatient(t);
  }
}
function selectPatient(t, p) {
  phoneEdit.key = null;
  t.patientId = p.id;
  t.title = p.name; // название события — ФИО пациента
  pat.open = false;
  pat.adding = false;
}
function startAddPatient(t) {
  patTarget = t;
  pat.key = keyOf(t);
  const q = pat.query.trim();
  const onlyDigits = q && /\d/.test(q) && !/\p{L}/u.test(q);
  pat.name = onlyDigits ? "" : q;
  pat.phone = onlyDigits ? formatPhone(q) : "";
  pat.error = "";
  pat.open = false;
  pat.adding = true;
  nextTick(() => document.getElementById(`newpat-name-${keyOf(t)}`)?.focus());
}
function cancelAddPatient() {
  pat.adding = false;
  pat.error = "";
}
// '' — телефон корректен; иначе текст ошибки. exceptId — пациент, чей номер мы сейчас меняем
function checkPhone(phone, exceptId = null) {
  const digits = digitsOf(phone);
  if (digits.length < 11) return "Введите номер полностью";
  const dup = patientList.value.find(
    (x) =>
      x.id !== exceptId && digitsOf(x.phone).slice(-10) === digits.slice(-10)
  );
  return dup ? `Этот номер уже есть у пациента: ${dup.name}` : "";
}
function startEditPhone(t) {
  const p = patientOf(t);
  if (!p) return;
  pat.open = false;
  pat.adding = false;
  phoneEdit.key = keyOf(t);
  phoneEdit.value = formatPhone(p.phone);
  phoneEdit.error = "";
  nextTick(() => document.getElementById(`phone-edit-${keyOf(t)}`)?.focus());
}
function cancelEditPhone() {
  phoneEdit.key = null;
  phoneEdit.error = "";
}
function savePhone(t) {
  const p = patientOf(t);
  if (!p) return;
  const phone = phoneEdit.value.trim().replace(/\s+/g, " ");
  const bad = checkPhone(phone, p.id);
  if (bad) return (phoneEdit.error = bad);
  if (phone !== p.phone) {
    phoneEdits.value = { ...phoneEdits.value, [p.id]: phone }; // телефон меняется у пациента во всех его событиях
    emit("patient-update", { ...p, phone }); // родитель может сохранить изменение у себя
  }
  cancelEditPhone();
}
function savePatient() {
  const name = pat.name.trim().replace(/\s+/g, " ");
  const phone = pat.phone.trim().replace(/\s+/g, " ");
  if (name.length < 2) return (pat.error = "Введите ФИО пациента");
  const bad = checkPhone(phone);
  if (bad) return (pat.error = bad);
  const created = { id: uid(), name, phone };
  addedPatients.value.push(created);
  emit("patient-add", created); // чтобы родитель мог сохранить пациента у себя (например, на сервере)
  if (patTarget) selectPatient(patTarget, created);
  pat.adding = false;
  pat.error = "";
}
watch(
  phoneEdits,
  (val) => {
    try {
      localStorage.setItem(STORAGE_PHONES, JSON.stringify(val));
    } catch {
      /* хранилище недоступно — работаем в памяти */
    }
  },
  { deep: true }
);
watch(
  addedPatients,
  (val) => {
    try {
      localStorage.setItem(STORAGE_PATIENTS, JSON.stringify(val));
    } catch {
      /* хранилище недоступно — работаем в памяти */
    }
  },
  { deep: true }
);

/* ---------- исполнитель и ассистенты ---------- */
// t — событие или черновик формы. Если исполнитель уже не в списке сотрудников, он остаётся в вариантах выбора.
function performerOptions(t) {
  return t.performer && !props.staff.includes(t.performer)
    ? [t.performer, ...props.staff]
    : props.staff;
}
// ассистентом нельзя выбрать исполнителя и тех, кто уже добавлен
function assistantChoices(t) {
  return props.staff.filter(
    (n) => n !== t.performer && !t.assistants.includes(n)
  );
}
function setPerformer(t, name) {
  t.performer = name;
  t.assistants = t.assistants.filter((n) => n !== name); // исполнитель не может быть своим ассистентом
}
function addAssistant(t, e) {
  const name = e.target.value;
  if (name && !t.assistants.includes(name)) t.assistants.push(name);
  e.target.value = ""; // селектор снова показывает «Добавить ассистента»
}
function removeAssistant(t, name) {
  t.assistants = t.assistants.filter((n) => n !== name);
}

function onKeydown(e) {
  if (e.key !== "Escape") return;
  if (picker.open) closePicker();
  else if (pat.adding) cancelAddPatient();
  else if (phoneEdit.key) cancelEditPhone();
  else if (expandedId.value) expandedId.value = null;
  else if (creating.value) cancelCreate();
  else if (isOpen.value) closeDay();
}

/* ---------- выбор времени (малые экраны) ---------- */
const picker = reactive({ open: false, label: "", hh: 9, mm: 0, min: "" });
const pickerMinH = computed(() =>
  picker.min ? Number(picker.min.slice(0, 2)) : 0
);
const pickerMinM = computed(() =>
  picker.min ? Number(picker.min.slice(3, 5)) : 0
);
// час недоступен, если он целиком раньше минимума; минута — если выбранный час совпадает с минимальным
const hourOff = (h) =>
  Boolean(picker.min) &&
  (h < pickerMinH.value || (h === pickerMinH.value && pickerMinM.value > 55));
const minuteOff = (m) =>
  Boolean(picker.min) && picker.hh === pickerMinH.value && m < pickerMinM.value;
// подтягиваем выбранное значение к ближайшему допустимому
function clampPicker() {
  if (!picker.min) return;
  const minTotal = pickerMinH.value * 60 + pickerMinM.value;
  if (picker.hh * 60 + picker.mm >= minTotal) return;
  const next = ceil5(minTotal);
  if (next >= 1440) {
    picker.hh = 23;
    picker.mm = 55;
  } else {
    picker.hh = Math.floor(next / 60);
    picker.mm = next % 60;
  }
}
function pickHour(h) {
  picker.hh = h;
  clampPicker();
}
const pickerEl = ref(null);
const pickerPreview = computed(() => `${pad(picker.hh)}:${pad(picker.mm)}`);
let pickerTarget = null;
let pickerKey = "";
let pickerReturn = null;

function openPicker(target, field, e) {
  pickerTarget = target;
  pickerKey = field.key;
  pickerReturn = e?.currentTarget ?? null;
  const v = target[field.key];
  if (v) {
    picker.hh = Number(v.slice(0, 2));
    picker.mm = Number(v.slice(3, 5));
  } else if (field.key === "endTime" && target.time) {
    // конец по умолчанию — через час после начала
    picker.hh = Math.min(23, Number(target.time.slice(0, 2)) + 1);
    picker.mm = Number(target.time.slice(3, 5));
  } else {
    picker.hh = 9;
    picker.mm = 0;
  }
  picker.label = field.label;
  picker.min = minFor(target, field.key) ?? "";
  clampPicker();
  picker.open = true;
  nextTick(() => pickerEl.value?.focus({ preventScroll: true }));
}
function closePicker() {
  picker.open = false;
  nextTick(() => pickerReturn?.focus?.({ preventScroll: true }));
}
function applyPicker() {
  if (pickerTarget) pickerTarget[pickerKey] = pickerPreview.value;
  closePicker();
}
function clearPicker() {
  if (pickerTarget) pickerTarget[pickerKey] = "";
  closePicker();
}
// Tab не уходит из окна выбора
function onPickerKeydown(e) {
  if (e.key !== "Tab" || !pickerEl.value) return;
  const items = [...pickerEl.value.querySelectorAll("button:not([disabled])")];
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  if (e.shiftKey && (active === first || active === pickerEl.value)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}

watch(selectedKey, (val) => {
  if (val) panelKey.value = val;
  resetPatientUi();
});
watch(expandedId, () => {
  resetPatientUi();
  timeNote.id = null;
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
            'day--past': cell.key < todayKey,
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
              :class="{
                'chip--done': ev.done,
                'chip--current': live.currentIds.has(ev.id),
                'chip--next': live.nextIds.has(ev.id),
              }"
              :style="{ '--c': ev.color }"
              :title="
                (live.currentIds.has(ev.id)
                  ? 'Сейчас: '
                  : live.nextIds.has(ev.id)
                  ? 'Далее: '
                  : '') +
                ev.title +
                (ev.location ? ` (${ev.location})` : '')
              "
              @click.stop="openEvent(cell.key, ev.id)"
            >
              <b v-if="ev.time">{{ ev.time }}</b>
              <span>{{ ev.title }}</span>
            </span>
            <span v-if="dayViews[cell.key].more" class="day__more">{{
              dayViews[cell.key].more
            }}</span>
            <span
              v-if="dayViews[cell.key].free.length"
              class="day__free"
              :class="`day__free--${dayViews[cell.key].freeTier}`"
            >
              <span
                v-for="w in dayViews[cell.key].free"
                :key="w.start"
                class="fwin"
                :class="{ 'fwin--more': w.more }"
                :title="
                  w.more
                    ? 'Остальные окна — в панели дня'
                    : `Свободно ${w.len} — создать событие`
                "
                @click="onFreeClick($event, cell.key, w)"
              >
                {{
                  w.more
                    ? w.label
                    : dayViews[cell.key].freeTier === "mini"
                    ? w.start
                    : `${w.start}–${w.end}`
                }}
              </span>
            </span>
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
      <div v-if="panelKey" class="side" :class="{ 'side--creating': creating }">
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
            <span v-if="panelReadonly" class="side__ro">
              <svg
                viewBox="0 0 20 20"
                width="14"
                height="14"
                aria-hidden="true"
              >
                <path
                  d="M6 9V6.5a4 4 0 0 1 8 0V9M5 9h10v7H5z"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              Только просмотр
            </span>
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
          <!-- сегодня: что идёт сейчас и что дальше -->
          <section
            v-if="panelKey === todayKey && panelEvents.length"
            class="now"
            aria-label="Сейчас и далее"
          >
            <div class="now__group">
              <p class="now__label">
                <span
                  v-if="live.current.length"
                  class="now__dot"
                  aria-hidden="true"
                ></span
                >Сейчас
                <span v-if="live.current.length > 1" class="now__count">{{
                  live.current.length
                }}</span>
              </p>
              <template v-if="live.current.length">
                <button
                  v-for="ev in live.current"
                  :key="ev.id"
                  class="now__card now__card--current"
                  type="button"
                  :style="{ '--c': ev.color }"
                  @click="toggleExpand(ev.id)"
                >
                  <span class="now__title">{{ ev.title }}</span>
                  <span class="now__meta"
                    >{{ timeRange(ev) }} · осталось
                    {{ untilLabel(endMin(ev) - nowMin) }}</span
                  >
                  <span v-if="whereLabel(ev)" class="now__where">{{
                    whereLabel(ev)
                  }}</span>
                </button>
              </template>
              <div v-else class="now__card now__card--empty">
                <span class="now__meta">Событий нет</span>
              </div>
            </div>

            <div class="now__group">
              <p class="now__label">
                Далее
                <span v-if="live.upcoming.length > 1" class="now__count">{{
                  live.upcoming.length
                }}</span>
              </p>
              <template v-if="live.upcoming.length">
                <button
                  v-for="ev in live.upcoming"
                  :key="ev.id"
                  class="now__card"
                  type="button"
                  :style="{ '--c': ev.color }"
                  @click="toggleExpand(ev.id)"
                >
                  <span class="now__title">{{ ev.title }}</span>
                  <span class="now__meta"
                    >{{ timeRange(ev) }} · через
                    {{ untilLabel(toMin(ev.time) - nowMin) }}</span
                  >
                  <span v-if="whereLabel(ev)" class="now__where">{{
                    whereLabel(ev)
                  }}</span>
                </button>
              </template>
              <div v-else class="now__card now__card--empty">
                <span class="now__meta">Больше событий сегодня нет</span>
              </div>
            </div>

            <div class="now__divider" aria-hidden="true">
              <span>Все события дня</span>
            </div>
          </section>

          <ul v-if="panelEvents.length" class="list">
            <li
              v-for="ev in panelEvents"
              :key="ev.id"
              :data-id="ev.id"
              class="item"
              :class="{
                'item--done': ev.done,
                'item--open': expandedId === ev.id,
                'item--current': live.currentIds.has(ev.id),
              }"
              :style="{ '--c': ev.color }"
            >
              <div class="item__row">
                <label class="item__check">
                  <input
                    type="checkbox"
                    :checked="ev.done"
                    :disabled="panelReadonly"
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
                      <span
                        v-if="live.currentIds.has(ev.id)"
                        class="badge badge--now"
                        >Сейчас</span
                      >
                      <span
                        v-else-if="live.nextIds.has(ev.id)"
                        class="badge badge--next"
                        >Далее</span
                      >
                      <span class="item__time">{{ timeRange(ev) }}</span>
                      <span v-if="ev.location" class="item__loc">{{
                        ev.location
                      }}</span>
                      <span v-if="teamLabel(ev)" class="item__loc">{{
                        teamLabel(ev)
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
                  v-if="!panelReadonly"
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
                    <fieldset class="details__ro" :disabled="panelReadonly">
                      <div class="field combo">
                        <label class="combo__label" :for="`pat-in-${ev.id}`"
                          >Пациент</label
                        >
                        <div class="combo__box">
                          <input
                            :id="`pat-in-${ev.id}`"
                            class="combo__input"
                            type="text"
                            role="combobox"
                            autocomplete="off"
                            aria-autocomplete="list"
                            aria-controls="pat-list"
                            :aria-expanded="
                              isPatientOpen(ev) ? 'true' : 'false'
                            "
                            :aria-activedescendant="
                              isPatientOpen(ev)
                                ? `pat-opt-${pat.active}`
                                : undefined
                            "
                            :value="comboValue(ev)"
                            :placeholder="
                              isPatientOpen(ev) && ev.title
                                ? ev.title
                                : 'Фамилия, имя или телефон'
                            "
                            @focus="openPatient(ev)"
                            @click="openPatient(ev)"
                            @input="onPatientInput(ev, $event)"
                            @keydown="onPatientKeydown($event, ev)"
                            @blur="closePatient"
                          />
                          <svg
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
                        </div>
                        <div
                          v-if="
                            patientOf(ev) &&
                            !isPatientOpen(ev) &&
                            !isAddingPatient(ev)
                          "
                          class="combo__phone"
                        >
                          <template v-if="!isEditingPhone(ev)">
                            <span>Телефон: {{ patientOf(ev).phone }}</span>
                            <button
                              v-if="!panelReadonly"
                              class="linkbtn"
                              type="button"
                              :aria-label="`Изменить телефон: ${
                                patientOf(ev).name
                              }`"
                              @click="startEditPhone(ev)"
                            >
                              Изменить
                            </button>
                          </template>
                          <div
                            v-else
                            class="newpat phoneedit"
                            role="group"
                            aria-label="Изменение телефона"
                          >
                            <label class="field">
                              <span>Номер телефона</span>
                              <input
                                :id="`phone-edit-${ev.id}`"
                                :value="phoneEdit.value"
                                @input="onMaskInput($event, phoneEdit, 'value')"
                                type="tel"
                                inputmode="tel"
                                maxlength="24"
                                autocomplete="off"
                                placeholder="+7 (900) 000-00-00"
                                @keydown.enter.prevent="savePhone(ev)"
                              />
                            </label>
                            <p
                              v-if="phoneEdit.error"
                              class="field-error"
                              role="alert"
                            >
                              {{ phoneEdit.error }}
                            </p>
                            <div class="newpat__actions">
                              <button
                                class="btn btn--ghost"
                                type="button"
                                @click="cancelEditPhone"
                              >
                                Отмена
                              </button>
                              <button
                                class="btn btn--primary"
                                type="button"
                                @click="savePhone(ev)"
                              >
                                Сохранить
                              </button>
                            </div>
                          </div>
                        </div>

                        <ul
                          v-if="isPatientOpen(ev)"
                          id="pat-list"
                          class="combo__list"
                          role="listbox"
                          aria-label="Пациенты"
                        >
                          <li
                            v-for="(p, i) in patientMatches"
                            :key="p.id"
                            :id="`pat-opt-${i}`"
                            class="combo__opt"
                            :class="{
                              'is-active': i === pat.active,
                              'is-selected': p.id === ev.patientId,
                            }"
                            role="option"
                            :aria-selected="p.id === ev.patientId"
                            @mousedown.prevent
                            @click="selectPatient(ev, p)"
                          >
                            <span class="combo__name">{{ p.name }}</span>
                            <span class="combo__tel">{{ p.phone }}</span>
                          </li>
                          <li
                            v-if="!patientMatches.length"
                            class="combo__empty"
                            role="presentation"
                          >
                            Пациент не найден
                          </li>
                          <li
                            :id="`pat-opt-${patientMatches.length}`"
                            class="combo__opt combo__opt--add"
                            :class="{
                              'is-active': pat.active === patientMatches.length,
                            }"
                            role="option"
                            aria-selected="false"
                            @mousedown.prevent
                            @click="startAddPatient(ev)"
                          >
                            +
                            {{
                              pat.query.trim()
                                ? `Добавить «${pat.query.trim()}» как нового пациента`
                                : "Добавить нового пациента"
                            }}
                          </li>
                        </ul>

                        <div
                          v-if="isAddingPatient(ev)"
                          class="newpat"
                          role="group"
                          aria-label="Новый пациент"
                        >
                          <p class="newpat__title">Новый пациент</p>
                          <label class="field">
                            <span>ФИО</span>
                            <input
                              :id="`newpat-name-${ev.id}`"
                              v-model="pat.name"
                              type="text"
                              maxlength="120"
                              autocomplete="off"
                              placeholder="Фамилия Имя Отчество"
                              @keydown.enter.prevent="savePatient"
                            />
                          </label>
                          <label class="field">
                            <span>Номер телефона</span>
                            <input
                              :value="pat.phone"
                              @input="onMaskInput($event, pat, 'phone')"
                              type="tel"
                              inputmode="tel"
                              maxlength="24"
                              autocomplete="off"
                              placeholder="+7 (900) 000-00-00"
                              @keydown.enter.prevent="savePatient"
                            />
                          </label>
                          <p v-if="pat.error" class="field-error" role="alert">
                            {{ pat.error }}
                          </p>
                          <div class="newpat__actions">
                            <button
                              class="btn btn--ghost"
                              type="button"
                              @click="cancelAddPatient"
                            >
                              Отмена
                            </button>
                            <button
                              class="btn btn--primary"
                              type="button"
                              @click="savePatient"
                            >
                              Сохранить
                            </button>
                          </div>
                        </div>
                      </div>

                      <div class="details__pair">
                        <label
                          v-for="f in TIME_FIELDS"
                          :key="f.key"
                          class="field"
                        >
                          <span>{{ f.label }}</span>
                          <button
                            v-if="isSmall"
                            type="button"
                            class="timebtn"
                            :class="{ 'timebtn--empty': !ev[f.key] }"
                            :aria-label="`${f.label}: ${
                              ev[f.key] || 'не задано'
                            }`"
                            @click="openPicker(ev, f, $event)"
                          >
                            <span>{{ ev[f.key] || "Выбрать" }}</span>
                            <svg
                              viewBox="0 0 20 20"
                              width="20"
                              height="20"
                              aria-hidden="true"
                            >
                              <circle
                                cx="10"
                                cy="10"
                                r="7.25"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.7"
                              />
                              <path
                                d="M10 5.8V10l2.8 1.8"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.7"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                              />
                            </svg>
                          </button>
                          <input
                            v-else
                            :value="ev[f.key]"
                            type="time"
                            :min="minFor(ev, f.key)"
                            @change="setEventTime(ev, f.key, $event)"
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
                      <p
                        v-if="timeNote.id === ev.id && timeNote.text"
                        class="field-error"
                        role="alert"
                      >
                        {{ timeNote.text }}
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
                        <span>Исполнитель</span>
                        <select
                          :value="ev.performer"
                          @change="setPerformer(ev, $event.target.value)"
                        >
                          <option value="">Не выбран</option>
                          <option
                            v-for="n in performerOptions(ev)"
                            :key="n"
                            :value="n"
                          >
                            {{ n }}
                          </option>
                        </select>
                      </label>

                      <fieldset class="field">
                        <legend>Ассистент</legend>
                        <ul v-if="ev.assistants.length" class="tags">
                          <li v-for="n in ev.assistants" :key="n" class="tag">
                            <span>{{ n }}</span>
                            <button
                              type="button"
                              class="tag__x"
                              :aria-label="`Убрать ассистента ${n}`"
                              @click="removeAssistant(ev, n)"
                            >
                              <svg
                                viewBox="0 0 20 20"
                                width="14"
                                height="14"
                                aria-hidden="true"
                              >
                                <path
                                  d="m5 5 10 10M15 5 5 15"
                                  fill="none"
                                  stroke="currentColor"
                                  stroke-width="2"
                                  stroke-linecap="round"
                                />
                              </svg>
                            </button>
                          </li>
                        </ul>
                        <p
                          v-if="panelReadonly && !ev.assistants.length"
                          class="combo__phone"
                        >
                          Не указаны
                        </p>
                        <select
                          v-if="!panelReadonly"
                          :value="''"
                          aria-label="Добавить ассистента"
                          :disabled="!assistantChoices(ev).length"
                          @change="addAssistant(ev, $event)"
                        >
                          <option value="">
                            {{
                              assistantChoices(ev).length
                                ? "Добавить ассистента…"
                                : "Все сотрудники выбраны"
                            }}
                          </option>
                          <option
                            v-for="n in assistantChoices(ev)"
                            :key="n"
                            :value="n"
                          >
                            {{ n }}
                          </option>
                        </select>
                      </fieldset>

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
                    </fieldset>

                    <div class="details__foot">
                      <span class="details__saved">{{
                        panelReadonly
                          ? "Прошедший день: только просмотр"
                          : "Изменения сохраняются сразу"
                      }}</span>
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
            {{
              panelReadonly
                ? "В этот день событий не было."
                : "На этот день ничего не запланировано. Добавьте первое событие ниже."
            }}
          </p>

          <!-- свободные окна: клик создаёт событие на это время -->
          <section
            v-if="!panelReadonly"
            class="free"
            aria-label="Свободное время"
          >
            <h4 class="free__title">Свободное время</h4>
            <ul v-if="freeWindows.length" class="free__list">
              <li v-for="w in freeWindows" :key="w.start">
                <button
                  class="free__btn"
                  type="button"
                  @click="createInWindow(w)"
                >
                  <span class="free__range">{{ w.start }}–{{ w.end }}</span>
                  <span class="free__len">{{ w.len }}</span>
                  <svg
                    viewBox="0 0 20 20"
                    width="16"
                    height="16"
                    aria-hidden="true"
                  >
                    <path
                      d="M10 4.5v11M4.5 10h11"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                    />
                  </svg>
                </button>
              </li>
            </ul>
            <p v-else class="free__none">Свободных окон нет</p>
          </section>
        </div>

        <!-- создание события: все поля сразу -->
        <form v-if="creating" class="create" @submit.prevent="addEvent">
          <h4 class="create__title">Новое событие</h4>

          <div class="field combo">
            <label class="combo__label" :for="`pat-in-new`">Пациент</label>
            <div class="combo__box">
              <input
                ref="titleInput"
                :id="`pat-in-new`"
                class="combo__input"
                type="text"
                role="combobox"
                autocomplete="off"
                aria-autocomplete="list"
                aria-controls="pat-list"
                :aria-expanded="isPatientOpen(form) ? 'true' : 'false'"
                :aria-activedescendant="
                  isPatientOpen(form) ? `pat-opt-${pat.active}` : undefined
                "
                :value="comboValue(form)"
                :placeholder="
                  isPatientOpen(form) && form.title
                    ? form.title
                    : 'Фамилия, имя или телефон'
                "
                @focus="openPatient(form)"
                @click="openPatient(form)"
                @input="onPatientInput(form, $event)"
                @keydown="onPatientKeydown($event, form)"
                @blur="closePatient"
              />
              <svg
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
            </div>
            <div
              v-if="
                patientOf(form) &&
                !isPatientOpen(form) &&
                !isAddingPatient(form)
              "
              class="combo__phone"
            >
              <template v-if="!isEditingPhone(form)">
                <span>Телефон: {{ patientOf(form).phone }}</span>
                <button
                  v-if="!panelReadonly"
                  class="linkbtn"
                  type="button"
                  :aria-label="`Изменить телефон: ${patientOf(form).name}`"
                  @click="startEditPhone(form)"
                >
                  Изменить
                </button>
              </template>
              <div
                v-else
                class="newpat phoneedit"
                role="group"
                aria-label="Изменение телефона"
              >
                <label class="field">
                  <span>Номер телефона</span>
                  <input
                    :id="`phone-edit-new`"
                    :value="phoneEdit.value"
                    @input="onMaskInput($event, phoneEdit, 'value')"
                    type="tel"
                    inputmode="tel"
                    maxlength="24"
                    autocomplete="off"
                    placeholder="+7 (900) 000-00-00"
                    @keydown.enter.prevent="savePhone(form)"
                  />
                </label>
                <p v-if="phoneEdit.error" class="field-error" role="alert">
                  {{ phoneEdit.error }}
                </p>
                <div class="newpat__actions">
                  <button
                    class="btn btn--ghost"
                    type="button"
                    @click="cancelEditPhone"
                  >
                    Отмена
                  </button>
                  <button
                    class="btn btn--primary"
                    type="button"
                    @click="savePhone(form)"
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            </div>

            <ul
              v-if="isPatientOpen(form)"
              id="pat-list"
              class="combo__list"
              role="listbox"
              aria-label="Пациенты"
            >
              <li
                v-for="(p, i) in patientMatches"
                :key="p.id"
                :id="`pat-opt-${i}`"
                class="combo__opt"
                :class="{
                  'is-active': i === pat.active,
                  'is-selected': p.id === form.patientId,
                }"
                role="option"
                :aria-selected="p.id === form.patientId"
                @mousedown.prevent
                @click="selectPatient(form, p)"
              >
                <span class="combo__name">{{ p.name }}</span>
                <span class="combo__tel">{{ p.phone }}</span>
              </li>
              <li
                v-if="!patientMatches.length"
                class="combo__empty"
                role="presentation"
              >
                Пациент не найден
              </li>
              <li
                :id="`pat-opt-${patientMatches.length}`"
                class="combo__opt combo__opt--add"
                :class="{ 'is-active': pat.active === patientMatches.length }"
                role="option"
                aria-selected="false"
                @mousedown.prevent
                @click="startAddPatient(form)"
              >
                +
                {{
                  pat.query.trim()
                    ? `Добавить «${pat.query.trim()}» как нового пациента`
                    : "Добавить нового пациента"
                }}
              </li>
            </ul>

            <div
              v-if="isAddingPatient(form)"
              class="newpat"
              role="group"
              aria-label="Новый пациент"
            >
              <p class="newpat__title">Новый пациент</p>
              <label class="field">
                <span>ФИО</span>
                <input
                  :id="`newpat-name-new`"
                  v-model="pat.name"
                  type="text"
                  maxlength="120"
                  autocomplete="off"
                  placeholder="Фамилия Имя Отчество"
                  @keydown.enter.prevent="savePatient"
                />
              </label>
              <label class="field">
                <span>Номер телефона</span>
                <input
                  :value="pat.phone"
                  @input="onMaskInput($event, pat, 'phone')"
                  type="tel"
                  inputmode="tel"
                  maxlength="24"
                  autocomplete="off"
                  placeholder="+7 (900) 000-00-00"
                  @keydown.enter.prevent="savePatient"
                />
              </label>
              <p v-if="pat.error" class="field-error" role="alert">
                {{ pat.error }}
              </p>
              <div class="newpat__actions">
                <button
                  class="btn btn--ghost"
                  type="button"
                  @click="cancelAddPatient"
                >
                  Отмена
                </button>
                <button
                  class="btn btn--primary"
                  type="button"
                  @click="savePatient"
                >
                  Сохранить
                </button>
              </div>
            </div>
          </div>

          <div class="details__pair">
            <label v-for="f in TIME_FIELDS" :key="f.key" class="field">
              <span>{{ f.label }}</span>
              <button
                v-if="isSmall"
                type="button"
                class="timebtn"
                :class="{ 'timebtn--empty': !form[f.key] }"
                :aria-label="`${f.label}: ${form[f.key] || 'не задано'}`"
                @click="openPicker(form, f, $event)"
              >
                <span>{{ form[f.key] || "Выбрать" }}</span>
                <svg
                  viewBox="0 0 20 20"
                  width="20"
                  height="20"
                  aria-hidden="true"
                >
                  <circle
                    cx="10"
                    cy="10"
                    r="7.25"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.7"
                  />
                  <path
                    d="M10 5.8V10l2.8 1.8"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.7"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </button>
              <input
                v-else
                v-model="form[f.key]"
                type="time"
                :min="minFor(form, f.key)"
              />
            </label>
          </div>
          <p v-if="formEndError" class="field-error" role="alert">
            Конец раньше начала
          </p>
          <p v-if="formPastError" class="field-error" role="alert">
            {{ formPastError }}
          </p>

          <label class="field">
            <span>Место</span>
            <input
              v-model="form.location"
              type="text"
              maxlength="80"
              placeholder="Кабинет, адрес или онлайн"
              autocomplete="off"
            />
          </label>

          <label class="field">
            <span>Исполнитель</span>
            <select
              :value="form.performer"
              @change="setPerformer(form, $event.target.value)"
            >
              <option value="">Не выбран</option>
              <option v-for="n in performerOptions(form)" :key="n" :value="n">
                {{ n }}
              </option>
            </select>
          </label>

          <fieldset class="field">
            <legend>Ассистент</legend>
            <ul v-if="form.assistants.length" class="tags">
              <li v-for="n in form.assistants" :key="n" class="tag">
                <span>{{ n }}</span>
                <button
                  type="button"
                  class="tag__x"
                  :aria-label="`Убрать ассистента ${n}`"
                  @click="removeAssistant(form, n)"
                >
                  <svg
                    viewBox="0 0 20 20"
                    width="14"
                    height="14"
                    aria-hidden="true"
                  >
                    <path
                      d="m5 5 10 10M15 5 5 15"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                    />
                  </svg>
                </button>
              </li>
            </ul>
            <select
              :value="''"
              aria-label="Добавить ассистента"
              :disabled="!assistantChoices(form).length"
              @change="addAssistant(form, $event)"
            >
              <option value="">
                {{
                  assistantChoices(form).length
                    ? "Добавить ассистента…"
                    : "Все сотрудники выбраны"
                }}
              </option>
              <option v-for="n in assistantChoices(form)" :key="n" :value="n">
                {{ n }}
              </option>
            </select>
          </fieldset>

          <label class="field">
            <span>Описание</span>
            <textarea
              v-model="form.notes"
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

          <div class="create__actions">
            <button class="btn btn--ghost" type="button" @click="cancelCreate">
              Отмена
            </button>
            <button
              class="btn btn--primary"
              type="submit"
              :disabled="
                !form.title.trim() || formEndError || Boolean(formPastError)
              "
            >
              Добавить
            </button>
          </div>
        </form>

        <!-- кнопка создания: прячется, пока открыта форма или раскрыто событие -->
        <div
          class="form-wrap"
          :class="{
            'form-wrap--hidden':
              creating || expandedId !== null || panelReadonly,
          }"
          :inert="
            creating || expandedId !== null || panelReadonly ? '' : undefined
          "
        >
          <div class="form-wrap__inner">
            <button
              class="btn btn--primary btn--block"
              type="button"
              @click="startCreate"
            >
              <svg
                viewBox="0 0 20 20"
                width="18"
                height="18"
                aria-hidden="true"
              >
                <path
                  d="M10 4.5v11M4.5 10h11"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              </svg>
              Добавить событие
            </button>
          </div>
        </div>
      </div>
    </aside>

    <!-- ===== Окно выбора времени (малые экраны) ===== -->
    <div v-if="picker.open" class="picker" @click.self="closePicker">
      <div
        ref="pickerEl"
        class="picker__dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="`Выбор времени: ${picker.label}`"
        tabindex="-1"
        @keydown.esc.stop="closePicker"
        @keydown="onPickerKeydown"
      >
        <p class="picker__caption">{{ picker.label }}</p>
        <p class="picker__preview">{{ pickerPreview }}</p>

        <p class="picker__caption">Часы</p>
        <div class="picker__grid">
          <button
            v-for="h in HOURS"
            :key="h"
            type="button"
            class="picker__opt"
            :class="{ 'is-active': picker.hh === h }"
            :aria-pressed="picker.hh === h"
            :disabled="hourOff(h)"
            @click="pickHour(h)"
          >
            {{ pad(h) }}
          </button>
        </div>

        <p class="picker__caption">Минуты</p>
        <div class="picker__grid">
          <button
            v-for="m in MINUTES"
            :key="m"
            type="button"
            class="picker__opt"
            :class="{ 'is-active': picker.mm === m }"
            :aria-pressed="picker.mm === m"
            :disabled="minuteOff(m)"
            @click="picker.mm = m"
          >
            {{ pad(m) }}
          </button>
        </div>

        <div class="picker__foot">
          <button type="button" class="btn picker__clear" @click="clearPicker">
            Очистить
          </button>
          <button type="button" class="btn btn--ghost" @click="closePicker">
            Отмена
          </button>
          <button type="button" class="btn btn--primary" @click="applyPicker">
            Готово
          </button>
        </div>
      </div>
    </div>
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
  cursor: pointer; /* событие в ячейке кликабельно */
}
@media (hover: hover) {
  .chip:hover {
    background: color-mix(in srgb, var(--c) 22%, white);
  }
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

/* текущее и следующее событие в ячейке */
.chip--next {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--c) 45%, transparent);
}
.chip--current {
  background: color-mix(in srgb, var(--c) 24%, white);
  box-shadow: inset 0 0 0 1px var(--c);
  font-weight: 600;
}
.chip--current::before {
  content: "";
  flex: none;
  align-self: center;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--c);
  animation: pulse 1.8s ease-in-out infinite;
}
@keyframes pulse {
  50% {
    opacity: 0.3;
  }
}

/* свободные окна в ячейке дня: переносятся по несколько в ряд */
.day__free {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  min-width: 0;
}
.fwin {
  display: block;
  max-width: 100%;
  width: 84px;
  padding: 1px 4px;
  border: 1px dashed var(--primary-600);
  border-radius: 3px;
  background: var(--primary-50);
  color: var(--primary-700);
  font-size: 11px;
  line-height: 1.35;
  font-variant-numeric: tabular-nums;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: clip;
  cursor: pointer;
}
/* компактная и мини-плотность — когда окон много, а места мало */
.day__free--compact .fwin {
  width: 70px;
  padding: 0 3px;
  font-size: 10px;
  line-height: 12px;
}
.day__free--mini .fwin {
  width: 30px;
  padding: 0;
  font-size: 9px;
  line-height: 10px;
}
.day__free .fwin--more {
  width: auto;
  min-width: 28px;
  border-style: solid;
  border-color: var(--line);
  background: var(--paper);
  color: var(--ink-soft);
  cursor: inherit;
}
@media (hover: hover) {
  .fwin:not(.fwin--more):hover {
    background: color-mix(in srgb, var(--primary-600) 14%, white);
  }
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
  --side-gap: 14px;
  gap: var(--side-gap);
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

/* ---------- сейчас и далее ---------- */
.now {
  display: grid;
  gap: 14px;
  margin-bottom: 12px;
}
.now__group {
  display: grid;
  gap: 6px;
}
/* разделитель между плашками «Сейчас / Далее» и общим списком */
.now__divider {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ink-faint);
}
.now__divider::before,
.now__divider::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--line);
}
.now__card {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  margin: 0;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-left: 4px solid var(--c, var(--line));
  border-radius: 8px;
  background: var(--paper);
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
}
button.now__card:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
.now__card--current {
  border-color: color-mix(in srgb, var(--c) 35%, var(--line));
  border-left-color: var(--c);
  background: color-mix(in srgb, var(--c) 10%, white);
}
.now__card--empty {
  border-left-color: var(--line);
  background: var(--muted);
  cursor: default;
}
.now__label {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--ink-soft);
}
.now__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--c);
  animation: pulse 1.8s ease-in-out infinite;
}
.now__count {
  display: inline-grid;
  place-items: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--muted);
  font-size: 11px;
  letter-spacing: 0;
  color: var(--ink-soft);
}
.now__where {
  font-size: 13px;
  color: var(--ink-faint);
  overflow-wrap: anywhere;
}
.now__title {
  font-size: 15px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.now__meta {
  font-size: 13px;
  color: var(--ink-soft);
  font-variant-numeric: tabular-nums;
}
.now__card--empty .now__meta {
  color: var(--ink-faint);
}
.badge {
  display: inline-block;
  padding: 0 7px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  line-height: 18px;
}
.badge--now {
  background: color-mix(in srgb, var(--c) 18%, white);
  color: var(--text-1);
  box-shadow: inset 0 0 0 1px var(--c);
}
.badge--next {
  background: var(--muted);
  color: var(--ink-soft);
}
.item--current {
  box-shadow: 0 2px 10px color-mix(in srgb, var(--c) 25%, transparent);
}

/* ---------- свободные окна ---------- */
.free {
  margin-top: 16px;
}
.list + .free,
.empty + .free {
  padding-top: 14px;
  border-top: 1px solid var(--line);
}
.free__title {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-soft);
}
.free__list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.free__btn {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 44px;
  padding: 0 12px;
  border: 1px dashed var(--primary-600);
  border-radius: 8px;
  background: var(--primary-50);
  color: var(--primary-700);
  font: inherit;
  font-size: 15px;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s;
}
.free__btn svg {
  flex: none;
  margin-left: auto;
}
.free__btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
@media (hover: hover) {
  .free__btn:hover {
    background: color-mix(in srgb, var(--primary-600) 14%, white);
  }
}
.free__range {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.free__len {
  font-size: 13px;
  color: var(--ink-soft);
}
.free__none {
  margin: 0;
  font-size: 14px;
  color: var(--ink-faint);
}

/* ---------- создание события ---------- */
.form-wrap {
  flex: none;
  display: grid;
  grid-template-rows: 1fr;
  margin-top: 0;
  border-top: 1px solid var(--line);
  transition: grid-template-rows 0.28s cubic-bezier(0.32, 0.72, 0, 1),
    margin-top 0.28s cubic-bezier(0.32, 0.72, 0, 1), border-color 0.28s,
    visibility 0s;
}
.form-wrap--hidden {
  grid-template-rows: 0fr;
  margin-top: calc(
    var(--side-gap, 14px) * -1
  ); /* убираем лишний gap, когда блок свёрнут */
  border-top-color: transparent;
  visibility: hidden;
  transition: grid-template-rows 0.28s cubic-bezier(0.32, 0.72, 0, 1),
    margin-top 0.28s cubic-bezier(0.32, 0.72, 0, 1), border-color 0.28s,
    visibility 0s 0.28s;
}
.form-wrap__inner {
  min-height: 0;
  overflow: hidden;
  padding: 14px 4px 4px;
  margin: 0 -4px;
}
.btn--block {
  width: 100%;
}

/* форма нового события: список скрыт, форма занимает панель и прокручивается */
.side--creating .side__scroll {
  display: none;
}
.create {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  margin: 0 -4px;
  padding: 2px 4px 4px;
  animation: pop 0.22s ease-out;
}
.create__title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.create__actions {
  position: sticky;
  bottom: 0;
  display: flex;
  gap: 8px;
  margin-top: auto;
  padding-top: 10px;
  background: var(--bg);
}
.create__actions .btn {
  flex: 1;
}

/* кнопка выбора времени на малых экранах */
.timebtn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  width: 100%;
  min-width: 0;
  height: 44px;
  padding: 0 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--paper);
  color: var(--ink);
  font: inherit;
  font-size: 16px;
  font-variant-numeric: tabular-nums;
  text-align: left;
  cursor: pointer;
}
.timebtn svg {
  flex: none;
  color: var(--text-3);
}
.timebtn--empty span {
  color: var(--text-3);
}
.timebtn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
  border-color: transparent;
}

/* ---------- окно выбора времени ---------- */
.picker {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgba(15, 23, 42, 0.45);
}
.picker__dialog {
  width: 100%;
  max-width: 340px;
  max-height: 100%;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 18px;
  border-radius: 14px;
  background: var(--surface);
  box-shadow: 0 16px 48px rgba(15, 23, 42, 0.3);
  outline: none;
  animation: pop 0.18s ease-out;
}
.picker__caption {
  margin: 14px 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}
.picker__caption:first-child {
  margin-top: 0;
}
.picker__preview {
  margin: 0;
  font-size: 44px;
  line-height: 1.1;
  font-weight: 700;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--primary-600);
}
.picker__grid {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 6px;
}
.picker__opt {
  height: 42px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-1);
  font: inherit;
  font-size: 15px;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}
.picker__opt.is-active {
  border-color: var(--primary-600);
  background: var(--primary-600);
  color: #fff;
  font-weight: 600;
}
.picker__opt:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.picker__opt:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
@media (hover: hover) {
  .picker__opt:not(.is-active):not(:disabled):hover {
    background: var(--primary-50);
  }
}
.picker__foot {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 18px;
}
.picker__clear {
  margin-right: auto;
  padding: 0 8px;
  color: var(--text-2);
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
.field input[type="tel"],
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
.field select {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  -webkit-appearance: none;
  appearance: none;
  height: 44px;
  padding: 0 36px 0 12px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background-color: var(--paper);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath d='m5 7.5 5 5 5-5' fill='none' stroke='%2364748b' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-size: 18px;
  color: var(--ink);
  font: inherit;
  font-size: 16px;
  text-overflow: ellipsis;
  cursor: pointer;
}
.field select:disabled {
  color: var(--ink-faint);
  background-color: var(--muted);
  cursor: not-allowed;
}
/* выбранные ассистенты */
.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.tag {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-height: 34px;
  max-width: 100%;
  padding: 0 4px 0 12px;
  border: 1px solid color-mix(in srgb, var(--primary-600) 35%, var(--line));
  border-radius: 999px;
  background: var(--primary-50);
  color: var(--primary-700);
  font-size: 14px;
  font-weight: 500;
}
.tag > span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tag__x {
  flex: none;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  margin: 0;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: none;
  color: inherit;
  cursor: pointer;
}
.tag__x:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
@media (hover: hover) {
  .tag__x:hover {
    background: color-mix(in srgb, var(--primary-600) 16%, white);
  }
}
/* поиск пациента: список раскрывается под полем и сдвигает содержимое (не обрезается панелью) */
.field > .combo__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--ink-soft);
}
.combo__box {
  position: relative;
}
.combo__box svg {
  position: absolute;
  top: 50%;
  right: 10px;
  margin-top: -9px;
  color: var(--text-3);
  pointer-events: none;
}
.field input.combo__input {
  padding-right: 36px;
  text-overflow: ellipsis;
}
.combo__phone {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 12px;
  margin: 0;
  font-size: 13px;
  color: var(--ink-soft);
  font-variant-numeric: tabular-nums;
}
.phoneedit {
  flex: 1 1 100%;
}
/* кнопка-ссылка «Изменить» */
.linkbtn {
  min-height: 32px;
  margin: 0;
  padding: 0 4px;
  border: 0;
  border-radius: 4px;
  background: none;
  color: var(--primary-600);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}
.linkbtn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
@media (hover: hover) {
  .linkbtn:hover {
    color: var(--primary-700);
  }
}
.combo__list {
  margin: 0;
  padding: 4px;
  max-height: 220px;
  overflow-y: auto;
  overscroll-behavior: contain;
  list-style: none;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--paper);
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.08);
}
.combo__opt {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 44px;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 15px;
  cursor: pointer;
}
.combo__opt.is-active {
  background: var(--primary-50);
}
.combo__opt.is-selected .combo__name {
  font-weight: 700;
}
.combo__name {
  min-width: 0;
  overflow-wrap: anywhere;
}
.combo__tel {
  flex: none;
  font-size: 13px;
  color: var(--ink-soft);
  font-variant-numeric: tabular-nums;
}
.combo__opt--add {
  justify-content: flex-start;
  margin-top: 4px;
  border-top: 1px solid var(--line);
  border-radius: 0 0 6px 6px;
  color: var(--primary-700);
  font-weight: 600;
}
.combo__empty {
  padding: 10px;
  font-size: 14px;
  color: var(--ink-faint);
}
@media (hover: hover) {
  .combo__opt:hover {
    background: var(--muted);
  }
  .combo__opt.is-active:hover {
    background: var(--primary-50);
  }
}
/* форма нового пациента */
.newpat {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  border: 1px dashed var(--primary-600);
  border-radius: 8px;
  background: var(--primary-50);
}
.newpat__title {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
}
.newpat__actions {
  display: flex;
  gap: 8px;
}
.newpat__actions .btn {
  flex: 1;
}
.field input:focus-visible,
.field textarea:focus-visible,
.field select:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 1px;
  border-color: transparent;
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

/* прошедшие дни — только просмотр */
.day--past .day__num {
  color: var(--ink-faint);
}
.day--past.day--today .day__num {
  color: #fff;
}
.side__ro {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 2px 10px 2px 8px;
  border-radius: 999px;
  background: var(--muted);
  color: var(--ink-soft);
  font-size: 12px;
  font-weight: 600;
}
.details__ro {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}
.details__ro:disabled :is(input, select, textarea) {
  background-color: var(--muted);
  color: var(--ink);
  -webkit-text-fill-color: var(--ink);
  opacity: 1;
  cursor: default;
}
.details__ro:disabled textarea {
  resize: none;
}
.details__ro:disabled select {
  background-image: none;
  padding-right: 12px;
}
.details__ro:disabled .combo__box svg,
.details__ro:disabled .tag__x {
  display: none;
}
.details__ro:disabled .tag {
  padding-right: 12px;
}
.details__ro:disabled .timebtn {
  background: var(--muted);
  color: var(--ink);
  cursor: default;
}
.details__ro:disabled .swatch,
.details__ro:disabled .swatch input {
  cursor: default;
}
.details__ro:disabled .swatch:not(:has(input:checked)) {
  display: none;
}
.item__check input:disabled,
.item__check:has(input:disabled) {
  cursor: default;
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
    --side-gap: 18px;
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
  /* на телефоне: текущее — кольцо вокруг точки, следующее — пунктирное кольцо */
  .chip--current::before {
    display: none;
  }
  .chip--current {
    box-shadow: 0 0 0 2px #fff, 0 0 0 3.5px var(--c);
  }
  .chip--next {
    box-shadow: none;
    outline: 1px dashed var(--c);
    outline-offset: 1.5px;
  }
  .day__more {
    padding: 0;
    font-size: 10px;
    line-height: 7px;
  }
  /* свободные окна на телефоне — компактные плашки с временем начала */
  .day__free {
    flex: 0 0 100%;
    justify-content: center;
  }
  .fwin {
    width: 34px;
    padding: 0;
    font-size: 10px;
    line-height: 12px;
  }
  .day__free .fwin--more {
    width: auto;
    min-width: 22px;
    padding: 0 3px;
  }
  .side {
    padding-inline: 14px;
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
    --side-gap: 10px;
  }
  .side__scroll {
    flex: none;
    overflow: visible;
  }
  .create {
    flex: none;
    overflow: visible;
  }
  .create__actions {
    position: static;
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
  .create,
  .picker__dialog,
  .free__btn,
  .chip--current::before,
  .now__dot,
  .swatch span {
    transition: none !important;
    animation: none !important;
  }
}
</style>
