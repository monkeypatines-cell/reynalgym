import { createRouter, createWebHistory } from 'vue-router'
import { supabase } from '../supabase'
import Login from '../views/Login.vue'
import Dashboard from '../views/Dashboard.vue'
import Miembros from '../views/Miembros.vue'
import PerfilMiembro from '../views/PerfilMiembro.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', name: 'login', component: Login },
    { path: '/dashboard', name: 'dashboard', component: Dashboard, meta: { requiresAuth: true } },
    { path: '/miembros', name: 'miembros', component: Miembros, meta: { requiresAuth: true } },
    { path: '/perfil/:id', name: 'perfil', component: PerfilMiembro, meta: { requiresAuth: true } },
  ],
})

router.beforeEach(async (to) => {
  if (to.meta.requiresAuth) {
    const { data } = await supabase.auth.getSession()
    if (!data.session) {
      return { name: 'login' }
    }
  }
})

export default router