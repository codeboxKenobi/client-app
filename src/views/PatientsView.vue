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

/* ---------- Справочники ---------- */
const GENDERS = ["Мужской", "Женский"];
const BITES = [
  "Ортогнатический",
  "Прямой",
  "Прогнатический",
  "Прогенический",
  "Глубокий",
  "Открытый",
  "Перекрёстный",
];
// Цвет коронки по шкале Vita
const VITA = [
  "A1",
  "A2",
  "A3",
  "A3.5",
  "A4",
  "B1",
  "B2",
  "B3",
  "B4",
  "C1",
  "C2",
  "C3",
  "C4",
  "D2",
  "D3",
  "D4",
];

// Справочник услуг: название и цена по умолчанию
const SERVICE_CATALOG = [
  { name: "Консультация, осмотр", price: 800 },
  { name: "Профессиональная гигиена", price: 4500 },
  { name: "Лечение кариеса", price: 5500 },
  { name: "Лечение пульпита", price: 9000 },
  { name: "Установка пломбы", price: 4000 },
  { name: "Удаление зуба", price: 3000 },
  { name: "Установка импланта", price: 45000 },
  { name: "Коронка металлокерамическая", price: 15000 },
];
const moneyFmt = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});
const money = (n) => moneyFmt.format(Number(n) || 0);

// Условные обозначения зубной формулы (упрощённый набор); пустое значение — здоровый зуб
const TEETH_STATUSES = [
  { code: "К", label: "Кариес" },
  { code: "П", label: "Пломба" },
  { code: "Пт", label: "Пульпит" },
  { code: "Р", label: "Корень" },
  { code: "И", label: "Искусственная коронка" },
  { code: "Имп", label: "Имплант" },
  { code: "О", label: "Отсутствует" },
];
const toothLabel = (code) =>
  TEETH_STATUSES.find((s) => s.code === code)?.label ?? "Здоров";

// Нумерация зубов по ФДИ. Четыре квадранта в порядке зубной формулы:
// верхняя правая, верхняя левая, нижняя правая, нижняя левая
const range = (a, b) =>
  Array.from({ length: Math.abs(b - a) + 1 }, (_, i) =>
    a <= b ? a + i : a - i
  );
const TEETH_SETS = [
  {
    id: "perm",
    label: "Постоянные",
    quads: [
      { id: "ur", label: "Верхняя правая", teeth: range(18, 11) },
      { id: "ul", label: "Верхняя левая", teeth: range(21, 28) },
      { id: "lr", label: "Нижняя правая", teeth: range(48, 41) },
      { id: "ll", label: "Нижняя левая", teeth: range(31, 38) },
    ],
  },
  {
    id: "milk",
    label: "Молочные",
    quads: [
      { id: "ur", label: "Верхняя правая", teeth: range(55, 51) },
      { id: "ul", label: "Верхняя левая", teeth: range(61, 65) },
      { id: "lr", label: "Нижняя правая", teeth: range(85, 81) },
      { id: "ll", label: "Нижняя левая", teeth: range(71, 75) },
    ],
  },
];
// Кисть для редактирования формулы: пустой код — «Здоров» (ластик)
const PALETTE = [{ code: "", label: "Здоров" }, ...TEETH_STATUSES];

const props = defineProps({
  patients: {
    type: Array,
    default: () => [
      {
        id: "p1",
        cardNumber: "00001",
        createdAt: "2023-02-14",
        fullName: "Иванова Мария Сергеевна",
        gender: "Женский",
        birthDate: "1988-05-17",
        phone: "+7 (900) 111-22-33",
        email: "ivanova.m@example.ru",
        address: "г. Москва, ул. Лесная, д. 12, кв. 45",
        workplace: "Бухгалтер, ООО «Вектор»",
        passportSeries: "4508",
        passportNumber: "123456",
        passportIssuedBy: "ОУФМС России по г. Москве по району Тверской",
        passportIssueDate: "2008-06-03",
        passportDepartmentCode: "770-001",
        snils: "123-456-789 01",
        oms: "7700000000000001",
        allergies: "Лидокаин (отёк, крапивница)",
        concomitant: "Гастрит, ремиссия",
        complaints: "Боль от холодного в области зуба 26",
        history: "Беспокоит около двух недель, к врачу не обращалась",
        diagnosis: "Средний кариес зуба 26",
        treatmentPlan: "Лечение зуба 26, профессиональная гигиена",
        bite: "Ортогнатический",
        hygieneIndex: "1,4",
        pma: "12",
        vitaShade: "A2",
        lastVisit: "2026-09-28",
        teeth: { 16: "П", 26: "К", 36: "П", 38: "О", 48: "О" },
        services: [
          {
            id: "s1",
            date: "2026-09-28",
            name: "Консультация, осмотр",
            teeth: [],
            price: 800,
            qty: 1,
          },
          {
            id: "s2",
            date: "2026-09-28",
            name: "Лечение кариеса",
            teeth: ["26"],
            price: 5500,
            qty: 1,
          },
        ],
        discount: { type: "percent", value: 10 },
      },
      {
        id: "p2",
        cardNumber: "00002",
        createdAt: "2022-11-03",
        fullName: "Петров Алексей Иванович",
        gender: "Мужской",
        birthDate: "1975-11-02",
        phone: "+7 (912) 345-67-89",
        email: "",
        address: "г. Москва, пр-т Мира, д. 7, кв. 3",
        workplace: "Инженер",
        passportSeries: "4515",
        passportNumber: "654321",
        passportIssuedBy: "ГУ МВД России по г. Москве",
        passportIssueDate: "2015-12-10",
        passportDepartmentCode: "770-045",
        snils: "234-567-890 12",
        oms: "",
        allergies: "",
        concomitant: "Гипертоническая болезнь",
        complaints: "Кровоточивость дёсен при чистке зубов",
        history: "",
        diagnosis: "Хронический генерализованный пародонтит",
        treatmentPlan: "Снятие зубных отложений, противовоспалительная терапия",
        bite: "Глубокий",
        hygieneIndex: "2,3",
        pma: "35",
        vitaShade: "A3",
        lastVisit: "2026-10-05",
        teeth: { 17: "И", 16: "И", 25: "П", 46: "Имп", 47: "О", 48: "О" },
        services: [],
      },
      {
        id: "p3",
        cardNumber: "00003",
        createdAt: "2024-04-22",
        fullName: "Сидорова Елена Викторовна",
        gender: "Женский",
        birthDate: "1996-01-30",
        phone: "+7 (921) 555-01-02",
        email: "sidorova@example.ru",
        address: "г. Москва, ул. Садовая, д. 21, кв. 9",
        workplace: "Дизайнер",
        passportSeries: "",
        passportNumber: "",
        passportIssuedBy: "",
        passportIssueDate: "",
        passportDepartmentCode: "",
        snils: "",
        oms: "",
        allergies: "",
        concomitant: "",
        complaints: "Профилактический осмотр",
        history: "",
        diagnosis: "Здорова",
        treatmentPlan: "",
        bite: "Ортогнатический",
        hygieneIndex: "1,1",
        pma: "0",
        vitaShade: "B1",
        lastVisit: "",
        teeth: {},
        services: [],
      },
    ],
  },
});

// Поддерживает v-model:patients, а также события add / edit / remove
const emit = defineEmits(["update:patients", "add", "edit", "remove"]);

// Зубы услуги: массив номеров; старое поле tooth ("26, 27") переносим сюда
const serviceTeeth = (s) =>
  Array.isArray(s.teeth)
    ? [...s.teeth]
    : s.tooth
    ? String(s.tooth)
        .split(/\s*,\s*/)
        .filter(Boolean)
    : [];

// Глубокая копия пациента: зубы, услуги и скидка не должны делить ссылки с родителем
const clonePatient = (p) => ({
  ...p,
  teeth: { ...(p.teeth ?? {}) },
  services: (p.services ?? []).map((s) => {
    const { ...rest } = s;
    return { ...rest, teeth: serviceTeeth(s) };
  }),
  discount: p.discount ? { ...p.discount } : null,
});
const emitPatients = () =>
  emit(
    "update:patients",
    items.value.map((p) => clonePatient(p))
  );

// Локальная копия: компонент работает и без v-model у родителя
const items = ref([]);
watch(
  () => props.patients,
  (v) => {
    items.value = v.map((p) => clonePatient(p));
  },
  { immediate: true, deep: true }
);

/* ---------- Утилиты ---------- */
const digitsOf = (v) => String(v ?? "").replace(/\D/g, "");
const pad = (n) => String(n).padStart(2, "0");
const toKey = (d) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = (k) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};
const todayKey = toKey(new Date());
const fmt = (d) => (d ? d.split("-").reverse().join(".") : "—");
const dash = (v) => (v && String(v).trim() ? v : "—");

function plural(n, forms) {
  const a = Math.abs(n) % 100;
  const b = a % 10;
  if (a > 10 && a < 20) return forms[2];
  if (b > 1 && b < 5) return forms[1];
  if (b === 1) return forms[0];
  return forms[2];
}
function ageLabel(birthDate) {
  if (!birthDate) return "";
  const b = fromKey(birthDate);
  const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  const m = t.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && t.getDate() < b.getDate())) a--;
  return `${a} ${plural(a, ["год", "года", "лет"])}`;
}
const initials = (name) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
const passportLine = (p) => {
  const s = p.passportSeries
    ? `${p.passportSeries.slice(0, 2)} ${p.passportSeries.slice(2)}`
    : "";
  return [s, p.passportNumber].filter(Boolean).join(" ");
};

