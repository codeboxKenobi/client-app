<script setup>
/**
 * Универсальная форма: вход / регистрация / смена пароля.
 *
 * Использование:
 *   <AuthForm v-model:mode="mode" :loading="loading" :server-error="error" :success="ok"
 *             @submit="onSubmit" @forgot-password="goForgot" />
 *
 * mode: "login" | "registration" | "change_password" | "reset_password"
 *   reset_password — восстановление пароля по email («Забыли пароль?»)
 * Режим можно менять и снаружи (prop), и внутри (вкладки, ссылки): форма хранит своё
 * состояние и сообщает о нём через update:mode, так что v-model:mode необязателен.
 * @submit отдаёт { mode, ...данные формы }
 */
import {
  computed,
  reactive,
  ref,
  useId,
  watch,
  defineProps,
  defineEmits,
} from "vue";

const MIN_PASSWORD_LENGTH = 8;

const props = defineProps({
  mode: {
    type: String,
    default: "login",
    validator: (v) =>
      ["login", "registration", "change_password", "reset_password"].includes(
        v
      ),
  },
  loading: { type: Boolean, default: false },
  /** Ошибка от сервера, например «Неверный email или пароль» */
  serverError: { type: String, default: "" },
  /** true после успешной смены пароля */
  success: { type: Boolean, default: false },
  /** Свой текст успеха; по умолчанию зависит от режима */
  successMessage: { type: String, default: "" },
  brandName: { type: String, default: "МедПортал" },
});

const emit = defineEmits(["submit", "update:mode", "forgot-password"]);

/* ---------- Конфигурация режимов ---------- */
const MODES = {
  login: {
    title: "Вход в личный кабинет",
    subtitle: "Войдите, чтобы продолжить.",
    submit: "Войти",
    tabs: true,
    fields: [
      {
        key: "email",
        label: "Email",
        type: "email",
        autocomplete: "email",
        placeholder: "name@mail.com",
      },
      {
        key: "password",
        label: "Пароль",
        type: "password",
        autocomplete: "current-password",
      },
    ],
  },
  registration: {
    title: "Создание аккаунта",
    subtitle: "Это займёт пару минут.",
    submit: "Создать аккаунт",
    tabs: true,
    fields: [
      {
        key: "name",
        label: "Имя",
        type: "text",
        autocomplete: "name",
        placeholder: "Анна Иванова",
      },
      {
        key: "email",
        label: "Email",
        type: "email",
        autocomplete: "email",
        placeholder: "name@mail.com",
      },
      {
        key: "password",
        label: "Пароль",
        type: "password",
        autocomplete: "new-password",
        strength: true,
        hint: `Минимум ${MIN_PASSWORD_LENGTH} символов: буквы разного регистра и цифры`,
      },
      {
        key: "confirm",
        label: "Повторите пароль",
        type: "password",
        autocomplete: "new-password",
      },
    ],
  },
  reset_password: {
    title: "Восстановление пароля",
    subtitle: "Укажите email — отправим ссылку для создания нового пароля.",
    submit: "Отправить ссылку",
    tabs: false,
    fields: [
      {
        key: "email",
        label: "Email",
        type: "email",
        autocomplete: "email",
        placeholder: "name@mail.com",
      },
    ],
  },
  change_password: {
    title: "Смена пароля",
    subtitle: "Введите текущий пароль и придумайте новый.",
    submit: "Сохранить пароль",
    tabs: false,
    fields: [
      {
        key: "currentPassword",
        label: "Текущий пароль",
        type: "password",
        autocomplete: "current-password",
      },
      {
        key: "newPassword",
        label: "Новый пароль",
        type: "password",
        autocomplete: "new-password",
        strength: true,
        hint: `Минимум ${MIN_PASSWORD_LENGTH} символов: буквы разного регистра и цифры`,
      },
      {
        key: "confirm",
        label: "Повторите новый пароль",
        type: "password",
        autocomplete: "new-password",
      },
    ],
  },
};

const currentMode = ref(MODES[props.mode] ? props.mode : "login");
watch(
  () => props.mode,
  (m) => {
    if (MODES[m]) setMode(m, false);
  }
);

const config = computed(() => MODES[currentMode.value]);
const successText = computed(
  () =>
    props.successMessage ||
    (currentMode.value === "reset_password"
      ? "Ссылка для восстановления отправлена. Проверьте почту."
      : "Пароль изменён.")
);

