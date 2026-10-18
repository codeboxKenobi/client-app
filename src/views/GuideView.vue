<script setup>
import { ref, computed } from "vue";

/* ---------- Содержимое руководства ----------
   Блок: { h: заголовок, p: абзац, list: [пункты], colors: true — показать цвета событий } */
const COLORS = [
  { value: "#0f766e", label: "Основной" },
  { value: "#005a9c", label: "Синий" },
  { value: "#10b981", label: "Норма" },
  { value: "#f59e0b", label: "Внимание" },
  { value: "#dc2626", label: "Срочно" },
];

const sections = [
  {
    id: "start",
    title: "Начало работы",
    lead: "Общие приёмы, которые одинаково работают во всех разделах.",
    blocks: [
      {
        h: "Меню и разделы",
        p: "Разделы открываются из бокового меню: «Календарь» — расписание приёмов, «Персонал» — карточки сотрудников, «Руководство» — эта инструкция, «Роли» — права доступа. Какие разделы и действия вам доступны, зависит от вашей роли: недоступный раздел в меню не показывается.",
      },
      {
        h: "Фильтры",
        list: [
          "Кнопка «Фильтры» в шапке раскрывает и скрывает панель. Число на кнопке показывает, сколько фильтров включено.",
          "На компьютере панель открыта сразу, на планшете и телефоне — свёрнута.",
          "Кнопка «Сбросить» очищает все поля. Пока фильтры не заданы, она неактивна.",
          "В телефонном поле можно ввести любую часть номера. Номера «8 912…» и «+7 912…» считаются одинаковыми.",
        ],
      },
      {
        h: "Клавиатура и сохранение",
        list: [
          "Клавиша Esc закрывает верхнее открытое окно: выбор даты или времени, форму, панель дня.",
          "Календарь сохраняет изменения сразу, кнопки «Сохранить» у события нет.",
          "Карточки сотрудников сохраняются кнопкой «Сохранить» в форме.",
          "Роли и права сохраняются кнопкой «Сохранить» в шапке страницы «Роли». Пока вы её не нажали, изменения можно отменить.",
        ],
      },
    ],
  },
  {
    id: "calendar",
    title: "Календарь",
    lead: "Месяц целиком: события, свободное время и панель выбранного дня.",
    blocks: [
      {
        h: "Как устроен экран",
        list: [
          "Неделя начинается с понедельника. Стрелки в шапке переключают месяцы, «Сегодня» возвращает к текущему дню и открывает его.",
          "Нажмите на день, чтобы открыть панель с событиями. На компьютере она появляется справа, на планшете и телефоне — выезжает снизу.",
          "Повторное нажатие на выбранный день закрывает панель. Нажатие на день соседнего месяца переключает месяц.",
          "Нажатие на событие в ячейке открывает этот день и сразу раскрывает событие.",
          "На телефоне события в ячейках показаны цветными точками. Подробности — в панели дня.",
        ],
      },
      {
        h: "Создание события",
        list: [
          "Откройте нужный день и нажмите «Добавить событие».",
          "Выберите пациента (см. раздел «Пациенты»). Название события — это ФИО пациента, без пациента событие не добавить.",
          "Укажите начало и конец. Если время не задано, событие считается «Весь день» и свободное время не занимает.",
          "Конец не может быть раньше начала — форма покажет ошибку и не даст добавить событие.",
          "Заполните место, исполнителя, ассистентов и описание, выберите цвет. Все эти поля необязательные.",
          "Нажмите «Добавить».",
        ],
      },
      {
        h: "Цвета событий",
        p: "Цвет помогает быстро отличать события в календаре. Значения такие:",
        colors: true,
      },
      {
        h: "Изменение события",
        list: [
          "Нажмите на событие в списке — оно раскроется, и все поля можно править на месте.",
          "Флажок слева отмечает событие выполненным: оно станет бледным и зачёркнутым.",
          "Корзина справа удаляет событие сразу, без подтверждения.",
          "В поле ассистентов можно выбрать несколько сотрудников. Исполнитель не может быть своим ассистентом.",
        ],
      },
      {
        h: "Свободное время",
        list: [
          "Календарь ищет окна с 08:00 до 22:00. Окна короче 30 минут не показываются.",
          "Если у события не указан конец, оно занимает 60 минут.",
          "В ячейках дня окна показаны пунктирными плашками, в панели дня — списком «Свободное время».",
          "Нажмите на окно — откроется форма нового события с уже подставленным временем.",
          "Когда окон слишком много, плашки становятся компактнее, а лишние сворачиваются в «+N». Полный список — в панели дня.",
          "Если выбран исполнитель в фильтрах, свободное время считается по его расписанию.",
        ],
      },
      {
        h: "Сейчас и Далее",
        p: "В панели сегодняшнего дня вверху показаны события, которые идут сейчас, и ближайшие по времени начала. Для текущих указано, сколько осталось, для следующих — через сколько они начнутся. В ячейке календаря такие события выделены и всегда остаются видимыми. Выполненные события и события «весь день» сюда не попадают.",
      },
      {
        h: "Прошедшие дни",
        p: "Дни до сегодняшнего открываются только для просмотра. Событие можно раскрыть и прочитать, но нельзя добавить, изменить, отметить выполненным или удалить.",
      },
      {
        h: "Фильтры календаря",
        list: [
          "Пациент — поиск по ФИО, слова можно вводить в любом порядке.",
          "Номер телефона — поиск по номеру пациента.",
          "Исполнитель — выбранный сотрудник или «Не назначен».",
          "Ассистент — выбранный сотрудник или «Без ассистента».",
          "Под фильтрами показано, сколько событий найдено в текущем месяце. Раскрытое событие остаётся в списке, даже если после правки перестало подходить.",
        ],
      },
    ],
  },
  {
    id: "patients",
    title: "Пациенты",
    lead: "Выбор пациента для события и работа с его телефоном.",
    blocks: [
      {
        h: "Поиск и выбор",
        list: [
          "Нажмите на поле «Пациент» и начните вводить фамилию, имя или цифры телефона.",
          "Стрелки вверх и вниз перемещаются по списку, Enter выбирает пациента, Esc закрывает список.",
          "После выбора под полем показан телефон пациента.",
        ],
      },
      {
        h: "Новый пациент",
        list: [
          "Если пациента нет в списке, выберите последнюю строку «Добавить нового пациента». Введённый текст подставится в форму сам.",
          "Укажите ФИО (не короче двух символов) и номер телефона полностью: +7 (900) 000-00-00.",
          "Один номер нельзя указать у двух пациентов — календарь подскажет, у кого он уже есть.",
          "После сохранения пациент сразу выбирается в событии.",
        ],
      },
      {
        h: "Изменение телефона",
        p: "Рядом с телефоном выбранного пациента есть кнопка «Изменить». Новый номер проходит те же проверки и меняется у пациента во всех его событиях.",
      },
    ],
  },
  {
    id: "staff",
    title: "Персонал",
    lead: "Карточки сотрудников, сгруппированные по должностям.",
    blocks: [
      {
        h: "Список",
        list: [
          "Сотрудники собраны в блоки по должности, рядом с названием блока показано их число.",
          "Работающие сотрудники выделены цветной карточкой и значком «Работает», уволенные — серой и значком «Уволен».",
          "Фильтры: ФИО или email, номер телефона, должность, статус («Работают» или «Уволены»). Кнопка «Сбросить» очищает их.",
        ],
      },
      {
        h: "Добавление и редактирование",
        list: [
          "«Добавить сотрудника» открывает пустую форму, «Редактировать» в карточке — форму с данными.",
          "Все поля, кроме даты увольнения, обязательные. Некорректные поля подсвечиваются красным с подсказкой.",
          "Email должен быть в формате name@company.ru, телефон вводится полностью, скобки и дефисы подставляются сами.",
          "Для дат откроется календарь. Дату увольнения нельзя выбрать раньше даты приёма — такие дни недоступны.",
          "Оставьте дату увольнения пустой, если сотрудник работает.",
        ],
      },
      {
        h: "Роли",
        p: "Роль задаёт права сотрудника в системе. По умолчанию есть четыре роли: «Администратор системы», «Руководитель», «Сотрудник» и «Наблюдатель». Что именно разрешено каждой роли, настраивается в разделе «Роли».",
      },
      {
        h: "Удаление",
        p: "Кнопка «Удалить» просит подтверждение. Карточка удаляется без возможности восстановления. Если сотрудник просто ушёл, укажите дату увольнения — он останется в списке со статусом «Уволен».",
      },
    ],
  },
  {
    id: "roles",
    title: "Роли",
    lead: "Какие разделы видит каждая роль и что в них может делать.",
    blocks: [
      {
        h: "Как устроен экран",
        list: [
          "Вверху вкладки ролей. Число на вкладке показывает, к скольким разделам меню у роли есть доступ на просмотр.",
          "Под вкладками описание выбранной роли, а ниже по одной карточке на каждый раздел меню: «Календарь», «Персонал», «Руководство», «Роли».",
          "Карточка раздела с правом просмотра выделена цветом, без права просмотра — серая.",
        ],
      },
      {
        h: "Настройка прав",
        list: [
          "В каждой карточке четыре флажка: «Просмотр», «Создание», «Редактирование» и «Удаление».",
          "Кнопка «Выбрать все» включает все четыре права сразу, «Снять все» выключает их.",
          "Без просмотра остальные права невозможны: если снять «Просмотр», остальные флажки снимутся сами. Если включить создание, редактирование или удаление, «Просмотр» включится автоматически.",
          "Раздел без права просмотра не появляется в меню. Под карточкой в таком случае есть подсказка.",
        ],
      },
      {
        h: "Сохранение изменений",
        list: [
          "Кнопки «Сохранить» и «Отменить» в шапке активны, только когда есть несохранённые изменения.",
          "«Отменить» возвращает права и список ролей к последнему сохранённому состоянию.",
          "Создание, переименование и удаление ролей, как и флажки, вступают в силу после «Сохранить».",
        ],
      },
      {
        h: "Создание роли",
        list: [
          "Нажмите «Добавить роль» в шапке.",
          "Введите название: оно обязательное, до 40 символов, и не должно повторять название другой роли.",
          "При желании добавьте описание: кто имеет эту роль и чем занимается.",
          "В списке «Скопировать права» можно выбрать существующую роль, чтобы начать с её прав. Вариант «Без прав» создаёт пустую роль.",
          "После создания откроется вкладка новой роли, права можно сразу поправить.",
        ],
      },
      {
        h: "Редактирование и удаление",
        list: [
          "«Редактировать» над карточками меняет название и описание выбранной роли.",
          "«Удалить» просит подтверждение. Роль и все её права исчезнут после сохранения.",
          "Сотрудникам, у которых была удалённая роль, нужно назначить другую в разделе «Персонал».",
        ],
      },
      {
        h: "Системная роль",
        p: "«Администратор системы» защищена: у неё включены все права, а название, описание и удаление недоступны. Это нужно, чтобы никто случайно не лишился доступа к настройкам. Такая роль отмечена значком «Системная роль».",
      },
    ],
  },
  {
    id: "faq",
    title: "Частые вопросы",
    lead: "Короткие ответы на то, о чём спрашивают чаще всего.",
    faq: [
      {
        q: "Почему в календаре нельзя ничего изменить?",
        a: "Вы открыли прошедший день, такие дни доступны только для просмотра. Сегодняшние и будущие дни редактируются как обычно.",
      },
      {
        q: "Почему не нажимается кнопка «Добавить» у события?",
        a: "Не выбран пациент или конец события раньше начала. Выберите пациента из списка или добавьте нового и проверьте время.",
      },
      {
        q: "Куда пропало событие из календаря?",
        a: "Проверьте фильтры: под ними может скрываться часть событий. Нажмите «Сбросить», чтобы увидеть всё. В панели дня при этом написано, сколько событий показано из скольких.",
      },
      {
        q: "Не получается добавить пациента с таким номером.",
        a: "Номер уже записан у другого пациента, его имя показано в сообщении об ошибке. Выберите этого пациента из списка.",
      },
      {
        q: "Как убрать сотрудника, который уволился?",
        a: "Откройте «Редактировать» и укажите дату увольнения. Карточка останется в архиве со статусом «Уволен». Удалять её не нужно.",
      },
      {
        q: "Почему в меню нет нужного раздела или не видно кнопок?",
        a: "У вашей роли нет прав на этот раздел или действие. Раздел без права просмотра в меню не показывается, а кнопки добавления, редактирования и удаления зависят от соответствующих прав. Обратитесь к администратору: он может изменить права в разделе «Роли».",
      },
      {
        q: "Я изменил права, но ничего не поменялось.",
        a: "Изменения на странице «Роли» вступают в силу после кнопки «Сохранить» в шапке. Пока она активна, правки ещё не сохранены.",
      },
      {
        q: "Не получается изменить права «Администратора системы».",
        a: "Это системная роль, её права и название защищены от изменений. Чтобы настроить доступ под свои задачи, создайте новую роль и скопируйте в неё права нужной.",
      },
      {
        q: "Фильтры не видны на телефоне.",
        a: "На телефоне и планшете панель свёрнута. Нажмите кнопку с воронкой в шапке.",
      },
    ],
  },
];

