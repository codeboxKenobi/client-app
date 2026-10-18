<script setup>
import {
  ref,
  reactive,
  computed,
  watch,
  nextTick,
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

const search = ref("");
const statusFilter = ref("");
const positionFilter = ref("");

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase();
  return items.value.filter((s) => {
    if (
      q &&
      ![s.fullName, s.email, s.phone, s.position]
        .join(" ")
        .toLowerCase()
        .includes(q)
    )
      return false;
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
  statusFilter.value = "";
  positionFilter.value = "";
}
const hasFilters = computed(
  () => !!(search.value || statusFilter.value || positionFilter.value)
);

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
    <h1 class="page__title">Персонал</h1>

    <div class="panel" role="toolbar" aria-label="Управление персоналом">
      <input
        v-model="search"
        class="input panel__search"
        type="search"
        placeholder="Поиск по ФИО, email, телефону"
      />

      <select
        v-model="positionFilter"
        class="input panel__select"
        aria-label="Фильтр по должности"
      >
        <option value="">Все должности</option>
        <option v-for="o in positions" :key="o" :value="o">{{ o }}</option>
      </select>

      <select
        v-model="statusFilter"
        class="input panel__select"
        aria-label="Фильтр по статусу"
      >
        <option value="">Все статусы</option>
        <option value="active">Работают</option>
        <option value="fired">Уволены</option>
      </select>

      <button
        class="btn btn--ghost"
        :disabled="!hasFilters"
        @click="resetFilters"
      >
        Сбросить
      </button>

      <span class="panel__count"
        >{{ filtered.length }} из {{ items.length }}</span
      >

      <button class="btn btn--primary panel__add" @click="openCreate">
        Добавить сотрудника
      </button>
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
    <div
      v-if="modalOpen"
      class="overlay"
      @mousedown.self="closeModal"
      @keydown.esc="closeModal"
    >
      <form class="modal" novalidate @submit.prevent="save">
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
      <div class="modal modal--small">
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

  min-height: 100vh;
  padding: 24px;
  background: var(--bg);
  color: var(--text-2);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  box-sizing: border-box;
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
  font-size: 28px;
}
h3 {
  font-size: 16px;
}
.muted {
  color: var(--text-3);
  font-size: 14px;
  margin: 4px 0 0;
}

.page__title {
  margin-bottom: 20px;
}
@media (max-width: 640px) {
  .page__title {
    font-size: 20px;
    margin-bottom: 12px;
  }
}

/* Control panel: на всю ширину, без скролла, адаптивно */
.panel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 16px;
  margin-bottom: 24px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
}
.panel > * {
  min-width: 0;
}
.panel__search {
  flex: 2 1 260px;
}
.panel__select {
  flex: 1 1 180px;
  width: auto;
}
.panel__count {
  color: var(--text-3);
  font-size: 14px;
  white-space: nowrap;
}
.panel__add {
  margin-left: auto;
  white-space: nowrap;
}
.btn:disabled {
  background: var(--muted-bg);
  color: var(--text-3);
  border-color: var(--border);
  cursor: not-allowed;
}

/* Десктоп: всё в одну строку на всю ширину */
@media (min-width: 1100px) {
  .panel {
    flex-wrap: nowrap;
  }
  .panel__search {
    flex: 3 1 0;
  }
  .panel__select {
    flex: 1.2 1 0;
  }
  .panel > .btn,
  .panel__count {
    flex: none;
  }
}

/* Планшет: поиск на всю строку, ниже фильтры и кнопки */
@media (max-width: 1099px) {
  .panel__search {
    flex: 1 1 100%;
  }
  .panel__select {
    flex: 1 1 calc(50% - 6px);
  }
  .panel__count {
    flex: 1 1 auto;
  }
}

/* Телефон: всё в колонку, кнопки на всю ширину */
@media (max-width: 560px) {
  .panel {
    padding: 12px;
  }
  .panel__select {
    flex-basis: 100%;
  }
  .panel__count {
    order: 5;
    flex: 1 1 auto;
  }
  .panel > .btn {
    flex: 1 1 auto;
  }
  .panel__add {
    order: 6;
    flex: 1 1 100%;
    margin-left: 0;
  }
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 20px;
}
.empty {
  text-align: center;
  padding: 48px 0;
  color: var(--text-3);
}

/* Card */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  transition: border-color 0.15s, background-color 0.15s;
}
.card--active {
  background: var(--primary-50);
  border-color: #99f6e4;
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
  background: #d1fae5;
  color: #047857;
}
.badge--off {
  background: var(--muted-bg);
  color: var(--text-3);
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
.card__info a:hover {
  color: var(--primary-700);
  text-decoration: underline;
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
.btn--primary:hover,
.btn--primary:active {
  background: var(--primary-700);
}
.btn--ghost {
  background: var(--surface);
  color: var(--primary-600);
  border-color: var(--border);
}
.btn--ghost:hover {
  background: var(--primary-50);
  border-color: var(--primary-600);
}
.btn--danger {
  background: var(--surface);
  color: var(--error);
  border-color: var(--border);
  margin-left: auto;
}
.btn--danger:hover {
  background: #fef2f2;
  border-color: var(--error);
}
.btn--emergency {
  background: var(--emergency);
  color: #fff;
}
.btn--emergency:hover {
  background: #b91c1c;
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
.input[type="search"]::-webkit-search-cancel-button {
  -webkit-appearance: none;
}

/* Modal */
.overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
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
  border-radius: 16px;
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
.btn--icon:hover {
  background: var(--muted-bg);
  color: var(--text-1);
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
.dp__day:hover:not(:disabled):not(.is-selected) {
  background: var(--primary-50);
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
.dp__day.is-selected:hover {
  background: var(--primary-700);
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
.picker__clear:hover {
  color: var(--text-1);
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
@media (max-width: 640px) {
  .group__title {
    font-size: 16px;
  }
  .group + .group {
    margin-top: 20px;
  }
}
</style>
