<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { supabase } from '../supabase'
import { aISO } from '../utils/periodos'

const route = useRoute()
const router = useRouter()

const hoy = aISO(new Date())

const miembros = ref([])

const coloresBadge = { verde: 'success', amarillo: 'warning', rojo: 'danger' }

function mensajeSemaforo(semaforo, dias) {
  if (semaforo === 'rojo') return `Membresía vencida hace ${Math.abs(dias)} día(s)`
  if (dias === 0) return 'Vence hoy'
  if (semaforo === 'amarillo') return `Vence en ${dias} día(s)`
  return `Al día (${dias} días restantes)`
}

function horaCorta(timestamp) {
  return new Date(timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
}

async function cargarMiembros() {
  const { data, error } = await supabase
    .from('miembros')
    .select('id, nombre, plan, activo')
    .order('nombre', { ascending: true })
  if (error) console.error(error)
  miembros.value = data ?? []
}

// ---------- Ingreso manual (CU-13) ----------
const busquedaManual = ref('')
const registrando = ref(false)
const resultadoManual = ref(null)
const errorManual = ref('')

const coincidencias = computed(() => {
  const texto = busquedaManual.value.trim().toLowerCase()
  if (texto.length < 2) return []
  return miembros.value
    .filter((m) => m.activo && m.nombre.toLowerCase().includes(texto))
    .slice(0, 6)
})

async function registrarManual(miembro) {
  errorManual.value = ''
  resultadoManual.value = null
  registrando.value = true

  const { data, error } = await supabase.rpc('registrar_asistencia_manual', {
    p_miembro_id: miembro.id,
  })
  registrando.value = false

  if (error) {
    errorManual.value = 'No se pudo registrar el ingreso: ' + error.message
    return
  }
  if (!data?.ok) {
    errorManual.value = 'No se encontró al miembro o está inactivo'
    return
  }

  resultadoManual.value = data
  busquedaManual.value = ''
  await cargarHistorial()
}

// ---------- Historial (CU-07) ----------
const desde = ref(hoy)
const hasta = ref(hoy)
const filtroMiembro = ref(typeof route.query.miembro === 'string' ? route.query.miembro : '')
const filtroNombre = ref('')
const registros = ref([])
const cargando = ref(false)
const errorHistorial = ref('')

// Si se llega desde el perfil de un miembro, se muestran sus últimos 30 días
if (filtroMiembro.value) {
  const d = new Date()
  d.setDate(d.getDate() - 29)
  desde.value = aISO(d)
}

const miembroFiltrado = computed(
  () => miembros.value.find((m) => m.id === filtroMiembro.value) || null
)

function establecerRango(dias) {
  const d = new Date()
  d.setDate(d.getDate() - (dias - 1))
  desde.value = aISO(d)
  hasta.value = hoy
  cargarHistorial()
}

function quitarFiltroMiembro() {
  filtroMiembro.value = ''
  router.replace({ query: {} })
  cargarHistorial()
}

async function cargarHistorial() {
  errorHistorial.value = ''
  if (desde.value > hasta.value) {
    errorHistorial.value = 'La fecha inicial no puede ser posterior a la final'
    return
  }

  cargando.value = true
  let consulta = supabase
    .from('asistencias')
    .select('id, miembro_id, fecha, hora_ingreso, semaforo, dias_restantes, metodo')
    .gte('fecha', desde.value)
    .lte('fecha', hasta.value)
    .order('fecha', { ascending: false })
    .order('hora_ingreso', { ascending: false })
    .limit(1000)

  if (filtroMiembro.value) consulta = consulta.eq('miembro_id', filtroMiembro.value)

  const { data, error } = await consulta
  cargando.value = false

  if (error) {
    errorHistorial.value = 'No se pudo cargar el historial'
    return
  }
  registros.value = data
}

const filas = computed(() => {
  const mapa = Object.fromEntries(miembros.value.map((m) => [m.id, m]))
  const texto = filtroNombre.value.trim().toLowerCase()
  return registros.value
    .map((r) => ({
      ...r,
      nombre: mapa[r.miembro_id]?.nombre ?? '—',
      plan: mapa[r.miembro_id]?.plan ?? '—',
    }))
    .filter((r) => !texto || r.nombre.toLowerCase().includes(texto))
})

onMounted(async () => {
  await cargarMiembros()
  await cargarHistorial()
})
</script>

<template>
  <div class="container mt-4" style="max-width: 900px">
    <h1 class="mb-3">Asistencia</h1>

    <!-- Ingreso manual -->
    <div class="card shadow-sm mb-4">
      <div class="card-body">
        <h2 class="h6 text-uppercase text-muted">Registrar ingreso manual</h2>
        <p class="text-muted small mb-2">
          Úsalo cuando el lector falle o el miembro no use huella.
        </p>
        <input
          v-model="busquedaManual"
          type="text"
          class="form-control"
          placeholder="Escribe al menos 2 letras del nombre..."
        />

        <div v-if="coincidencias.length" class="list-group mt-2">
          <button
            v-for="m in coincidencias"
            :key="m.id"
            type="button"
            class="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
            :disabled="registrando"
            @click="registrarManual(m)"
          >
            <span>{{ m.nombre }} <small class="text-muted text-capitalize">· {{ m.plan }}</small></span>
            <span class="badge bg-primary">Registrar ingreso</span>
          </button>
        </div>
        <div
          v-else-if="busquedaManual.trim().length >= 2"
          class="text-muted small mt-2"
        >
          No hay miembros activos que coincidan.
        </div>

        <div v-if="errorManual" class="alert alert-danger py-2 mt-3 mb-0">{{ errorManual }}</div>
        <div
          v-if="resultadoManual"
          class="alert py-2 mt-3 mb-0"
          :class="`alert-${coloresBadge[resultadoManual.semaforo]}`"
        >
          <strong>{{ resultadoManual.nombre }}</strong>:
          {{ mensajeSemaforo(resultadoManual.semaforo, resultadoManual.dias_restantes) }}
        </div>
      </div>
    </div>

    <!-- Historial -->
    <div class="card shadow-sm">
      <div class="card-body">
        <h2 class="h6 text-uppercase text-muted">Historial de asistencia</h2>

        <div v-if="miembroFiltrado" class="alert alert-secondary py-2 d-flex justify-content-between align-items-center">
          <span>Mostrando solo a <strong>{{ miembroFiltrado.nombre }}</strong></span>
          <button class="btn btn-outline-secondary btn-sm" @click="quitarFiltroMiembro">Ver todos</button>
        </div>

        <div class="row g-2 align-items-end mb-3">
          <div class="col-6 col-md-3">
            <label class="form-label small mb-1">Desde</label>
            <input v-model="desde" type="date" class="form-control" :max="hoy" @change="cargarHistorial" />
          </div>
          <div class="col-6 col-md-3">
            <label class="form-label small mb-1">Hasta</label>
            <input v-model="hasta" type="date" class="form-control" :max="hoy" @change="cargarHistorial" />
          </div>
          <div v-if="!miembroFiltrado" class="col-12 col-md-6">
            <label class="form-label small mb-1">Filtrar por nombre</label>
            <input v-model="filtroNombre" type="text" class="form-control" placeholder="Nombre..." />
          </div>
        </div>

        <div class="d-flex gap-2 mb-3">
          <button class="btn btn-outline-primary btn-sm" @click="establecerRango(1)">Hoy</button>
          <button class="btn btn-outline-primary btn-sm" @click="establecerRango(7)">Últimos 7 días</button>
          <button class="btn btn-outline-primary btn-sm" @click="establecerRango(30)">Últimos 30 días</button>
        </div>

        <div v-if="errorHistorial" class="alert alert-danger py-2">{{ errorHistorial }}</div>
        <div v-else-if="cargando" class="text-center text-muted">Cargando...</div>
        <div v-else-if="filas.length === 0" class="text-center text-muted">
          No hay ingresos registrados en este periodo.
        </div>

        <template v-else>
          <div class="text-muted small mb-2">{{ filas.length }} ingreso(s)</div>
          <div class="table-responsive">
            <table class="table table-sm align-middle mb-0">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Hora</th>
                  <th>Miembro</th>
                  <th>Plan</th>
                  <th>Estado</th>
                  <th>Método</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in filas" :key="r.id">
                  <td>{{ r.fecha }}</td>
                  <td>{{ horaCorta(r.hora_ingreso) }}</td>
                  <td>
                    <RouterLink :to="`/perfil/${r.miembro_id}`">{{ r.nombre }}</RouterLink>
                  </td>
                  <td class="text-capitalize">{{ r.plan }}</td>
                  <td>
                    <span
                      class="badge"
                      :class="[`bg-${coloresBadge[r.semaforo]}`, { 'text-dark': r.semaforo === 'amarillo' }]"
                    >
                      {{ r.semaforo }} · {{ r.dias_restantes }} d
                    </span>
                  </td>
                  <td class="text-capitalize">{{ r.metodo }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>