import { createRouter, createWebHistory } from "vue-router";
import { ambilToken } from "../services/api";
import LoginView from "../views/LoginView.vue";
import DashboardView from "../views/DashboardView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: "/",
      redirect: "/dashboard"
    },
    {
      path: "/login",
      name: "login",
      component: LoginView
    },
    {
      path: "/dashboard",
      name: "dashboard",
      component: DashboardView,
      meta: { wajibMasuk: true }
    },
    {
      path: "/tiket",
      name: "tiket",
      component: DashboardView,
      meta: { wajibMasuk: true }
    },
    {
      path: "/surat-tugas",
      name: "surat-tugas",
      component: DashboardView,
      meta: { wajibMasuk: true }
    }
  ]
});

router.beforeEach((to) => {
  const token = ambilToken();
  if (to.meta.wajibMasuk && !token) {
    return { name: "login" };
  }

  if (to.name === "login" && token) {
    return { name: "dashboard" };
  }

  return true;
});

export default router;
