import { isFechaLocalISO } from '@/domain/dates/dates'

export interface FilaChronojumpCMJParsed {
  aliasOrigen: string
  fecha: string
  horaOrigen: string
  alturaSaltoCm: number
  tiempoVueloMs: number | null
  intento: number
  idSaltoChronojump: string
  idPersonaChronojump: string
  idSesionChronojump: string
  simulado: boolean
  numFilaOriginal: number
}

export interface FilaOmitidaChronojump {
  numFilaOriginal: number
  tipo: string
  motivo: string
}

export interface FilaErrorChronojump {
  numFilaOriginal: number
  aliasOrigen: string
  motivo: string
}

export interface ResultadoParseoChronojumpCMJ {
  exito: boolean
  mensajeGlobal?: string
  nombreSesion?: string
  fechaSesion?: string
  totalFilasSaltosSimples: number
  totalCMJ: number
  filasValidas: FilaChronojumpCMJParsed[]
  filasOmitidas: FilaOmitidaChronojump[]
  filasConError: FilaErrorChronojump[]
}

/**
 * Parsea el contenido CSV exportado por Chronojump Desktop Windows 2.6.0-072.
 * Extrae de forma aislada la sección '+ SALTOS SIMPLES' y procesa exclusivamente filas de tipo 'CMJ'.
 */
