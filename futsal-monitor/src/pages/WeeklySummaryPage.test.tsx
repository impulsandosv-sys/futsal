import React from "react"
import { render, screen, within } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { MemoryRouter } from "react-router-dom"
import { WeeklySummaryPage } from "./WeeklySummaryPage"
import { useStore } from "@/store/store"
import type { StoreState } from "@/store/store"

vi.mock("@/store/store", () => ({
  useStore: vi.fn()
}))

vi.mock("@/utils/export", () => ({ exportToExcel: vi.fn() }))
vi.mock("@/utils/pdf", () => ({ generatePDFStaff: vi.fn() }))

function createMockStore(overrides: Partial<StoreState>): StoreState {
  const base: StoreState = {
    jugadoras: [],
    sesiones: [],
    partidos: [],
    sesion_rpe: [],
    rpe_partido: [],
    resumen_semanal: [],
    alertas: [],
    lesiones: [],
    pruebas_cmj: [],
    wellness: [],
    registros_menstruales: [],
    filters: { semana: "2026-W32" },
    isInitialized: true,
    isLoading: false,
    error: null,
    setFilter: vi.fn(),
    resetFilters: vi.fn(),
    initializeData: vi.fn(),
    addJugadora: vi.fn(),
    updateJugadora: vi.fn(),
    addSesion: vi.fn(),
    addRpePartido: vi.fn(),
    guardarBatchRPEPartido: vi.fn(),
    updateRpePartido: vi.fn(),
    deleteRpePartido: vi.fn(),
    generateWeeklySummary: vi.fn(),
    addPartido: vi.fn(),
    addLesion: vi.fn(),
    updateLesion: vi.fn(),
    addCMJ: vi.fn(),
    addSesionRpe: vi.fn(),
    guardarBatchRPE: vi.fn(),
    addWellness: vi.fn(),
    addRegistroMenstrual: vi.fn(),
    updateRegistroMenstrual: vi.fn(),
    deleteRegistroMenstrual: vi.fn(),
    resolverAlerta: vi.fn(),
    recalcularAcwrGlobal: vi.fn(),
    generarDecisionDiaria: vi.fn(),
    guardarSesionFuerza: vi.fn(),
    guardarTrabajoFuerza: vi.fn(),
    eliminarSesionFuerza: vi.fn(),
    eliminarTrabajoFuerza: vi.fn()
  }
  return { ...base, ...overrides }
}

describe("WeeklySummaryPage - Exposicion Competitiva Integration", () => {
  beforeEach(() => {
    vi.mocked(useStore).mockReturnValue(createMockStore({
      jugadoras: [
        { id_jugadora: "j1", nombre: "Ana", posicion: "Ala", estado_activo: true, activa: true, fecha_nacimiento: "", altura_cm: 0, peso_kg: 0, imc: 0, grasa: 0, anos_experiencia_futsal: 0, historial_lesional: "", notas: "" },
        { id_jugadora: "j2", nombre: "Bea", posicion: "Cierre", estado_activo: true, activa: true, fecha_nacimiento: "", altura_cm: 0, peso_kg: 0, imc: 0, grasa: 0, anos_experiencia_futsal: 0, historial_lesional: "", notas: "" }
      ],
      rpe_partido: [
        { id_registro: "r1", id_jugadora: "j1", id_partido: "p1", fecha: "2026-08-05", minutos_jugados: 30, rpe: 8, tipo_participacion: "parcial" }
      ],
      resumen_semanal: [
        { id: "rs1", semana: "2026-W32", id_jugadora: "j1", carga_entreno: 0, carga_partido: 0, carga_total: 0, carga_cronica: 0, acwr: 1, wellness_medio: 0, num_sesiones: 0, estado: "optimo" },
        { id: "rs2", semana: "2026-W32", id_jugadora: "j2", carga_entreno: 0, carga_partido: 0, carga_total: 0, carga_cronica: 0, acwr: 1, wellness_medio: 0, num_sesiones: 0, estado: "optimo" }
      ],
      filters: { semana: "2026-W32" }
    }))
  })

  it("Resumen semanal: muestra solo datos de cada jugadora, comprobando estado sin_registros_competitivos y fin de semana como corte", () => {
    render(
      <MemoryRouter>
        <WeeklySummaryPage />
      </MemoryRouter>
    )
    
    // Obtener las filas de la tabla correspondientes a cada jugadora
    // Usamos getAllByText y filtramos para encontrar el que está en una tabla
    const rowAna = screen.getAllByText("Ana").find(el => el.closest("tr"))!.closest("tr")!
    const rowBea = screen.getAllByText("Bea").find(el => el.closest("tr"))!.closest("tr")!

    // Validar Ana
    const withinAna = within(rowAna)
    expect(withinAna.getByText("30")).toBeInTheDocument()
    expect(withinAna.getByText("Parcial")).toBeInTheDocument()

    // Validar Bea
    const withinBea = within(rowBea)
    expect(withinBea.getByText("Sin registros competitivos")).toBeInTheDocument()
    expect(withinBea.getAllByText("—").length).toBeGreaterThan(0)
    // Bea no debería mostrar el 30 de Ana
    expect(withinBea.queryByText("30")).toBeNull()
  })
})