/* ---------- Состояние формы ---------- */
const uid = useId();
const blankForm = () => ({
  name: "",
  email: "",
  password: "",
  currentPassword: "",
  newPassword: "",
  confirm: "",
  remember: true,
  agree: false,
});
const form = reactive(blankForm());
const errors = reactive({});
const visible = reactive({}); // показ пароля по ключу поля
const submitted = ref(false);

// При смене режима очищаем форму; email переносим между режимами
watch(currentMode, () => {
  const email = form.email;
  Object.assign(form, blankForm(), { email });
  Object.keys(errors).forEach((k) => delete errors[k]);
  Object.keys(visible).forEach((k) => delete visible[k]);
  submitted.value = false;
});

// После успешной смены пароля очищаем поля
watch(
  () => props.success,
  (ok) => {
    if (ok && currentMode.value === "change_password") {
      Object.assign(form, blankForm());
      submitted.value = false;
    }
  }
);

/* ---------- Надёжность пароля ---------- */
function passwordScore(p) {
  if (!p) return 0;
  let s = 0;
  if (p.length >= 8) s++;
  if (/[a-zа-я]/.test(p) && /[A-ZА-Я]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^\p{L}\d]/u.test(p) || p.length >= 14) s++;
  return s;
}
const strengthLabels = ["", "Слабый", "Средний", "Хороший", "Надёжный"];

/* ---------- Валидация ---------- */
const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

function validate() {
  const e = {};
  const m = currentMode.value;

  if (m === "login" || m === "registration" || m === "reset_password") {
    e.email = !form.email.trim()
      ? "Введите email"
      : !isEmail(form.email)
      ? "Проверьте формат email, например name@mail.com"
      : "";
  }

  if (m === "login") {
    e.password = form.password ? "" : "Введите пароль";
  }

  if (m === "registration") {
    e.name =
      form.name.trim().length >= 2 ? "" : "Введите имя (минимум 2 символа)";
    e.password =
      form.password.length >= MIN_PASSWORD_LENGTH
        ? ""
        : `Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов`;
    e.confirm = !form.confirm
      ? "Повторите пароль"
      : form.confirm !== form.password
      ? "Пароли не совпадают"
      : "";
    e.agree = form.agree ? "" : "Необходимо согласие с условиями";
  }

  if (m === "change_password") {
    e.currentPassword = form.currentPassword ? "" : "Введите текущий пароль";
    e.newPassword = !form.newPassword
      ? "Введите новый пароль"
      : form.newPassword.length < MIN_PASSWORD_LENGTH
      ? `Пароль должен быть не короче ${MIN_PASSWORD_LENGTH} символов`
      : form.newPassword === form.currentPassword
      ? "Новый пароль должен отличаться от текущего"
      : "";
    e.confirm = !form.confirm
      ? "Повторите новый пароль"
      : form.confirm !== form.newPassword
      ? "Пароли не совпадают"
      : "";
  }

  Object.keys(errors).forEach((k) => delete errors[k]);
  Object.assign(errors, e);
  return Object.values(e).every((v) => !v);
}

// После первой попытки отправки перепроверяем «вживую»
watch(form, () => {
  if (submitted.value) validate();
});

function onSubmit() {
  submitted.value = true;
  if (!validate()) return;
  const payloads = {
    login: () => ({
      email: form.email.trim(),
      password: form.password,
      remember: form.remember,
    }),
    registration: () => ({
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
    }),
    reset_password: () => ({ email: form.email.trim() }),
    change_password: () => ({
      currentPassword: form.currentPassword,
      newPassword: form.newPassword,
    }),
  };
  emit("submit", { mode: currentMode.value, ...payloads[currentMode.value]() });
}

const fieldId = (key) => `${uid}-${key}`;
function setMode(m, notify = true) {
  if (m === currentMode.value) return;
  currentMode.value = m;
  if (notify) emit("update:mode", m);
}
const switchMode = (m) => setMode(m);
function goForgot() {
  setMode("reset_password");
  emit("forgot-password");
}
</script>

