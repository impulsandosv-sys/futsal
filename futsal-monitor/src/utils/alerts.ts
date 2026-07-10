import { db } from '@/db/database'
import type { Alerta } from '@/types'

const UMBRAL_WELLNESS_CRITICO = 5
const UMBRAL_WELLNESS_BAJO = 6.5
const UMBRAL_ACWR_ALTO = 1.5
const UMBRAL_ACWR_ELEVADO = 1.3

export async function generarAlertas(): Promise<void> {
  const [jugadoras, wellness, resumenes, lesiones] = await Promise.all([
    db.jugadoras.where('activa').equals(1).toArray(),
    db.wellness.toArray(),
    db.resumen_semanal.toArray(),
    db.lesiones.toArray(),
  ])

  const alertas: Alerta[] = []
  const hoy = new Date().toISOString().split('T')[0]
  const ahora = new Date().toISOString()

  for (const jug of jugadoras) {
    // 1. Alertas de wellness bajo
    const wellnessReciente = wellness
      .filter((w) => w.id_jugadora === jug.id_jugadora)
      .sort((a, b) => b.fecha.localeCompare(a.fecha))

    if (wellnessReciente.length > 0) {
      const ultimo = wellnessReciente[0]
      if (ultimo.score_wellness < UMBRAL_WELLNESS_CRITICO) {
        alertas.push({
          tipo: 'wellness_bajo',
          id_jugadora: jug.id_jugadora,
          fecha: ultimo.fecha,
          mensaje: `${jug.nombre}: Wellness crítico (${ultimo.score_wellness}/10) el ${ultimo.fecha}`,
          nivel: 'alto',
          leida: false,
          creada: ahora,
        })
      } else if (ultimo.score_wellness < UMBRAL_WELLNESS_BAJO) {
        alertas.push({
          tipo: 'wellness_bajo',
          id_jugadora: jug.id_jugadora,
          fecha: ultimo.fecha,
          mensaje: `${jug.nombre}: Wellness bajo (${ultimo.score_wellness}/10) el ${ultimo.fecha}`,
          nivel: 'medio',
          leida: false,
          creada: ahora,
        })
      }
    }

    // 2. ACWR alto
    const rsReciente = resumenes
      .filter((rs) => rs.id_jugadora === jug.id_jugadora)
      .sort((a, b) => b.semana.localeCompare(a.semana))

    if (rsReciente.length > 0) {
      const ultimoRS = rsReciente[0]
      if (ultimoRS.acwr >= UMBRAL_ACWR_ALTO) {
        alertas.push({
          tipo: 'carga_alta',
          id_jugadora: jug.id_jugadora,
          fecha: hoy,
          mensaje: `${jug.nombre}: ACWR alto (${ultimoRS.acwr}) - riesgo de lesión`,
          nivel: 'alto',
          leida: false,
          creada: ahora,
        })
      } else if (ultimoRS.acwr >= UMBRAL_ACWR_ELEVADO) {
        alertas.push({
          tipo: 'carga_alta',
          id_jugadora: jug.id_jugadora,
          fecha: hoy,
          mensaje: `${jug.nombre}: ACWR elevado (${ultimoRS.acwr}) - monitorizar carga`,
          nivel: 'medio',
          leida: false,
          creada: ahora,
        })
      }
    }

    // 3. Datos faltantes (últimos 3 días sin wellness)
    const fechasRecientes = wellnessReciente.slice(0, 3).map((w) => w.fecha)
    const faltan = []
    for (let i = 1; i <= 3; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const fechaStr = d.toISOString().split('T')[0]
      if (!fechasRecientes.includes(fechaStr)) {
        faltan.push(fechaStr)
      }
    }
    if (faltan.length > 0) {
      alertas.push({
        tipo: 'datos_faltantes',
        id_jugadora: jug.id_jugadora,
        fecha: hoy,
        mensaje: `${jug.nombre}: Faltan datos de wellness (${faltan.join(', ')})`,
        nivel: faltan.length >= 3 ? 'alto' : 'medio',
        leida: false,
        creada: ahora,
      })
    }
  }

  // 4. Lesiones activas
  const lesionesActivas = lesiones.filter((l) => !l.disponible)
  for (const les of lesionesActivas) {
    const jug = jugadoras.find((j) => j.id_jugadora === les.id_jugadora)
    alertas.push({
      tipo: 'lesion',
      id_jugadora: les.id_jugadora,
      fecha: hoy,
      mensaje: `${jug?.nombre || les.id_jugadora}: Lesionada - ${les.tipo} (${les.localizacion}) - Fase: ${les.fase_rtp}`,
      nivel: 'alto',
      leida: false,
      creada: ahora,
    })
  }

  // Guardar alertas nuevas (evitar duplicados exactos)
  const existentes = await db.alertas.toArray()
  for (const a of alertas) {
    const duplicado = existentes.some(
      (e) => e.tipo === a.tipo && e.id_jugadora === a.id_jugadora && e.mensaje === a.mensaje && !e.leida
    )
    if (!duplicado) {
      await db.alertas.put(a)
    }
  }
}
