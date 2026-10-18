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
    // основной макет: боковое меню + router-view для вложенных страниц
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
        path: "staff",
        name: "staff",
        meta: { title: "Персонал" },
        component: () =>
          import(/* webpackChunkName: "staff" */ "../views/StaffView.vue"),
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
