<script setup>
import { ref, computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { supabase } from '../supabase'
import { colorSemaforo, textoSemaforo, diasRestantes } from '../utils/semaforo'

const miembros = ref([])
const cargando = ref(true)
const error = ref('')

onMounted(async () => {
  const { data, error: fetchError } = await supabase
    .from('miembros')
    .select('id, nombre, plan, forma_pago, fecha_inscripcion, fecha_vencimiento')

  if (fetchError) error.value = 'No se pudieron cargar los datos del dashboard'
  else miembros.value = data
  cargando.value = false
})

const fechaHoy = new Date().toLocaleDateString('es-CO', {
  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
})

// --- Semáforo ---
const contar = (color) =>
  miembros.value.filter((m) => colorSemaforo(m.fecha_vencimiento) === color).length

const total = computed(() => miembros.value.length)
const alDia = computed(() => contar('success'))
const porVencer = computed(() => contar('warning'))
const vencidos = computed(() => contar('danger'))

const pct = (n) => (total.value ? Math.round((n / total.value) * 100) : 0)
const anchoBarra = (cantidad) => (total.value ? `${(cantidad / total.value) * 100}%` : '0%')

const kpis = computed(() => [
  { etiqueta: 'Total de miembros', valor: total.value, nota: 'Registrados en el sistema', clase: 'k-total' },
  { etiqueta: 'Al día', valor: alDia.value, nota: `${pct(alDia.value)}% del total`, clase: 'k-ok' },
  { etiqueta: 'Por vencer', valor: porVencer.value, nota: 'Vencen en 5 días o menos', clase: 'k-warn' },
  { etiqueta: 'Vencidos', valor: vencidos.value, nota: 'Necesitan renovar', clase: 'k-bad' },
])

// --- Por plan y por forma de pago ---
const planes = ['diario', 'semanal', 'quincena', 'mensual']
const porPlan = computed(() =>
  planes.map((p) => ({ nombre: p, cantidad: miembros.value.filter((m) => m.plan === p).length }))
)
const porPago = computed(() => [
  { nombre: 'Efectivo', clase: 'efectivo', cantidad: miembros.value.filter((m) => m.forma_pago === 'efectivo').length },
  { nombre: 'Transferencia', clase: 'transferencia', cantidad: miembros.value.filter((m) => m.forma_pago === 'transferencia').length },
])

// --- Inscripciones nuevas (según fecha_inscripcion) ---
const inscritosEn = (dias) =>
  miembros.value.filter((m) => {
    if (!m.fecha_inscripcion) return false
    const transcurridos = -diasRestantes(m.fecha_inscripcion)
    return transcurridos >= 0 && transcurridos < dias
  }).length
const inscHoy = computed(() => inscritosEn(1))
const insc7 = computed(() => inscritosEn(7))
const insc30 = computed(() => inscritosEn(30))

// --- Requieren atención: vencidos o por vencer, los más urgentes primero ---
const atencion = computed(() =>
  miembros.value
    .filter((m) => colorSemaforo(m.fecha_vencimiento) !== 'success')
    .sort((a, b) => diasRestantes(a.fecha_vencimiento) - diasRestantes(b.fecha_vencimiento))
)
const atencionVisible = computed(() => atencion.value.slice(0, 8))
</script>

<template>
  <div class="rg-page">
    <h1 class="rg-page-title">Dashboard</h1>
    <p class="rg-page-sub rg-date">{{ fechaHoy }}</p>

    <div v-if="cargando" class="text-center text-muted py-5">Cargando...</div>
    <div v-else-if="error" class="alert alert-danger">{{ error }}</div>

    <template v-else>
      <div v-if="total === 0" class="alert alert-info">
        Aún no hay miembros registrados. Agrega el primero desde la sección Miembros.
      </div>

      <!-- Resumen -->
      <div class="row g-3 mb-3">
        <div v-for="k in kpis" :key="k.etiqueta" class="col-6 col-lg-3">
          <div class="rg-card rg-kpi" :class="k.clase">
            <div class="rg-kpi-label">{{ k.etiqueta }}</div>
            <div class="rg-kpi-value">{{ k.valor }}</div>
            <div class="rg-kpi-note">{{ k.nota }}</div>
          </div>
        </div>
      </div>

      <!-- Atención + estado -->
      <div class="row g-3 mb-3">
        <div class="col-lg-7">
          <div class="rg-card">
            <h2>Requieren atención</h2>
            <p class="rg-sub">Membresías vencidas o por vencer, las más urgentes primero</p>

            <p v-if="atencion.length === 0" class="text-muted mb-0">
              Todo al día, no hay membresías pendientes.
            </p>
            <ul v-else class="rg-list">
              <li v-for="m in atencionVisible" :key="m.id">
                <div>
                  <RouterLink :to="`/perfil/${m.id}`">{{ m.nombre }}</RouterLink>
                  <div class="small text-muted text-capitalize">Plan {{ m.plan }}</div>
                </div>
                <span class="badge" :class="`bg-${colorSemaforo(m.fecha_vencimiento)}`">
                  {{ textoSemaforo(m.fecha_vencimiento) }}
                </span>
              </li>
            </ul>
            <RouterLink
              v-if="atencion.length > atencionVisible.length"
              to="/miembros"
              class="small d-inline-block mt-2"
            >
              Ver los {{ atencion.length }} en Miembros →
            </RouterLink>
          </div>
        </div>

        <div class="col-lg-5">
          <div class="rg-card">
            <h2>Estado de membresías</h2>
            <p class="rg-sub">Proporción según la fecha de vencimiento</p>
            <div class="rg-stack">
              <div class="s-ok" :style="{ width: anchoBarra(alDia) }"></div>
              <div class="s-warn" :style="{ width: anchoBarra(porVencer) }"></div>
              <div class="s-bad" :style="{ width: anchoBarra(vencidos) }"></div>
            </div>
            <div class="rg-legend">
              <span><i class="rg-dot" style="background: var(--rg-ok)"></i>Al día ({{ alDia }})</span>
              <span><i class="rg-dot" style="background: var(--rg-warn)"></i>Por vencer ({{ porVencer }})</span>
              <span><i class="rg-dot" style="background: var(--rg-bad)"></i>Vencidos ({{ vencidos }})</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Distribuciones -->
      <div class="row g-3 mb-3">
        <div class="col-md-6 col-lg-4">
          <div class="rg-card">
            <h2>Miembros por plan</h2>
            <p class="rg-sub">Plan que tienen actualmente</p>
            <div v-for="p in porPlan" :key="p.nombre" class="rg-bar-row">
              <div class="rg-bar-head">
                <span class="text-capitalize">{{ p.nombre }}</span>
                <strong>{{ p.cantidad }}</strong>
              </div>
              <div class="rg-bar-track">
                <div class="rg-bar-fill" :style="{ width: anchoBarra(p.cantidad) }"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="col-md-6 col-lg-4">
          <div class="rg-card">
            <h2>Forma de pago</h2>
            <p class="rg-sub">Cómo pagan los miembros actuales</p>
            <div v-for="p in porPago" :key="p.nombre" class="rg-bar-row">
              <div class="rg-bar-head">
                <span>{{ p.nombre }}</span>
                <strong>{{ p.cantidad }}</strong>
              </div>
              <div class="rg-bar-track">
                <div class="rg-bar-fill" :class="p.clase" :style="{ width: anchoBarra(p.cantidad) }"></div>
              </div>
            </div>
          </div>
        </div>

        <div class="col-lg-4">
          <div class="rg-card">
            <h2>Nuevas inscripciones</h2>
            <p class="rg-sub">Miembros que se registraron recientemente</p>
            <div class="rg-trio">
              <div><div class="rg-trio-num">{{ inscHoy }}</div><div class="rg-trio-lbl">Hoy</div></div>
              <div><div class="rg-trio-num">{{ insc7 }}</div><div class="rg-trio-lbl">Últimos 7 días</div></div>
              <div><div class="rg-trio-num">{{ insc30 }}</div><div class="rg-trio-lbl">Últimos 30 días</div></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Próximamente -->
      <div class="row g-3">
        <div class="col-lg-6">
          <div class="rg-card rg-soon">
            <span class="rg-pill">Próximamente</span>
            <h2 class="mt-2">Asistencia</h2>
            <p class="text-muted mb-0">
              Personas que ingresaron por día, semana y mes. Se activa al conectar el lector dactilar.
            </p>
          </div>
        </div>
        <div class="col-lg-6">
          <div class="rg-card rg-soon">
            <span class="rg-pill">Próximamente</span>
            <h2 class="mt-2">Ingresos</h2>
            <p class="text-muted mb-0">
              Efectivo (verde), transferencia (azul) y total, comparados en una sola gráfica. Se activa al registrar cada pago.
            </p>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>