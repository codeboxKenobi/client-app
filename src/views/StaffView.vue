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

const props = defineProps({
  staff: {
    type: Array,
    default: () => [
      {
        id: 1,
        fullName: "Иванова Анна Сергеевна",
        phone: "+7 (916) 123-45-67",
        email: "ivanova@clinic.ru",
        hireDate: "2021-03-15",
        fireDate: "",
        position: "Врач-терапевт",
        role: "Руководитель",
      },
      {
        id: 2,
        fullName: "Петров Дмитрий Олегович",
        phone: "+7 (925) 765-43-21",
        email: "petrov@clinic.ru",
        hireDate: "2019-09-01",
        fireDate: "2024-06-30",
        position: "Врач-хирург",
        role: "Сотрудник",
      },
      {
        id: 3,
        fullName: "Смирнова Елена Игоревна",
        phone: "+7 (903) 555-12-34",
        email: "smirnova@clinic.ru",
        hireDate: "2023-01-10",
        fireDate: "",
        position: "Медсестра",
        role: "Сотрудник",
      },
    ],
  },
});

// Поддерживает v-model:staff, а также события add / edit / remove
const emit = defineEmits(["update:staff", "add", "edit", "remove"]);

const positions = [
  "Врач-терапевт",
  "Врач-хирург",
  "Медсестра",
  "Администратор",
  "Лаборант",
  "Менеджер",
];
const roles = [
  "Администратор системы",
  "Руководитель",
  "Сотрудник",
  "Наблюдатель",
];

// Локальная копия: компонент работает и без v-model у родителя
const items = ref([]);
watch(
  () => props.staff,
  (v) => {
    items.value = v.map((p) => ({ ...p }));
  },
  { immediate: true, deep: true }
);

/* ---------- Фильтры (панель как в календаре) ---------- */
const search = ref(""); // ФИО или email
const phoneFilter = ref(""); // любая часть номера
const statusFilter = ref("");
const positionFilter = ref("");
const filtersOpen = ref(true); // на планшетах и телефонах панель свёрнута (см. onMounted)

const digitsOf = (v) => String(v ?? "").replace(/\D/g, "");

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  const d = digitsOf(phoneFilter.value);
  return items.value.filter((s) => {
    if (q && ![s.fullName, s.email].join(" ").toLowerCase().includes(q))
      return false;
    if (d) {
      const phone = digitsOf(s.phone);
      // «8 912…» и «+7 912…» — один и тот же номер
      if (
        !phone.includes(d) &&
        !(d[0] === "8" && phone.includes("7" + d.slice(1)))
      )
        return false;
    }
    if (statusFilter.value === "active" && s.fireDate) return false;
    if (statusFilter.value === "fired" && !s.fireDate) return false;
    if (positionFilter.value && s.position !== positionFilter.value)
      return false;
    return true;
  });
});

// Блоки по специальности (должности): порядок как в списке positions, затем остальные; пустые блоки скрыты
const groups = computed(() => {
  const map = new Map();
  for (const p of filtered.value) {
    const key = p.position || "Без должности";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(p);
  }
  const order = [
    ...positions,
    ...[...map.keys()]
      .filter((k) => !positions.includes(k))
      .sort((a, b) => a.localeCompare(b, "ru")),
  ];
  return order
    .filter((k) => map.has(k))
    .map((k) => ({ title: k, people: map.get(k) }));
});

function resetFilters() {
  search.value = "";
  phoneFilter.value = "";
  statusFilter.value = "";
  positionFilter.value = "";
}
const activeFilterCount = computed(
  () =>
    [
      search.value.trim(),
      digitsOf(phoneFilter.value),
      statusFilter.value,
      positionFilter.value,
    ].filter(Boolean).length
);
const hasFilters = computed(() => activeFilterCount.value > 0);

// Modal state
const modalOpen = ref(false);
const editingId = ref(null);
const errors = reactive({});
const emptyForm = () => ({
  fullName: "",
  phone: "",
  email: "",
  hireDate: "",
  fireDate: "",
  position: "",
  role: "",
});
const form = reactive(emptyForm());

// Delete confirm
const deleteTarget = ref(null);

const nextId = () => items.value.reduce((m, p) => Math.max(m, p.id), 0) + 1;

function openCreate() {
  editingId.value = null;
  Object.assign(form, emptyForm());
  clearErrors();
  modalOpen.value = true;
}

