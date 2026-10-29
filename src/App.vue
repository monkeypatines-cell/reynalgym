<script setup>
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { supabase } from './supabase'

const route = useRoute()
const router = useRouter()

async function cerrarSesion() {
  await supabase.auth.signOut()
  router.push('/')
}
</script>

<template>
  <header v-if="route.meta.requiresAuth" class="rg-navbar">
    <div class="rg-navbar-inner">
      <RouterLink to="/dashboard" class="rg-brand">Reynal<span>Gym</span></RouterLink>
      
      <nav class="rg-links">
        <RouterLink to="/dashboard" class="rg-link">Dashboard</RouterLink>
        <RouterLink to="/miembros" class="rg-link">Miembros</RouterLink>
        <RouterLink to="/asistencia" class="rg-link">Asistencia</RouterLink>
      </nav>
      <button class="rg-logout" @click="cerrarSesion">Cerrar sesión</button>
    </div>
  </header>

  <RouterView />
</template>