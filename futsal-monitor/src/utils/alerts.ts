import { db } from '@/db/database'
import { calcularNuevasAlertas } from '@/domain/alerts/alerts'
import { getTodayLocalISO } from '@/domain/dates/dates'

export async function generarAlertas(): Promise<void> {
  const [todasJugadoras, wellness, resumenes, lesiones, existentes] = await Promise.all([
    db.jugadoras.toArray(),
    db.wellness.toArray(),
    db.resumen_semanal.toArray(),
    db.lesiones.toArray(),
    db.alertas.toArray()
  ])

  const jugadoras = todasJugadoras.filter((j) => j.activa !== false)

  const hoy = getTodayLocalISO()
  const ahora = new Date().toISOString()

  // Call the pure domain calculation
  const nuevasAlertas = calcularNuevasAlertas(
    jugadoras,
    wellness,
    resumenes,
    lesiones,
    existentes,
    hoy,
    ahora
  )

  // Persist the computed alerts
  for (const a of nuevasAlertas) {
    await db.alertas.put(a)
  }
}