/* ---------- Поиск по руководству ---------- */
const query = ref("");
const norm = (v) =>
  String(v ?? "")
    .toLowerCase()
    .replace(/ё/g, "е");

function textOf(section) {
  const parts = [section.title, section.lead];
  for (const b of section.blocks ?? []) parts.push(b.h, b.p, ...(b.list ?? []));
  for (const f of section.faq ?? []) parts.push(f.q, f.a);
  return norm(parts.filter(Boolean).join(" "));
}

const searchIndex = sections.map((s) => ({ id: s.id, text: textOf(s) }));

const visible = computed(() => {
  const words = norm(query.value).split(/\s+/).filter(Boolean);
  if (!words.length) return sections;
  const ok = new Set(
    searchIndex
      .filter((x) => words.every((w) => x.text.includes(w)))
      .map((x) => x.id)
  );
  return sections.filter((s) => ok.has(s.id));
});

function goTo(id) {
  document
    .getElementById(`guide-${id}`)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}
</script>

<template>
  <div class="page">
    <header class="page__head">
      <h1 class="page__title">Руководство</h1>

      <div class="page__actions">
        <label class="search">
          <span class="sr-only">Поиск по руководству</span>
          <input
            v-model="query"
            type="search"
            placeholder="Поиск по руководству"
            autocomplete="off"
          />
        </label>
      </div>
    </header>

    <div class="layout">
      <!-- Оглавление -->
      <nav class="toc" aria-label="Оглавление">
        <ul>
          <li v-for="s in visible" :key="s.id">
            <button type="button" class="toc__link" @click="goTo(s.id)">
              {{ s.title }}
            </button>
          </li>
        </ul>
      </nav>

      <div class="content">
        <p v-if="!visible.length" class="empty">
          Ничего не найдено. Попробуйте другое слово или
          <button type="button" class="linkbtn" @click="query = ''">
            очистите поиск</button
          >.
        </p>

        <section
          v-for="s in visible"
          :id="`guide-${s.id}`"
          :key="s.id"
          class="section"
          :aria-labelledby="`guide-h-${s.id}`"
        >
          <header class="section__head">
            <h2 :id="`guide-h-${s.id}`" class="section__title">
              {{ s.title }}
            </h2>
          </header>
          <p class="section__lead">{{ s.lead }}</p>

          <div v-if="s.blocks" class="blocks">
            <article v-for="b in s.blocks" :key="b.h" class="block">
              <h3>{{ b.h }}</h3>
              <p v-if="b.p">{{ b.p }}</p>
              <ul v-if="b.list" class="block__list">
                <li v-for="(item, i) in b.list" :key="i">{{ item }}</li>
              </ul>
              <ul v-if="b.colors" class="colors">
                <li v-for="c in COLORS" :key="c.value">
                  <span
                    class="colors__dot"
                    :style="{ background: c.value }"
                  ></span>
                  {{ c.label }}
                </li>
              </ul>
            </article>
          </div>

          <div v-if="s.faq" class="faq">
            <details v-for="f in s.faq" :key="f.q" class="faq__item">
              <summary>
                <span>{{ f.q }}</span>
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
              </summary>
              <p>{{ f.a }}</p>
            </details>
          </div>
        </section>
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
  min-width: 0;
}
.search {
  display: block;
  width: 280px;
  max-width: 100%;
}
.search input {
  width: 100%;
  height: 44px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background-color: var(--surface);
  color: var(--text-1);
  font: inherit;
  font-size: 16px;
  -webkit-appearance: none;
  appearance: none;
}
.search input::placeholder {
  color: var(--text-3);
}
.search input:focus-visible {
  outline: 2px solid var(--primary-600);
  outline-offset: 1px;
  border-color: transparent;
}

