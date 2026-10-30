import { createRouter, createWebHistory } from "vue-router";
import HomeView from "../views/HomeView.vue";

const routes = [
  {
    // страница входа / регистрации
    path: "/",
    name: "home",
    component: HomeView,
  },
  {
    // основной макет: боковое меню + router-view
    path: "/dashboard",
    component: () =>
      import(/* webpackChunkName: "dashboard" */ "../views/DashboardView.vue"),
    children: [
      { path: "", redirect: { name: "calendar" } },
      {
        path: "calendar",
        name: "calendar",
        meta: { title: "Календарь" },
        component: () =>
          import(
            /* webpackChunkName: "calendar" */ "../views/CalendarView.vue"
          ),
      },
      {
        path: "patients",
        name: "patients",
        meta: { title: "Пациенты" },
        component: () =>
          import(/* webpackChunkName: "staff" */ "../views/PatientsView.vue"),
      },
      {
        path: "staff",
        name: "staff",
        meta: { title: "Персонал" },
        component: () =>
          import(/* webpackChunkName: "staff" */ "../views/StaffView.vue"),
      },
      {
        path: "roles",
        name: "roles",
        meta: { title: "Роли" },
        component: () =>
          import(/* webpackChunkName: "staff" */ "../views/RolesView.vue"),
      },
      {
        path: "guide",
        name: "guide",
        meta: { title: "Руководство пользователя" },
        component: () =>
          import(/* webpackChunkName: "staff" */ "../views/GuideView.vue"),
      },
    ],
  },
  { path: "/:pathMatch(.*)*", redirect: "/" },
];

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
});

export default router;