function openEdit(person) {
  editingId.value = person.id;
  Object.assign(form, { ...person, phone: formatPhone(person.phone) });
  clearErrors();
  modalOpen.value = true;
}

function closeModal() {
  modalOpen.value = false;
}

function clearErrors() {
  Object.keys(errors).forEach((k) => delete errors[k]);
}

function validate() {
  clearErrors();
  if (!form.fullName.trim()) errors.fullName = "Введите ФИО";
  if (!form.phone.trim()) errors.phone = "Введите номер телефона";
  else if (form.phone.replace(/\D/g, "").length < 11)
    errors.phone = "Введите номер полностью";
  if (!/^\S+@\S+\.\S+$/.test(form.email))
    errors.email = "Введите корректный email";
  if (!form.hireDate) errors.hireDate = "Укажите дату приема";
  if (form.fireDate && form.hireDate && form.fireDate < form.hireDate)
    errors.fireDate = "Дата увольнения раньше даты приема";
  if (!form.position) errors.position = "Выберите должность";
  if (!form.role) errors.role = "Выберите роль";
  return Object.keys(errors).length === 0;
}

function save() {
  if (!validate()) return;
  if (editingId.value === null) {
    const created = { id: nextId(), ...form };
    items.value.push(created);
    emit("add", created);
  } else {
    const i = items.value.findIndex((s) => s.id === editingId.value);
    if (i !== -1) {
      items.value[i] = { id: editingId.value, ...form };
      emit("edit", items.value[i]);
    }
  }
  emit(
    "update:staff",
    items.value.map((p) => ({ ...p }))
  );
  closeModal();
}

function confirmDelete() {
  const removed = deleteTarget.value;
  items.value = items.value.filter((s) => s.id !== removed.id);
  emit("remove", removed);
  emit(
    "update:staff",
    items.value.map((p) => ({ ...p }))
  );
  deleteTarget.value = null;
}

const initials = (name) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
const fmt = (d) => (d ? d.split("-").reverse().join(".") : "—");

/* ---------- Выбор даты ---------- */
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const pad = (n) => String(n).padStart(2, "0");
const toKey = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (k) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const todayKey = toKey(new Date());
const monthFmt = new Intl.DateTimeFormat("ru-RU", { month: "long" });
const monthGenFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
});

const dp = reactive({
  open: false,
  field: "",
  label: "",
  year: 0,
  month: 0,
  value: "",
  min: "",
});
const dpEl = ref(null);
let dpReturn = null;

const dpMonthLabel = computed(() => {
  const n = monthFmt.format(new Date(dp.year, dp.month, 1));
  return n.charAt(0).toUpperCase() + n.slice(1);
});
const dpMonthName = (key) =>
  monthGenFmt.format(fromKey(key)).replace(/^\d+\s/, "");
const dpTodayDisabled = computed(() => !!dp.min && todayKey < dp.min);

const dpCells = computed(() => {
  const first = new Date(dp.year, dp.month, 1);
  const offset = (first.getDay() + 6) % 7; // неделя с понедельника
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(dp.year, dp.month, 1 - offset + i);
    const key = toKey(d);
    return {
      key,
      day: d.getDate(),
      outside: d.getMonth() !== dp.month,
      isToday: key === todayKey,
      disabled: !!dp.min && key < dp.min, // дата увольнения не раньше даты приема
    };
  });
});