/* Раскладка: оглавление слева, текст справа */
.layout {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 24px;
  align-items: start;
}
.toc {
  position: sticky;
  top: 24px;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
}
.toc ul {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0;
  padding: 0;
  list-style: none;
}
.toc__link {
  width: 100%;
  min-height: 40px;
  padding: 0 12px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--text-2);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}
.toc__link:focus-visible {
  outline: 2px solid var(--primary-600);
  outline-offset: 2px;
}
@media (hover: hover) {
  .toc__link:hover {
    background: var(--primary-50);
    color: var(--primary-700);
  }
}

.content {
  min-width: 0;
}
.section {
  scroll-margin-top: 24px;
}
.section + .section {
  margin-top: 32px;
}
.section__head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
}
.section__head::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--border);
}
.section__title {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.section__lead {
  margin: 0 0 16px;
  font-size: 14px;
  line-height: 1.5;
  color: var(--text-3);
}

.blocks {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 20px;
}
.block {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 20px;
  border: 1px solid var(--border);
  border-left: 4px solid var(--primary-600);
  border-radius: 8px;
  background: var(--surface);
}
.block h3 {
  font-size: 16px;
  font-weight: 600;
}
.block p {
  margin: 0;
  font-size: 14px;
  line-height: 1.6;
}
.block__list {
  margin: 0;
  padding-left: 18px;
  display: grid;
  gap: 8px;
  font-size: 14px;
  line-height: 1.55;
}
.block__list li::marker {
  color: var(--primary-600);
}

.colors {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 14px;
  color: var(--text-1);
}
.colors li {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.colors__dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
}

/* Частые вопросы */
.faq {
  display: grid;
  gap: 8px;
}
.faq__item {
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface);
}
.faq__item summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 48px;
  padding: 8px 16px;
  color: var(--text-1);
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  list-style: none;
}
.faq__item summary::-webkit-details-marker {
  display: none;
}
.faq__item summary:focus-visible {
  outline: 2px solid var(--primary-600);
  outline-offset: 2px;
  border-radius: 8px;
}
.faq__item summary svg {
  flex: none;
  color: var(--text-3);
  transition: transform 0.2s;
}
.faq__item[open] summary svg {
  transform: rotate(180deg);
}
.faq__item p {
  margin: 0;
  padding: 0 16px 16px;
  font-size: 14px;
  line-height: 1.6;
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
.linkbtn {
  padding: 0;
  border: 0;
  background: none;
  color: var(--primary-600);
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
}
.linkbtn:focus-visible {
  outline: 2px solid var(--primary-600);
  outline-offset: 2px;
  border-radius: 2px;
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

/* Планшеты: оглавление становится лентой над текстом */
@media (max-width: 1024px) {
  .layout {
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
  }
  .toc {
    position: static;
    padding: 6px;
    overflow-x: auto;
  }
  .toc ul {
    flex-direction: row;
    gap: 4px;
  }
  .toc__link {
    width: auto;
    white-space: nowrap;
  }
  .section {
    scroll-margin-top: 12px;
  }
}

/* Телефоны */
@media (max-width: 640px) {
  /* название страницы уже есть в верхней панели дашборда */
  .page__title {
    display: none;
  }
  .page__head {
    min-height: 36px;
    margin-bottom: 12px;
  }
  .page__actions {
    flex: 1;
  }
  .search {
    width: 100%;
  }
  .search input {
    height: 36px;
  }
  .section + .section {
    margin-top: 24px;
  }
  .section__title {
    font-size: 18px;
  }
  .blocks {
    gap: 12px;
  }
  .block {
    padding: 16px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .toc__link,
  .faq__item summary svg {
    transition: none !important;
  }
}
</style>
