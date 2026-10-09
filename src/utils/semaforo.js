const diasPorPlan = { diario: 1, semanal: 7, quincena: 15, mensual: 30 }

function parseFechaLocal(fechaStr) {
  const [year, month, day] = fechaStr.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function hoyLocal() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function diasRestantes(fechaVencimientoStr) {
  const hoy = hoyLocal()
  const vencimiento = parseFechaLocal(fechaVencimientoStr)
  return Math.round((vencimiento - hoy) / 86400000)
}

export function colorSemaforo(fechaVencimientoStr) {
  const dias = diasRestantes(fechaVencimientoStr)
  if (dias < 0) return 'danger'
  if (dias <= 5) return 'warning'
  return 'success'
}

export function textoSemaforo(fechaVencimientoStr) {
  const dias = diasRestantes(fechaVencimientoStr)
  if (dias < 0) return `Vencida hace ${Math.abs(dias)} día(s)`
  if (dias === 0) return 'Vence hoy'
  if (dias <= 5) return `Vence en ${dias} día(s)`
  return 'Al día'
}

// Si la membresía sigue activa, renueva desde su fecha de vencimiento actual
// (no le quita los días que ya pagó). Si ya venció, renueva desde hoy.
export function calcularNuevoVencimiento(fechaVencimientoActualStr, plan) {
  const hoy = hoyLocal()
  const actual = fechaVencimientoActualStr ? parseFechaLocal(fechaVencimientoActualStr) : hoy
  const base = actual > hoy ? actual : hoy
  base.setDate(base.getDate() + (diasPorPlan[plan] || 0))
  return base.toISOString().split('T')[0]
}