export function parsearChronojumpCMJCsv(contenido: string): ResultadoParseoChronojumpCMJ {
  if (!contenido || !contenido.trim()) {
    return {
      exito: false,
      mensajeGlobal: 'El archivo CSV está vacío',
      totalFilasSaltosSimples: 0,
      totalCMJ: 0,
      filasValidas: [],
      filasOmitidas: [],
      filasConError: [],
    }
  }

  // Eliminar BOM de UTF-8 si existe
  const textoLimpio = contenido.replace(/^\uFEFF/, '')
  const lineas = textoLimpio.split(/\r?\n/)

  let nombreSesion: string | undefined
  let fechaSesion: string | undefined

  let enSaltosSimples = false
  let cabeceraIndices: Map<string, number> | null = null
  const filasRaw: { celdas: string[]; numFila: number }[] = []

  // Recorrer líneas detectando secciones
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i].trim()
    const numFila = i + 1

    if (linea === '+ SESIÓN' || linea === '+ PERSONAS') {
      enSaltosSimples = false
      continue
    }

    if (linea === '+ SALTOS SIMPLES') {
      enSaltosSimples = true
      continue
    }

    if (enSaltosSimples) {
      if (!linea) continue // Ignorar líneas vacías

      const celdas = linea.split(';').map((c) => c.trim())

      if (!cabeceraIndices) {
        // Primera línea de la sección de saltos simples es la cabecera
        const indices = new Map<string, number>()
        celdas.forEach((col, idx) => indices.set(col, idx))
        cabeceraIndices = indices
      } else {
        filasRaw.push({ celdas, numFila })
      }
    } else if (lineas[i].includes(';')) {
      // Extraer datos opcionales de metadatos de sesión si están presentes
      const celdas = lineas[i].split(';').map((c) => c.trim())
      if (celdas.length >= 4 && celdas[1] === 'SIMULATED') {
        nombreSesion = celdas[1]
        if (celdas[3]) fechaSesion = celdas[3]
      }
    }
  }

  if (!cabeceraIndices) {
    return {
      exito: false,
      mensajeGlobal: 'No se encontró la sección "+ SALTOS SIMPLES" o su cabecera en el archivo CSV',
      totalFilasSaltosSimples: 0,
      totalCMJ: 0,
      filasValidas: [],
      filasOmitidas: [],
      filasConError: [],
    }
  }

  // Columnas mínimas requeridas en cabecera
  const columnasRequeridas = [
    'ID de la persona',
    'Nombre de la persona',
    'ID de salto',
    'Tipo',
    'TV',
    'Altura',
    'Fecha',
  ]

  for (const colReq of columnasRequeridas) {
    if (!cabeceraIndices.has(colReq)) {
      return {
        exito: false,
        mensajeGlobal: `La cabecera de la sección "+ SALTOS SIMPLES" carece de la columna obligatoria "${colReq}"`,
        totalFilasSaltosSimples: 0,
        totalCMJ: 0,
        filasValidas: [],
        filasOmitidas: [],
        filasConError: [],
      }
    }
  }

  const getVal = (celdas: string[], colName: string): string => {
    const idx = cabeceraIndices!.get(colName)
    return idx != null && idx < celdas.length ? celdas[idx] : ''
  }

  const filasCandidatas: {
    aliasOrigen: string
    fecha: string
    horaOrigen: string
    alturaSaltoCm: number
    tiempoVueloMs: number | null
    idSalto: string
    idPersona: string
    idSesion: string
    simulado: boolean
    numFila: number
  }[] = []

  const filasOmitidas: FilaOmitidaChronojump[] = []
  const filasConError: FilaErrorChronojump[] = []
  let totalCMJ = 0

  for (const { celdas, numFila } of filasRaw) {
    const tipo = getVal(celdas, 'Tipo').trim().toUpperCase()

    // Solo se procesan saltos tipo 'CMJ'
    if (tipo !== 'CMJ') {
      filasOmitidas.push({
        numFilaOriginal: numFila,
        tipo: getVal(celdas, 'Tipo'),
        motivo: `Tipo de prueba no soportado (${getVal(celdas, 'Tipo') || 'vacío'})`,
      })
      continue
    }

    totalCMJ++

    const aliasOrigen = getVal(celdas, 'Nombre de la persona').trim()
    if (!aliasOrigen) {
      filasConError.push({
        numFilaOriginal: numFila,
        aliasOrigen: '',
        motivo: 'Columna "Nombre de la persona" (alias) está vacía',
      })
      continue
    }

    const fechaStr = getVal(celdas, 'Fecha').trim()
    if (!isFechaLocalISO(fechaStr)) {
      filasConError.push({
        numFilaOriginal: numFila,
        aliasOrigen,
        motivo: `Fecha local estricta inválida "${fechaStr}" (debe ser YYYY-MM-DD)`,
      })
      continue
    }

    const alturaRaw = getVal(celdas, 'Altura').replace(',', '.').trim()
    const alturaNum = parseFloat(alturaRaw)
    if (isNaN(alturaNum) || !Number.isFinite(alturaNum) || alturaNum <= 0) {
      filasConError.push({
        numFilaOriginal: numFila,
        aliasOrigen,
        motivo: `Altura de salto inválida "${getVal(celdas, 'Altura')}"`,
      })
      continue
    }

    const tvRaw = getVal(celdas, 'TV').replace(',', '.').trim()
    let tiempoVueloMs: number | null = null
    if (tvRaw !== '' && tvRaw !== '0') {
      const tvNum = parseFloat(tvRaw)
      if (!isNaN(tvNum) && Number.isFinite(tvNum) && tvNum > 0) {
        tiempoVueloMs = Math.round(tvNum * 1000)
      }
    }

    const horaOrigen = getVal(celdas, 'Tiempo').trim()
    const idSalto = getVal(celdas, 'ID de salto').trim()
    const idPersona = getVal(celdas, 'ID de la persona').trim()
    const idSesion = getVal(celdas, 'ID de sesión').trim()
    const simulado = getVal(celdas, 'Simulado').trim().toLowerCase() === 'sí' || getVal(celdas, 'Simulado').trim().toLowerCase() === 'si'

    filasCandidatas.push({
      aliasOrigen,
      fecha: fechaStr,
      horaOrigen,
      alturaSaltoCm: alturaNum,
      tiempoVueloMs,
      idSalto,
      idPersona,
      idSesion,
      simulado,
      numFila,
    })
  }

  // Asignación de intentos por grupo (aliasOrigen + fecha) ordenando por Tiempo asc, ID de salto asc, numFila asc
  const grupos = new Map<string, typeof filasCandidatas>()

  filasCandidatas.forEach((f) => {
    const key = `${f.aliasOrigen}::${f.fecha}`
    const lista = grupos.get(key) || []
    lista.push(f)
    grupos.set(key, lista)
  })

  const filasValidas: FilaChronojumpCMJParsed[] = []

  grupos.forEach((items) => {
    // Ordenar ascendentemente por horaOrigen, luego idSalto numérico, luego numFila
    items.sort((a, b) => {
      if (a.horaOrigen && b.horaOrigen && a.horaOrigen !== b.horaOrigen) {
        return a.horaOrigen.localeCompare(b.horaOrigen)
      }
      const idA = parseInt(a.idSalto, 10) || 0
      const idB = parseInt(b.idSalto, 10) || 0
      if (idA !== idB) return idA - idB
      return a.numFila - b.numFila
    })

    // Asignar intento consecutivo: 1, 2, 3...
    items.forEach((item, index) => {
      filasValidas.push({
        aliasOrigen: item.aliasOrigen,
        fecha: item.fecha,
        horaOrigen: item.horaOrigen,
        alturaSaltoCm: item.alturaSaltoCm,
        tiempoVueloMs: item.tiempoVueloMs,
        intento: index + 1,
        idSaltoChronojump: item.idSalto,
        idPersonaChronojump: item.idPersona,
        idSesionChronojump: item.idSesion,
        simulado: item.simulado,
        numFilaOriginal: item.numFila,
      })
    })
  })

  return {
    exito: true,
    nombreSesion,
    fechaSesion,
    totalFilasSaltosSimples: filasRaw.length,
    totalCMJ,
    filasValidas,
    filasOmitidas,
    filasConError,
  }
}