/* ---------- Маски ввода ---------- */
function formatPhone(value) {
  let d = digitsOf(value);
  if (!d) return "";
  if (d[0] === "7" || d[0] === "8") d = d.slice(1); // код страны вводится маской
  d = d.slice(0, 10);
  let out = "+7";
  if (d.length) out += " (" + d.slice(0, 3);
  if (d.length > 3) out += ") " + d.slice(3, 6);
  if (d.length > 6) out += "-" + d.slice(6, 8);
  if (d.length > 8) out += "-" + d.slice(8, 10);
  return out;
}
const fmtSeries = (v) => digitsOf(v).slice(0, 4);
const fmtNumber = (v) => digitsOf(v).slice(0, 6);
const fmtOms = (v) => digitsOf(v).slice(0, 16);
function fmtCode(v) {
  const d = digitsOf(v).slice(0, 6);
  return d.length > 3 ? `${d.slice(0, 3)}-${d.slice(3)}` : d;
}
function fmtSnils(v) {
  const d = digitsOf(v).slice(0, 11);
  let out = d.slice(0, 3);
  if (d.length > 3) out += "-" + d.slice(3, 6);
  if (d.length > 6) out += "-" + d.slice(6, 9);
  if (d.length > 9) out += " " + d.slice(9, 11);
  return out;
}

// Ввод с маской: форматируем и возвращаем курсор после того же количества цифр
function maskInput(e, fmtFn, key) {
  const el = e.target;
  const atEnd = el.selectionStart === el.value.length;
  const before = el.value.slice(0, el.selectionStart).replace(/\D/g, "").length;
  const formatted = fmtFn(el.value);
  el.value = formatted;
  form[key] = formatted;
  delete errors[key];
  if (atEnd) return;
  let seen = 0,
    pos = 0;
  while (pos < formatted.length && seen < before)
    if (/\d/.test(formatted[pos++])) seen++;
  el.setSelectionRange(pos, pos);
}

/* ---------- Фильтры ---------- */
const search = ref(""); // ФИО, email или номер карты
const phoneFilter = ref("");
const genderFilter = ref("");
const allergyFilter = ref("");
const filtersOpen = ref(true);

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase().replace(/ё/g, "е");
  const d = digitsOf(phoneFilter.value);
  return items.value.filter((p) => {
    if (
      q &&
      ![p.fullName, p.email, p.cardNumber]
        .join(" ")
        .toLowerCase()
        .replace(/ё/g, "е")
        .includes(q)
    )
      return false;
    if (d) {
      const phone = digitsOf(p.phone);
      // «8 912…» и «+7 912…» — один и тот же номер
      if (
        !phone.includes(d) &&
        !(d[0] === "8" && phone.includes("7" + d.slice(1)))
      )
        return false;
    }
    if (genderFilter.value && p.gender !== genderFilter.value) return false;
    if (allergyFilter.value === "yes" && !p.allergies?.trim()) return false;
    if (allergyFilter.value === "no" && p.allergies?.trim()) return false;
    return true;
  });
});

// Блоки по первой букве фамилии
const groups = computed(() => {
  const map = new Map();
  const sorted = [...filtered.value].sort((a, b) =>
    a.fullName.localeCompare(b.fullName, "ru")
  );
  for (const p of sorted) {
    const key = p.fullName.trim().charAt(0).toUpperCase() || "#";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(p);
  }
  return [...map.entries()].map(([title, people]) => ({ title, people }));
});

function resetFilters() {
  search.value = "";
  phoneFilter.value = "";
  genderFilter.value = "";
  allergyFilter.value = "";
}
const activeFilterCount = computed(
  () =>
    [
      search.value.trim(),
      digitsOf(phoneFilter.value),
      genderFilter.value,
      allergyFilter.value,
    ].filter(Boolean).length
);
const hasFilters = computed(() => activeFilterCount.value > 0);

/* ---------- Подробности ---------- */
const detailTarget = ref(null);

/* ---------- Зубная карта ---------- */
const teethSet = ref("perm"); // какой набор показан: постоянные или молочные
const activeSet = computed(
  () => TEETH_SETS.find((t) => t.id === teethSet.value) ?? TEETH_SETS[0]
);
const selectedTooth = ref(null); // выбранный зуб в подробностях
const activeStatus = ref("К"); // выбранная отметка в форме
const isChild = (p) =>
  !!p?.birthDate && parseInt(ageLabel(p.birthDate), 10) < 12;

// детям сразу показываем молочные зубы
watch(
  () => detailTarget.value?.id,
  () => {
    const p = detailTarget.value;
    if (p) {
      teethSet.value = isChild(p) ? "milk" : "perm";
      selectedTooth.value = null;
    }
  }
);

function teethCounts(teeth) {
  const c = {};
  for (const v of Object.values(teeth ?? {})) c[v] = (c[v] || 0) + 1;
  return c;
}
function toothCaption(p) {
  const n = selectedTooth.value;
  return n
    ? `Зуб ${n} — ${toothLabel(p.teeth?.[n])}`
    : "Нажмите на зуб, чтобы увидеть отметку";
}

function detailSections(p) {
  return [
    {
      title: "Общие сведения",
      rows: [
        { l: "ФИО", v: p.fullName },
        { l: "Пол", v: p.gender },
        {
          l: "Дата рождения",
          v: p.birthDate
            ? `${fmt(p.birthDate)} (${ageLabel(p.birthDate)})`
            : "",
        },
        { l: "Телефон", v: p.phone },
        { l: "Email", v: p.email },
        { l: "Номер карты", v: p.cardNumber },
        { l: "Карта заведена", v: fmt(p.createdAt) },
        { l: "Последний визит", v: fmt(p.lastVisit) },
        { l: "Адрес", v: p.address, full: true },
        { l: "Место работы, профессия", v: p.workplace, full: true },
      ],
    },
    {
      title: "Паспортные данные и документы",
      rows: [
        { l: "Серия и номер паспорта", v: passportLine(p) },
        { l: "Дата выдачи", v: fmt(p.passportIssueDate) },
        { l: "Код подразделения", v: p.passportDepartmentCode },
        { l: "СНИЛС", v: p.snils },
        { l: "Полис ОМС", v: p.oms },
        { l: "Кем выдан", v: p.passportIssuedBy, full: true },
      ],
    },
    {
      title: "Медицинские данные",
      rows: [
        { l: "Аллергии", v: p.allergies, full: true },
        { l: "Сопутствующие заболевания", v: p.concomitant, full: true },
        { l: "Жалобы", v: p.complaints, full: true },
        { l: "Развитие заболевания", v: p.history, full: true },
        { l: "Диагноз", v: p.diagnosis, full: true },
        { l: "План лечения", v: p.treatmentPlan, full: true },
      ],
    },
    {
      title: "Осмотр",
      rows: [
        { l: "Прикус", v: p.bite },
        { l: "Гигиенический индекс (ГИ)", v: p.hygieneIndex },
        { l: "Индекс РМА, %", v: p.pma },
        { l: "Цвет по шкале Vita", v: p.vitaShade },
      ],
    },
  ];
}

/* ---------- Форма ---------- */
const modalOpen = ref(false);
const editingId = ref(null);
const errors = reactive({});
const emptyForm = () => ({
  fullName: "",
  gender: "",
  birthDate: "",
  phone: "",
  email: "",
  address: "",
  workplace: "",
  passportSeries: "",
  passportNumber: "",
  passportIssuedBy: "",
  passportIssueDate: "",
  passportDepartmentCode: "",
  snils: "",
  oms: "",
  allergies: "",
  concomitant: "",
  complaints: "",
  history: "",
  diagnosis: "",
  treatmentPlan: "",
  bite: "",
  hygieneIndex: "",
  pma: "",
  vitaShade: "",
  teeth: {},
});
const form = reactive(emptyForm());
const deleteTarget = ref(null);

function clearErrors() {
  Object.keys(errors).forEach((k) => delete errors[k]);
}

function openCreate() {
  editingId.value = null;
  Object.assign(form, emptyForm());
  clearErrors();
  teethSet.value = "perm";
  activeStatus.value = "К";
  modalOpen.value = true;
}

function openEdit(p) {
  editingId.value = p.id;
  Object.assign(form, emptyForm(), p, {
    phone: formatPhone(p.phone),
    teeth: { ...(p.teeth ?? {}) },
  });
  delete form.services; // услуги редактируются отдельно, в окне «Подробнее»
  clearErrors();
  detailTarget.value = null;
  teethSet.value = isChild(p) ? "milk" : "perm";
  activeStatus.value = "К";
  modalOpen.value = true;
}

function closeModal() {
  modalOpen.value = false;
}

// Нажатие на зуб ставит выбранную отметку; повторное нажатие той же отметкой снимает её
function applyTooth(n) {
  if (!activeStatus.value || form.teeth[n] === activeStatus.value)
    delete form.teeth[n];
  else form.teeth[n] = activeStatus.value;
}
function clearTeeth() {
  for (const k of Object.keys(form.teeth)) delete form.teeth[k];
}

function validate() {
  clearErrors();
  if (!form.fullName.trim()) errors.fullName = "Введите ФИО";
  if (!form.gender) errors.gender = "Выберите пол";
  if (!form.birthDate) errors.birthDate = "Укажите дату рождения";

  const phone = digitsOf(form.phone);
  if (!phone) errors.phone = "Введите номер телефона";
  else if (phone.length < 11) errors.phone = "Введите номер полностью";
  else {
    const dup = items.value.find(
      (x) =>
        x.id !== editingId.value &&
        digitsOf(x.phone).slice(-10) === phone.slice(-10)
    );
    if (dup) errors.phone = `Этот номер уже есть у пациента: ${dup.fullName}`;
  }

  if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim()))
    errors.email = "Введите корректный email";

  if (form.passportSeries || form.passportNumber) {
    if (form.passportSeries.length !== 4) errors.passportSeries = "4 цифры";
    if (form.passportNumber.length !== 6) errors.passportNumber = "6 цифр";
  }
  if (
    form.passportDepartmentCode &&
    digitsOf(form.passportDepartmentCode).length !== 6
  )
    errors.passportDepartmentCode = "Формат 000-000";
  if (form.snils && digitsOf(form.snils).length !== 11)
    errors.snils = "Введите 11 цифр";
  if (form.oms && form.oms.length !== 16) errors.oms = "Введите 16 цифр";
  return Object.keys(errors).length === 0;
}

