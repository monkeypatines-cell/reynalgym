<script setup>
import { ref, onMounted, computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { supabase } from '../supabase'
import { colorSemaforo, textoSemaforo } from '../utils/semaforo'

const router = useRouter()
const miembros = ref([])
const busqueda = ref('')
const cargando = ref(true)
const error = ref('')

async function cargarMiembros() {
  cargando.value = true
  error.value = ''
  const { data, error: fetchError } = await supabase
    .from('miembros')
    .select('id, nombre, celular, plan, forma_pago, fecha_vencimiento')
    .order('nombre', { ascending: true })

  if (fetchError) {
    error.value = 'No se pudieron cargar los miembros'
    cargando.value = false
    return
  }
  miembros.value = data
  cargando.value = false
}

onMounted(cargarMiembros)

const miembrosFiltrados = computed(() => {
  if (!busqueda.value.trim()) return miembros.value
  const texto = busqueda.value.toLowerCase()
  return miembros.value.filter((m) => m.nombre.toLowerCase().includes(texto))
})

function verPerfil(id) {
  router.push(`/perfil/${id}`)
}
</script>

<template>
  <div class="container mt-4">
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h1>Miembros</h1>
      <div class="d-flex gap-2">
        <RouterLink to="/dashboard" class="btn btn-outline-secondary btn-sm">Volver al Dashboard</RouterLink>
        <RouterLink to="/miembros/nuevo" class="btn btn-primary btn-sm">+ Agregar miembro</RouterLink>
      </div>
    </div>

    <input
      v-model="busqueda"
      type="text"
      class="form-control mb-3"
      placeholder="Buscar por nombre..."
    />

    <div v-if="cargando" class="text-center text-muted">Cargando...</div>
    <div v-else-if="error" class="alert alert-danger">{{ error }}</div>
    <div v-else-if="miembrosFiltrados.length === 0" class="text-center text-muted">
      No hay miembros que coincidan.
    </div>

    <table v-else class="table table-hover align-middle">
      <thead>
        <tr>
          <th>Nombre</th>
          <th>Celular</th>
          <th>Plan</th>
          <th>Pago</th>
          <th>Vence</th>
          <th>Estado</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="m in miembrosFiltrados"
          :key="m.id"
          @click="verPerfil(m.id)"
          style="cursor: pointer"
        >
          <td>{{ m.nombre }}</td>
          <td>{{ m.celular || '—' }}</td>
          <td class="text-capitalize">{{ m.plan }}</td>
          <td class="text-capitalize">{{ m.forma_pago }}</td>
          <td>{{ m.fecha_vencimiento }}</td>
          <td>
            <span class="badge" :class="`bg-${colorSemaforo(m.fecha_vencimiento)}`">
              {{ textoSemaforo(m.fecha_vencimiento) }}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>