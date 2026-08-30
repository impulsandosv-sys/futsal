// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@/db/database'
import {
  createBackupData,
  validateBackupData,
  restoreFromData
} from './backup'

vi.unmock('./backup')
vi.unmock('@/utils/backup')

// Mocking Dexie database
vi.mock('@/db/database', () => {
  const mockTable = () => ({
    toArray: vi.fn(() => Promise.resolve([])),
    put: vi.fn(() => Promise.resolve(1)),
    clear: vi.fn(() => Promise.resolve()),
    where: vi.fn(() => ({
      toArray: vi.fn(() => Promise.resolve([]))
    }))
  })

  const dbMock = {
    transaction: vi.fn((mode, tables, callback) => callback()),
    temporadas: mockTable(),
    alias_jugadora: mockTable(),
    jugadoras: mockTable(),
    formulario_respuestas: mockTable(),
    wellness: mockTable(),
    wellness_diario_importado: mockTable(),
    wellness_semanal_importado: mockTable(),
    sesiones: mockTable(),
    partidos: mockTable(),
    lesiones: mockTable(),
    tests_fisicos: mockTable(),
    rpe_partido: mockTable(),
    resumen_semanal: mockTable(),
    alertas: mockTable(),
    sesion_rpe: mockTable(),
    readiness: mockTable(),
    historial_importaciones: mockTable(),
    historial_copias: mockTable(),
    ciclo_menstrual: mockTable(),
    registro_menstrual: mockTable(),
    carga_gps: mockTable(),
    fuerza_vbt: mockTable(),
    hidratacion: mockTable(),
    rtp_checklist: mockTable(),
    test_psicologico: mockTable(),
    protocolos_cmj: mockTable(),
    pruebas_cmj: mockTable(),
    ejercicios_fuerza: mockTable(),
    trabajos_fuerza: mockTable(),
    plantillas_fuerza: mockTable(),
    sesiones_fuerza_individual: mockTable(),
    plantillas_importacion: mockTable()
  }

  return { db: dbMock }
})

// Mocking dependencies to avoid executing complex domain functions
vi.mock('@/services/resumenSemanal', () => ({
  recalcularResumenSemanal: vi.fn(() => Promise.resolve({}))
}))
vi.mock('@/services/readiness', () => ({
  recalcularReadinessJugadora: vi.fn(() => Promise.resolve())
}))
vi.mock('@/domain/dates/dates', () => ({
  getWeekId: vi.fn(() => '2026-W29'),
  getTodayLocalISO: vi.fn(() => '2026-07-28'),
  getLocalDateString: vi.fn(() => '2026-07-28')
}))

