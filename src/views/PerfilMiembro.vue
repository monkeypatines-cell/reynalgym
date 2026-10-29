<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { supabase } from '../supabase'
import { colorSemaforo, textoSemaforo, calcularNuevoVencimiento } from '../utils/semaforo'

const route = useRoute()
const id = route.params.id

const miembro = ref(null)
const cargando = ref(true)
const error = ref('')

const pagos = ref([])
const errorPagos = ref('')

const peso = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
})

// Precios sugeridos según el plan. El monto se puede editar.
const preciosPorPlan = { diario: 6000, semanal: 21000, quincena: 33000, mensual: 60000 }

function fechaCorta(timestamp) {
  return timestamp ? new Date(timestamp).toLocaleDateString('es-CO') : '—'
}

async function cargarMiembro() {
  cargando.value = true
  error.value = ''
  const { data, error: fetchError } = await supabase
    .from('miembros')
    .select('*')
    .eq('id', id)
    .single()

  if (fetchError) {
    error.value = 'No se pudo cargar este miembro'
  } else {
    miembro.value = data
  }
  cargando.value = false
}

async function cargarPagos() {
  errorPagos.value = ''
  const { data, error: pagosError } = await supabase
    .from('pagos')
    .select('id, fecha, plan, monto, forma_pago')
    .eq('miembro_id', id)
    .order('fecha', { ascending: false })

  if (pagosError) {
    errorPagos.value = 'No se pudo cargar el historial de pagos'
    return
  }
  pagos.value = data
}

onMounted(async () => {
  await cargarMiembro()
  await cargarPagos()
})

// El primer pago de membresía es la inscripción; los siguientes son renovaciones.
// Los pagos "diario" se cuentan aparte como jornadas.
const renovaciones = computed(() => {
  const membresias = pagos.value.filter((p) => p.plan !== 'diario').length
  return Math.max(membresias - 1, 0)
})
const jornadasDiarias = computed(() => pagos.value.filter((p) => p.plan === 'diario').length)

// ---------- Editar datos (CU-04) ----------
const editando = ref(false)
const guardandoEdicion = ref(false)
const errorEdicion = ref('')
const form = ref({})

const numeroONull = (valor) => (valor === '' || valor === null ? null : Number(valor))

function abrirEdicion() {
  const m = miembro.value
  form.value = {
    nombre: m.nombre ?? '',
    celular: m.celular ?? '',
    edad: m.edad ?? '',
    estatura: m.estatura ?? '',
    peso_actual: m.peso_actual ?? '',
    peso_objetivo: m.peso_objetivo ?? '',
    condiciones_fisicas: m.condiciones_fisicas ?? '',
    tipo_servicio: m.tipo_servicio ?? '',
  }
  errorEdicion.value = ''
  editando.value = true
}

async function guardarEdicion() {
  errorEdicion.value = ''
  if (!String(form.value.nombre).trim()) {
    errorEdicion.value = 'El nombre es obligatorio'
    return
  }

  guardandoEdicion.value = true
  const { data, error: updateError } = await supabase
    .from('miembros')
    .update({
      nombre: String(form.value.nombre).trim(),
      celular: String(form.value.celular).trim() || null,
      edad: numeroONull(form.value.edad),
      estatura: numeroONull(form.value.estatura),
      peso_actual: numeroONull(form.value.peso_actual),
      peso_objetivo: numeroONull(form.value.peso_objetivo),
      condiciones_fisicas: String(form.value.condiciones_fisicas).trim() || null,
      tipo_servicio: String(form.value.tipo_servicio).trim() || null,
    })
    .eq('id', id)
    .select()
    .single()
  guardandoEdicion.value = false

  if (updateError) {
    errorEdicion.value = 'No se pudo guardar: ' + updateError.message
    return
  }
  miembro.value = data
  editando.value = false
}

// ---------- Huella (CU-03) ----------
const editandoHuella = ref(false)
const idHuellaNuevo = ref('')
const autorizoHuella = ref(false)
const guardandoHuella = ref(false)
const errorHuella = ref('')

