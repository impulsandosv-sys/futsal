import type { FutsalDB } from '@/db/database'
import type { MedicionCMJ, IntentoCMJ, HistorialImportacion } from '@/types'
import type { EstadoValidacionCMJ, MedicionCMJNormalizada } from './cmjDomain'
import { parsearChronojumpCMJCsv } from './chronojumpParser'
import {
  validarPlausibilidadCMJ,
  generarClaveLogicaCMJ,
  evaluarClasificacionCMJ,
  seleccionarMejoresIntentosCMJ,
} from './cmjEngine'
import { resolverAliasActivo } from '@/domain/alias/aliasJugadora'

export interface ResumenFilaChronojump {
  numFilaOriginal: number
  idJugadora: string | null
  aliasOrigen: string
  nombreJugadoraInternal?: string
  fecha: string
  intento: number
  alturaSaltoCm: number
  tiempoVueloMs: number | null
  idProtocolo: string
  protocoloNombre: string
  estado: EstadoValidacionCMJ
  motivoEstado?: string
  seleccionadoComoMejor: boolean
  idSaltoChronojump: string
}

export interface ResumenPrevisualizacionChronojumpCMJ {
  exito: boolean
  mensajeGlobal?: string
  nombreArchivo: string
  totalFilasSaltosSimples: number
  totalCMJ: number
  nuevosValidos: number
  requierenRevision: number
  duplicados: number
  conflictos: number
  errores: number
  omitidos: number
  puedeConfirmar: boolean
  filas: ResumenFilaChronojump[]
}

const DEFAULT_PROTOCOL_ID = 'CMJ_BILATERAL_ESTANDAR'
const DEFAULT_PROTOCOL_NAME = 'CMJ bilateral — manos en caderas — protocolo estándar'

/**
 * Analiza el contenido CSV de Chronojump, resuelve alias contra Dexie,
 * valida plausibilidad, clasifica por clave lógica y genera el resumen de previsualización.
 */