function openDatePicker(field, label, e) {
  dpReturn = e?.currentTarget ?? null;
  dp.field = field;
  dp.label = label;
  dp.value = form[field] || "";
  dp.min = field === "fireDate" ? form.hireDate || "" : "";
  const base = dp.value
    ? fromKey(dp.value)
    : dp.min && dp.min > todayKey
    ? fromKey(dp.min)
    : new Date();
  dp.year = base.getFullYear();
  dp.month = base.getMonth();
  dp.open = true;
  nextTick(() => dpEl.value?.focus({ preventScroll: true }));
}
function closeDatePicker() {
  dp.open = false;
  nextTick(() => dpReturn?.focus?.({ preventScroll: true }));
}
function shiftDpMonth(delta) {
  const d = new Date(dp.year, dp.month + delta, 1);
  dp.year = d.getFullYear();
  dp.month = d.getMonth();
}
function pickDate(key) {
  form[dp.field] = key;
  delete errors[dp.field];
  if (dp.field === "hireDate") delete errors.fireDate;
  closeDatePicker();
}
function clearDatePicker() {
  form[dp.field] = "";
  closeDatePicker();
}
// Tab не уходит из окна выбора
function onDpKeydown(e) {
  if (e.key !== "Tab" || !dpEl.value) return;
  const items = [...dpEl.value.querySelectorAll("button:not([disabled])")];
  if (!items.length) return;
  const first = items[0],
    last = items[items.length - 1];
  const active = document.activeElement;
  if (e.shiftKey && (active === first || active === dpEl.value)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}

/* ---------- Esc закрывает верхнее открытое окно ---------- */
function onKeydown(e) {
  if (e.key !== "Escape") return;
  if (dp.open) closeDatePicker();
  else if (deleteTarget.value) deleteTarget.value = null;
  else if (modalOpen.value) closeModal();
}
onMounted(() => {
  // как в календаре: на планшетах и телефонах (до 1024px) панель фильтров свёрнута
  filtersOpen.value = !window.matchMedia("(max-width: 1024px)").matches;
  window.addEventListener("keydown", onKeydown);
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));

/* ---------- Маска телефона: +7 (900) 000-00-00 ---------- */
function formatPhone(value) {
  let d = String(value ?? "").replace(/\D/g, "");
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

function onPhoneInput(e) {
  const el = e.target;
  const atEnd = el.selectionStart === el.value.length;
  const digitsBefore = el.value
    .slice(0, el.selectionStart)
    .replace(/\D/g, "").length;
  const formatted = formatPhone(el.value);
  el.value = formatted;
  form.phone = formatted;
  delete errors.phone;
  if (atEnd) return;
  // возвращаем курсор после того же количества цифр
  let seen = 0,
    pos = 0;
  while (pos < formatted.length && seen < digitsBefore)
    if (/\d/.test(formatted[pos++])) seen++;
  el.setSelectionRange(pos, pos);
}
</script>

<template>
  <div class="page">
    <!-- Шапка: как у календаря — заголовок слева, кнопки справа -->
    <header class="page__head">
      <h1 class="page__title">Персонал</h1>

      <div class="page__actions">
        <button
          class="btn btn--ghost filters-btn"
          type="button"
          aria-controls="staff-filters"
          :aria-expanded="filtersOpen ? 'true' : 'false'"
          :aria-label="
            activeFilterCount
              ? `Фильтры, включено: ${activeFilterCount}`
              : 'Фильтры'
          "
          @click="filtersOpen = !filtersOpen"
        >
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
            <path
              d="M3.5 5h13l-5 6v4.5l-3 1.5V11z"
              fill="none"
              stroke="currentColor"
              stroke-width="1.7"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span class="filters-btn__text">Фильтры</span>
          <span
            v-if="activeFilterCount"
            class="filters-btn__badge"
            aria-hidden="true"
            >{{ activeFilterCount }}</span
          >
        </button>

        <button class="btn btn--primary" type="button" @click="openCreate">
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
            <path
              d="M10 4.5v11M4.5 10h11"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
          <span class="add__full">Добавить сотрудника</span>
          <span class="add__short">Добавить</span>
        </button>
      </div>
    </header>

    <!-- Панель фильтров: та же, что в календаре -->
    <div
      v-show="filtersOpen"
      id="staff-filters"
      class="filters"
      role="search"
      aria-label="Фильтры сотрудников"
    >
      <label class="filters__field">
        <span>ФИО или email</span>
        <input
          v-model="search"
          type="search"
          placeholder="Фамилия, имя или email"
          autocomplete="off"
        />
      </label>
      <label class="filters__field">
        <span>Номер телефона</span>
        <input
          v-model="phoneFilter"
          type="tel"
          inputmode="tel"
          placeholder="Любая часть номера"
          autocomplete="off"
        />
      </label>
      <label class="filters__field">
        <span>Должность</span>
        <select v-model="positionFilter">
          <option value="">Все должности</option>
          <option v-for="o in positions" :key="o" :value="o">{{ o }}</option>
        </select>
      </label>
      <label class="filters__field">
        <span>Статус</span>
        <select v-model="statusFilter">
          <option value="">Все статусы</option>
          <option value="active">Работают</option>
          <option value="fired">Уволены</option>
        </select>
      </label>
      <div class="filters__foot">
        <span class="filters__count" aria-live="polite">{{
          hasFilters ? `Найдено: ${filtered.length} из ${items.length}` : ""
        }}</span>
        <button
          class="btn btn--ghost filters__reset"
          type="button"
          :disabled="!hasFilters"
          @click="resetFilters"
        >
          Сбросить
        </button>
      </div>
    </div>

    <p v-if="!filtered.length" class="empty">
      {{
        items.length
          ? "Ничего не найдено. Измените запрос или фильтры."
          : "Список пуст. Добавьте первого сотрудника."
      }}
    </p>

    <section
      v-for="(g, gi) in groups"
      :key="g.title"
      class="group"
      :aria-labelledby="`group-${gi}`"
    >
      <header class="group__head">
        <h2 :id="`group-${gi}`" class="group__title">{{ g.title }}</h2>
        <span class="group__count">{{ g.people.length }}</span>
      </header>
      <div class="grid">
        <article
          v-for="p in g.people"
          :key="p.id"
          class="card"
          :class="{ 'card--active': !p.fireDate }"
        >
          <div class="card__top">
            <div class="avatar">{{ initials(p.fullName) }}</div>
            <div class="card__title">
              <h3>{{ p.fullName }}</h3>
              <span class="muted">{{ p.role }}</span>
            </div>
            <span
              class="badge"
              :class="p.fireDate ? 'badge--off' : 'badge--on'"
            >
              {{ p.fireDate ? "Уволен" : "Работает" }}
            </span>
          </div>

          <dl class="card__info">
            <div>
              <dt>Телефон</dt>
              <dd>{{ p.phone }}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>
                <a :href="'mailto:' + p.email">{{ p.email }}</a>
              </dd>
            </div>
            <div>
              <dt>Принят</dt>
              <dd>{{ fmt(p.hireDate) }}</dd>
            </div>
            <div>
              <dt>Уволен</dt>
              <dd>{{ fmt(p.fireDate) }}</dd>
            </div>
          </dl>

          <div class="card__footer">
            <button class="btn btn--ghost" @click="openEdit(p)">
              Редактировать
            </button>
            <button class="btn btn--danger" @click="deleteTarget = p">
              Удалить
            </button>
          </div>
        </article>
      </div>
    </section>

    <!-- Create / edit modal -->
    <div v-if="modalOpen" class="overlay" @mousedown.self="closeModal">
      <form
        class="modal"
        role="dialog"
        aria-modal="true"
        :aria-label="
          editingId === null ? 'Новый сотрудник' : 'Редактирование сотрудника'
        "
        novalidate
        @submit.prevent="save"
      >
        <h2>
          {{
            editingId === null ? "Новый сотрудник" : "Редактирование сотрудника"
          }}
        </h2>

        <label class="field field--full">
          <span>ФИО</span>
          <input
            v-model="form.fullName"
            class="input"
            :class="{ 'input--error': errors.fullName }"
            type="text"
            placeholder="Иванов Иван Иванович"
            autofocus
          />
          <small v-if="errors.fullName" class="error">{{
            errors.fullName
          }}</small>
        </label>

        <label class="field">
          <span>Номер телефона</span>
          <input
            :value="form.phone"
            class="input"
            :class="{ 'input--error': errors.phone }"
            type="tel"
            inputmode="tel"
            autocomplete="tel"
            placeholder="+7 (900) 000-00-00"
            @input="onPhoneInput"
          />
          <small v-if="errors.phone" class="error">{{ errors.phone }}</small>
        </label>

        <label class="field">
          <span>Email</span>
          <input
            v-model="form.email"
            class="input"
            :class="{ 'input--error': errors.email }"
            type="email"
            placeholder="name@company.ru"
          />
          <small v-if="errors.email" class="error">{{ errors.email }}</small>
        </label>

        <label class="field">
          <span>Дата приема на работу</span>
          <button
            type="button"
            class="input datebtn"
            :class="{
              'input--error': errors.hireDate,
              'datebtn--empty': !form.hireDate,
            }"
            :aria-label="`Дата приема на работу: ${
              form.hireDate ? fmt(form.hireDate) : 'не задана'
            }`"
            @click="openDatePicker('hireDate', 'Дата приема на работу', $event)"
          >
            <span>{{
              form.hireDate ? fmt(form.hireDate) : "Выбрать дату"
            }}</span>
            <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
              <rect
                x="3.5"
                y="4.5"
                width="13"
                height="12"
                rx="2"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
              />
              <path
                d="M3.5 8.5h13M7 3v3M13 3v3"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
              />
            </svg>
          </button>
          <small v-if="errors.hireDate" class="error">{{
            errors.hireDate
          }}</small>
        </label>

        <label class="field">
          <span>Дата увольнения</span>
          <button
            type="button"
            class="input datebtn"
            :class="{
              'input--error': errors.fireDate,
              'datebtn--empty': !form.fireDate,
            }"
            :aria-label="`Дата увольнения: ${
              form.fireDate ? fmt(form.fireDate) : 'не задана'
            }`"
            @click="openDatePicker('fireDate', 'Дата увольнения', $event)"
          >
            <span>{{
              form.fireDate ? fmt(form.fireDate) : "Выбрать дату"
            }}</span>
            <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
              <rect
                x="3.5"
                y="4.5"
                width="13"
                height="12"
                rx="2"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
              />
              <path
                d="M3.5 8.5h13M7 3v3M13 3v3"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
              />
            </svg>
          </button>
          <small v-if="errors.fireDate" class="error">{{
            errors.fireDate
          }}</small>
          <small v-else class="helper"
            >Оставьте пустым, если сотрудник работает</small
          >
        </label>

        <label class="field">
          <span>Должность</span>
          <select
            v-model="form.position"
            class="input"
            :class="{ 'input--error': errors.position }"
          >
            <option value="" disabled>Выберите должность</option>
            <option v-for="o in positions" :key="o" :value="o">{{ o }}</option>
          </select>
          <small v-if="errors.position" class="error">{{
            errors.position
          }}</small>
        </label>

        <label class="field">
          <span>Роль</span>
          <select
            v-model="form.role"
            class="input"
            :class="{ 'input--error': errors.role }"
          >
            <option value="" disabled>Выберите роль</option>
            <option v-for="o in roles" :key="o" :value="o">{{ o }}</option>
          </select>
          <small v-if="errors.role" class="error">{{ errors.role }}</small>
        </label>

        <div class="modal__footer field--full">
          <button type="button" class="btn btn--ghost" @click="closeModal">
            Отмена
          </button>
          <button type="submit" class="btn btn--primary">Сохранить</button>
        </div>
      </form>
    </div>

    <!-- Delete confirm -->
    <div
      v-if="deleteTarget"
      class="overlay"
      @mousedown.self="deleteTarget = null"
    >
      <div
        class="modal modal--small"
        role="dialog"
        aria-modal="true"
        aria-label="Удаление сотрудника"
      >
        <h2>Удалить сотрудника?</h2>
        <p class="muted field--full">
          Карточка «{{ deleteTarget.fullName }}» будет удалена без возможности
          восстановления.
        </p>
        <div class="modal__footer field--full">
          <button class="btn btn--ghost" @click="deleteTarget = null">
            Отмена
          </button>
          <button class="btn btn--emergency" @click="confirmDelete">
            Удалить
          </button>
        </div>
      </div>
    </div>

    <!-- Выбор даты: в стиле календаря -->
    <div v-if="dp.open" class="picker" @mousedown.self="closeDatePicker">
      <div
        ref="dpEl"
        class="picker__dialog"
        role="dialog"
        aria-modal="true"
        :aria-label="`Выбор даты: ${dp.label}`"
        tabindex="-1"
        @keydown.esc.stop="closeDatePicker"
        @keydown="onDpKeydown"
      >
        <p class="picker__caption">{{ dp.label }}</p>

        <div class="dp__head">
          <p class="dp__month">
            {{ dpMonthLabel }} <span>{{ dp.year }}</span>
          </p>
          <div class="dp__nav">
            <button
              type="button"
              class="btn btn--icon"
              aria-label="Предыдущий месяц"
              @click="shiftDpMonth(-1)"
            >
              <svg
                viewBox="0 0 20 20"
                width="18"
                height="18"
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
            </button>
            <button
              type="button"
              class="btn btn--icon"
              aria-label="Следующий месяц"
              @click="shiftDpMonth(1)"
            >
              <svg
                viewBox="0 0 20 20"
                width="18"
                height="18"
                aria-hidden="true"
              >
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
        </div>

        <div class="dp__weekdays" aria-hidden="true">
          <span
            v-for="(w, i) in WEEKDAYS"
            :key="w"
            :class="{ 'is-weekend': i > 4 }"
            >{{ w }}</span
          >
        </div>
        <div class="dp__grid" role="grid">
          <button
            v-for="c in dpCells"
            :key="c.key"
            type="button"
            class="dp__day"
            :class="{
              'is-outside': c.outside,
              'is-today': c.isToday,
              'is-selected': c.key === dp.value,
            }"
            :disabled="c.disabled"
            :aria-pressed="c.key === dp.value"
            :aria-label="`${c.day} ${dpMonthName(c.key)} ${c.key.slice(0, 4)}`"
            @click="pickDate(c.key)"
          >
            {{ c.day }}
          </button>
        </div>

        <div class="picker__foot">
          <button
            type="button"
            class="btn picker__clear"
            @click="clearDatePicker"
          >
            Очистить
          </button>
          <button
            type="button"
            class="btn btn--ghost"
            :disabled="dpTodayDisabled"
            @click="pickDate(todayKey)"
          >
            Сегодня
          </button>
          <button type="button" class="btn btn--ghost" @click="closeDatePicker">
            Отмена
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  --primary-600: #0f766e;
  --primary-700: #115e59;
  --primary-50: #f0fdfa;
  --accent-blue: #005a9c;
  --bg: #f8fafc;
  --surface: #ffffff;
  --muted-bg: #f1f5f9;
  --border: #e2e8f0;
  --text-1: #0f172a;
  --text-2: #475569;
  --text-3: #64748b;
  --success: #10b981;
  --warning: #f59e0b;
  --error: #ef4444;
  --emergency: #dc2626;

  min-height: 100%;
  padding: 24px;
  background: var(--bg);
  color: var(--text-2);
  font-family: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  box-sizing: border-box;
  -webkit-tap-highlight-color: transparent;
}
.page *,
.page *::before,
.page *::after {
  box-sizing: border-box;
}

/* Отступы по краям как в календаре: 24px / 20px / 12px 10px */
@media (max-width: 1024px) {
  .page {
    padding: 20px;
  }
}
@media (max-width: 640px) {
  .page {
    padding: 12px 10px 14px;
  }
}

h1,
h2,
h3 {
  margin: 0;
  color: var(--text-1);
}
h1 {
  font-size: clamp(24px, 4vw, 34px);
  line-height: 1.1;
  font-weight: 700;
  letter-spacing: -0.02em;
}
h3 {
  font-size: 15px;
  font-weight: 600;
}
.muted {
  color: var(--text-3);
  font-size: 14px;
  margin: 4px 0 0;
}

/* Шапка — как у календаря */
.page__head {
  display: flex;
  flex-wrap: nowrap;
  min-height: 44px;
  align-items: center;
  justify-content: space-between;
  gap: 12px 16px;
  margin-bottom: 20px;
}
.page__actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}
.add__short {
  display: none;
}

/* ---------- Панель фильтров (как в календаре) ---------- */
.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 10px 12px;
  margin-bottom: 20px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
}
.filters__field {
  display: flex;
  flex: 1 1 170px;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.filters__field > span {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
}
.filters__field input,
.filters__field select {
  width: 100%;
  min-width: 0;
  height: 40px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background-color: var(--surface);
  color: var(--text-1);
  font: inherit;
  font-size: 14px;
  -webkit-appearance: none;
  appearance: none;
}
.filters__field input::placeholder {
  color: var(--text-3);
}
.filters__field select {
  padding-right: 34px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath d='m5 7.5 5 5 5-5' fill='none' stroke='%2364748b' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 9px center;
  background-size: 18px;
  text-overflow: ellipsis;
  cursor: pointer;
}
.filters__field input:focus-visible,
.filters__field select:focus-visible {
  outline: 2px solid var(--primary-600);
  outline-offset: 1px;
  border-color: transparent;
}
.filters__foot {
  flex: 1 1 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.filters__count {
  font-size: 13px;
  color: var(--text-2);
}
.filters__reset {
  height: 44px;
  flex: none;
}
.filters-btn {
  position: relative;
}
.filters-btn__badge {
  display: inline-grid;
  place-items: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--primary-600);
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}
.btn:disabled {
  background: var(--muted-bg);
  color: var(--text-3);
  border-color: var(--border);
  cursor: not-allowed;
}
@media (max-width: 1024px) {
  .filters__field input,
  .filters__field select {
    font-size: 16px; /* чтобы iOS не приближал страницу при фокусе */
  }
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}
/* пустое состояние — как в панели дня календаря */
.empty {
  margin: 0 0 20px;
  padding: 16px;
  border: 1px dashed var(--text-3);
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-2);
}

/* Card */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-left: 4px solid var(--text-3); /* цветная полоска слева — как у событий календаря */
  border-radius: 8px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  transition: border-color 0.15s, background-color 0.15s;
}
.card--active {
  background: var(--primary-50);
  border-color: color-mix(in srgb, var(--primary-600) 35%, var(--border));
  border-left-color: var(--primary-600);
}
.card:not(.card--active) {
  background: var(--surface);
}
.card__top {
  display: flex;
  align-items: center;
  gap: 12px;
}
.card__title {
  flex: 1;
  min-width: 0;
}
.card__title h3 {
  overflow-wrap: anywhere;
}
.avatar {
  width: 44px;
  height: 44px;
  flex: none;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: var(--primary-600);
  color: #fff;
  font-weight: 600;
  font-size: 15px;
}
.card:not(.card--active) .avatar {
  background: var(--muted-bg);
  color: var(--text-3);
}

.badge {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 999px;
  white-space: nowrap;
}
.badge--on {
  background: color-mix(in srgb, var(--success) 18%, white);
  color: var(--text-1);
  box-shadow: inset 0 0 0 1px var(--success);
}
.badge--off {
  background: var(--muted-bg);
  color: var(--text-2);
}

.card__info {
  margin: 0;
  display: grid;
  gap: 8px;
  font-size: 14px;
}
.card__info div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}
.card__info dt {
  color: var(--text-3);
}
.card__info dd {
  margin: 0;
  color: var(--text-1);
  text-align: right;
  overflow-wrap: anywhere;
}
.card__info a {
  color: var(--primary-600);
  text-decoration: none;
}
@media (hover: hover) {
  .card__info a:hover {
    color: var(--primary-700);
    text-decoration: underline;
  }
}

.card__footer {
  display: flex;
  gap: 8px;
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}

/* Buttons */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 44px;
  padding: 0 16px;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s, color 0.15s,
    opacity 0.15s;
}
.btn:focus-visible {
  outline: 2px solid var(--primary-600);
  outline-offset: 2px;
}
.btn--primary {
  background: var(--primary-600);
  color: #fff;
}
.btn--primary:active:not(:disabled) {
  background: var(--primary-700);
}
.btn--ghost {
  background: var(--surface);
  color: var(--text-1);
  border-color: var(--border);
}
.btn--danger {
  background: var(--surface);
  color: var(--error);
  border-color: var(--border);
  margin-left: auto;
}
.btn--danger:focus-visible {
  outline-color: var(--error);
}
.btn--emergency {
  background: var(--emergency);
  color: #fff;
}
@media (hover: hover) {
  .btn--primary:hover:not(:disabled) {
    background: var(--primary-700);
  }
  .btn--ghost:hover:not(:disabled) {
    background: var(--muted-bg);
  }
  .btn--danger:hover {
    background: color-mix(in srgb, var(--error) 10%, white);
  }
  .btn--emergency:hover {
    background: #b91c1c;
  }
}

/* Inputs и selects — единый стиль: высота 44px, радиус 8px, шрифт 16px (iOS не приближает страницу при фокусе) */
.input {
  display: block;
  width: 100%;
  min-width: 0;
  max-width: 100%;
  height: 44px;
  padding: 0 12px;
  -webkit-appearance: none;
  appearance: none;
  border: 1px solid var(--border);
  border-radius: 8px;
  background-color: var(--surface);
  color: var(--text-1);
  font: inherit;
  font-size: 16px;
  text-overflow: ellipsis;
}
.input::placeholder {
  color: var(--text-3);
}
.input:focus-visible {
  outline: 2px solid var(--primary-600);
  outline-offset: 1px;
  border-color: transparent;
}
.input--error {
  border-color: var(--error);
}

select.input {
  padding-right: 36px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath d='m5 7.5 5 5 5-5' fill='none' stroke='%2364748b' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-size: 18px;
  cursor: pointer;
}
select.input:disabled {
  color: var(--text-3);
  background-color: var(--muted-bg);
  cursor: not-allowed;
}

/* Modal */
.overlay {
  position: fixed;
  inset: 0;
  z-index: 150; /* выше бокового меню и его затемнения */
  background: rgba(15, 23, 42, 0.45);
  display: grid;
  place-items: center;
  padding: 16px;
  overflow-y: auto;
}
.modal {
  width: 100%;
  max-width: 640px;
  background: var(--surface);
  border-radius: 14px;
  padding: 24px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.modal--small {
  max-width: 420px;
  grid-template-columns: 1fr;
}
.modal h2 {
  grid-column: 1 / -1;
  font-size: 20px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  font-size: 14px;
}
.field > span {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}
.field--full {
  grid-column: 1 / -1;
}
.helper {
  color: var(--text-3);
  font-size: 12px;
}
.error {
  color: var(--error);
  font-size: 13px;
}
.modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

@media (max-width: 560px) {
  .modal {
    grid-template-columns: 1fr;
  }
}

/* Кнопка выбора даты — как .timebtn в календаре */
.datebtn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  text-align: left;
  cursor: pointer;
  font-variant-numeric: tabular-nums;
}
.datebtn svg {
  flex: none;
  color: var(--text-3);
}
.datebtn--empty span {
  color: var(--text-3);
}

/* Окно выбора даты — в стиле календаря */
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
  max-width: 360px;
  max-height: 100%;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 18px;
  border-radius: 14px;
  background: var(--surface);
  box-shadow: 0 16px 48px rgba(15, 23, 42, 0.3);
  outline: none;
}
.picker__caption {
  margin: 0 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}
.dp__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}
.dp__month {
  margin: 0;
  font-size: 22px;
  line-height: 1.1;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-1);
}
.dp__month span {
  font-size: 16px;
  font-weight: 400;
  color: var(--text-3);
  font-variant-numeric: tabular-nums;
}
.dp__nav {
  display: flex;
  gap: 4px;
}
.btn--icon {
  width: 44px;
  padding: 0;
  color: var(--text-2);
  background: transparent;
}
@media (hover: hover) {
  .btn--icon:hover {
    background: var(--muted-bg);
    color: var(--text-1);
  }
}

.dp__weekdays {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  padding-bottom: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
  text-align: center;
}
.dp__weekdays .is-weekend {
  color: var(--text-3);
}
.dp__grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 2px;
  padding-top: 6px;
  border-top: 1px solid var(--border);
}
.dp__day {
  height: 40px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--text-1);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}
@media (hover: hover) {
  .dp__day:hover:not(:disabled):not(.is-selected) {
    background: var(--primary-50);
  }
}
.dp__day.is-outside {
  color: var(--text-3);
  font-weight: 400;
  opacity: 0.6;
}
.dp__day.is-today:not(.is-selected) {
  box-shadow: inset 0 0 0 1.5px var(--primary-600);
  color: var(--primary-600);
}
.dp__day.is-selected {
  background: var(--primary-600);
  color: #fff;
  opacity: 1;
}
@media (hover: hover) {
  .dp__day.is-selected:hover {
    background: var(--primary-700);
  }
}
.dp__day:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.dp__day:focus-visible {
  outline: 2px solid var(--primary-600);
  outline-offset: 2px;
}

.picker__foot {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}
.picker__clear {
  margin-right: auto;
  padding: 0 8px;
  color: var(--text-2);
  background: transparent;
}
@media (hover: hover) {
  .picker__clear:hover {
    color: var(--text-1);
  }
}

/* Блоки по специальности */
.group + .group {
  margin-top: 28px;
}
.group__head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}
.group__head::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--border);
}
.group__title {
  order: 0;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.group__count {
  order: 1;
  display: inline-grid;
  place-items: center;
  min-width: 22px;
  height: 22px;
  padding: 0 7px;
  border-radius: 999px;
  background: var(--muted-bg);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
}
.group__head::after {
  order: 2;
}

/* ===== Телефоны: как в календаре ===== */
@media (max-width: 640px) {
  /* название страницы уже есть в верхней панели дашборда — в шапке остаются кнопки */
  .page__title {
    display: none;
  }
  .page__head {
    gap: 8px;
    min-height: 36px;
    margin-bottom: 12px;
  }
  .page__actions {
    flex: 1;
    gap: 4px;
  }
  .page__actions .btn {
    height: 36px;
  }
  .page__actions .btn--primary {
    flex: 1;
  }
  .filters-btn {
    width: 36px;
    padding: 0 !important;
  }
  .filters-btn__text {
    display: none;
  }
  .filters-btn__badge {
    position: absolute;
    top: -6px;
    right: -6px;
  }
  .add__full {
    display: none;
  }
  .add__short {
    display: inline;
  }
  .filters {
    flex-direction: column;
    flex-wrap: nowrap;
    align-items: stretch;
    margin-bottom: 12px;
  }
  .filters__field,
  .filters__foot {
    flex: none;
  }
  .group__title {
    font-size: 16px;
  }
  .group + .group {
    margin-top: 20px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .btn,
  .card,
  .dp__day {
    transition: none !important;
  }
}
</style>