<template>
  <main class="auth">
    <div class="auth__column">
      <div class="auth__brand">
        <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
          <rect width="28" height="28" rx="8" fill="#0F766E" />
          <path
            d="M14 7v14M7 14h14"
            stroke="#fff"
            stroke-width="3"
            stroke-linecap="round"
          />
        </svg>
        <span>{{ brandName }}</span>
      </div>

      <section class="auth__card">
        <div
          v-if="config.tabs"
          class="tabs"
          role="tablist"
          aria-label="Вход или регистрация"
        >
          <button
            type="button"
            role="tab"
            class="tab"
            :class="{ 'is-active': currentMode === 'login' }"
            :aria-selected="currentMode === 'login'"
            @click="switchMode('login')"
          >
            Вход
          </button>
          <button
            type="button"
            role="tab"
            class="tab"
            :class="{ 'is-active': currentMode === 'registration' }"
            :aria-selected="currentMode === 'registration'"
            @click="switchMode('registration')"
          >
            Регистрация
          </button>
        </div>

        <header class="auth__header">
          <h1>{{ config.title }}</h1>
          <p>{{ config.subtitle }}</p>
        </header>

        <form novalidate @submit.prevent="onSubmit">
          <div
            v-if="
              success &&
              (currentMode === 'change_password' ||
                currentMode === 'reset_password')
            "
            class="alert alert--success"
            role="status"
          >
            {{ successText }}
          </div>
          <div v-if="serverError" class="alert alert--error" role="alert">
            {{ serverError }}
          </div>

          <template v-for="f in config.fields" :key="`${currentMode}-${f.key}`">
            <div class="field" :class="{ 'has-error': errors[f.key] }">
              <label :for="fieldId(f.key)" class="field__label">{{
                f.label
              }}</label>
              <div class="field__control">
                <input
                  :id="fieldId(f.key)"
                  v-model="form[f.key]"
                  :type="
                    f.type === 'password' && visible[f.key] ? 'text' : f.type
                  "
                  :autocomplete="f.autocomplete"
                  :placeholder="f.placeholder"
                  :aria-invalid="!!errors[f.key]"
                  :aria-describedby="
                    errors[f.key]
                      ? `${fieldId(f.key)}-msg`
                      : f.hint
                      ? `${fieldId(f.key)}-msg`
                      : undefined
                  "
                  class="field__input"
                  :class="{ 'field__input--action': f.type === 'password' }"
                />
                <button
                  v-if="f.type === 'password'"
                  type="button"
                  class="field__toggle"
                  :aria-label="
                    visible[f.key] ? 'Скрыть пароль' : 'Показать пароль'
                  "
                  :aria-pressed="!!visible[f.key]"
                  @click="visible[f.key] = !visible[f.key]"
                >
                  <svg
                    v-if="!visible[f.key]"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path
                      d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"
                    />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <svg
                    v-else
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.8"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 3l18 18" />
                    <path
                      d="M10.6 5.1A9.9 9.9 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6A16.6 16.6 0 0 0 2 12s3.6 7 10 7c1.8 0 3.4-.5 4.8-1.2"
                    />
                    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
                  </svg>
                </button>
              </div>
              <p
                v-if="errors[f.key]"
                :id="`${fieldId(f.key)}-msg`"
                class="field__msg field__msg--error"
                role="alert"
              >
                {{ errors[f.key] }}
              </p>
              <p
                v-else-if="f.hint"
                :id="`${fieldId(f.key)}-msg`"
                class="field__msg field__msg--hint"
              >
                {{ f.hint }}
              </p>
            </div>

            <div
              v-if="f.strength && form[f.key]"
              class="strength"
              :data-score="passwordScore(form[f.key])"
              role="status"
              aria-live="polite"
            >
              <div class="strength__bars" aria-hidden="true">
                <span
                  v-for="n in 4"
                  :key="n"
                  :class="{ on: n <= passwordScore(form[f.key]) }"
                />
              </div>
              <span class="strength__label"
                >Надёжность пароля:
                {{ strengthLabels[passwordScore(form[f.key])] }}</span
              >
            </div>
          </template>

          <!-- Только вход -->
          <div v-if="currentMode === 'login'" class="row">
            <label class="check">
              <input v-model="form.remember" type="checkbox" />
              <span>Запомнить меня</span>
            </label>
            <a href="#" class="link" @click.prevent="goForgot"
              >Забыли пароль?</a
            >
          </div>

          <!-- Только регистрация -->
          <div v-if="currentMode === 'registration'" class="agree">
            <label class="check check--top">
              <input
                v-model="form.agree"
                type="checkbox"
                :aria-invalid="!!errors.agree"
              />
              <span>
                Я принимаю
                <a href="/terms" target="_blank" rel="noopener"
                  >условия использования</a
                >
                и
                <a href="/privacy" target="_blank" rel="noopener"
                  >политику конфиденциальности</a
                >
              </span>
            </label>
            <p v-if="errors.agree" class="agree__error" role="alert">
              {{ errors.agree }}
            </p>
          </div>

          <button
            class="btn"
            type="submit"
            :disabled="loading"
            :aria-busy="loading"
          >
            <span v-if="loading" class="btn__spinner" aria-hidden="true" />
            {{ config.submit }}
          </button>
        </form>
      </section>

      <p v-if="currentMode !== 'change_password'" class="auth__footer">
        <template v-if="currentMode === 'reset_password'">
          Вспомнили пароль?
          <a href="#" @click.prevent="switchMode('login')"
            >Вернуться ко входу</a
          >
        </template>
        <template v-else-if="currentMode === 'login'">
          Нет аккаунта?
          <a href="#" @click.prevent="switchMode('registration')"
            >Зарегистрироваться</a
          >
        </template>
        <template v-else>
          Уже есть аккаунт?
          <a href="#" @click.prevent="switchMode('login')">Войти</a>
        </template>
      </p>
    </div>
  </main>
