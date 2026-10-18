<script setup>
import {
  ref,
  reactive,
  computed,
  onMounted,
  onBeforeUnmount,
  defineProps,
  defineEmits,
} from "vue";

/* ---------- Справочники ---------- */
const ACTIONS = [
  { key: "view", label: "Просмотр" },
  { key: "create", label: "Создание" },
  { key: "edit", label: "Редактирование" },
  { key: "delete", label: "Удаление" },
];

// Пункты бокового меню и что в них можно делать
const MENU = [
  {
    id: "calendar",
    label: "Календарь",
    description:
      "Расписание приёмов по месяцам. Создание событий, выбор пациента, исполнителя и ассистентов, свободные окна, отметка о выполнении. Редактировать и удалять можно только события сегодняшнего и будущих дней.",
  },
  {
    id: "staff",
    label: "Персонал",
    description:
      "Карточки сотрудников по должностям: контакты, даты приёма и увольнения, должность и роль в системе.",
  },
  {
    id: "guide",
    label: "Руководство",
    description:
      "Инструкция по работе с системой: разделы, подсказки и ответы на частые вопросы. Страница справочная, поэтому для неё обычно достаточно просмотра.",
  },
  {
    id: "roles",
    label: "Роли",
    description:
      "Настройка прав доступа: какие действия каждая роль может выполнять в каждом разделе меню.",
  },
];

const props = defineProps({
  // Список ролей. locked: true — системная роль: все права включены, менять и удалять её нельзя,
  // чтобы не потерять доступ к настройкам.
  roles: {
    type: Array,
    default: () => [
      {
        id: "admin",
        label: "Администратор системы",
        description: "Полный доступ ко всем разделам.",
        locked: true,
      },
      {
        id: "manager",
        label: "Руководитель",
        description: "Управляет расписанием и персоналом своего подразделения.",
      },
      {
        id: "employee",
        label: "Сотрудник",
        description:
          "Работает с расписанием, личные данные коллег только читает.",
      },
      {
        id: "observer",
        label: "Наблюдатель",
        description: "Только просматривает данные, ничего не меняет.",
      },
    ],
  },
  // Начальные права: { [roleId]: { [menuId]: { view, create, edit, delete } } }.
  // Что не указано, считается выключенным.
  permissions: {
    type: Object,
    default: () => ({
      admin: {
        calendar: { view: true, create: true, edit: true, delete: true },
        staff: { view: true, create: true, edit: true, delete: true },
        guide: { view: true, create: true, edit: true, delete: true },
        roles: { view: true, create: true, edit: true, delete: true },
      },
      manager: {
        calendar: { view: true, create: true, edit: true, delete: true },
        staff: { view: true, create: true, edit: true, delete: false },
        guide: { view: true },
        roles: { view: true },
      },
      employee: {
        calendar: { view: true, create: true, edit: true, delete: false },
        staff: { view: true },
        guide: { view: true },
      },
      observer: {
        calendar: { view: true },
        staff: { view: true },
        guide: { view: true },
      },
    }),
  },
});

// Поддерживает v-model:roles и v-model:permissions, а также событие save
const emit = defineEmits(["update:roles", "update:permissions", "save"]);

/* ---------- Состояние ---------- */
const blankRow = () => ({
  view: false,
  create: false,
  edit: false,
  delete: false,
});

// Строка прав для каждого пункта меню; недостающее заполняется выключенным
function rowsFor(source) {
  const out = {};
  for (const m of MENU)
    out[m.id] = { ...blankRow(), ...(source?.[m.id] ?? {}) };
  return out;
}

const roles = ref(props.roles.map((r) => ({ ...r })));

// Единственное хранилище прав: state[роль][пункт меню][действие] = true | false
const state = reactive({});
for (const r of roles.value) state[r.id] = rowsFor(props.permissions?.[r.id]);

const snapshotOf = () => JSON.stringify({ roles: roles.value, state });
const snapshot = ref(snapshotOf()); // последнее сохранённое состояние
const currentRoleId = ref(roles.value[0]?.id ?? "");

const currentRole = computed(
  () => roles.value.find((r) => r.id === currentRoleId.value) ?? roles.value[0]
);
const locked = computed(() => !!currentRole.value?.locked);
const dirty = computed(() => snapshotOf() !== snapshot.value);

