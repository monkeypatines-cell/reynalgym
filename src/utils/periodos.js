// Convierte una fecha a texto AAAA-MM-DD usando la hora local
export function aISO(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dia}`
}

// Convierte 'AAAA-MM-DD' a Date local (evita desfases de zona horaria)
export function parseISO(texto) {
  const [y, m, d] = String(texto).slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Lunes de la semana de una fecha
export function lunesDe(fecha) {
  const x = new Date(fecha)
  const dia = (x.getDay() + 6) % 7
  x.setDate(x.getDate() - dia)
  x.setHours(0, 0, 0, 0)
  return x
}

// Genera las barras: 14 días, 8 semanas o 6 meses
export function construirBuckets(periodo) {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const salida = []

  if (periodo === 'dia') {
    for (let i = 13; i >= 0; i--) {
      const d = new Date(hoy)
      d.setDate(d.getDate() - i)
      salida.push({
        clave: aISO(d),
        etiqueta: d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }),
      })
    }
  } else if (periodo === 'semana') {
    const lunes = lunesDe(hoy)
    for (let i = 7; i >= 0; i--) {
      const d = new Date(lunes)
      d.setDate(d.getDate() - i * 7)
      salida.push({
        clave: aISO(d),
        etiqueta: 'Sem ' + d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' }),
      })
    }
  } else {
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
      salida.push({
        clave: aISO(d).slice(0, 7),
        etiqueta: d.toLocaleDateString('es-CO', { month: 'short', year: '2-digit' }),
      })
    }
  }
  return salida
}

// A qué barra pertenece una fecha
export function claveDe(fecha, periodo) {
  const texto = String(fecha).slice(0, 10)
  if (periodo === 'dia') return texto
  if (periodo === 'mes') return texto.slice(0, 7)
  return aISO(lunesDe(parseISO(texto)))
}

// Desde qué fecha hay que pedir datos a Supabase
export function desdeDe(buckets, periodo) {
  const primera = buckets[0].clave
  return periodo === 'mes' ? `${primera}-01` : primera
}