</template>

<style scoped>
/* Палитра. При желании вынесите в глобальные CSS-переменные. */
.auth {
  --primary-600: #0f766e;
  --primary-700: #115e59;
  --primary-50: #f0fdfa;
  --accent-blue: #005a9c;
  --bg-default: #f8fafc;
  --bg-surface: #ffffff;
  --bg-muted: #f1f5f9;
  --text: #0f172a;
  --text-muted: #475569;
  --border: #cbd5e1;
  --danger: #b91c1c;
  --danger-bg: #fef2f2;
  --warning: #b45309;
  --focus-ring: 0 0 0 3px rgba(15, 118, 110, 0.22);

  /* Адаптивные размеры: подстраиваются под высоту экрана */
  --gap: clamp(8px, 1.7vh, 16px);
  --gap-lg: clamp(10px, 2.2vh, 22px);
  --ctl-h: clamp(38px, 5.2vh, 44px);

  height: 100vh;
  height: 100dvh;
  overflow: hidden; /* страница не скроллится */
  box-sizing: border-box;
  display: grid;
  place-items: center;
  padding: clamp(8px, 2.5vh, 32px) 16px;
  background: var(--bg-default);
  color: var(--text);
  font-family: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.auth__column {
  width: 100%;
  max-width: 420px;
  max-height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.auth__brand {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: var(--gap-lg);
  font-weight: 650;
  font-size: 18px;
}
.auth__card {
  background: var(--bg-surface);
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: clamp(14px, 3vh, 28px);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
  min-height: 0;
  overflow-y: auto; /* запасной вариант: скролл только внутри карточки на очень низких экранах */
  overscroll-behavior: contain;
}
.auth__header {
  margin-bottom: var(--gap-lg);
}
.auth__header h1 {
  margin: 0 0 6px;
  font-size: clamp(20px, 3.3vh, 24px);
  line-height: 1.25;
  letter-spacing: -0.01em;
}
.auth__header p {
  margin: 0;
  color: var(--text-muted);
  font-size: 15px;
  line-height: 1.5;
}
.auth__footer {
  flex: none;
  margin: var(--gap-lg) 0 0;
  text-align: center;
  font-size: 14px;
  color: var(--text-muted);
}
.auth__footer a,
.link,
.check a {
  color: var(--primary-600);
  font-weight: 550;
  text-decoration: none;
}
.auth__footer a:hover,
.link:hover,
.check a:hover {
  color: var(--primary-700);
  text-decoration: underline;
}

/* Вкладки */
.tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 4px;
  margin-bottom: var(--gap-lg);
  background: var(--bg-muted);
  border-radius: 10px;
}
.tab {
  padding: clamp(6px, 1.2vh, 9px) 12px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  cursor: pointer;
  font: inherit;
  font-size: 14px;
  font-weight: 550;
  color: var(--text-muted);
  transition: background 0.15s, color 0.15s;
}
.tab:hover {
  color: var(--primary-700);
}
.tab.is-active {
  background: var(--primary-50);
  color: var(--primary-600);
  box-shadow: inset 0 0 0 1px rgba(15, 118, 110, 0.25);
}
.tab:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}

/* Алерты */
.alert {
  margin-bottom: var(--gap);
  padding: 12px 14px;
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.45;
}
.alert--error {
  background: var(--danger-bg);
  color: var(--danger);
  border: 1px solid #fecaca;
}
.alert--success {
  background: var(--primary-50);
  color: var(--primary-700);
  border: 1px solid #99f6e4;
}