/* ---------- Изменение прав ---------- */
function setAction(menuId, key, value) {
  if (locked.value) return;
  const row = state[currentRoleId.value][menuId];
  row[key] = value;
  // без просмотра остальные действия невозможны
  if (key === "view" && !value) {
    row.create = row.edit = row.delete = false;
  } else if (key !== "view" && value) {
    row.view = true;
  }
}

function allChecked(menuId) {
  return ACTIONS.every((a) => state[currentRoleId.value][menuId][a.key]);
}
function someChecked(menuId) {
  return ACTIONS.some((a) => state[currentRoleId.value][menuId][a.key]);
}
function toggleAll(menuId) {
  if (locked.value) return;
  const next = !allChecked(menuId);
  for (const a of ACTIONS) state[currentRoleId.value][menuId][a.key] = next;
}

function countOf(roleId) {
  return MENU.filter((m) => state[roleId]?.[m.id]?.view).length;
}

function save() {
  const data = JSON.parse(snapshotOf());
  snapshot.value = JSON.stringify(data);
  emit("update:roles", data.roles);
  emit("update:permissions", data.state);
  emit("save", { roles: data.roles, permissions: data.state });
}
function discard() {
  const saved = JSON.parse(snapshot.value);
  roles.value = saved.roles;
  for (const k of Object.keys(state)) delete state[k];
  for (const [id, rows] of Object.entries(saved.state)) state[id] = rows;
  if (!roles.value.some((r) => r.id === currentRoleId.value))
    currentRoleId.value = roles.value[0]?.id ?? "";
}

/* ---------- Создание, редактирование и удаление роли ---------- */
const modalOpen = ref(false);
const editingId = ref(null);
const errors = reactive({});
const form = reactive({ label: "", description: "", copyFrom: "" });
const deleteTarget = ref(null);

function clearErrors() {
  Object.keys(errors).forEach((k) => delete errors[k]);
}

function openCreate() {
  editingId.value = null;
  Object.assign(form, { label: "", description: "", copyFrom: "" });
  clearErrors();
  modalOpen.value = true;
}

function openEdit() {
  const r = currentRole.value;
  if (!r || r.locked) return;
  editingId.value = r.id;
  Object.assign(form, {
    label: r.label,
    description: r.description ?? "",
    copyFrom: "",
  });
  clearErrors();
  modalOpen.value = true;
}

function closeModal() {
  modalOpen.value = false;
}

function validate() {
  clearErrors();
  const name = form.label.trim().replace(/\s+/g, " ");
  if (!name) errors.label = "Введите название роли";
  else if (
    roles.value.some(
      (r) =>
        r.id !== editingId.value && r.label.toLowerCase() === name.toLowerCase()
    )
  )
    errors.label = "Роль с таким названием уже есть";
  return Object.keys(errors).length === 0;
}

function saveRole() {
  if (!validate()) return;
  const label = form.label.trim().replace(/\s+/g, " ");
  const description = form.description.trim();
  if (editingId.value === null) {
    const id = `role-${Date.now().toString(36)}`;
    roles.value.push({ id, label, description });
    // новая роль начинается без прав или с копии прав выбранной роли
    state[id] = form.copyFrom
      ? rowsFor(JSON.parse(JSON.stringify(state[form.copyFrom])))
      : rowsFor();
    currentRoleId.value = id;
  } else {
    const r = roles.value.find((x) => x.id === editingId.value);
    if (r) Object.assign(r, { label, description });
  }
  closeModal();
}

function askDelete() {
  const r = currentRole.value;
  if (!r || r.locked) return;
  deleteTarget.value = r;
}

function confirmDelete() {
  const removed = deleteTarget.value;
  const i = roles.value.findIndex((r) => r.id === removed.id);
  if (i === -1) return;
  roles.value.splice(i, 1);
  delete state[removed.id];
  // после удаления открываем соседнюю роль
  currentRoleId.value =
    (roles.value[i] ?? roles.value[i - 1] ?? roles.value[0])?.id ?? "";
  deleteTarget.value = null;
}