const nextCardNumber = () => {
  const max = items.value.reduce(
    (m, p) => Math.max(m, parseInt(p.cardNumber, 10) || 0),
    0
  );
  return String(max + 1).padStart(5, "0");
};

function save() {
  if (!validate()) return;
  const data = {};
  for (const [k, v] of Object.entries(form))
    data[k] = typeof v === "string" ? v.trim() : v;
  data.teeth = { ...form.teeth };

  if (editingId.value === null) {
    const created = {
      id: `p${Date.now().toString(36)}`,
      cardNumber: nextCardNumber(),
      createdAt: todayKey,
      lastVisit: "",
      services: [],
      ...data,
    };
    items.value.push(created);
    emit("add", created);
  } else {
    const i = items.value.findIndex((s) => s.id === editingId.value);
    if (i !== -1) {
      // services не входят в форму и остаются как были
      items.value[i] = { ...items.value[i], ...data };
      emit("edit", items.value[i]);
    }
  }
  emitPatients();
  closeModal();
}

function confirmDelete() {
  const removed = deleteTarget.value;
  items.value = items.value.filter((s) => s.id !== removed.id);
  emit("remove", removed);
  emitPatients();
  deleteTarget.value = null;
}

/* ---------- Услуги ---------- */
const svc = reactive({ open: false, editingId: null });
const svcForm = reactive({
  date: "",
  name: "",
  teeth: [],
  price: "",
  qty: "1",
});
const svcErrors = reactive({});
const svcDelete = ref(null);
const svcTeethSet = ref("perm"); // какой набор зубов показан в окне услуги

const round2 = (n) => Math.round(n * 100) / 100;
const sortedServices = (p) =>
  [...(p.services ?? [])].sort((a, b) => b.date.localeCompare(a.date));
const servicesTotal = (p) =>
  round2((p.services ?? []).reduce((s, x) => s + x.price * x.qty, 0));

// Скидка на весь чек: процент или фиксированная сумма
const discountAmount = (p) => {
  const d = p.discount;
  const sub = servicesTotal(p);
  if (!d || !(d.value > 0)) return 0;
  const raw = d.type === "percent" ? (sub * d.value) / 100 : d.value;
  return round2(Math.min(sub, raw));
};
const payTotal = (p) => round2(servicesTotal(p) - discountAmount(p));
const discountLabel = (p) =>
  p.discount?.type === "percent"
    ? `Скидка ${String(p.discount.value).replace(".", ",")}%`
    : "Скидка";

function clearSvcErrors() {
  Object.keys(svcErrors).forEach((k) => delete svcErrors[k]);
}

// Обновляем пациента в списке и в открытом окне «Подробнее»
function commitPatient(id, patch) {
  const i = items.value.findIndex((x) => x.id === id);
  if (i === -1) return;
  items.value[i] = { ...items.value[i], ...patch };
  if (detailTarget.value?.id === id) detailTarget.value = items.value[i];
  emit("edit", items.value[i]);
  emitPatients();
}

function openServiceCreate() {
  svc.editingId = null;
  Object.assign(svcForm, {
    date: todayKey,
    name: "",
    teeth: [],
    price: "",
    qty: "1",
  });
  svcTeethSet.value = isChild(detailTarget.value) ? "milk" : "perm";
  clearSvcErrors();
  svc.open = true;
}
function openServiceEdit(s) {
  svc.editingId = s.id;
  Object.assign(svcForm, {
    date: s.date,
    name: s.name,
    teeth: [...(s.teeth ?? [])],
    price: String(s.price),
    qty: String(s.qty),
  });
  // молочные зубы нумеруются с 51
  svcTeethSet.value = svcForm.teeth.some((n) => Number(n) >= 51)
    ? "milk"
    : isChild(detailTarget.value)
    ? "milk"
    : "perm";
  clearSvcErrors();
  svc.open = true;
}
function closeService() {
  svc.open = false;
  nextTick(() => detailEl.value?.focus({ preventScroll: true }));
}
// Выбор зубов услуги на зубной карте: нажатие отмечает зуб, повторное снимает
function toggleSvcTooth(n) {
  const k = String(n);
  const i = svcForm.teeth.indexOf(k);
  if (i === -1) svcForm.teeth.push(k);
  else svcForm.teeth.splice(i, 1);
  svcForm.teeth.sort((a, b) => Number(a) - Number(b));
}
// Выбрали услугу из справочника — подставляем цену, если она ещё не введена
function onServiceName() {
  delete svcErrors.name;
  const hit = SERVICE_CATALOG.find((c) => c.name === svcForm.name.trim());
  if (hit && !svcForm.price) svcForm.price = String(hit.price);
}
function validateService() {
  clearSvcErrors();
  if (!svcForm.date) svcErrors.date = "Укажите дату";
  else if (svcForm.date > todayKey)
    svcErrors.date = "Дата не может быть в будущем";
  if (!svcForm.name.trim()) svcErrors.name = "Введите название услуги";
  const price = Number(String(svcForm.price).replace(",", "."));
  if (svcForm.price === "" || !Number.isFinite(price) || price < 0)
    svcErrors.price = "Введите цену";
  const qty = Number(svcForm.qty);
  if (!Number.isInteger(qty) || qty < 1) svcErrors.qty = "Минимум 1";
  return Object.keys(svcErrors).length === 0;
}
function saveService() {
  const p = detailTarget.value;
  if (!p || !validateService()) return;
  const data = {
    date: svcForm.date,
    name: svcForm.name.trim(),
    teeth: [...svcForm.teeth],
    price: Number(String(svcForm.price).replace(",", ".")),
    qty: Number(svcForm.qty),
  };
  const list = (p.services ?? []).map((s) => ({ ...s }));
  if (svc.editingId === null) {
    list.push({ id: `s${Date.now().toString(36)}`, ...data });
  } else {
    const i = list.findIndex((s) => s.id === svc.editingId);
    if (i !== -1) list[i] = { ...list[i], ...data };
  }
  commitPatient(p.id, { services: list });
  closeService();
}
function confirmServiceDelete() {
  const p = detailTarget.value;
  if (p && svcDelete.value) {
    commitPatient(p.id, {
      services: (p.services ?? []).filter((s) => s.id !== svcDelete.value.id),
    });
  }
  svcDelete.value = null;
}

/* ---------- Скидка на чек ---------- */
const disc = reactive({ open: false });
const discForm = reactive({ type: "percent", value: "" });
const discError = ref("");
const discValue = () => Number(String(discForm.value).replace(",", "."));

// Сколько останется к оплате — показываем, пока человек вводит скидку
const discPreview = computed(() => {
  const p = detailTarget.value;
  if (!disc.open || !p) return "";
  const v = discValue();
  const sub = servicesTotal(p);
  if (!Number.isFinite(v) || v <= 0) return "";
  if (discForm.type === "percent" ? v > 100 : v > sub) return "";
  const a = discForm.type === "percent" ? (sub * v) / 100 : v;
  return money(round2(sub - a));
});

function openDiscount() {
  const d = detailTarget.value?.discount;
  discForm.type = d?.type ?? "percent";
  discForm.value = d ? String(d.value).replace(".", ",") : "";
  discError.value = "";
  disc.open = true;
}
function closeDiscount() {
  disc.open = false;
  nextTick(() => detailEl.value?.focus({ preventScroll: true }));
}
function setDiscType(t) {
  discForm.type = t;
  discError.value = "";
}
function saveDiscount() {
  const p = detailTarget.value;
  if (!p) return;
  const v = discValue();
  const sub = servicesTotal(p);
  if (String(discForm.value).trim() === "" || !Number.isFinite(v) || v <= 0) {
    discError.value = "Введите значение больше нуля";
    return;
  }
  if (discForm.type === "percent" && v > 100) {
    discError.value = "Не больше 100%";
    return;
  }
  if (discForm.type === "amount" && v > sub) {
    discError.value = `Не больше суммы услуг: ${money(sub)}`;
    return;
  }
  commitPatient(p.id, { discount: { type: discForm.type, value: v } });
  closeDiscount();
}
function removeDiscount() {
  const p = detailTarget.value;
  if (p) commitPatient(p.id, { discount: null });
  closeDiscount();
}

/* ---------- Выбор даты ---------- */
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const monthFmt = new Intl.DateTimeFormat("ru-RU", { month: "long" });
const monthGenFmt = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
});
const YEARS = (() => {
  const y = new Date().getFullYear();
  return Array.from({ length: y - 1919 }, (_, i) => y - i);
})();

const dp = reactive({
  open: false,
  field: "",
  label: "",
  year: 0,
  month: 0,
  value: "",
});
const dpEl = ref(null);
let dpReturn = null;

const dpMonthLabel = computed(() => {
  const n = monthFmt.format(new Date(dp.year, dp.month, 1));
  return n.charAt(0).toUpperCase() + n.slice(1);
});
const dpMonthName = (key) =>
  monthGenFmt.format(fromKey(key)).replace(/^\d+\s/, "");

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
      disabled: key > todayKey, // даты рождения и выдачи не бывают в будущем
    };
  });
});