function abrirHuella() {
  idHuellaNuevo.value = miembro.value.id_huella ?? ''
  autorizoHuella.value = false
  errorHuella.value = ''
  editandoHuella.value = true
}

async function guardarHuella() {
  errorHuella.value = ''
  const numero = Number(idHuellaNuevo.value)
  if (!Number.isInteger(numero) || numero <= 0) {
    errorHuella.value = 'Escribe un identificador numérico mayor que cero'
    return
  }
  if (!autorizoHuella.value) {
    errorHuella.value = 'Confirma que el miembro autorizó por escrito el uso de su huella'
    return
  }

  guardandoHuella.value = true
  const { data, error: updateError } = await supabase
    .from('miembros')
    .update({ id_huella: numero, huella_registrada_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  guardandoHuella.value = false

  if (updateError) {
    errorHuella.value =
      updateError.code === '23505'
        ? 'Ese identificador ya está asignado a otro miembro'
        : 'No se pudo guardar: ' + updateError.message
    return
  }
  miembro.value = data
  editandoHuella.value = false
}

async function quitarHuella() {
  if (!window.confirm('¿Quitar la huella de este miembro? Dejará de poder ingresar con ella.')) return

  errorHuella.value = ''
  const { data, error: updateError } = await supabase
    .from('miembros')
    .update({ id_huella: null, huella_template: null, huella_registrada_at: null })
    .eq('id', id)
    .select()
    .single()

  if (updateError) {
    errorHuella.value = 'No se pudo quitar la huella: ' + updateError.message
    return
  }
  miembro.value = data
  editandoHuella.value = false
}

// ---------- Desactivar / reactivar (CU-04) ----------
const cambiandoActivo = ref(false)
const errorActivo = ref('')

async function cambiarActivo(nuevoValor) {
  errorActivo.value = ''

  if (!nuevoValor) {
    const vigente = colorSemaforo(miembro.value.fecha_vencimiento) !== 'danger'
    const advertencia = vigente
      ? `Este miembro tiene la membresía vigente hasta el ${miembro.value.fecha_vencimiento}. `
      : ''
    const confirmado = window.confirm(
      `${advertencia}Se conservará su historial de pagos y asistencias, pero no podrá ingresar con su huella ni renovar. ¿Desactivar a ${miembro.value.nombre}?`
    )
    if (!confirmado) return
  }

  cambiandoActivo.value = true
  const { data, error: updateError } = await supabase
    .from('miembros')
    .update({ activo: nuevoValor })
    .eq('id', id)
    .select()
    .single()
  cambiandoActivo.value = false

  if (updateError) {
    errorActivo.value = 'No se pudo cambiar el estado: ' + updateError.message
    return
  }
  miembro.value = data
}

// ---------- Renovar (CU-06) ----------
const mostrandoRenovar = ref(false)
const planRenovar = ref('mensual')
const pagoRenovar = ref('efectivo')
const montoRenovar = ref('')
const renovando = ref(false)
const errorRenovar = ref('')

watch(planRenovar, (plan) => {
  montoRenovar.value = preciosPorPlan[plan]
})

function abrirRenovar() {
  planRenovar.value = miembro.value.plan
  pagoRenovar.value = miembro.value.forma_pago
  montoRenovar.value = preciosPorPlan[miembro.value.plan]
  errorRenovar.value = ''
  mostrandoRenovar.value = true
}

async function confirmarRenovar() {
  errorRenovar.value = ''
  if (!montoRenovar.value || Number(montoRenovar.value) <= 0) {
    errorRenovar.value = 'Escribe el monto pagado'
    return
  }

  renovando.value = true
  const nuevaFecha = calcularNuevoVencimiento(miembro.value.fecha_vencimiento, planRenovar.value)

  // 1. Registrar el pago (así los ingresos del dashboard incluyen la renovación)
  const { data: pago, error: pagoError } = await supabase
    .from('pagos')
    .insert({
      miembro_id: id,
      plan: planRenovar.value,
      monto: Number(montoRenovar.value),
      forma_pago: pagoRenovar.value,
    })
    .select('id')
    .single()

  if (pagoError) {
    renovando.value = false
    errorRenovar.value = 'No se pudo registrar el pago: ' + pagoError.message
    return
  }

  // 2. Actualizar la membresía vigente
  const { data, error: updateError } = await supabase
    .from('miembros')
    .update({
      plan: planRenovar.value,
      forma_pago: pagoRenovar.value,
      fecha_vencimiento: nuevaFecha,
      estado: 'activo',
    })
    .eq('id', id)
    .select()
    .single()

  if (updateError) {
    // Deshacer el pago para no dejar ingresos sin renovación
    await supabase.from('pagos').delete().eq('id', pago.id)
    renovando.value = false
    errorRenovar.value = 'No se pudo renovar: ' + updateError.message
    return
  }

  miembro.value = data
  await cargarPagos()
  renovando.value = false
  mostrandoRenovar.value = false
}
</script>

<template>
  <div class="container mt-4" style="max-width: 650px">
    <RouterLink to="/miembros" class="btn btn-outline-secondary btn-sm mb-3">← Volver a Miembros</RouterLink>

    <div v-if="cargando" class="text-center text-muted">Cargando...</div>
    <div v-else-if="error" class="alert alert-danger">{{ error }}</div>

    <div v-else-if="miembro" class="card shadow-sm">
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-start mb-3">
          <div>
            <h1 class="h3 mb-1">{{ miembro.nombre }}</h1>
            <span class="text-muted">{{ miembro.celular || 'Sin celular registrado' }}</span>
          </div>
          <div class="d-flex flex-column align-items-end gap-1">
            <span class="badge fs-6" :class="`bg-${colorSemaforo(miembro.fecha_vencimiento)}`">
              {{ textoSemaforo(miembro.fecha_vencimiento) }}
            </span>
            <span v-if="!miembro.activo" class="badge bg-secondary">Inactivo</span>
          </div>
        </div>
                <RouterLink :to="`/asistencia?miembro=${miembro.id}`" class="btn btn-outline-secondary btn-sm mb-3">
          Ver asistencias
        </RouterLink>

        <hr />

        <h2 class="h6 text-uppercase text-muted">Membresía</h2>
        <div class="row mb-3">
          <div class="col-6">
            <div class="text-muted small">Plan</div>
            <div class="text-capitalize">{{ miembro.plan }}</div>
          </div>
          <div class="col-6">
            <div class="text-muted small">Forma de pago</div>
            <div class="text-capitalize">{{ miembro.forma_pago }}</div>
          </div>
          <div class="col-6 mt-2">
            <div class="text-muted small">Inscripción</div>
            <div>{{ miembro.fecha_inscripcion }}</div>
          </div>
          <div class="col-6 mt-2">
            <div class="text-muted small">Vencimiento</div>
            <div>{{ miembro.fecha_vencimiento }}</div>
          </div>
          <div class="col-6 mt-2">
            <div class="text-muted small">Renovaciones</div>
            <div>{{ renovaciones }}</div>
          </div>
          <div v-if="jornadasDiarias > 0" class="col-6 mt-2">
            <div class="text-muted small">Jornadas pagadas (diario)</div>
            <div>{{ jornadasDiarias }}</div>
          </div>
        </div>

        <hr />

        <!-- Huella -->
        <h2 class="h6 text-uppercase text-muted">Huella</h2>
        <div v-if="errorHuella && !editandoHuella" class="alert alert-danger py-2">{{ errorHuella }}</div>

        <div v-if="!editandoHuella" class="mb-3">
          <div class="row mb-2">
            <div class="col-6">
              <div class="text-muted small">Identificador</div>
              <div>{{ miembro.id_huella ?? 'Sin huella asignada' }}</div>
            </div>
            <div class="col-6">
              <div class="text-muted small">Registrada</div>
              <div>{{ fechaCorta(miembro.huella_registrada_at) }}</div>
            </div>
          </div>
          <div class="d-flex gap-2 flex-wrap">
            <button class="btn btn-outline-primary btn-sm" @click="abrirHuella">
              {{ miembro.id_huella ? 'Cambiar huella' : 'Asignar huella' }}
            </button>
            <button v-if="miembro.id_huella" class="btn btn-outline-danger btn-sm" @click="quitarHuella">
              Quitar huella
            </button>
          </div>
        </div>

        <div v-else class="border rounded p-3 bg-light mb-3">
          <div class="mb-2">
            <label class="form-label">Identificador de la huella en el lector</label>
            <input v-model="idHuellaNuevo" type="number" min="1" step="1" class="form-control" />
            <div class="form-text">
              Es el número que el lector entrega al identificar a este miembro. Debe ser único.
            </div>
          </div>
          <div class="form-check mb-2">
            <input id="autorizo" v-model="autorizoHuella" type="checkbox" class="form-check-input" />
            <label for="autorizo" class="form-check-label">
              El miembro autorizó por escrito el tratamiento de su huella
            </label>
          </div>
          <div v-if="errorHuella" class="alert alert-danger py-2">{{ errorHuella }}</div>
          <div class="d-flex gap-2">
            <button class="btn btn-primary flex-grow-1" :disabled="guardandoHuella" @click="guardarHuella">
              {{ guardandoHuella ? 'Guardando...' : 'Guardar huella' }}
            </button>
            <button class="btn btn-outline-secondary" @click="editandoHuella = false">Cancelar</button>
          </div>
        </div>

        <hr />

        <!-- Perfil físico / editar datos -->
        <div v-if="!editando">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <h2 class="h6 text-uppercase text-muted mb-0">Perfil físico</h2>
            <button class="btn btn-outline-secondary btn-sm" @click="abrirEdicion">Editar datos</button>
          </div>
          <div class="row mb-3">
            <div class="col-6">
              <div class="text-muted small">Edad</div>
              <div>{{ miembro.edad ?? '—' }}</div>
            </div>
            <div class="col-6">
              <div class="text-muted small">Estatura</div>
              <div>{{ miembro.estatura ? `${miembro.estatura} cm` : '—' }}</div>
            </div>
            <div class="col-6 mt-2">
              <div class="text-muted small">Peso actual</div>
              <div>{{ miembro.peso_actual ? `${miembro.peso_actual} kg` : '—' }}</div>
            </div>
            <div class="col-6 mt-2">
              <div class="text-muted small">Peso objetivo</div>
              <div>{{ miembro.peso_objetivo ? `${miembro.peso_objetivo} kg` : '—' }}</div>
            </div>
            <div class="col-12 mt-2">
              <div class="text-muted small">Condiciones físicas</div>
              <div>{{ miembro.condiciones_fisicas || '—' }}</div>
            </div>
            <div class="col-12 mt-2">
              <div class="text-muted small">Tipo de servicio</div>
              <div>{{ miembro.tipo_servicio || '—' }}</div>
            </div>
          </div>
        </div>

        <div v-else class="border rounded p-3 bg-light mb-3">
          <h2 class="h6">Editar datos</h2>
          <div class="row g-2 mb-2">
            <div class="col-12">
              <label class="form-label">Nombre *</label>
              <input v-model="form.nombre" type="text" class="form-control" />
            </div>
            <div class="col-12">
              <label class="form-label">Celular</label>
              <input v-model="form.celular" type="text" class="form-control" />
            </div>
            <div class="col-6">
              <label class="form-label">Edad</label>
              <input v-model="form.edad" type="number" min="0" class="form-control" />
            </div>
            <div class="col-6">
              <label class="form-label">Estatura (cm)</label>
              <input v-model="form.estatura" type="number" min="0" step="any" class="form-control" />
            </div>
            <div class="col-6">
              <label class="form-label">Peso actual (kg)</label>
              <input v-model="form.peso_actual" type="number" min="0" step="any" class="form-control" />
            </div>
            <div class="col-6">
              <label class="form-label">Peso objetivo (kg)</label>
              <input v-model="form.peso_objetivo" type="number" min="0" step="any" class="form-control" />
            </div>
            <div class="col-12">
              <label class="form-label">Condiciones físicas</label>
              <input v-model="form.condiciones_fisicas" type="text" class="form-control" />
            </div>
            <div class="col-12">
              <label class="form-label">Tipo de servicio</label>
              <input v-model="form.tipo_servicio" type="text" class="form-control" />
            </div>
          </div>
          <div v-if="errorEdicion" class="alert alert-danger py-2">{{ errorEdicion }}</div>
          <div class="d-flex gap-2">
            <button class="btn btn-primary flex-grow-1" :disabled="guardandoEdicion" @click="guardarEdicion">
              {{ guardandoEdicion ? 'Guardando...' : 'Guardar cambios' }}
            </button>
            <button class="btn btn-outline-secondary" @click="editando = false">Cancelar</button>
          </div>
        </div>

        <hr />

        <h2 class="h6 text-uppercase text-muted">Historial de pagos</h2>
        <div v-if="errorPagos" class="alert alert-danger py-2">{{ errorPagos }}</div>
        <div v-else-if="pagos.length === 0" class="text-muted small mb-3">Aún no hay pagos registrados.</div>
        <div v-else class="table-responsive mb-3">
          <table class="table table-sm align-middle mb-0">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Plan</th>
                <th>Valor</th>
                <th>Pago</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in pagos" :key="p.id">
                <td>{{ String(p.fecha).slice(0, 10) }}</td>
                <td class="text-capitalize">{{ p.plan }}</td>
                <td>{{ peso.format(p.monto) }}</td>
                <td class="text-capitalize">{{ p.forma_pago }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <hr />

        <!-- Renovar -->
        <div v-if="!miembro.activo" class="alert alert-secondary mb-3">
          Este miembro está inactivo. Reactívalo para poder renovar su membresía.
        </div>

        <div v-else-if="!mostrandoRenovar">
          <button
            class="btn w-100"
            :class="colorSemaforo(miembro.fecha_vencimiento) === 'success' ? 'btn-outline-primary' : 'btn-danger'"
            @click="abrirRenovar"
          >
            Renovar membresía
          </button>
        </div>

        <div v-else class="border rounded p-3 bg-light">
          <h2 class="h6">Renovar membresía</h2>
          <div class="row mb-2">
            <div class="col">
              <label class="form-label">Plan</label>
              <select v-model="planRenovar" class="form-select">
                <option value="diario">Diario</option>
                <option value="semanal">Semanal</option>
                <option value="quincena">Quincena</option>
                <option value="mensual">Mensual</option>
              </select>
            </div>
            <div class="col">
              <label class="form-label">Forma de pago</label>
              <select v-model="pagoRenovar" class="form-select">
                <option value="efectivo">Efectivo</option>
                <option value="transferencia">Transferencia</option>
              </select>
            </div>
          </div>
          <div class="mb-2">
            <label class="form-label">Monto pagado (COP) *</label>
            <input v-model="montoRenovar" type="number" min="1" step="1000" class="form-control" />
            <div class="form-text">Se sugiere según el plan.</div>
          </div>
          <div v-if="errorRenovar" class="alert alert-danger py-2">{{ errorRenovar }}</div>
          <div class="d-flex gap-2">
            <button class="btn btn-primary flex-grow-1" :disabled="renovando" @click="confirmarRenovar">
              {{ renovando ? 'Guardando...' : 'Confirmar renovación' }}
            </button>
            <button class="btn btn-outline-secondary" @click="mostrandoRenovar = false">Cancelar</button>
          </div>
        </div>

        <hr />

        <!-- Desactivar / reactivar -->
        <div v-if="errorActivo" class="alert alert-danger py-2">{{ errorActivo }}</div>
        <div class="d-flex justify-content-between align-items-center">
          <span class="text-muted small">
            {{ miembro.activo ? 'Miembro activo' : 'Miembro inactivo: no puede ingresar ni renovar.' }}
          </span>
          <button
            v-if="miembro.activo"
            class="btn btn-outline-danger btn-sm"
            :disabled="cambiandoActivo"
            @click="cambiarActivo(false)"
          >
            Desactivar miembro
          </button>
          <button v-else class="btn btn-success btn-sm" :disabled="cambiandoActivo" @click="cambiarActivo(true)">
            Reactivar miembro
          </button>
        </div>
      </div>
    </div>
  </div>
</template>