/* Поля */
.field {
  margin-bottom: var(--gap);
}
.field__label {
  display: block;
  margin-bottom: 6px;
  font-size: 14px;
  font-weight: 550;
}
.field__control {
  position: relative;
}
.field__input {
  width: 100%;
  box-sizing: border-box;
  height: var(--ctl-h);
  padding: 0 12px;
  font: inherit;
  font-size: 15px;
  color: var(--text);
  background: var(--bg-muted);
  border: 1px solid transparent;
  border-radius: 8px;
  transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
}
.field__input::placeholder {
  color: #94a3b8;
}
.field__input:hover {
  border-color: var(--border);
}
.field__input:focus {
  outline: none;
  background: var(--bg-surface);
  border-color: var(--primary-600);
  box-shadow: var(--focus-ring);
}
.field__input--action {
  padding-right: 46px;
}
.has-error .field__input {
  background: var(--bg-surface);
  border-color: var(--danger);
}
.has-error .field__input:focus {
  box-shadow: 0 0 0 3px rgba(185, 28, 28, 0.18);
}
.field__toggle {
  position: absolute;
  top: 50%;
  right: 4px;
  transform: translateY(-50%);
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border: 0;
  background: transparent;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-muted);
}
.field__toggle:hover {
  color: var(--primary-600);
  background: var(--primary-50);
}
.field__toggle:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
}
.field__msg {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.4;
  color: var(--text-muted);
}
.field__msg--error {
  color: var(--danger);
}

/* Надёжность пароля */
.strength {
  margin: calc(var(--gap) * -0.4) 0 var(--gap);
}
.strength__bars {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 4px;
}
.strength__bars span {
  height: 4px;
  border-radius: 2px;
  background: var(--bg-muted);
  transition: background 0.2s;
}
.strength__label {
  display: block;
  margin-top: 6px;
  font-size: 13px;
  color: var(--text-muted);
}
.strength[data-score="1"] .on {
  background: var(--danger);
}
.strength[data-score="2"] .on {
  background: var(--warning);
}
.strength[data-score="3"] .on {
  background: var(--accent-blue);
}
.strength[data-score="4"] .on {
  background: var(--primary-600);
}

/* Чекбоксы */
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 4px 0 var(--gap-lg);
  font-size: 14px;
}
.check {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 14px;
}
.check input {
  flex: none;
  width: 16px;
  height: 16px;
  accent-color: var(--primary-600);
}
.check--top {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  line-height: 1.45;
  color: var(--text-muted);
}
.check--top input {
  margin-top: 2px;
}
.agree {
  margin: 4px 0 var(--gap-lg);
}
.agree__error {
  margin: 6px 0 0 26px;
  font-size: 13px;
  color: var(--danger);
}

/* Кнопка */
.btn {
  width: 100%;
  height: calc(var(--ctl-h) + 2px);
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-top: 4px;
  font: inherit;
  font-size: 15px;
  font-weight: 600;
  color: #fff;
  background: var(--primary-600);
  border: 0;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s, transform 0.05s;
}
.row + .btn,
.agree + .btn {
  margin-top: 0;
}
.btn:hover:not(:disabled),
.btn:active:not(:disabled) {
  background: var(--primary-700);
}
.btn:active:not(:disabled) {
  transform: translateY(1px);
}
.btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px #fff, 0 0 0 5px var(--primary-600);
}
.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.btn__spinner {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid rgba(255, 255, 255, 0.45);
  border-top-color: #fff;
  animation: spin 0.7s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (prefers-reduced-motion: reduce) {
  .btn__spinner {
    animation-duration: 2s;
  }
}

/* Низкие экраны: убираем второстепенный текст, чтобы всё помещалось без прокрутки */
@media (max-height: 780px) {
  .field__msg--hint {
    display: none;
  }
  .auth__header p {
    display: none;
  }
  .strength__label {
    display: none;
  }
  .strength {
    margin-top: calc(var(--gap) * -0.5);
  }
  .field__label {
    margin-bottom: 4px;
  }
}
@media (max-height: 640px) {
  .auth__brand {
    display: none;
  }
  .agree .check--top {
    font-size: 13px;
    line-height: 1.35;
  }
}

/* Узкие экраны */
@media (max-width: 480px) {
  .auth {
    padding-left: 12px;
    padding-right: 12px;
  }
  .auth__card {
    border-radius: 12px;
  }
}

/* Широкие и низкие (телефон в ландшафте): регистрация в две колонки */
@media (min-width: 640px) and (max-height: 560px) {
  .auth__column {
    max-width: 560px;
  }
  .auth__card form {
    display: grid;
    grid-template-columns: 1fr 1fr;
    column-gap: 14px;
  }
  .auth__card form > .alert,
  .auth__card form > .agree,
  .auth__card form > .row,
  .auth__card form > .btn,
  .auth__card form > .strength {
    grid-column: 1 / -1;
  }
}
</style>