/* ---------- Esc закрывает верхнее открытое окно ---------- */
function onKeydown(e) {
  if (e.key !== "Escape") return;
  if (deleteTarget.value) deleteTarget.value = null;
  else if (modalOpen.value) closeModal();
}
onMounted(() => window.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div class="page">
    <header class="page__head">
      <h1 class="page__title">Роли</h1>

      <div class="page__actions">
        <button class="btn btn--ghost" type="button" @click="openCreate">
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
            <path
              d="M10 4.5v11M4.5 10h11"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
          <span class="add__full">Добавить роль</span>
          <span class="add__short">Роль</span>
        </button>
        <button
          class="btn btn--ghost"
          type="button"
          :disabled="!dirty"
          @click="discard"
        >
          Отменить
        </button>
        <button
          class="btn btn--primary"
          type="button"
          :disabled="!dirty"
          @click="save"
        >
          Сохранить
        </button>
      </div>
    </header>

    <!-- Выбор роли -->
    <div class="tabs" role="tablist" aria-label="Роли">
      <button
        v-for="r in roles"
        :id="`role-tab-${r.id}`"
        :key="r.id"
        class="tab"
        :class="{ 'is-active': r.id === currentRoleId }"
        type="button"
        role="tab"
        :aria-selected="r.id === currentRoleId ? 'true' : 'false'"
        aria-controls="role-panel"
        @click="currentRoleId = r.id"
      >
        <span>{{ r.label }}</span>
        <span
          class="tab__count"
          :title="`Доступно разделов: ${countOf(r.id)} из ${MENU.length}`"
        >
          {{ countOf(r.id) }}
        </span>
      </button>
    </div>

    <section
      v-if="currentRole"
      id="role-panel"
      role="tabpanel"
      :aria-labelledby="`role-tab-${currentRole.id}`"
    >
      <div class="role__head">
        <div class="role__info">
          <p class="role__desc">
            {{
              currentRole.description ||
              "Описание не указано. Его можно добавить в редактировании роли."
            }}
          </p>
          <p v-if="locked" class="role__lock">
            <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
              <path
                d="M6 9V6.5a4 4 0 0 1 8 0V9M5 9h10v7H5z"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            Системная роль: права, название и удаление недоступны
          </p>
        </div>

        <div v-if="!locked" class="role__actions">
          <button class="btn btn--ghost" type="button" @click="openEdit">
            Редактировать
          </button>
          <button class="btn btn--danger" type="button" @click="askDelete">
            Удалить
          </button>
        </div>
      </div>

      <div class="cards">
        <fieldset
          v-for="m in MENU"
          :key="m.id"
          class="card"
          :class="{ 'card--on': state[currentRole.id][m.id].view }"
          :disabled="locked"
        >
          <legend class="sr-only">{{ m.label }}</legend>

          <div class="card__top">
            <div class="card__title">
              <h2>{{ m.label }}</h2>
              <p class="card__desc">{{ m.description }}</p>
            </div>
            <button
              class="btn btn--ghost card__all"
              type="button"
              :disabled="locked"
              :aria-label="`${
                allChecked(m.id) ? 'Снять все права' : 'Выбрать все права'
              }: ${m.label}`"
              @click="toggleAll(m.id)"
            >
              {{ allChecked(m.id) ? "Снять все" : "Выбрать все" }}
            </button>
          </div>

          <div class="checks">
            <label v-for="a in ACTIONS" :key="a.key" class="check">
              <input
                type="checkbox"
                :checked="state[currentRole.id][m.id][a.key]"
                :disabled="locked"
                @change="setAction(m.id, a.key, $event.target.checked)"
              />
              <span class="check__box" aria-hidden="true"></span>
              <span class="check__label">{{ a.label }}</span>
            </label>
          </div>

          <p v-if="!locked && !someChecked(m.id)" class="card__hint">
            Раздел скрыт: без права просмотра он не появится в меню.
          </p>
        </fieldset>
      </div>
    </section>

    <p v-else class="empty">Ролей нет. Добавьте первую роль.</p>

    <!-- Создание / редактирование роли -->
    <div v-if="modalOpen" class="overlay" @mousedown.self="closeModal">
      <form
        class="modal"
        role="dialog"
        aria-modal="true"
        :aria-label="editingId === null ? 'Новая роль' : 'Редактирование роли'"
        novalidate
        @submit.prevent="saveRole"
      >
        <h2>{{ editingId === null ? "Новая роль" : "Редактирование роли" }}</h2>

        <label class="field">
          <span>Название</span>
          <input
            v-model="form.label"
            class="input"
            :class="{ 'input--error': errors.label }"
            type="text"
            maxlength="40"
            placeholder="Например, Старшая медсестра"
            autocomplete="off"
            autofocus
            @input="delete errors.label"
          />
          <small v-if="errors.label" class="error">{{ errors.label }}</small>
        </label>

        <label class="field">
          <span>Описание</span>
          <textarea
            v-model="form.description"
            class="input input--area"
            rows="3"
            maxlength="200"
            placeholder="Кто имеет эту роль и чем занимается"
          ></textarea>
        </label>

        <label v-if="editingId === null" class="field">
          <span>Скопировать права</span>
          <select v-model="form.copyFrom" class="input">
            <option value="">Без прав, настрою сам</option>
            <option v-for="r in roles" :key="r.id" :value="r.id">
              {{ r.label }}
            </option>
          </select>
          <small class="helper"
            >Права можно будет изменить после создания</small
          >
        </label>

        <div class="modal__footer">
          <button type="button" class="btn btn--ghost" @click="closeModal">
            Отмена
          </button>
          <button type="submit" class="btn btn--primary">
            {{ editingId === null ? "Создать" : "Сохранить" }}
          </button>
        </div>
      </form>
    </div>

    <!-- Подтверждение удаления -->
    <div
      v-if="deleteTarget"
      class="overlay"
      @mousedown.self="deleteTarget = null"
    >
      <div
        class="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Удаление роли"
      >
        <h2>Удалить роль?</h2>
        <p class="muted">
          Роль «{{ deleteTarget.label }}» и все её права будут удалены после
          сохранения. Сотрудникам с этой ролью нужно назначить другую.
        </p>
        <div class="modal__footer">
          <button
            class="btn btn--ghost"
            type="button"
            @click="deleteTarget = null"
          >
            Отмена
          </button>
          <button
            class="btn btn--emergency"
            type="button"
            @click="confirmDelete"
          >
            Удалить
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
  --bg: #f8fafc;
  --surface: #ffffff;
  --muted-bg: #f1f5f9;
  --border: #e2e8f0;
  --text-1: #0f172a;
  --text-2: #475569;
  --text-3: #64748b;
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
h2 {
  margin: 0;
  color: var(--text-1);
}
h1 {
  font-size: clamp(24px, 4vw, 34px);
  line-height: 1.1;
  font-weight: 700;
  letter-spacing: -0.02em;
}
h2 {
  font-size: 16px;
  font-weight: 600;
}
.muted {
  margin: 0;
  color: var(--text-3);
  font-size: 14px;
  line-height: 1.5;
}

/* Шапка */
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

/* Выбор роли */
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 16px;
}
.tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 44px;
  padding: 0 16px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
  color: var(--text-1);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.15s, border-color 0.15s, color 0.15s;
}
.tab:focus-visible {
  outline: 2px solid var(--primary-600);
  outline-offset: 2px;
}
.tab__count {
  display: inline-grid;
  place-items: center;
  min-width: 22px;
  height: 22px;
  padding: 0 7px;
  border-radius: 999px;
  background: var(--muted-bg);
  color: var(--text-2);
  font-size: 12px;
  font-weight: 600;
}
.tab.is-active {
  border-color: var(--primary-600);
  background: var(--primary-50);
  color: var(--primary-700);
}
.tab.is-active .tab__count {
  background: var(--primary-600);
  color: #fff;
}
@media (hover: hover) {
  .tab:not(.is-active):hover {
    background: var(--muted-bg);
  }
}

/* Описание роли и действия над ней */
.role__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 20px;
}
.role__info {
  min-width: 0;
}
.role__desc {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-3);
  overflow-wrap: anywhere;
}
.role__lock {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 8px 0 0;
  padding: 2px 10px 2px 8px;
  border-radius: 999px;
  background: var(--muted-bg);
  color: var(--text-2);
  font-size: 12px;
  font-weight: 600;
}
.role__actions {
  display: flex;
  flex: none;
  gap: 8px;
}

.empty {
  margin: 0;
  padding: 16px;
  border: 1px dashed var(--text-3);
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-2);
}

/* Карточки пунктов меню: одна под другой на всю ширину */
.cards {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 20px;
}
.card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  margin: 0;
  padding: 20px;
  border: 1px solid var(--border);
  border-left: 4px solid var(--text-3);
  border-radius: 8px;
  background: var(--surface);
  transition: border-color 0.15s, background-color 0.15s;
}
.card--on {
  border-color: color-mix(in srgb, var(--primary-600) 35%, var(--border));
  border-left-color: var(--primary-600);
  background: var(--primary-50);
}
.card__top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
}
.card__title {
  min-width: 0;
}
.card__desc {
  margin: 6px 0 0;
  font-size: 14px;
  line-height: 1.55;
  color: var(--text-2);
}
.card__all {
  flex: none;
}
.card__hint {
  margin: 0;
  font-size: 13px;
  color: var(--text-3);
}

/* Чекбоксы */
.checks {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}
.check {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  cursor: pointer;
}
.check input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}
.check__box {
  flex: none;
  width: 20px;
  height: 20px;
  border: 2px solid var(--text-3);
  border-radius: 6px;
  background: var(--surface);
  transition: background-color 0.15s, border-color 0.15s;
}
.check input:checked + .check__box {
  background-color: var(--primary-600);
  border-color: var(--primary-600);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath d='m5 10.5 3.2 3.2L15 6.8' fill='none' stroke='white' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-size: 100%;
}
.check input:focus-visible + .check__box {
  outline: 2px solid var(--primary-600);
  outline-offset: 2px;
}
.check__label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-1);
}
.card:disabled .check,
.card:disabled .check input {
  cursor: not-allowed;
}
.card:disabled .check input:checked + .check__box {
  opacity: 0.6;
}
.card:disabled .check__label {
  color: var(--text-2);
}

/* Кнопки */
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
.btn:disabled {
  background: var(--muted-bg);
  color: var(--text-3);
  border-color: var(--border);
  cursor: not-allowed;
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
  .btn--danger:hover:not(:disabled) {
    background: color-mix(in srgb, var(--error) 10%, white);
  }
  .btn--emergency:hover {
    background: #b91c1c;
  }
}

/* Окна создания и удаления */
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
  max-width: 480px;
  background: var(--surface);
  border-radius: 14px;
  padding: 24px;
  display: grid;
  gap: 16px;
}
.modal h2 {
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
.helper {
  color: var(--text-3);
  font-size: 12px;
}
.error {
  color: var(--error);
  font-size: 13px;
}
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
.input--area {
  height: auto;
  min-height: 84px;
  max-height: 200px;
  padding: 10px 12px;
  line-height: 1.45;
  resize: vertical;
}
select.input {
  padding-right: 36px;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath d='m5 7.5 5 5 5-5' fill='none' stroke='%2364748b' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 10px center;
  background-size: 18px;
  cursor: pointer;
}
.modal__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
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

/* ===== Телефоны ===== */
@media (max-width: 640px) {
  /* название страницы уже есть в верхней панели дашборда */
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
    flex: 1;
    padding: 0 10px;
  }
  .add__full {
    display: none;
  }
  .add__short {
    display: inline;
  }
  .tabs {
    flex-wrap: nowrap;
    overflow-x: auto;
    margin-bottom: 12px;
    padding-bottom: 2px;
  }
  .tab {
    flex: none;
    height: 40px;
  }
  .role__head {
    flex-direction: column;
    gap: 12px;
    margin-bottom: 12px;
  }
  .role__actions {
    width: 100%;
  }
  .role__actions .btn {
    flex: 1;
  }
  .cards {
    gap: 12px;
  }
  .card {
    padding: 16px;
  }
  .card__top {
    flex-direction: column;
    gap: 12px;
  }
  .card__all {
    height: 36px;
  }
  .checks {
    flex-direction: column;
    gap: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .btn,
  .tab,
  .card,
  .check__box {
    transition: none !important;
  }
}
</style>