function openDatePicker(field, label, e) {
  dpReturn = e?.currentTarget ?? null;
  dp.field = field;
  dp.label = label;
  dp.value = form[field] || "";
  const base = dp.value
    ? fromKey(dp.value)
    : field === "birthDate"
    ? new Date(1990, 0, 1)
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
  closeDatePicker();
}
function clearDatePicker() {
  form[dp.field] = "";
  closeDatePicker();
}
// Tab не уходит из окна выбора
function onDpKeydown(e) {
  if (e.key !== "Tab" || !dpEl.value) return;
  const btns = [
    ...dpEl.value.querySelectorAll("button:not([disabled]), select"),
  ];
  if (!btns.length) return;
  const first = btns[0],
    last = btns[btns.length - 1];
  const active = document.activeElement;
  if (e.shiftKey && (active === first || active === dpEl.value)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}

/* ---------- Окно «Подробнее»: фокус и закрытие ---------- */
const detailEl = ref(null);
let detailReturn = null;

function openDetails(p, e) {
  detailReturn = e?.currentTarget ?? null;
  detailTarget.value = p;
  nextTick(() => detailEl.value?.focus({ preventScroll: true }));
}
function closeDetails() {
  detailTarget.value = null;
  // фокус возвращается на кнопку «Подробнее», если дальше не открылась форма
  nextTick(() => {
    if (!modalOpen.value) detailReturn?.focus?.({ preventScroll: true });
  });
}
// Tab не уходит из окна
function onDetailKeydown(e) {
  if (e.key !== "Tab" || !detailEl.value) return;
  const nodes = [...detailEl.value.querySelectorAll("button:not([disabled])")];
  if (!nodes.length) return;
  const first = nodes[0],
    last = nodes[nodes.length - 1];
  const active = document.activeElement;
  if (e.shiftKey && (active === first || active === detailEl.value)) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}

/* ---------- Пока открыто окно, страница под ним не прокручивается ---------- */
const anyOpen = computed(
  () =>
    !!(
      detailTarget.value ||
      modalOpen.value ||
      deleteTarget.value ||
      dp.open ||
      svc.open ||
      disc.open ||
      svcDelete.value
    )
);
let prevBodyOverflow = "";
watch(anyOpen, (open) => {
  if (typeof document === "undefined") return;
  if (open) {
    prevBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  } else {
    document.body.style.overflow = prevBodyOverflow;
  }
});
onBeforeUnmount(() => {
  if (anyOpen.value) document.body.style.overflow = prevBodyOverflow;
});

/* ---------- Esc закрывает верхнее открытое окно ---------- */
function onKeydown(e) {
  if (e.key !== "Escape") return;
  if (dp.open) closeDatePicker();
  else if (svcDelete.value) svcDelete.value = null;
  else if (disc.open) closeDiscount();
  else if (svc.open) closeService();
  else if (deleteTarget.value) deleteTarget.value = null;
  else if (modalOpen.value) closeModal();
  else if (detailTarget.value) closeDetails();
}
onMounted(() => {
  // на планшетах и телефонах (до 1024px) панель фильтров свёрнута
  filtersOpen.value = !window.matchMedia("(max-width: 1024px)").matches;
  window.addEventListener("keydown", onKeydown);
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKeydown));
</script>

<template>
  <div class="page">
    <header class="page__head">
      <h1 class="page__title">Пациенты</h1>

      <div class="page__actions">
        <button
          class="btn btn--ghost filters-btn"
          type="button"
          aria-controls="patients-filters"
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
          <span class="add__full">Добавить пациента</span>
          <span class="add__short">Добавить</span>
        </button>
      </div>
    </header>

    <!-- Панель фильтров -->
    <div
      v-show="filtersOpen"
      id="patients-filters"
      class="filters"
      role="search"
      aria-label="Фильтры пациентов"
    >
      <label class="filters__field">
        <span>ФИО, email или номер карты</span>
        <input
          v-model="search"
          type="search"
          placeholder="Фамилия, email или № карты"
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
        <span>Пол</span>
        <select v-model="genderFilter">
          <option value="">Любой</option>
          <option v-for="g in GENDERS" :key="g" :value="g">{{ g }}</option>
        </select>
      </label>
      <label class="filters__field">
        <span>Аллергии</span>
        <select v-model="allergyFilter">
          <option value="">Все пациенты</option>
          <option value="yes">С аллергией</option>
          <option value="no">Без аллергии</option>
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
          : "Список пуст. Добавьте первого пациента."
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
        <article v-for="p in g.people" :key="p.id" class="card">
          <div class="card__top">
            <div class="avatar">{{ initials(p.fullName) }}</div>
            <div class="card__title">
              <h3>{{ p.fullName }}</h3>
              <span class="muted">Карта № {{ p.cardNumber }}</span>
            </div>
            <span
              v-if="p.allergies && p.allergies.trim()"
              class="badge badge--warn"
            >
              Аллергия
            </span>
          </div>

          <dl class="card__info">
            <div>
              <dt>Дата рождения</dt>
              <dd>
                {{ fmt(p.birthDate)
                }}<template v-if="p.birthDate"
                  >, {{ ageLabel(p.birthDate) }}</template
                >
              </dd>
            </div>
            <div>
              <dt>Телефон</dt>
              <dd>{{ p.phone }}</dd>
            </div>
            <div v-if="p.email">
              <dt>Email</dt>
              <dd>
                <a :href="'mailto:' + p.email">{{ p.email }}</a>
              </dd>
            </div>
            <div>
              <dt>Последний визит</dt>
              <dd>{{ fmt(p.lastVisit) }}</dd>
            </div>
            <div>
              <dt>Диагноз</dt>
              <dd>{{ dash(p.diagnosis) }}</dd>
            </div>
          </dl>

          <div class="card__footer">
            <button
              class="btn btn--primary card__more"
              type="button"
              @click="openDetails(p, $event)"
            >
              Подробнее
            </button>
            <button class="btn btn--ghost" type="button" @click="openEdit(p)">
              Редактировать
            </button>
            <button
              class="btn btn--danger"
              type="button"
              @click="deleteTarget = p"
            >
              Удалить
            </button>
          </div>
        </article>
      </div>
    </section>

    <!-- Подробности пациента: шапка и кнопки закреплены, прокручивается только содержимое -->
    <div
      v-if="detailTarget"
      class="overlay overlay--detail"
      @mousedown.self="closeDetails"
    >
      <div
        ref="detailEl"
        class="detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="detail-title"
        tabindex="-1"
        @keydown="onDetailKeydown"
      >
        <header class="detail__head">
          <div class="avatar">{{ initials(detailTarget.fullName) }}</div>
          <div class="detail__title">
            <h2 id="detail-title">{{ detailTarget.fullName }}</h2>
            <span class="muted">
              Медицинская карта стоматологического больного №
              {{ detailTarget.cardNumber }}
            </span>
          </div>
          <button
            class="btn btn--icon"
            type="button"
            aria-label="Закрыть"
            @click="closeDetails"
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

        <div class="detail__body">
          <section
            v-for="s in detailSections(detailTarget)"
            :key="s.title"
            class="dsec"
          >
            <h3 class="dsec__title">{{ s.title }}</h3>
            <dl class="dgrid">
              <div
                v-for="r in s.rows"
                :key="r.l"
                :class="{ dgrid__full: r.full }"
              >
                <dt>{{ r.l }}</dt>
                <dd>{{ dash(r.v) }}</dd>
              </div>
            </dl>
          </section>

          <section class="dsec">
            <h3 class="dsec__title">Зубная формула</h3>
            <div class="teeth">
              <div class="teeth__bar">
                <div class="seg" role="group" aria-label="Тип зубов">
                  <button
                    v-for="t in TEETH_SETS"
                    :key="t.id"
                    type="button"
                    :aria-pressed="teethSet === t.id ? 'true' : 'false'"
                    @click="
                      teethSet = t.id;
                      selectedTooth = null;
                    "
                  >
                    {{ t.label }}
                  </button>
                </div>
              </div>

              <div class="teeth__grid">
                <div v-for="q in activeSet.quads" :key="q.id" class="quad">
                  <span class="quad__cap">{{ q.label }}</span>
                  <div class="quad__row">
                    <button
                      v-for="n in q.teeth"
                      :key="n"
                      type="button"
                      class="tooth"
                      :class="{ 'is-selected': selectedTooth === n }"
                      :data-s="detailTarget.teeth?.[n] || ''"
                      :aria-label="`Зуб ${n}: ${toothLabel(
                        detailTarget.teeth?.[n]
                      )}`"
                      :aria-pressed="selectedTooth === n ? 'true' : 'false'"
                      @click="selectedTooth = n"
                    >
                      <small>{{ n }}</small>
                      <span>{{ detailTarget.teeth?.[n] || "·" }}</span>
                    </button>
                  </div>
                </div>
              </div>

              <p class="teeth__caption" aria-live="polite">
                {{ toothCaption(detailTarget) }}
              </p>
            </div>

            <ul class="legend">
              <li v-for="s in TEETH_STATUSES" :key="s.code">
                <i :data-s="s.code">{{ s.code }}</i>
                {{ s.label
                }}<template v-if="teethCounts(detailTarget.teeth)[s.code]">
                  : {{ teethCounts(detailTarget.teeth)[s.code] }}</template
                >
              </li>
              <li><i>·</i> Здоров</li>
            </ul>
          </section>

          <!-- Услуги -->
          <section class="dsec">
            <div class="dsec__bar">
              <h3 class="dsec__title">Услуги</h3>
              <button
                class="btn btn--primary btn--sm"
                type="button"
                @click="openServiceCreate"
              >
                Добавить услугу
              </button>
            </div>

            <p v-if="!detailTarget.services?.length" class="helper">
              Услуги ещё не добавлены.
            </p>
            <template v-else>
              <ul class="services">
                <li
                  v-for="s in sortedServices(detailTarget)"
                  :key="s.id"
                  class="service"
                >
                  <div class="service__main">
                    <strong>{{ s.name }}</strong>
                    <span class="service__meta">
                      {{ fmt(s.date)
                      }}<template v-if="s.teeth?.length">
                        · {{ s.teeth.length > 1 ? "зубы" : "зуб" }}
                        {{ s.teeth.join(", ") }}</template
                      ><template v-if="s.qty > 1"> · {{ s.qty }} шт.</template>
                    </span>
                  </div>
                  <span class="service__sum">{{ money(s.price * s.qty) }}</span>
                  <button
                    class="btn btn--icon"
                    type="button"
                    :aria-label="`Редактировать услугу: ${s.name}`"
                    @click="openServiceEdit(s)"
                  >
                    <svg
                      viewBox="0 0 20 20"
                      width="18"
                      height="18"
                      aria-hidden="true"
                    >
                      <path
                        d="M4 16h3l8-8-3-3-8 8zM11 6l3 3"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.7"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  </button>
                  <button
                    class="btn btn--icon"
                    type="button"
                    :aria-label="`Удалить услугу: ${s.name}`"
                    @click="svcDelete = s"
                  >
                    <svg
                      viewBox="0 0 20 20"
                      width="18"
                      height="18"
                      aria-hidden="true"
                    >
                      <path
                        d="M4.5 6h11M8 6V4.5h4V6M6 6l.7 9.5h6.6L14 6"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.7"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      />
                    </svg>
                  </button>
                </li>
              </ul>
              <div class="bill">
                <div class="bill__row">
                  <span>Сумма услуг</span>
                  <span>{{ money(servicesTotal(detailTarget)) }}</span>
                </div>
                <div
                  v-if="discountAmount(detailTarget)"
                  class="bill__row bill__row--disc"
                >
                  <span>{{ discountLabel(detailTarget) }}</span>
                  <span>−{{ money(discountAmount(detailTarget)) }}</span>
                </div>
                <div class="bill__row bill__row--total">
                  <span>К оплате</span>
                  <strong>{{ money(payTotal(detailTarget)) }}</strong>
                </div>
                <button
                  class="btn btn--ghost btn--sm bill__btn"
                  type="button"
                  @click="openDiscount"
                >
                  {{
                    detailTarget.discount
                      ? "Изменить скидку"
                      : "Добавить скидку"
                  }}
                </button>
              </div>
            </template>
          </section>
        </div>

        <footer class="detail__foot">
          <button
            class="btn btn--ghost"
            type="button"
            @click="openEdit(detailTarget)"
          >
            Редактировать
          </button>
          <button class="btn btn--primary" type="button" @click="closeDetails">
            Закрыть
          </button>
        </footer>
      </div>
    </div>

    <!-- Услуга: добавление / редактирование (поверх окна «Подробнее») -->
    <div v-if="svc.open" class="overlay" @mousedown.self="closeService">
      <form
        class="modal modal--service"
        role="dialog"
        aria-modal="true"
        aria-labelledby="svc-title"
        novalidate
        @submit.prevent="saveService"
      >
        <h2 id="svc-title">
          {{
            svc.editingId === null ? "Новая услуга" : "Редактирование услуги"
          }}
        </h2>

        <label class="field field--full">
          <span>Услуга</span>
          <input
            v-model="svcForm.name"
            class="input"
            :class="{ 'input--error': svcErrors.name }"
            type="text"
            list="service-catalog"
            maxlength="120"
            autocomplete="off"
            placeholder="Выберите из списка или введите свою"
            autofocus
            @input="onServiceName"
          />
          <datalist id="service-catalog">
            <option
              v-for="c in SERVICE_CATALOG"
              :key="c.name"
              :value="c.name"
            />
          </datalist>
          <small v-if="svcErrors.name" class="error">{{
            svcErrors.name
          }}</small>
        </label>

        <div class="trio field--full">
          <label class="field">
            <span>Дата</span>
            <input
              v-model="svcForm.date"
              class="input"
              :class="{ 'input--error': svcErrors.date }"
              type="date"
              :max="todayKey"
              @input="delete svcErrors.date"
            />
            <small v-if="svcErrors.date" class="error">{{
              svcErrors.date
            }}</small>
          </label>

          <label class="field">
            <span>Цена, ₽</span>
            <input
              v-model="svcForm.price"
              class="input"
              :class="{ 'input--error': svcErrors.price }"
              type="text"
              inputmode="decimal"
              maxlength="9"
              placeholder="0"
              autocomplete="off"
              @input="delete svcErrors.price"
            />
            <small v-if="svcErrors.price" class="error">{{
              svcErrors.price
            }}</small>
          </label>

          <label class="field">
            <span>Количество</span>
            <input
              v-model="svcForm.qty"
              class="input"
              :class="{ 'input--error': svcErrors.qty }"
              type="text"
              inputmode="numeric"
              maxlength="3"
              autocomplete="off"
              @input="delete svcErrors.qty"
            />
            <small v-if="svcErrors.qty" class="error">{{
              svcErrors.qty
            }}</small>
          </label>
        </div>

        <!-- Зубная карта: выбор зубов, к которым относится услуга -->
        <div class="field--full teeth svc-teeth">
          <div class="teeth__bar">
            <span class="svc-teeth__title">Зубы (необязательно)</span>
            <div class="seg" role="group" aria-label="Тип зубов">
              <button
                v-for="t in TEETH_SETS"
                :key="t.id"
                type="button"
                :aria-pressed="svcTeethSet === t.id ? 'true' : 'false'"
                @click="svcTeethSet = t.id"
              >
                {{ t.label }}
              </button>
            </div>
          </div>
          <p class="helper">
            Нажимайте на зубы, чтобы отметить их. Цвет показывает текущее
            состояние зуба в формуле пациента.
          </p>

          <div class="teeth__grid">
            <div
              v-for="q in TEETH_SETS.find((t) => t.id === svcTeethSet).quads"
              :key="q.id"
              class="quad"
            >
              <span class="quad__cap">{{ q.label }}</span>
              <div class="quad__row">
                <button
                  v-for="n in q.teeth"
                  :key="n"
                  type="button"
                  class="tooth"
                  :class="{ 'is-picked': svcForm.teeth.includes(String(n)) }"
                  :data-s="detailTarget?.teeth?.[n] || ''"
                  :aria-label="`Зуб ${n}: ${toothLabel(
                    detailTarget?.teeth?.[n]
                  )}`"
                  :aria-pressed="
                    svcForm.teeth.includes(String(n)) ? 'true' : 'false'
                  "
                  @click="toggleSvcTooth(n)"
                >
                  <small>{{ n }}</small>
                  <span>{{ detailTarget?.teeth?.[n] || "·" }}</span>
                </button>
              </div>
            </div>
          </div>

          <div class="svc-teeth__foot">
            <p class="teeth__caption" aria-live="polite">
              {{
                svcForm.teeth.length
                  ? `Выбрано: ${svcForm.teeth.join(", ")}`
                  : "Зубы не выбраны"
              }}
            </p>
            <button
              type="button"
              class="btn btn--ghost btn--sm"
              :disabled="!svcForm.teeth.length"
              @click="svcForm.teeth.splice(0)"
            >
              Снять выбор
            </button>
          </div>
        </div>

        <div class="modal__footer field--full">
          <button type="button" class="btn btn--ghost" @click="closeService">
            Отмена
          </button>
          <button type="submit" class="btn btn--primary">Сохранить</button>
        </div>
      </form>
    </div>

    <!-- Услуга: подтверждение удаления -->
    <div v-if="svcDelete" class="overlay" @mousedown.self="svcDelete = null">
      <div
        class="modal modal--small"
        role="dialog"
        aria-modal="true"
        aria-label="Удаление услуги"
      >
        <h2>Удалить услугу?</h2>
        <p class="muted field--full">
          «{{ svcDelete.name }}» будет удалена из карты пациента.
        </p>
        <div class="modal__footer field--full">
          <button
            class="btn btn--ghost"
            type="button"
            @click="svcDelete = null"
          >
            Отмена
          </button>
          <button
            class="btn btn--emergency"
            type="button"
            @click="confirmServiceDelete"
          >
            Удалить
          </button>
        </div>
      </div>
    </div>

    <!-- Скидка на общий чек -->
    <div v-if="disc.open" class="overlay" @mousedown.self="closeDiscount">
      <form
        class="modal modal--small"
        role="dialog"
        aria-modal="true"
        aria-labelledby="disc-title"
        novalidate
        @submit.prevent="saveDiscount"
      >
        <h2 id="disc-title">Скидка на чек</h2>
        <p class="muted field--full">
          Сумма услуг: {{ money(servicesTotal(detailTarget)) }}
        </p>

        <div class="seg disc__seg" role="group" aria-label="Тип скидки">
          <button
            type="button"
            :aria-pressed="discForm.type === 'percent' ? 'true' : 'false'"
            @click="setDiscType('percent')"
          >
            В процентах
          </button>
          <button
            type="button"
            :aria-pressed="discForm.type === 'amount' ? 'true' : 'false'"
            @click="setDiscType('amount')"
          >
            В рублях
          </button>
        </div>

        <label class="field field--full">
          <span>{{
            discForm.type === "percent"
              ? "Размер скидки, %"
              : "Размер скидки, ₽"
          }}</span>
          <input
            v-model="discForm.value"
            class="input"
            :class="{ 'input--error': discError }"
            type="text"
            inputmode="decimal"
            maxlength="9"
            autocomplete="off"
            placeholder="0"
            autofocus
            @input="discError = ''"
          />
          <small v-if="discError" class="error">{{ discError }}</small>
        </label>

        <p v-if="discPreview" class="helper disc__preview">
          К оплате будет: <strong>{{ discPreview }}</strong>
        </p>

        <div class="modal__footer field--full">
          <button
            v-if="detailTarget?.discount"
            type="button"
            class="btn btn--ghost disc__remove"
            @click="removeDiscount"
          >
            Убрать скидку
          </button>
          <button type="button" class="btn btn--ghost" @click="closeDiscount">
            Отмена
          </button>
          <button type="submit" class="btn btn--primary">Применить</button>
        </div>
      </form>
    </div>

    <!-- Создание / редактирование -->
    <div
      v-if="modalOpen"
      class="overlay overlay--detail"
      @mousedown.self="closeModal"
    >
      <form
        class="detail detail--form"
        role="dialog"
        aria-modal="true"
        aria-labelledby="form-title"
        novalidate
        @submit.prevent="save"
      >
        <header class="detail__head">
          <div class="detail__title">
            <h2 id="form-title">
              {{
                editingId === null ? "Новый пациент" : "Редактирование пациента"
              }}
            </h2>
          </div>
          <button
            class="btn btn--icon"
            type="button"
            aria-label="Закрыть"
            @click="closeModal"
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

        <div class="detail__body">
          <div class="fgrid">
            <h3 class="modal__section">Общие сведения</h3>

            <label class="field field--full">
              <span>ФИО</span>
              <input
                v-model="form.fullName"
                class="input"
                :class="{ 'input--error': errors.fullName }"
                type="text"
                placeholder="Иванов Иван Иванович"
                autocomplete="off"
                autofocus
                @input="delete errors.fullName"
              />
              <small v-if="errors.fullName" class="error">{{
                errors.fullName
              }}</small>
            </label>

            <label class="field">
              <span>Пол</span>
              <select
                v-model="form.gender"
                class="input"
                :class="{ 'input--error': errors.gender }"
                @change="delete errors.gender"
              >
                <option value="" disabled>Выберите пол</option>
                <option v-for="g in GENDERS" :key="g" :value="g">
                  {{ g }}
                </option>
              </select>
              <small v-if="errors.gender" class="error">{{
                errors.gender
              }}</small>
            </label>

            <label class="field">
              <span>Дата рождения</span>
              <button
                type="button"
                class="input datebtn"
                :class="{
                  'input--error': errors.birthDate,
                  'datebtn--empty': !form.birthDate,
                }"
                :aria-label="`Дата рождения: ${
                  form.birthDate ? fmt(form.birthDate) : 'не задана'
                }`"
                @click="openDatePicker('birthDate', 'Дата рождения', $event)"
              >
                <span>{{
                  form.birthDate ? fmt(form.birthDate) : "Выбрать дату"
                }}</span>
                <svg
                  viewBox="0 0 20 20"
                  width="20"
                  height="20"
                  aria-hidden="true"
                >
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
              <small v-if="errors.birthDate" class="error">{{
                errors.birthDate
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
                autocomplete="off"
                maxlength="18"
                placeholder="+7 (900) 000-00-00"
                @input="maskInput($event, formatPhone, 'phone')"
              />
              <small v-if="errors.phone" class="error">{{
                errors.phone
              }}</small>
            </label>

            <label class="field">
              <span>Email</span>
              <input
                v-model="form.email"
                class="input"
                :class="{ 'input--error': errors.email }"
                type="email"
                placeholder="name@example.ru"
                @input="delete errors.email"
              />
              <small v-if="errors.email" class="error">{{
                errors.email
              }}</small>
            </label>

            <label class="field field--full">
              <span>Адрес</span>
              <input
                v-model="form.address"
                class="input"
                type="text"
                maxlength="200"
                placeholder="Город, улица, дом, квартира"
                autocomplete="off"
              />
            </label>

            <label class="field field--full">
              <span>Место работы, профессия</span>
              <input
                v-model="form.workplace"
                class="input"
                type="text"
                maxlength="120"
                placeholder="Необязательно"
                autocomplete="off"
              />
            </label>

            <h3 class="modal__section">Паспорт и документы</h3>

            <div class="pair field--full">
              <label class="field">
                <span>Серия паспорта</span>
                <input
                  :value="form.passportSeries"
                  class="input"
                  :class="{ 'input--error': errors.passportSeries }"
                  type="text"
                  inputmode="numeric"
                  maxlength="4"
                  placeholder="0000"
                  autocomplete="off"
                  @input="maskInput($event, fmtSeries, 'passportSeries')"
                />
                <small v-if="errors.passportSeries" class="error">{{
                  errors.passportSeries
                }}</small>
              </label>

              <label class="field">
                <span>Номер паспорта</span>
                <input
                  :value="form.passportNumber"
                  class="input"
                  :class="{ 'input--error': errors.passportNumber }"
                  type="text"
                  inputmode="numeric"
                  maxlength="6"
                  placeholder="000000"
                  autocomplete="off"
                  @input="maskInput($event, fmtNumber, 'passportNumber')"
                />
                <small v-if="errors.passportNumber" class="error">{{
                  errors.passportNumber
                }}</small>
              </label>
            </div>

            <label class="field">
              <span>Дата выдачи</span>
              <button
                type="button"
                class="input datebtn"
                :class="{ 'datebtn--empty': !form.passportIssueDate }"
                :aria-label="`Дата выдачи паспорта: ${
                  form.passportIssueDate
                    ? fmt(form.passportIssueDate)
                    : 'не задана'
                }`"
                @click="
                  openDatePicker(
                    'passportIssueDate',
                    'Дата выдачи паспорта',
                    $event
                  )
                "
              >
                <span>{{
                  form.passportIssueDate
                    ? fmt(form.passportIssueDate)
                    : "Выбрать дату"
                }}</span>
                <svg
                  viewBox="0 0 20 20"
                  width="20"
                  height="20"
                  aria-hidden="true"
                >
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
            </label>

            <label class="field">
              <span>Код подразделения</span>
              <input
                :value="form.passportDepartmentCode"
                class="input"
                :class="{ 'input--error': errors.passportDepartmentCode }"
                type="text"
                inputmode="numeric"
                maxlength="7"
                placeholder="000-000"
                autocomplete="off"
                @input="maskInput($event, fmtCode, 'passportDepartmentCode')"
              />
              <small v-if="errors.passportDepartmentCode" class="error">{{
                errors.passportDepartmentCode
              }}</small>
            </label>

            <label class="field field--full">
              <span>Кем выдан</span>
              <input
                v-model="form.passportIssuedBy"
                class="input"
                type="text"
                maxlength="200"
                placeholder="Название органа, выдавшего паспорт"
                autocomplete="off"
              />
            </label>

            <label class="field">
              <span>СНИЛС</span>
              <input
                :value="form.snils"
                class="input"
                :class="{ 'input--error': errors.snils }"
                type="text"
                inputmode="numeric"
                maxlength="14"
                placeholder="000-000-000 00"
                autocomplete="off"
                @input="maskInput($event, fmtSnils, 'snils')"
              />
              <small v-if="errors.snils" class="error">{{
                errors.snils
              }}</small>
            </label>

            <label class="field">
              <span>Полис ОМС</span>
              <input
                :value="form.oms"
                class="input"
                :class="{ 'input--error': errors.oms }"
                type="text"
                inputmode="numeric"
                maxlength="16"
                placeholder="16 цифр"
                autocomplete="off"
                @input="maskInput($event, fmtOms, 'oms')"
              />
              <small v-if="errors.oms" class="error">{{ errors.oms }}</small>
            </label>

            <h3 class="modal__section">Медицинские данные</h3>

            <label class="field field--full">
              <span>Аллергии</span>
              <input
                v-model="form.allergies"
                class="input"
                type="text"
                maxlength="200"
                placeholder="Препарат и реакция. Оставьте пустым, если нет"
                autocomplete="off"
              />
            </label>

            <label class="field field--full">
              <span>Сопутствующие заболевания</span>
              <textarea
                v-model="form.concomitant"
                class="input input--area"
                rows="2"
                maxlength="500"
                placeholder="Перенесённые и хронические заболевания"
              ></textarea>
            </label>

            <label class="field field--full">
              <span>Жалобы</span>
              <textarea
                v-model="form.complaints"
                class="input input--area"
                rows="2"
                maxlength="500"
                placeholder="Со слов пациента"
              ></textarea>
            </label>

            <label class="field field--full">
              <span>Развитие заболевания</span>
              <textarea
                v-model="form.history"
                class="input input--area"
                rows="2"
                maxlength="500"
                placeholder="Когда появились первые проявления, чем лечился"
              ></textarea>
            </label>

            <label class="field field--full">
              <span>Диагноз</span>
              <input
                v-model="form.diagnosis"
                class="input"
                type="text"
                maxlength="200"
                placeholder="Например, средний кариес зуба 26"
                autocomplete="off"
              />
            </label>

            <label class="field field--full">
              <span>План лечения</span>
              <textarea
                v-model="form.treatmentPlan"
                class="input input--area"
                rows="2"
                maxlength="500"
                placeholder="Этапы лечения и профилактики"
              ></textarea>
            </label>

            <h3 class="modal__section">Осмотр</h3>

            <label class="field">
              <span>Прикус</span>
              <select v-model="form.bite" class="input">
                <option value="">Не указан</option>
                <option v-for="b in BITES" :key="b" :value="b">{{ b }}</option>
              </select>
            </label>

            <label class="field">
              <span>Цвет по шкале Vita</span>
              <select v-model="form.vitaShade" class="input">
                <option value="">Не указан</option>
                <option v-for="v in VITA" :key="v" :value="v">{{ v }}</option>
              </select>
            </label>

            <div class="pair field--full">
              <label class="field">
                <span>Гигиенический индекс (ГИ)</span>
                <input
                  v-model="form.hygieneIndex"
                  class="input"
                  type="text"
                  inputmode="decimal"
                  maxlength="5"
                  placeholder="Например, 1,4"
                  autocomplete="off"
                />
              </label>

              <label class="field">
                <span>Индекс РМА, %</span>
                <input
                  v-model="form.pma"
                  class="input"
                  type="text"
                  inputmode="decimal"
                  maxlength="5"
                  placeholder="Например, 12"
                  autocomplete="off"
                />
              </label>
            </div>

            <h3 class="modal__section">Зубная формула</h3>

            <div class="field--full teeth">
              <p class="helper">
                Выберите отметку, затем нажимайте на зубы. Повторное нажатие той
                же отметкой снимает её.
              </p>

              <div class="teeth__bar">
                <div class="seg" role="group" aria-label="Тип зубов">
                  <button
                    v-for="t in TEETH_SETS"
                    :key="t.id"
                    type="button"
                    :aria-pressed="teethSet === t.id ? 'true' : 'false'"
                    @click="teethSet = t.id"
                  >
                    {{ t.label }}
                  </button>
                </div>
                <button
                  type="button"
                  class="btn btn--ghost btn--sm"
                  :disabled="!Object.keys(form.teeth).length"
                  @click="clearTeeth"
                >
                  Очистить формулу
                </button>
              </div>

              <div class="palette" role="group" aria-label="Отметка">
                <button
                  v-for="s in PALETTE"
                  :key="s.code"
                  type="button"
                  class="pal"
                  :aria-pressed="activeStatus === s.code ? 'true' : 'false'"
                  @click="activeStatus = s.code"
                >
                  <i :data-s="s.code">{{ s.code || "·" }}</i>
                  {{ s.label }}
                </button>
              </div>

              <div class="teeth__grid">
                <div v-for="q in activeSet.quads" :key="q.id" class="quad">
                  <span class="quad__cap">{{ q.label }}</span>
                  <div class="quad__row">
                    <button
                      v-for="n in q.teeth"
                      :key="n"
                      type="button"
                      class="tooth"
                      :data-s="form.teeth[n] || ''"
                      :aria-label="`Зуб ${n}: ${toothLabel(form.teeth[n])}`"
                      @click="applyTooth(n)"
                    >
                      <small>{{ n }}</small>
                      <span>{{ form.teeth[n] || "·" }}</span>
                    </button>
                  </div>
                </div>
              </div>

              <p class="teeth__caption" aria-live="polite">
                Отмечено зубов: {{ Object.keys(form.teeth).length }}
              </p>
            </div>
          </div>
        </div>

        <footer class="detail__foot">
          <button type="button" class="btn btn--ghost" @click="closeModal">
            Отмена
          </button>
          <button type="submit" class="btn btn--primary">Сохранить</button>
        </footer>
      </form>
    </div>

    <!-- Подтверждение удаления -->
    <div
      v-if="deleteTarget"
      class="overlay"
      @mousedown.self="deleteTarget = null"
    >
      <div
        class="modal modal--small"
        role="dialog"
        aria-modal="true"
        aria-label="Удаление пациента"
      >
        <h2>Удалить пациента?</h2>
        <p class="muted field--full">
          Карта «{{ deleteTarget.fullName }}» будет удалена без возможности
          восстановления.
        </p>
        <div class="modal__footer field--full">
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

    <!-- Выбор даты -->
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
          <div class="dp__title">
            <p class="dp__month">{{ dpMonthLabel }}</p>
            <select
              class="dp__year"
              aria-label="Год"
              :value="dp.year"
              @change="dp.year = Number($event.target.value)"
            >
              <option v-for="y in YEARS" :key="y" :value="y">{{ y }}</option>
            </select>
          </div>
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

  color-scheme: light;
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

/* ---------- Панель фильтров ---------- */
.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 10px 12px;
  margin-bottom: 20px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface, #ffffff);
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
  background-color: var(--surface, #ffffff);
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
  background: var(--muted-bg, #f1f5f9);
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
  grid-template-columns: repeat(auto-fill, minmax(min(320px, 100%), 1fr));
  gap: 20px;
}
.empty {
  margin: 0 0 20px;
  padding: 16px;
  border: 1px dashed var(--text-3);
  border-radius: 8px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-2);
}

/* Карточка пациента */
.card {
  background: var(--primary-50, #f0fdfa);
  border: 1px solid color-mix(in srgb, var(--primary-600) 35%, var(--border));
  border-left: 4px solid var(--primary-600);
  border-radius: 8px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
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
.badge {
  font-size: 12px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 999px;
  white-space: nowrap;
}
.badge--warn {
  background: color-mix(in srgb, var(--warning) 20%, white);
  color: var(--text-1);
  box-shadow: inset 0 0 0 1px var(--warning);
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
  flex: none;
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
  flex-wrap: wrap;
  gap: 8px;
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}
.card__more {
  flex: 1 1 100%;
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
  background: var(--surface, #ffffff);
  color: var(--text-1);
  border-color: var(--border);
}
.btn--danger {
  background: var(--surface, #ffffff);
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
.btn--icon {
  width: 44px;
  padding: 0;
  color: var(--text-2);
  background: transparent;
}
@media (hover: hover) {
  .btn--primary:hover:not(:disabled) {
    background: var(--primary-700);
  }
  .btn--ghost:hover:not(:disabled) {
    background: var(--muted-bg, #f1f5f9);
  }
  .btn--danger:hover {
    background: color-mix(in srgb, var(--error) 10%, white);
  }
  .btn--emergency:hover {
    background: #b91c1c;
  }
  .btn--icon:hover {
    background: var(--muted-bg, #f1f5f9);
    color: var(--text-1);
  }
}

/* Inputs и selects */
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
  background-color: var(--surface, #ffffff);
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
  min-height: 64px;
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

/* Окна */
.overlay {
  position: fixed;
  inset: 0;
  z-index: 150; /* выше бокового меню и его затемнения */
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  justify-content: center;
  padding: max(16px, env(safe-area-inset-top))
    max(16px, env(safe-area-inset-right)) max(16px, env(safe-area-inset-bottom))
    max(16px, env(safe-area-inset-left));
  overflow-y: auto;
  overscroll-behavior: contain;
}
.modal {
  width: 100%;
  max-width: 640px;
  margin: auto; /* по центру, а если окно выше экрана — прокручивается сверху */
  background-color: #ffffff; /* запасной цвет: окно никогда не бывает прозрачным */
  background: var(--surface, #ffffff);
  opacity: 1;
  isolation: isolate;
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
.modal--service {
  max-width: 720px;
}
.modal h2 {
  grid-column: 1 / -1;
  font-size: 20px;
}
.modal__section {
  grid-column: 1 / -1;
  margin-top: 8px;
  padding-top: 16px;
  border-top: 1px solid var(--border);
  font-size: 16px;
}
.modal__section:first-of-type {
  margin-top: 0;
  padding-top: 0;
  border-top: 0;
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
  margin: 0 0 8px;
  color: var(--text-3);
  font-size: 12px;
}
.error {
  color: var(--error);
  font-size: 13px;
}
.modal__footer {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}

@media (max-width: 560px) {
  .modal {
    grid-template-columns: 1fr;
    padding: 18px;
  }
}

/* Окно «Подробнее»: шапка и кнопки на месте, прокручивается только содержимое */
.overlay--detail {
  align-items: center;
  overflow: hidden;
}
.detail {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 880px;
  height: min(100%, 860px); /* одинаковый размер у просмотра и редактирования */
  overflow: hidden;
  border-radius: 14px;
  background-color: #ffffff;
  background: var(--surface, #ffffff);
  box-shadow: 0 16px 48px rgba(15, 23, 42, 0.3);
  outline: none;
  isolation: isolate;
}
.detail__head {
  flex: none;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 16px 16px 20px;
  border-bottom: 1px solid var(--border);
}
.detail__title {
  flex: 1;
  min-width: 0;
}
.detail__title h2 {
  font-size: 20px;
  line-height: 1.2;
  overflow-wrap: anywhere;
}
.detail__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 20px;
  container-type: inline-size; /* число колонок зависит от ширины окна, а не экрана */
}
.detail__foot {
  flex: none;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--border);
}
/* сетка полей формы: колонки зависят от ширины окна */
.fgrid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}
@container (max-width: 520px) {
  .fgrid {
    grid-template-columns: minmax(0, 1fr);
  }
}
@media (max-width: 560px) {
  /* то же для браузеров без container queries */
  .fgrid {
    grid-template-columns: minmax(0, 1fr);
  }
}
.detail__body > .dsec:first-child {
  padding-top: 0;
  border-top: 0;
}
.detail__body > .dsec + .dsec {
  margin-top: 16px;
}

/* Планшеты */
@media (max-width: 1024px) {
  .detail {
    max-width: 720px;
  }
}

/* Телефоны и низкие экраны (телефон горизонтально): окно на весь экран */
@media (max-width: 640px), (max-height: 520px) {
  .overlay--detail {
    padding: 0;
  }
  .detail {
    max-width: none;
    height: 100%;
    border-radius: 0;
    box-shadow: none;
  }
  .detail__head {
    padding: max(12px, env(safe-area-inset-top))
      max(8px, env(safe-area-inset-right)) 12px
      max(14px, env(safe-area-inset-left));
  }
  .detail__title h2 {
    font-size: 18px;
  }
  .detail__body {
    padding: 14px max(14px, env(safe-area-inset-right)) 14px
      max(14px, env(safe-area-inset-left));
  }
  .detail__foot {
    padding: 12px max(14px, env(safe-area-inset-right))
      calc(12px + env(safe-area-inset-bottom, 0px))
      max(14px, env(safe-area-inset-left));
  }
  .detail__foot .btn {
    flex: 1;
  }
}

.dsec {
  grid-column: 1 / -1;
  padding-top: 16px;
  border-top: 1px solid var(--border);
}
.dsec__title {
  margin-bottom: 12px;
  font-size: 16px;
}
.dgrid {
  margin: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 16px;
}
.dgrid > div {
  min-width: 0;
}
.dgrid__full {
  grid-column: 1 / -1;
}
.dgrid dt {
  margin-bottom: 2px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-3);
}
.dgrid dd {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-1);
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
@container (max-width: 480px) {
  .dgrid {
    grid-template-columns: minmax(0, 1fr);
  }
}
@container (min-width: 720px) {
  .dgrid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 560px) {
  /* то же для браузеров без container queries */
  .dgrid {
    grid-template-columns: minmax(0, 1fr);
  }
}

/* Зубная карта */
.teeth {
  container-type: inline-size; /* раскладка зависит от ширины самой карты, а не экрана */
}
.teeth__bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
  margin-bottom: 12px;
}
.btn--sm {
  height: 36px;
  padding: 0 12px;
}

/* Переключатель «Постоянные / Молочные» */
.seg {
  display: inline-flex;
  padding: 3px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--muted-bg, #f1f5f9);
}
.seg button {
  height: 36px;
  padding: 0 14px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--text-2);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.seg button[aria-pressed="true"] {
  background: var(--surface, #ffffff);
  color: var(--primary-700);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.12);
}
.seg button:focus-visible {
  outline: 2px solid var(--primary-600);
  outline-offset: 1px;
}

/* Цвета отметок: общие для зубов, кисти и легенды */
[data-s="К"] {
  --tb: color-mix(in srgb, var(--warning) 20%, white);
  --tc: var(--warning);
}
[data-s="П"] {
  --tb: var(--primary-50, #f0fdfa);
  --tc: var(--primary-600);
}
[data-s="Пт"] {
  --tb: color-mix(in srgb, var(--emergency) 12%, white);
  --tc: var(--emergency);
}
[data-s="Р"] {
  --tb: color-mix(in srgb, var(--warning) 10%, var(--muted-bg, #f1f5f9));
  --tc: var(--text-3);
}
[data-s="И"],
[data-s="Имп"] {
  --tb: color-mix(in srgb, var(--accent-blue) 12%, white);
  --tc: var(--accent-blue);
}
[data-s="О"] {
  --tb: var(--muted-bg, #f1f5f9);
  --tc: var(--text-3);
}

/* Кисть */
.palette {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
}
.pal {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 0 12px 0 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface, #ffffff);
  color: var(--text-1);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.pal[aria-pressed="true"] {
  border-color: var(--primary-600);
  outline: 2px solid var(--primary-600);
  outline-offset: 0;
}
.pal:focus-visible {
  outline: 2px solid var(--primary-600);
  outline-offset: 2px;
}
.pal i,
.legend i {
  display: inline-grid;
  place-items: center;
  min-width: 24px;
  height: 22px;
  padding: 0 4px;
  border: 1px solid var(--tc, var(--border));
  border-radius: 6px;
  background: var(--tb, var(--surface, #ffffff));
  color: var(--text-1);
  font-style: normal;
  font-size: 12px;
  font-weight: 700;
}
.pal i[data-s="О"],
.legend i[data-s="О"] {
  border-style: dashed;
}
@media (hover: hover) {
  .pal:hover {
    background: var(--muted-bg, #f1f5f9);
  }
}

/* Квадранты: перекрестье как в бумажной формуле */
.teeth__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.quad {
  min-width: 0;
  padding: 0 0 12px;
}
.quad:nth-child(odd) {
  padding-right: 10px;
  border-right: 2px solid var(--border);
}
.quad:nth-child(even) {
  padding-left: 10px;
}
.quad:nth-child(n + 3) {
  padding-top: 12px;
  padding-bottom: 0;
  border-top: 2px solid var(--border);
}
.quad__cap {
  display: block;
  margin-bottom: 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-3);
}
.quad:nth-child(odd) .quad__cap {
  text-align: right;
}
.quad__row {
  display: flex;
  gap: 3px;
}
.quad:nth-child(odd) .quad__row {
  justify-content: flex-end; /* зубы прижаты к центру, как на схеме */
}
.tooth {
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 0;
  max-width: 48px;
  height: 52px;
  padding: 0;
  border: 1px solid var(--tc, var(--border));
  border-radius: 6px;
  background: var(--tb, var(--surface, #ffffff));
  color: var(--text-1);
  font: inherit;
  cursor: pointer;
}
.tooth[data-s="О"] {
  border-style: dashed;
  color: var(--text-3);
}
.tooth small {
  font-size: 10px;
  line-height: 1;
  color: var(--text-3);
}
.tooth span {
  min-height: 17px;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.3;
}
.tooth:focus-visible {
  outline: 2px solid var(--primary-600);
  outline-offset: 2px;
}
.tooth.is-selected {
  outline: 2px solid var(--primary-600);
  outline-offset: 1px;
}
@media (hover: hover) {
  .tooth:hover {
    border-color: var(--primary-600);
  }
}
@media (pointer: coarse) {
  .tooth {
    height: 56px;
  }
}
.teeth__caption {
  min-height: 20px;
  margin: 10px 0 0;
  font-size: 13px;
  color: var(--text-2);
}

/* Узкая карта (телефон, узкое окно): квадранты друг под другом, по 8 зубов в ряд */
@container (max-width: 480px) {
  .teeth__grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }
  .quad:nth-child(n) {
    padding: 0;
    border: 0;
  }
  .quad:nth-child(odd) .quad__cap {
    text-align: left;
  }
  .quad:nth-child(odd) .quad__row {
    justify-content: flex-start;
  }
}
@media (max-width: 560px) {
  /* то же для браузеров без container queries */
  .teeth__grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }
  .quad:nth-child(n) {
    padding: 0;
    border: 0;
  }
  .quad:nth-child(odd) .quad__cap {
    text-align: left;
  }
  .quad:nth-child(odd) .quad__row {
    justify-content: flex-start;
  }
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin: 12px 0 0;
  padding: 0;
  list-style: none;
  font-size: 12px;
  color: var(--text-2);
}
.legend li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

/* Услуги */
.dsec__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}
.dsec__bar .dsec__title {
  margin-bottom: 0;
}
.services {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--border);
  border-radius: 8px;
}
.service {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 8px 10px 12px;
}
.service + .service {
  border-top: 1px solid var(--border);
}
.service__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 14px;
  color: var(--text-1);
  overflow-wrap: anywhere;
}
.service__meta {
  font-size: 12px;
  color: var(--text-3);
}
.service__sum {
  flex: none;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-1);
  font-variant-numeric: tabular-nums;
}
.service .btn--icon {
  width: 36px;
  height: 36px;
  flex: none;
}
/* Итог по услугам: сумма, скидка, к оплате */
.bill {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--muted-bg, #f1f5f9);
  font-size: 14px;
  color: var(--text-2);
}
.bill__row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-variant-numeric: tabular-nums;
}
.bill__row--disc {
  color: var(--primary-700);
  font-weight: 600;
}
.bill__row--total {
  margin-top: 4px;
  padding-top: 8px;
  border-top: 1px solid var(--border);
  font-size: 16px;
  color: var(--text-1);
}
.bill__row--total strong {
  font-weight: 700;
}
.bill__btn {
  align-self: flex-end;
  margin-top: 4px;
}

/* Окно скидки */
.disc__seg {
  display: flex;
  width: 100%;
}
.disc__seg button {
  flex: 1;
}
.disc__preview {
  grid-column: 1 / -1;
  margin: 0;
  font-size: 13px;
}
.disc__preview strong {
  color: var(--text-1);
}
.disc__remove {
  margin-right: auto;
  color: var(--error);
}

/* Три поля в ряд: дата, цена, количество */
.trio {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}
@media (max-width: 560px) {
  .trio {
    grid-template-columns: minmax(0, 1fr);
    gap: 12px;
  }
}

/* Зубная карта в окне услуги */
.svc-teeth__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}
.svc-teeth__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 10px;
}
.svc-teeth__foot .teeth__caption {
  margin: 0;
}
.tooth.is-picked {
  background: var(--primary-600);
  border-color: var(--primary-600);
  color: #fff;
}
.tooth.is-picked small {
  color: rgba(255, 255, 255, 0.85);
}
.modal--service .input[type="date"] {
  min-height: 44px;
}

/* Кнопка выбора даты */
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

/* Окно выбора даты */
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
  background-color: #ffffff;
  background: var(--surface, #ffffff);
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
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 12px;
}
.dp__title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.dp__month {
  margin: 0;
  font-size: 20px;
  line-height: 1.1;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-1);
}
.dp__year {
  height: 36px;
  padding: 0 28px 0 10px;
  -webkit-appearance: none;
  appearance: none;
  border: 1px solid var(--border);
  border-radius: 8px;
  background-color: var(--surface, #ffffff);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath d='m5 7.5 5 5 5-5' fill='none' stroke='%2364748b' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 6px center;
  background-size: 16px;
  color: var(--text-2);
  font: inherit;
  font-size: 16px;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}
.dp__year:focus-visible {
  outline: 2px solid var(--primary-600);
  outline-offset: 1px;
}
.dp__nav {
  display: flex;
  gap: 4px;
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
    background: var(--primary-50, #f0fdfa);
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

/* Блоки по первой букве фамилии */
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
  order: 2;
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
  background: var(--muted-bg, #f1f5f9);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
}

/* Пары коротких полей остаются в две колонки даже на телефоне */
.pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

/* Пары коротких полей на телефоне: меньше промежуток */
@media (max-width: 560px) {
  .pair {
    gap: 12px;
  }
}

/* Очень узкие экраны */
@media (max-width: 360px) {
  .card {
    padding: 16px;
  }
  .seg button {
    padding: 0 10px;
  }
}

/* ===== Телефоны ===== */
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
  .dp__day {
    transition: none !important;
  }
}
</style>