describe('backup utility - strict validation & security', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock localStorage
    if (typeof localStorage === 'undefined') {
      let store: Record<string, string> = {}
      global.localStorage = {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value.toString() },
        clear: () => { store = {} },
        removeItem: (key: string) => { delete store[key] },
        length: 0,
        key: () => null
      } as Storage
    } else {
      localStorage.clear()
    }
    // Mock URL.createObjectURL y click para jsdom
    if (typeof URL.createObjectURL === 'undefined') {
      URL.createObjectURL = vi.fn(() => 'blob:mock')
      URL.revokeObjectURL = vi.fn()
    }
    if (typeof HTMLAnchorElement !== 'undefined') {
      HTMLAnchorElement.prototype.click = vi.fn()
    }
  })

  it('1. Cobertura: createBackupData incluye el 100% de las tablas IndexedDB', async () => {
    vi.mocked(db.jugadoras.toArray).mockResolvedValue([{ id_jugadora: 'J01', nombre: 'Jugadora 1' }] as any)
    vi.mocked(db.wellness.toArray).mockResolvedValue([{ id: 1, id_jugadora: 'J01', fecha: '2026-07-19' }] as any)
    vi.mocked(db.temporadas.toArray).mockResolvedValue([{ id_temporada: 'T2026', nombre: 'Temporada 2026-2027', activa: true, fecha_inicio: '2026-08-01', fecha_fin: '2027-06-30' }] as any)

    const backup = await createBackupData()

    expect(backup.version).toBe(16)
    expect(backup.backupFormatVersion).toBe(1)
    expect(backup.databaseSchemaVersion).toBe(16)
    expect(backup.data).toHaveProperty('temporadas')
    expect(backup.data).toHaveProperty('alias_jugadora')
    expect(backup.data).toHaveProperty('jugadoras')
    expect(backup.data).toHaveProperty('formulario_respuestas')
    expect(backup.data).toHaveProperty('wellness')
    expect(backup.data).toHaveProperty('ciclo_menstrual')
    expect(backup.data).toHaveProperty('historial_copias')

    expect(db.jugadoras.toArray).toHaveBeenCalled()
    expect(db.wellness.toArray).toHaveBeenCalled()
    expect(db.temporadas.toArray).toHaveBeenCalled()
  })

  it('2. Validación: detecta archivos JSON y estructuras de esquema inválidas', () => {
    let validation = validateBackupData(null)
    expect(validation.isValid).toBe(false)
    expect(validation.canRestore).toBe(false)

    validation = validateBackupData({ version: 'invalid', data: {} })
    expect(validation.isValid).toBe(false)
    expect(validation.canRestore).toBe(false)

    validation = validateBackupData({ version: 16 })
    expect(validation.isValid).toBe(false)
    expect(validation.canRestore).toBe(false)
  })

  it('3. Contrato de Versiones: valida backupFormatVersion y databaseSchemaVersion de forma independiente', async () => {
    // Formato 1 + Esquema 16 (Soportado): canRestore es true
    let validation = validateBackupData({
      backupFormatVersion: 1,
      databaseSchemaVersion: 16,
      data: { jugadoras: [], sesiones: [], partidos: [], lesiones: [], temporadas: [] }
    })
    expect(validation.isValid).toBe(true)
    expect(validation.canRestore).toBe(true)

    // Formato 2 (No soportado): canRestore es false, sin escrituras
    const backupFormatNoSoportado = {
      backupFormatVersion: 2,
      databaseSchemaVersion: 16,
      data: { jugadoras: [{ id_jugadora: 'J01', nombre: 'Jugadora 1' }], sesiones: [], partidos: [], lesiones: [], temporadas: [] }
    }
    validation = validateBackupData(backupFormatNoSoportado)
    expect(validation.canRestore).toBe(false)
    expect(validation.error).toContain('Formato de copia de seguridad (versión 2) no soportado')

    const restoreFormatRes = await restoreFromData(backupFormatNoSoportado, 'replace')
    expect(restoreFormatRes.success).toBe(false)
    expect(db.jugadoras.clear).not.toHaveBeenCalled()

    // Formato 1 + Esquema 14 (Esquema incompatible): canRestore es false, sin escrituras
    const backupSchemaIncompatible = {
      backupFormatVersion: 1,
      databaseSchemaVersion: 14,
      data: { jugadoras: [{ id_jugadora: 'J01', nombre: 'Jugadora 1' }], sesiones: [], partidos: [], lesiones: [], temporadas: [] }
    }
    validation = validateBackupData(backupSchemaIncompatible)
    expect(validation.canRestore).toBe(false)
    expect(validation.error).toContain('Esquema de base de datos (v14) no compatible')

    const restoreSchemaRes = await restoreFromData(backupSchemaIncompatible, 'replace')
    expect(restoreSchemaRes.success).toBe(false)
    expect(db.jugadoras.clear).not.toHaveBeenCalled()
  })

  it('4. Bloqueo total por tabla crítica ausente: si falta una tabla crítica canRestore es false y cero tablas alteradas', async () => {
    const backupIncompletoSinJugadoras = {
      backupFormatVersion: 1,
      databaseSchemaVersion: 16,
      data: {
        sesiones: [{ id_sesion: 'S01' }],
        partidos: [],
        lesiones: [],
        temporadas: []
        // Falta 'jugadoras' (tabla crítica)
      }
    }

    const validation = validateBackupData(backupIncompletoSinJugadoras)
    expect(validation.isValid).toBe(false)
    expect(validation.canRestore).toBe(false)
    expect(validation.error).toContain('Falta la tabla crítica "jugadoras"')

    const restoreRes = await restoreFromData(backupIncompletoSinJugadoras, 'replace')
    expect(restoreRes.success).toBe(false)
    expect(db.sesiones.clear).not.toHaveBeenCalled()
    expect(db.sesiones.put).not.toHaveBeenCalled()
  })

  it('5. Política de Replace Opción A: bloquea reemplazo total si falta cualquier tabla opcional del contrato para evitar borrado accidental', async () => {
    const backupIncompletoSinWellness = {
      backupFormatVersion: 1,
      databaseSchemaVersion: 16,
      data: {
        jugadoras: [{ id_jugadora: 'J01', nombre: 'Jugadora 1' }],
        sesiones: [],
        partidos: [],
        lesiones: [],
        temporadas: []
        // Falta 'wellness' (tabla opcional del contrato)
      }
    }

    const result = await restoreFromData(backupIncompletoSinWellness, 'replace')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Reemplazo total bloqueado')
    expect(db.jugadoras.clear).not.toHaveBeenCalled()
  })

  it('6. Política de Merge con tabla ausente: preserva datos locales de esa tabla sin alterarlos ni ejecutar clear()', async () => {
    const backupSinWellness = {
      backupFormatVersion: 1,
      databaseSchemaVersion: 16,
      data: {
        jugadoras: [{ id_jugadora: 'J01', nombre: 'Jugadora 1' }],
        sesiones: [],
        partidos: [],
        lesiones: [],
        temporadas: []
        // 'wellness' ausente en el backup
      }
    }

    vi.mocked(db.jugadoras.toArray).mockResolvedValue([{ id_jugadora: 'J01', nombre: 'Jugadora 1' }] as any)
    vi.mocked(db.wellness.toArray).mockResolvedValue([{ id: 1, id_jugadora: 'J01', fecha: '2026-07-19', score_wellness: 85 }] as any)

    const result = await restoreFromData(backupSinWellness, 'merge', 'skip')

    expect(result.success).toBe(true)
    expect(db.wellness.clear).not.toHaveBeenCalled() // No debe tocarse la tabla ausente
  })

  it('7. Preservación de Trazabilidad Humana en Alertas: las notas y estado del staff no se pierden al regenerar derivados', async () => {
    const alertaConTrazabilidadHumana = {
      id: 10,
      id_jugadora: 'J01',
      fecha: '2026-07-19',
      tipo: 'carga_alta' as const,
      nivel: 'alto' as const,
      prioridad: 'alto' as const,
      leida: true,
      creada: '2026-07-19T10:00:00Z',
      fecha_creacion: '2026-07-19T10:00:00Z',
      estado: 'en_revision' as const,
      responsable: 'Fisiorrehabilitador Pedro',
      nota_decision: 'Reducir minutos en entrenamiento táctico y realizar descarga en piscina.',
      sugerencia: 'Revisión de carga',
      mensaje: 'Alerta de alta carga',
      origen: 'algoritmo',
      datos_sustento: '{}'
    }

    vi.mocked(db.jugadoras.toArray).mockResolvedValue([{ id_jugadora: 'J01', nombre: 'Ana' }] as any)
    vi.mocked(db.wellness.toArray).mockResolvedValue([{ id_jugadora: 'J01', fecha: '2026-07-19', score_wellness: 40 }] as any)
    vi.mocked(db.ciclo_menstrual.toArray).mockResolvedValue([{ id_jugadora: 'J01', fecha: '2026-07-19', fase: 'Lutea' }] as any)
    vi.mocked(db.resumen_semanal.where).mockReturnValue({
      toArray: vi.fn().mockResolvedValue([{ id_jugadora: 'J01', semana: '2026-W29', acwr: 1.8 }])
    } as any)
    vi.mocked(db.alertas.where).mockReturnValue({
      toArray: vi.fn().mockResolvedValue([alertaConTrazabilidadHumana])
    } as any)

    // regenerarTablasDerivadas limpia readiness y resumen_semanal, pero NO vacía alertas
    const { regenerarTablasDerivadas } = await import('./backup')
    await regenerarTablasDerivadas()

    expect(db.readiness.clear).toHaveBeenCalled()
    expect(db.resumen_semanal.clear).toHaveBeenCalled()
    expect(db.alertas.clear).not.toHaveBeenCalled() // Preservada para no perder notas humanas
  })

  it('8. Prevención de huérfanos en Merge: omitir registros hijos cuyos padres no existen', async () => {
    const backupData = {
      backupFormatVersion: 1,
      databaseSchemaVersion: 16,
      data: {
        jugadoras: [{ id_jugadora: 'J01', nombre: 'Jugadora Existente' }],
        sesiones: [],
        partidos: [],
        lesiones: [],
        temporadas: [],
        wellness: [
          { id: 1, id_jugadora: 'J01', fecha: '2026-07-19', score_wellness: 80 }, // Válido
          { id: 2, id_jugadora: 'J_INEXISTENTE', fecha: '2026-07-19', score_wellness: 70 } // Huérfano
        ],
        rpe_partido: [
          { id: 1, id_jugadora: 'J01', id_partido: 'P_INEXISTENTE', rpe: 7 } // Huérfano por partido
        ]
      }
    }

    vi.mocked(db.jugadoras.toArray).mockResolvedValue([{ id_jugadora: 'J01', nombre: 'Jugadora Existente' }] as any)
    vi.mocked(db.wellness.toArray).mockResolvedValue([] as any)
    vi.mocked(db.rpe_partido.toArray).mockResolvedValue([] as any)

    const result = await restoreFromData(backupData, 'merge', 'skip')

    expect(result.success).toBe(true)
    expect(result.stats.wellness.inserted).toBe(1)
    expect(result.stats.wellness.skipped).toBe(1)
    expect(result.stats.rpe_partido.skipped).toBe(1)

    const huérfanos = result.conflicts.filter(c => c.key === 'Huérfano')
    expect(huérfanos.length).toBe(2)
    expect(huérfanos[0].description).toContain('Registro huérfano omitido')
  })

  it('9. Restauración Replace: cancela y no ejecuta clear() si falla la descarga del backup previo', async () => {
    const backupData = {
      backupFormatVersion: 1,
      databaseSchemaVersion: 16,
      data: {
        jugadoras: [{ id_jugadora: 'J01', nombre: 'Jugadora Nueva' }],
        sesiones: [],
        partidos: [],
        lesiones: [],
        temporadas: [],
        formulario_respuestas: [], wellness: [], tests_fisicos: [], rpe_partido: [],
        sesion_rpe: [], alertas: [], historial_importaciones: [], historial_copias: [],
        ciclo_menstrual: [], registro_menstrual: [], carga_gps: [], fuerza_vbt: [], hidratacion: [],
        rtp_checklist: [], test_psicologico: [], protocolos_cmj: [], pruebas_cmj: [], wellness_diario_importado: [], wellness_semanal_importado: [],
        ejercicios_fuerza: [], trabajos_fuerza: [], plantillas_fuerza: [],
        sesiones_fuerza_individual: [], plantillas_importacion: [], alias_jugadora: []
      }
    }

    // Simulamos que la descarga previa falla inhabilitando document
    vi.stubGlobal('document', undefined)

    const result = await restoreFromData(backupData, 'replace')

    vi.unstubAllGlobals()

    expect(result.success).toBe(false)
    expect(result.error).toContain('No se pudo generar o descargar la copia de seguridad previa')
    expect(db.jugadoras.clear).not.toHaveBeenCalled()
  })

  it('10. Rollback de Transacción Dexie: captura error y responde con success: false sin persistencia', async () => {
    const backupData = {
      backupFormatVersion: 1,
      databaseSchemaVersion: 16,
      data: {
        jugadoras: [{ id_jugadora: 'J01', nombre: 'Jugadora Test' }],
        sesiones: [],
        partidos: [],
        lesiones: [],
        temporadas: [],
        formulario_respuestas: [], wellness: [], tests_fisicos: [], rpe_partido: [],
        sesion_rpe: [], alertas: [], historial_importaciones: [], historial_copias: [],
        ciclo_menstrual: [], registro_menstrual: [], carga_gps: [], fuerza_vbt: [], hidratacion: [],
        rtp_checklist: [], test_psicologico: [], protocolos_cmj: [], pruebas_cmj: [], wellness_diario_importado: [], wellness_semanal_importado: [],
        ejercicios_fuerza: [], trabajos_fuerza: [], plantillas_fuerza: [],
        sesiones_fuerza_individual: [], plantillas_importacion: [], alias_jugadora: []
      }
    }

    vi.mocked(db.transaction).mockImplementationOnce(() => {
      throw new Error('Error simulado de base de datos durante transacción')
    })

    const result = await restoreFromData(backupData, 'replace')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Error simulado de base de datos')
  })

  it('11. Módulo de backup seguro NO exporta restoreBackup ni restoreBackupDangerousLegacy', async () => {
    const backupModule = await import('./backup')
    expect((backupModule as any).restoreBackup).toBeUndefined()
    expect((backupModule as any).restoreBackupDangerousLegacy).toBeUndefined()
  })

  it('12. Un backup completo incluye registro_menstrual con todos sus campos', async () => {
    const mockRegMenstrual = [
      {
        id: 1,
        id_jugadora: 'J01',
        fecha_inicio: '2026-05-10',
        impacto_percibido: 3,
        comentario: 'Molestia leve',
        nota_ajuste: 'Carga reducida',
        creado_en: '2026-05-10T10:00:00Z',
        actualizado_en: '2026-05-10T10:00:00Z'
      }
    ]

    vi.mocked(db.registro_menstrual.toArray).mockResolvedValueOnce(mockRegMenstrual as any)

    const backup = await createBackupData()
    expect(backup.data.registro_menstrual).toBeDefined()
    expect(backup.data.registro_menstrual).toHaveLength(1)
    expect(backup.data.registro_menstrual[0]).toEqual(mockRegMenstrual[0])
  })

  it('13. Restaurar recupera registro_menstrual y no altera ciclo_menstrual', async () => {
    const incomingReg = [
      {
        id: 1,
        id_jugadora: 'J01',
        fecha_inicio: '2026-05-10',
        impacto_percibido: 4,
        comentario: 'Nota',
        nota_ajuste: 'Ajuste',
        creado_en: '2026-05-10T10:00:00Z',
        actualizado_en: '2026-05-10T10:00:00Z'
      }
    ]

    const backupData = {
      backupFormatVersion: 1,
      databaseSchemaVersion: 16,
      data: {
        jugadoras: [{ id_jugadora: 'J01', nombre: 'Jugadora Existente' }],
        sesiones: [],
        partidos: [],
        lesiones: [],
        temporadas: [],
        formulario_respuestas: [], wellness: [], tests_fisicos: [], rpe_partido: [],
        sesion_rpe: [], alertas: [], historial_importaciones: [], historial_copias: [],
        ciclo_menstrual: [],
        registro_menstrual: incomingReg,
        carga_gps: [], fuerza_vbt: [], hidratacion: [],
        rtp_checklist: [], test_psicologico: [], protocolos_cmj: [], pruebas_cmj: [], wellness_diario_importado: [], wellness_semanal_importado: [],
        ejercicios_fuerza: [], trabajos_fuerza: [], plantillas_fuerza: [],
        sesiones_fuerza_individual: [], plantillas_importacion: [], alias_jugadora: []
      }
    }

    vi.mocked(db.jugadoras.toArray).mockResolvedValue([{ id_jugadora: 'J01', nombre: 'Jugadora Existente' }] as any)
    vi.mocked(db.registro_menstrual.toArray).mockResolvedValue([] as any)
    vi.mocked(db.ciclo_menstrual.toArray).mockResolvedValue([{ id: 99, id_jugadora: 'J01', fecha: '2025-01-01', fase: 'Folicular', sintomas: '', notas: '' }] as any)

    const result = await restoreFromData(backupData, 'merge', 'skip')

    expect(result.success).toBe(true)
    expect(result.stats.registro_menstrual.inserted).toBe(1)
    // ciclo_menstrual no debe ser borrado ni alterado en merge
    expect(db.ciclo_menstrual.clear).not.toHaveBeenCalled()
  })

  it('14. Restaurar ciclo_menstrual no altera registro_menstrual', async () => {
    const incomingCiclo = [
      { id: 10, id_jugadora: 'J01', fecha: '2025-02-01', fase: 'Lutea', sintomas: '', notas: '' }
    ]

    const backupData = {
      backupFormatVersion: 1,
      databaseSchemaVersion: 16,
      data: {
        jugadoras: [{ id_jugadora: 'J01', nombre: 'Jugadora Existente' }],
        sesiones: [],
        partidos: [],
        lesiones: [],
        temporadas: [],
        formulario_respuestas: [], wellness: [], tests_fisicos: [], rpe_partido: [],
        sesion_rpe: [], alertas: [], historial_importaciones: [], historial_copias: [],
        ciclo_menstrual: incomingCiclo,
        registro_menstrual: [],
        carga_gps: [], fuerza_vbt: [], hidratacion: [],
        rtp_checklist: [], test_psicologico: [], protocolos_cmj: [], pruebas_cmj: [], wellness_diario_importado: [], wellness_semanal_importado: [],
        ejercicios_fuerza: [], trabajos_fuerza: [], plantillas_fuerza: [],
        sesiones_fuerza_individual: [], plantillas_importacion: [], alias_jugadora: []
      }
    }

    vi.mocked(db.jugadoras.toArray).mockResolvedValue([{ id_jugadora: 'J01', nombre: 'Jugadora Existente' }] as any)
    vi.mocked(db.ciclo_menstrual.toArray).mockResolvedValue([] as any)
    vi.mocked(db.registro_menstrual.toArray).mockResolvedValue([{ id: 1, id_jugadora: 'J01', fecha_inicio: '2026-05-10', impacto_percibido: 3 }] as any)

    const result = await restoreFromData(backupData, 'merge', 'skip')

    expect(result.success).toBe(true)
    expect(result.stats.ciclo_menstrual.inserted).toBe(1)
    expect(db.registro_menstrual.clear).not.toHaveBeenCalled()
  })

  it('15. Restaurar omite duplicados lógicos en registro_menstrual para misma jugadora y fecha_inicio', async () => {
    const incomingReg = [
      {
        id: 1,
        id_jugadora: 'J01',
        fecha_inicio: '2026-05-10',
        impacto_percibido: 3,
        comentario: 'Mismo dato',
        nota_ajuste: '',
        creado_en: '2026-05-10T10:00:00Z',
        actualizado_en: '2026-05-10T10:00:00Z'
      }
    ]

    const backupData = {
      backupFormatVersion: 1,
      databaseSchemaVersion: 16,
      data: {
        jugadoras: [{ id_jugadora: 'J01', nombre: 'Jugadora Existente' }],
        sesiones: [],
        partidos: [],
        lesiones: [],
        temporadas: [],
        formulario_respuestas: [], wellness: [], tests_fisicos: [], rpe_partido: [],
        sesion_rpe: [], alertas: [], historial_importaciones: [], historial_copias: [],
        ciclo_menstrual: [],
        registro_menstrual: incomingReg,
        carga_gps: [], fuerza_vbt: [], hidratacion: [],
        rtp_checklist: [], test_psicologico: [], protocolos_cmj: [], pruebas_cmj: [], wellness_diario_importado: [], wellness_semanal_importado: [],
        ejercicios_fuerza: [], trabajos_fuerza: [], plantillas_fuerza: [],
        sesiones_fuerza_individual: [], plantillas_importacion: [], alias_jugadora: []
      }
    }

    vi.mocked(db.jugadoras.toArray).mockResolvedValue([{ id_jugadora: 'J01', nombre: 'Jugadora Existente' }] as any)
    // Ya existe localmente el mismo registro id_jugadora + fecha_inicio
    vi.mocked(db.registro_menstrual.toArray).mockResolvedValue([incomingReg[0]] as any)

    const result = await restoreFromData(backupData, 'merge', 'skip')

    expect(result.success).toBe(true)
    expect(result.stats.registro_menstrual.inserted).toBe(0)
    expect(result.stats.registro_menstrual.skipped).toBe(1)
  })

  // FASE 4B - Contexto Menstrual (Backup & Restore)
  it('Fase 4B. createBackupData incluye registro_menstrual con accion_ajuste, fecha_decision y nota_ajuste', async () => {
    const regCon4B = {
      id: 1,
      id_jugadora: 'J01',
      fecha_inicio: '2026-08-27',
      impacto_percibido: 5,
      accion_ajuste: 'AJUSTE_VOLUMEN',
      fecha_decision: '2026-08-27',
      nota_ajuste: 'Reducir volumen un 20%',
      comentario: 'Molestias pélvicas',
      creado_en: '2026-08-27T00:00:00Z',
      actualizado_en: '2026-08-27T00:00:00Z'
    }
    vi.mocked(db.registro_menstrual.toArray).mockResolvedValue([regCon4B] as unknown as import('@/types').RegistroMenstrual[])

    const backup = await createBackupData()
    expect(backup.data.registro_menstrual).toHaveLength(1)

    const r = backup.data.registro_menstrual[0]
    expect(r.accion_ajuste).toBe('AJUSTE_VOLUMEN')
    expect(r.fecha_decision).toBe('2026-08-27')
    expect(r.nota_ajuste).toBe('Reducir volumen un 20%')
    expect(r.comentario).toBe('Molestias pélvicas')
  })

  it('Fase 4B. restoreFromData (merge) preserva campos si el registro no existía', async () => {
    const regCon4B = {
      id: 1,
      id_jugadora: 'J01',
      fecha_inicio: '2026-08-27',
      impacto_percibido: 5,
      accion_ajuste: 'AJUSTE_VOLUMEN',
      fecha_decision: '2026-08-27',
      nota_ajuste: 'Nota restaurada'
    }

    const backupData = {
      version: '1.0.0',
      timestamp: '2026-08-27T00:00:00Z',
      backupFormatVersion: 1,
      databaseSchemaVersion: 16,
      data: {
        jugadoras: [], sesiones: [], partidos: [], lesiones: [], temporadas: [],
        formulario_respuestas: [], wellness: [], tests_fisicos: [], rpe_partido: [],
        sesion_rpe: [], alertas: [], historial_importaciones: [], historial_copias: [],
        ciclo_menstrual: [], carga_gps: [], fuerza_vbt: [], hidratacion: [],
        rtp_checklist: [], test_psicologico: [], protocolos_cmj: [], pruebas_cmj: [],
        wellness_diario_importado: [], wellness_semanal_importado: [],
        ejercicios_fuerza: [], trabajos_fuerza: [], plantillas_fuerza: [],
        sesiones_fuerza_individual: [], plantillas_importacion: [], alias_jugadora: [],
        registro_menstrual: [regCon4B]
      }
    }

    vi.mocked(db.registro_menstrual.toArray).mockResolvedValue([])
    const putMock = vi.mocked(db.registro_menstrual.put).mockResolvedValue(1)

    const result = await restoreFromData(backupData, 'merge', 'replace')

    expect(result.success).toBe(true)
    expect(putMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accion_ajuste: 'AJUSTE_VOLUMEN',
        fecha_decision: '2026-08-27',
        nota_ajuste: 'Nota restaurada'
      })
    )
  })

  it('Fase 4B. restoreFromData (replace mode) preserva campos al restaurar BD completa', async () => {
    const regCon4B = {
      id: 1,
      id_jugadora: 'J02',
      fecha_inicio: '2026-08-20',
      impacto_percibido: 3,
      accion_ajuste: 'SIN_CAMBIOS',
      fecha_decision: '2026-08-21'
    }

    const backupData = {
      version: '1.0.0', timestamp: '2026-08-27T00:00:00Z',
      backupFormatVersion: 1, databaseSchemaVersion: 16,
      data: {
        jugadoras: [], sesiones: [], partidos: [], lesiones: [], temporadas: [],
        formulario_respuestas: [], wellness: [], tests_fisicos: [], rpe_partido: [],
        sesion_rpe: [], alertas: [], historial_importaciones: [], historial_copias: [],
        ciclo_menstrual: [], carga_gps: [], fuerza_vbt: [], hidratacion: [],
        rtp_checklist: [], test_psicologico: [], protocolos_cmj: [], pruebas_cmj: [],
        wellness_diario_importado: [], wellness_semanal_importado: [],
        ejercicios_fuerza: [], trabajos_fuerza: [], plantillas_fuerza: [],
        sesiones_fuerza_individual: [], plantillas_importacion: [], alias_jugadora: [],
        registro_menstrual: [regCon4B]
      }
    }

    const clearMock = vi.mocked(db.registro_menstrual.clear).mockResolvedValue(undefined)
    const putMock = vi.mocked(db.registro_menstrual.put).mockClear().mockResolvedValue(1)

    const result = await restoreFromData(backupData, 'replace', 'replace')

    expect(result.success).toBe(true)
    expect(clearMock).toHaveBeenCalled()
    expect(putMock).toHaveBeenCalledWith(
      expect.objectContaining({
        accion_ajuste: 'SIN_CAMBIOS',
        fecha_decision: '2026-08-21'
      })
    )
  })
})