export async function analizarImportacionChronojumpCMJ(
  db: FutsalDB,
  contenidoCsv: string,
  nombreArchivo: string,
  idProtocoloOverride?: string
): Promise<ResumenPrevisualizacionChronojumpCMJ> {
  const parseo = parsearChronojumpCMJCsv(contenidoCsv)

  if (!parseo.exito) {
    return {
      exito: false,
      mensajeGlobal: parseo.mensajeGlobal,
      nombreArchivo,
      totalFilasSaltosSimples: 0,
      totalCMJ: 0,
      nuevosValidos: 0,
      requierenRevision: 0,
      duplicados: 0,
      conflictos: 0,
      errores: 0,
      omitidos: 0,
      puedeConfirmar: false,
      filas: [],
    }
  }

  // Obtener protocolo activo de la DB si existe
  let idProtocolo = idProtocoloOverride || DEFAULT_PROTOCOL_ID
  let protocoloNombre = DEFAULT_PROTOCOL_NAME

  try {
    const protos = await db.protocolos_cmj.where('activo').equals(1).toArray()
    if (protos && protos.length > 0) {
      idProtocolo = protos[0].id_protocolo
      protocoloNombre = protos[0].nombre
    }
  } catch {
    // Si falla la consulta de protocolo, usar los valores por defecto
  }

  // Cargar jugadoras existentes para mostrar su nombre interno en la previsualización
  const mapJugadoras = new Map<string, string>()
  try {
    const jugadoras = await db.jugadoras.toArray()
    jugadoras.forEach((j) => mapJugadoras.set(j.id_jugadora, j.nombre))
  } catch {
    // Sin acción
  }

  // Cargar pruebas CMJ existentes para comparación de claves lógicas
  const pruebasExistentes = await db.pruebas_cmj.toArray()

  // Mapa de clave lógica -> MedicionCMJNormalizada existente
  const mapExistentes = new Map<string, MedicionCMJNormalizada>()
  pruebasExistentes.forEach((p) => {
    p.intentos.forEach((intento) => {
      if (intento.valido && intento.altura_cm != null) {
        const key = generarClaveLogicaCMJ(p.id_jugadora, p.fecha, p.id_protocolo, intento.orden)
        mapExistentes.set(key, {
          idJugadora: p.id_jugadora,
          aliasOrigen: '',
          origenAlias: 'chronojump',
          idProtocolo: p.id_protocolo,
          fecha: p.fecha,
          intento: intento.orden,
          alturaSaltoCm: intento.altura_cm,
          tiempoVueloMs: intento.tiempo_vuelo_ms ?? null,
          unidadAltura: 'cm',
          seleccionadoComoMejor: p.mejor_intento_valido_id === intento.id_intento,
          estado: 'valido',
          fuente: 'chronojump',
        })
      }
    })
  })

  const resumenFilas: ResumenFilaChronojump[] = []
  let erroresCount = parseo.filasConError.length

  // Agregar filas con error sintáctico de parseo
  parseo.filasConError.forEach((e) => {
    resumenFilas.push({
      numFilaOriginal: e.numFilaOriginal,
      idJugadora: null,
      aliasOrigen: e.aliasOrigen,
      fecha: '',
      intento: 0,
      alturaSaltoCm: 0,
      tiempoVueloMs: null,
      idProtocolo,
      protocoloNombre,
      estado: 'error',
      motivoEstado: e.motivo,
      seleccionadoComoMejor: false,
      idSaltoChronojump: '',
    })
  })

  // Procesar filas válidas en estructura
  const medicionesNormalizadas: (MedicionCMJNormalizada & { numFilaOriginal: number; idSaltoChronojump: string })[] = []

  for (const fila of parseo.filasValidas) {
    // 1. Resolver alias estricto 'chronojump'
    const idJugadora = await resolverAliasActivo(db, 'chronojump', fila.aliasOrigen)

    if (!idJugadora) {
      erroresCount++
      resumenFilas.push({
        numFilaOriginal: fila.numFilaOriginal,
        idJugadora: null,
        aliasOrigen: fila.aliasOrigen,
        fecha: fila.fecha,
        intento: fila.intento,
        alturaSaltoCm: fila.alturaSaltoCm,
        tiempoVueloMs: fila.tiempoVueloMs,
        idProtocolo,
        protocoloNombre,
        estado: 'error',
        motivoEstado: `Alias 'chronojump' "${fila.aliasOrigen}" no está registrado o no está activo`,
        seleccionadoComoMejor: false,
        idSaltoChronojump: fila.idSaltoChronojump,
      })
      continue
    }

    // 2. Validar plausibilidad
    const plausibilidad = validarPlausibilidadCMJ({
      fecha: fila.fecha,
      intento: fila.intento,
      alturaSaltoCm: fila.alturaSaltoCm,
    })

    if (plausibilidad.estado === 'error') {
      erroresCount++
      resumenFilas.push({
        numFilaOriginal: fila.numFilaOriginal,
        idJugadora,
        aliasOrigen: fila.aliasOrigen,
        nombreJugadoraInternal: mapJugadoras.get(idJugadora),
        fecha: fila.fecha,
        intento: fila.intento,
        alturaSaltoCm: fila.alturaSaltoCm,
        tiempoVueloMs: fila.tiempoVueloMs,
        idProtocolo,
        protocoloNombre,
        estado: 'error',
        motivoEstado: plausibilidad.motivo,
        seleccionadoComoMejor: false,
        idSaltoChronojump: fila.idSaltoChronojump,
      })
      continue
    }

    // 3. Evaluar duplicado o conflicto contra existentes por clave lógica
    const claveLogica = generarClaveLogicaCMJ(idJugadora, fila.fecha, idProtocolo, fila.intento)
    const existente = mapExistentes.get(claveLogica)

    let estadoFinal: EstadoValidacionCMJ = plausibilidad.estado // 'valido' o 'requiere_revision'
    let motivoEstado = plausibilidad.motivo

    if (existente) {
      const clasif = evaluarClasificacionCMJ(
        {
          idJugadora,
          aliasOrigen: fila.aliasOrigen,
          origenAlias: 'chronojump',
          idProtocolo,
          fecha: fila.fecha,
          intento: fila.intento,
          alturaSaltoCm: fila.alturaSaltoCm,
          tiempoVueloMs: fila.tiempoVueloMs,
          unidadAltura: 'cm',
          seleccionadoComoMejor: false,
          estado: estadoFinal,
          fuente: 'chronojump',
        },
        existente
      )

      if (clasif === 'duplicado') {
        estadoFinal = 'duplicado'
        motivoEstado = 'Registro idéntico preexistente en la base de datos'
      } else if (clasif === 'conflicto') {
        estadoFinal = 'conflicto'
        motivoEstado = `Conflicto con registro existente (mismo intento ${fila.intento}, altura existente: ${existente.alturaSaltoCm} cm)`
      }
    }

    medicionesNormalizadas.push({
      idJugadora,
      aliasOrigen: fila.aliasOrigen,
      origenAlias: 'chronojump',
      idProtocolo,
      fecha: fila.fecha,
      intento: fila.intento,
      alturaSaltoCm: fila.alturaSaltoCm,
      tiempoVueloMs: fila.tiempoVueloMs,
      unidadAltura: 'cm',
      seleccionadoComoMejor: false,
      estado: estadoFinal,
      motivoEstado,
      fuente: 'chronojump',
      numFilaOriginal: fila.numFilaOriginal,
      idSaltoChronojump: fila.idSaltoChronojump,
    })
  }

  // Seleccionar mejores intentos para mediciones normalizadas
  const seleccionadas = seleccionarMejoresIntentosCMJ(medicionesNormalizadas)

  // Ensamblar resumen de filas
  medicionesNormalizadas.forEach((m, idx) => {
    resumenFilas.push({
      numFilaOriginal: m.numFilaOriginal,
      idJugadora: m.idJugadora,
      aliasOrigen: m.aliasOrigen,
      nombreJugadoraInternal: mapJugadoras.get(m.idJugadora),
      fecha: m.fecha,
      intento: m.intento,
      alturaSaltoCm: m.alturaSaltoCm,
      tiempoVueloMs: m.tiempoVueloMs ?? null,
      idProtocolo: m.idProtocolo,
      protocoloNombre,
      estado: m.estado,
      motivoEstado: m.motivoEstado,
      seleccionadoComoMejor: seleccionadas[idx].seleccionadoComoMejor,
      idSaltoChronojump: m.idSaltoChronojump,
    })
  })

  // Ordenar filas resumen por número de fila original
  resumenFilas.sort((a, b) => a.numFilaOriginal - b.numFilaOriginal)

  // Conteo de estados
  const nuevosValidos = resumenFilas.filter((r) => r.estado === 'valido').length
  const requierenRevision = resumenFilas.filter((r) => r.estado === 'requiere_revision').length
  const duplicados = resumenFilas.filter((r) => r.estado === 'duplicado').length
  const conflictos = resumenFilas.filter((r) => r.estado === 'conflicto').length
  const errores = resumenFilas.filter((r) => r.estado === 'error').length
  const omitidos = parseo.filasOmitidas.length

  // La confirmación está permitida SOLO si NO hay errores ni conflictos y hay al menos 1 registro elegible (válido o en revisión)
  const puedeConfirmar = errores === 0 && conflictos === 0 && nuevosValidos + requierenRevision > 0

  return {
    exito: true,
    nombreArchivo,
    totalFilasSaltosSimples: parseo.totalFilasSaltosSimples,
    totalCMJ: parseo.totalCMJ,
    nuevosValidos,
    requierenRevision,
    duplicados,
    conflictos,
    errores,
    omitidos,
    puedeConfirmar,
    filas: resumenFilas,
  }
}

