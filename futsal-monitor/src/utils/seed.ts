import { db } from '@/db/database'
import type { Jugadora, Sesion, Partido, Wellness, SesionRPE } from '@/types'
import { calcularScoreWellness, calcularCargaUA } from './calculations'

const JUGADORAS: Jugadora[] = [
  { id_jugadora: 'J01', nombre: 'Ana García', fecha_nacimiento: '1998-03-15', posicion: 'Portera', altura_cm: 172, peso_kg: 65, imc: 22.0, grasa: 18.5, anos_experiencia_futsal: 8, historial_lesional: 'Esguince tobillo izq. 2022', notas: 'Capitana', activa: true },
  { id_jugadora: 'J02', nombre: 'María López', fecha_nacimiento: '2000-07-22', posicion: 'Cierre', altura_cm: 168, peso_kg: 62, imc: 22.0, grasa: 17.0, anos_experiencia_futsal: 6, historial_lesional: '', notas: '', activa: true },
  { id_jugadora: 'J03', nombre: 'Laura Martínez', fecha_nacimiento: '1999-11-08', posicion: 'Ala', altura_cm: 165, peso_kg: 58, imc: 21.3, grasa: 16.5, anos_experiencia_futsal: 7, historial_lesional: 'Rotura fibrilar isquio 2023', notas: 'Velocidad explosiva', activa: true },
  { id_jugadora: 'J04', nombre: 'Sofía Ruiz', fecha_nacimiento: '2001-02-14', posicion: 'Ala', altura_cm: 163, peso_kg: 56, imc: 21.1, grasa: 15.8, anos_experiencia_futsal: 4, historial_lesional: '', notas: '', activa: true },
  { id_jugadora: 'J05', nombre: 'Elena Hernández', fecha_nacimiento: '1997-06-30', posicion: 'Pivot', altura_cm: 170, peso_kg: 68, imc: 23.5, grasa: 19.0, anos_experiencia_futsal: 10, historial_lesional: 'Pubalgia crónica', notas: 'Gestión de carga permanente', activa: true },
  { id_jugadora: 'J06', nombre: 'Lucía Díaz', fecha_nacimiento: '2000-09-18', posicion: 'Cierre', altura_cm: 167, peso_kg: 60, imc: 21.5, grasa: 16.0, anos_experiencia_futsal: 5, historial_lesional: '', notas: '', activa: true },
  { id_jugadora: 'J07', nombre: 'Carmen Moreno', fecha_nacimiento: '1999-04-05', posicion: 'Ala', altura_cm: 164, peso_kg: 57, imc: 21.2, grasa: 16.2, anos_experiencia_futsal: 6, historial_lesional: 'Tendinopatía rotuliana 2024', notas: 'En readaptación', activa: true },
  { id_jugadora: 'J08', nombre: 'Paula Jiménez', fecha_nacimiento: '2002-01-25', posicion: 'Universal', altura_cm: 166, peso_kg: 59, imc: 21.4, grasa: 15.5, anos_experiencia_futsal: 3, historial_lesional: '', notas: 'Joven promesa', activa: true },
  { id_jugadora: 'J09', nombre: 'Andrea Navarro', fecha_nacimiento: '1998-12-12', posicion: 'Portera', altura_cm: 175, peso_kg: 70, imc: 22.9, grasa: 19.5, anos_experiencia_futsal: 9, historial_lesional: '', notas: 'Segunda portera', activa: true },
  { id_jugadora: 'J10', nombre: 'Marta Sánchez', fecha_nacimiento: '2000-08-03', posicion: 'Pivot', altura_cm: 169, peso_kg: 64, imc: 22.4, grasa: 17.8, anos_experiencia_futsal: 5, historial_lesional: 'Esguince rodilla der. 2023', notas: '', activa: true },
  { id_jugadora: 'J11', nombre: 'Lucía Romero', fecha_nacimiento: '2001-05-20', posicion: 'Ala', altura_cm: 162, peso_kg: 55, imc: 21.0, grasa: 15.0, anos_experiencia_futsal: 3, historial_lesional: '', notas: '', activa: true },
  { id_jugadora: 'J12', nombre: 'Irene Torres', fecha_nacimiento: '1999-10-10', posicion: 'Cierre', altura_cm: 171, peso_kg: 66, imc: 22.5, grasa: 18.0, anos_experiencia_futsal: 7, historial_lesional: '', notas: 'Lesionada actualmente', activa: true },
]

import { getLocalDateString } from '@/domain/dates/dates'

function randomBetween(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10
}

