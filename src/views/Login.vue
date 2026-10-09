<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { supabase } from '../supabase'

const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const router = useRouter()

async function handleLogin() {
  error.value = ''
  loading.value = true
  const { error: loginError } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value,
  })
  loading.value = false
  if (loginError) {
    error.value = 'Correo o contraseña incorrectos'
    return
  }
  router.push('/dashboard')
}
</script>

<template>
  <div class="rg-login-wrap">
    <div class="rg-login-card">
      <h1>Reynal<span>Gym</span></h1>
      <p class="rg-sub">Panel de administración</p>

      <form @submit.prevent="handleLogin">
        <div class="mb-3">
          <label class="form-label">Correo</label>
          <input v-model="email" type="email" class="form-control" required />
        </div>
        <div class="mb-3">
          <label class="form-label">Contraseña</label>
          <input v-model="password" type="password" class="form-control" required />
        </div>
        <div v-if="error" class="alert alert-danger py-2">{{ error }}</div>
        <button type="submit" class="btn btn-primary w-100" :disabled="loading">
          {{ loading ? 'Ingresando...' : 'Ingresar' }}
        </button>
      </form>
    </div>
  </div>
</template>