export interface ResultadoImportacionCMJ {
  exito: boolean
  totalInsertados: number
  loteId: string
  mensaje?: string
}

/**
 * Ejecuta la inserción atómica de las mediciones CMJ validadas en Dexie dentro de una transacción limpia.
 * En caso de fallo, realiza rollback automático garantizando 0 escrituras parciales.
 */
export async function ejecutarImportacionChronojumpCMJAtomica(
  db: FutsalDB,
  resumen: ResumenPrevisualizacionChronojumpCMJ
): Promise<ResultadoImportacionCMJ> {
  if (!resumen.puedeConfirmar) {
    throw new Error('La importación no se puede confirmar porque contiene errores o conflictos bloqueantes')
  }

  // Filtrar filas elegibles a inserción (válidas o que requieren revisión)
  const elegibles = resumen.filas.filter(
    (f) => (f.estado === 'valido' || f.estado === 'requiere_revision') && f.idJugadora != null
  )

  if (elegibles.length === 0) {
    return { exito: true, totalInsertados: 0, loteId: '', mensaje: 'No hay mediciones nuevas para insertar' }
  }

  const loteId = `lote_chrono_${Date.now()}`
  const ahora = new Date().toISOString()

  // Agrupar filas elegibles por idJugadora + fecha + idProtocolo
  const grupos = new Map<string, ResumenFilaChronojump[]>()

  elegibles.forEach((f) => {
    const key = `${f.idJugadora}::${f.fecha}::${f.idProtocolo}`
    const lista = grupos.get(key) || []
    lista.push(f)
    grupos.set(key, lista)
  })

  let totalInsertados = 0

  // Transacción atómica Dexie sobre pruebas_cmj e historial_importaciones
  await db.transaction('rw', [db.pruebas_cmj, db.historial_importaciones], async () => {
    for (const [key, filasGrupo] of grupos.entries()) {
      const [idJugadora, fecha, idProtocolo] = key.split('::')

      // Buscar si ya existe una MedicionCMJ en la DB para este grupo
      let medicionExistente: MedicionCMJ | undefined
      const coincidentes = await db.pruebas_cmj
        .where('[id_jugadora+id_protocolo+fecha]')
        .equals([idJugadora, idProtocolo, fecha])
        .first()

      if (coincidentes) {
        medicionExistente = coincidentes
      } else {
        // Fallback por id_jugadora + fecha
        const porFecha = await db.pruebas_cmj
          .where('[id_jugadora+fecha]')
          .equals([idJugadora, fecha])
          .toArray()

        medicionExistente = porFecha.find((p) => p.id_protocolo === idProtocolo)
      }

      const intentosNuevos: IntentoCMJ[] = filasGrupo.map((f) => ({
        id_intento: `int_${f.idSaltoChronojump || Date.now()}_${f.intento}`,
        orden: f.intento,
        valido: f.estado === 'valido' || f.estado === 'requiere_revision',
        altura_cm: f.alturaSaltoCm,
        tiempo_vuelo_ms: f.tiempoVueloMs ?? undefined,
      }))

      let medicionFinal: MedicionCMJ

      if (medicionExistente) {
        // Añadir intentos nuevos conservando los preexistentes
        const intentosCombinados = [...medicionExistente.intentos]
        intentosNuevos.forEach((nuevo) => {
          if (!intentosCombinados.some((i) => i.orden === nuevo.orden)) {
            intentosCombinados.push(nuevo)
          }
        })
        intentosCombinados.sort((a, b) => a.orden - b.orden)

        // Encontrar mejor intento entre válidos
        const mejores = intentosCombinados.filter((i) => i.valido && i.altura_cm != null)
        mejores.sort((a, b) => (b.altura_cm! - a.altura_cm!) || (a.orden - b.orden))
        const mejor = mejores[0]

        medicionFinal = {
          ...medicionExistente,
          intentos: intentosCombinados,
          mejor_intento_valido_id: mejor ? mejor.id_intento : null,
          altura_mejor_cm: mejor ? mejor.altura_cm ?? null : null,
          tiempo_vuelo_mejor_ms: mejor ? mejor.tiempo_vuelo_ms ?? null : null,
          updatedAt: ahora,
        }
      } else {
        // Crear nueva medición CMJ
        const mejores = intentosNuevos.filter((i) => i.valido && i.altura_cm != null)
        mejores.sort((a, b) => (b.altura_cm! - a.altura_cm!) || (a.orden - b.orden))
        const mejor = mejores[0]

        medicionFinal = {
          id_medicion: `cmj_chrono_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          id_jugadora: idJugadora,
          fecha,
          tipo_prueba: 'cmj_bilateral',
          id_protocolo: idProtocolo,
          protocolo_nombre_historico: filasGrupo[0].protocoloNombre || DEFAULT_PROTOCOL_NAME,
          finalidad: 'control',
          intentos: intentosNuevos,
          mejor_intento_valido_id: mejor ? mejor.id_intento : null,
          altura_mejor_cm: mejor ? mejor.altura_cm ?? null : null,
          tiempo_vuelo_mejor_ms: mejor ? mejor.tiempo_vuelo_ms ?? null : null,
          fuente: 'chronojump_csv_futuro',
          createdAt: ahora,
          updatedAt: ahora,
        }
      }

      await db.pruebas_cmj.put(medicionFinal)
      totalInsertados += intentosNuevos.length
    }

    // Registrar entrada en el historial de importaciones
    const historialEntry: HistorialImportacion = {
      fechaHora: ahora,
      nombreArchivo: resumen.nombreArchivo,
      tipoImportacion: 'wellness', // Reutiliza tipo existente en tabla de historial o string compatible
      totalFilas: resumen.totalFilasSaltosSimples,
      registrosNuevos: totalInsertados,
      registrosActualizados: 0,
      registrosOmitidos: resumen.duplicados + resumen.omitidos,
      registrosErroneos: resumen.errores,
      detalleErrores: resumen.filas.filter((f) => f.estado === 'error').map((f) => `Fila ${f.numFilaOriginal}: ${f.motivoEstado}`),
      estrategiaDuplicadosElegida: 'omit',
      nombreBackupPrevio: '',
      versionEsquema: 15,
      estado: 'completada',
    }

    await db.historial_importaciones.put(historialEntry)
  })

  return {
    exito: true,
    totalInsertados,
    loteId,
    mensaje: `Importación completada con éxito. ${totalInsertados} intentos de salto importados.`,
  }
}