function dateStr(d: Date): string {
  return getLocalDateString(d)
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

export async function seedDatabase(): Promise<void> {
  const existing = await db.jugadoras.count()
  if (existing > 0) return

  for (const j of JUGADORAS) {
    await db.jugadoras.put(j)
  }

  const sesiones: Sesion[] = []
  for (let i = 30; i >= 0; i--) {
    const fecha = daysAgo(i)
    const dow = fecha.getDay()
    if (dow === 0) continue

    const tiposSesion: Sesion['tipo_sesion'][] = ['Fisico', 'Tecnico', 'Tactico', 'Recuperacion', 'Gimnasio', 'Preventivo']
    const tipo = tiposSesion[Math.floor(Math.random() * tiposSesion.length)]
    const duracion = tipo === 'Recuperacion' ? 45 : tipo === 'Gimnasio' ? 60 : tipo === 'Preventivo' ? 30 : randomBetween(60, 90)

    sesiones.push({
      id_sesion: `S${String(i).padStart(3, '0')}`,
      fecha: dateStr(fecha),
      tipo_dia: 'Entreno',
      tipo_sesion: tipo,
      duracion_min: duracion,
      objetivo_principal: `${tipo} - Sesión del ${dateStr(fecha)}`,
      observaciones_grupo: '',
    })
  }
  for (const s of sesiones) {
    await db.sesiones.put(s)
  }

  const partidos: Partido[] = [
    { id_partido: 'P001', fecha: dateStr(daysAgo(25)), rival: 'FC Barcelona', competicion: 'Liga Nacional', resultado: '3-2', lugar: 'Local' },
    { id_partido: 'P002', fecha: dateStr(daysAgo(18)), rival: 'Rayo Vallecano', competicion: 'Liga Nacional', resultado: '1-1', lugar: 'Visitante' },
    { id_partido: 'P003', fecha: dateStr(daysAgo(11)), rival: 'Inter Movistar', competicion: 'Copa', resultado: '4-2', lugar: 'Local' },
    { id_partido: 'P004', fecha: dateStr(daysAgo(4)), rival: 'ElPozo Murcia', competicion: 'Liga Nacional', resultado: '2-3', lugar: 'Visitante' },
  ]
  for (const p of partidos) {
    await db.partidos.put(p)
  }

  for (const jug of JUGADORAS) {
    for (let i = 30; i >= 0; i--) {
      const fecha = daysAgo(i)
      if (fecha.getDay() === 0) continue

      const w: Wellness = {
        id_jugadora: jug.id_jugadora,
        fecha: dateStr(fecha),
        calidad_sueno: randomBetween(5, 9),
        fatiga: randomBetween(3, 8),
        dolor_muscular: randomBetween(2, 7),
        estres: randomBetween(3, 8),
        estado_animo: randomBetween(5, 9),
        dolor_especifico: Math.random() > 0.85 ? 'Leve molestia' : '',
        score_wellness: 0,
      }
      w.score_wellness = calcularScoreWellness(w)
      await db.wellness.put(w)
    }
  }

  const jugadoresActivas = JUGADORAS.filter(j => j.activa !== false)
  for (const sesion of sesiones) {
    for (const jug of jugadoresActivas) {
      const rpe = randomBetween(4, 8)

      const srpe: SesionRPE = {
        id_sesion: sesion.id_sesion,
        id_jugadora: jug.id_jugadora,
        rpe,
        duracion_min: sesion.duracion_min,
        carga_ua: calcularCargaUA(rpe, sesion.duracion_min),
        fecha: sesion.fecha,
      }
      await db.sesion_rpe.put(srpe)
    }
  }

  for (const partido of partidos) {
    for (const jug of jugadoresActivas) {
      const minutos = Math.floor(Math.random() * 20) + 10
      const rpe = randomBetween(6, 9)
      await db.rpe_partido.put({
        id_partido: partido.id_partido,
        id_jugadora: jug.id_jugadora,
        minutos_jugados: minutos,
        rpe,
        fecha: partido.fecha,
        carga_ua: calcularCargaUA(rpe, minutos),
      })
    }
  }

  await db.lesiones.put({
    id_lesion: 'L001',
    id_jugadora: 'J12',
    fecha_inicio: dateStr(daysAgo(20)),
    fecha_fin: '',
    tipo: 'Rotura fibrilar',
    localizacion: 'Isquiotibial derecho',
    mecanismo: 'Sobrecarga',
    severidad_dias_baja: 21,
    disponibilidad: 'Lesionada',
    comentario_fisio_medico: 'Rotura grado II. Inicio programa RTP.',
    fase_rtp: 'Fase_3_Fuerza',
    disponible: false,
  })

  await db.lesiones.put({
    id_lesion: 'L002',
    id_jugadora: 'J07',
    fecha_inicio: dateStr(daysAgo(35)),
    fecha_fin: dateStr(daysAgo(10)),
    tipo: 'Tendinopatía',
    localizacion: 'Rotuliano izquierdo',
    mecanismo: 'Sobrecarga crónica',
    severidad_dias_baja: 25,
    disponibilidad: 'Readaptacion',
    comentario_fisio_medico: 'En fase final de readaptación. Próxima revisión en 5 días.',
    fase_rtp: 'Fase_4_Reentreno',
    disponible: false,
  })

  const testTypes = ['CMJ (cm)', 'Sprint 30m (s)', 'Yo-Yo IR1 (m)', 'Test navaja (s)', 'Salto horizontal (cm)']
  for (const jug of jugadoresActivas) {
    for (const test of testTypes) {
      const base = test.includes('cm') ? 35 : test.includes('s') ? 4.5 : 1200
      const variation = test.includes('cm') ? 8 : test.includes('s') ? 0.5 : 200
      await db.tests_fisicos.put({
        fecha: dateStr(daysAgo(28)),
        momento: 'Pretemporada',
        id_jugadora: jug.id_jugadora,
        test,
        resultado: randomBetween(base - variation, base + variation),
        unidad: test.match(/\((.+)\)/)?.[1] || '',
        notas: '',
      })
    }
  }
}
